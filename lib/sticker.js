// lib/sticker.js
// Comando !sticker, disponible para todos los participantes.
// Soporta tanto imágenes (sticker estático) como videos cortos/gifs (sticker animado).
//
// HISTORIAL TÉCNICO (por qué está hecho así):
// 1er intento: "sharp" -> requiere compilar libvips nativo, falla en Termux/arm64.
// 2do intento: "wa-sticker-formatter" -> por debajo también usa "sharp", mismo problema.
// Solución final: llamar a ffmpeg DIRECTAMENTE como proceso externo (no como
// librería de Node). ffmpeg se instala limpio en Termux con "pkg install ffmpeg"
// y no requiere ninguna compilación de código nativo de Node.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const DURACION_MAXIMA_SEG = 6; // WhatsApp limita los stickers animados a ~6 segundos
const FILTRO_ESCALA_PAD =
  "scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000";

function ejecutarFfmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolve();
    });
  });
}

async function manejarComandoSticker(sock, grupoId, sender, msg) {
  const contexto = msg.message?.extendedTextMessage?.contextInfo;
  const citado = contexto?.quotedMessage;

  const esImagen = !!citado?.imageMessage;
  const esVideo = !!citado?.videoMessage;

  if (!citado || (!esImagen && !esVideo)) {
    await sock.sendMessage(grupoId, {
      text: '⚠️ Responde a una imagen o un video corto con !sticker para convertirlo.',
    });
    return;
  }

  const tmpDir = os.tmpdir();
  const idUnico = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const extEntrada = esVideo ? 'mp4' : 'jpg';
  const rutaEntrada = path.join(tmpDir, `sticker_in_${idUnico}.${extEntrada}`);
  const rutaSalida = path.join(tmpDir, `sticker_out_${idUnico}.webp`);

  try {
    const buffer = await downloadMediaMessage(
      { message: citado, key: { remoteJid: grupoId, id: contexto.stanzaId, fromMe: false } },
      'buffer',
      {}
    );

    fs.writeFileSync(rutaEntrada, buffer);

    if (esVideo) {
      // Sticker animado: recorta a máx. 6s, reduce a ~10fps (limita tamaño del archivo,
      // WhatsApp rechaza stickers animados muy pesados), y aplica el mismo escalado/pad.
      await ejecutarFfmpeg([
        '-i', rutaEntrada,
        '-t', String(DURACION_MAXIMA_SEG),
        '-vf', `${FILTRO_ESCALA_PAD},fps=10`,
        '-loop', '0',
        '-an', // sin audio, los stickers de WhatsApp no llevan sonido
        '-y', rutaSalida,
      ]);
    } else {
      // Sticker estático: solo escala y agrega el padding cuadrado
      await ejecutarFfmpeg([
        '-i', rutaEntrada,
        '-vf', FILTRO_ESCALA_PAD,
        '-y', rutaSalida,
      ]);
    }

    const webpBuffer = fs.readFileSync(rutaSalida);
    await sock.sendMessage(grupoId, { sticker: webpBuffer });
  } catch (e) {
    console.log('Error al generar sticker:', e.message);
    await sock.sendMessage(grupoId, {
      text: '❌ No pude generar el sticker. Intenta con otro archivo (o uno más corto/liviano).',
    });
  } finally {
    // Limpieza de archivos temporales, sin importar si hubo error o no
    try { fs.unlinkSync(rutaEntrada); } catch (_) {}
    try { fs.unlinkSync(rutaSalida); } catch (_) {}
  }
}

function ejecutarComando(comando, args) {
  return new Promise((resolve, reject) => {
    execFile(comando, args, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolve();
    });
  });
}

/**
 * Comando !toimg: convierte un sticker citado de vuelta a imagen (o video, si el
 * sticker era animado). WhatsApp guarda los stickers como webp.
 *
 * NOTA TÉCNICA: ffmpeg genera los webp de sticker con el encoder "libwebp_anim"
 * (contenedor animado, incluso para 1 solo frame), y su propio decodificador a
 * veces falla al leerlos de vuelta ("Invalid data found when processing input").
 * Por eso, para el caso estático usamos "dwebp" (parte del paquete "webp" de
 * Termux/Ubuntu: pkg install webp), que decodifica ese mismo formato sin problema.
 * Si dwebp no está disponible, caemos de nuevo a ffmpeg como respaldo.
 */
async function manejarComandoAImagen(sock, grupoId, sender, msg) {
  const contexto = msg.message?.extendedTextMessage?.contextInfo;
  const citado = contexto?.quotedMessage;
  const esSticker = !!citado?.stickerMessage;

  if (!citado || !esSticker) {
    await sock.sendMessage(grupoId, {
      text: '⚠️ Responde a un sticker con !toimg para convertirlo a imagen.',
    });
    return;
  }

  const esAnimado = !!citado.stickerMessage.isAnimated;
  const tmpDir = os.tmpdir();
  const idUnico = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const rutaEntrada = path.join(tmpDir, `toimg_in_${idUnico}.webp`);
  // Si el sticker es animado, lo devolvemos como mp4 (para conservar el movimiento);
  // si es estático, lo devolvemos como png.
  const extSalida = esAnimado ? 'mp4' : 'png';
  const rutaSalida = path.join(tmpDir, `toimg_out_${idUnico}.${extSalida}`);

  try {
    const buffer = await downloadMediaMessage(
      { message: citado, key: { remoteJid: grupoId, id: contexto.stanzaId, fromMe: false } },
      'buffer',
      {}
    );

    fs.writeFileSync(rutaEntrada, buffer);

    if (esAnimado) {
      await ejecutarFfmpeg([
        '-i', rutaEntrada,
        '-movflags', 'faststart',
        '-pix_fmt', 'yuv420p',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // asegura dimensiones pares, requisito de h264
        '-y', rutaSalida,
      ]);
      const videoBuffer = fs.readFileSync(rutaSalida);
      await sock.sendMessage(grupoId, { video: videoBuffer, caption: '' });
    } else {
      try {
        // Método principal: dwebp, decodifica el webp estático de forma confiable
        await ejecutarComando('dwebp', [rutaEntrada, '-o', rutaSalida]);
      } catch (errorDwebp) {
        // Respaldo: si dwebp no está instalado, lo intentamos con ffmpeg igual
        console.log('dwebp no disponible o falló, usando ffmpeg como respaldo:', errorDwebp.message);
        await ejecutarFfmpeg(['-i', rutaEntrada, '-y', rutaSalida]);
      }
      const imagenBuffer = fs.readFileSync(rutaSalida);
      await sock.sendMessage(grupoId, { image: imagenBuffer });
    }
  } catch (e) {
    console.log('Error al convertir sticker a imagen:', e.message);
    await sock.sendMessage(grupoId, {
      text: '❌ No pude convertir ese sticker a imagen.',
    });
  } finally {
    try { fs.unlinkSync(rutaEntrada); } catch (_) {}
    try { fs.unlinkSync(rutaSalida); } catch (_) {}
  }
}

module.exports = { manejarComandoSticker, manejarComandoAImagen };
 
