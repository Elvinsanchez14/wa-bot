// lib/sticker.js
// Bloque 5, parte 2: comando !sticker, disponible para todos los participantes.
//
// HISTORIAL TÉCNICO (por qué está hecho así):
// 1er intento: "sharp" -> requiere compilar libvips nativo, falla en Termux/arm64.
// 2do intento: "wa-sticker-formatter" -> por debajo también usa "sharp", mismo problema.
// Solución final: llamar a ffmpeg DIRECTAMENTE como proceso externo (no como
// librería de Node). ffmpeg se instala limpio en Termux con "pkg install ffmpeg"
// y no requiere ninguna compilación de código nativo de Node — es un programa
// aparte que Node solo invoca.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

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

  if (!citado || !citado.imageMessage) {
    await sock.sendMessage(grupoId, {
      text: '⚠️ Responde a una imagen con !sticker para convertirla.',
    });
    return;
  }

  const tmpDir = os.tmpdir();
  const idUnico = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const rutaEntrada = path.join(tmpDir, `sticker_in_${idUnico}.jpg`);
  const rutaSalida = path.join(tmpDir, `sticker_out_${idUnico}.webp`);

  try {
    const buffer = await downloadMediaMessage(
      { message: citado, key: { remoteJid: grupoId, id: contexto.stanzaId, fromMe: false } },
      'buffer',
      {}
    );

    fs.writeFileSync(rutaEntrada, buffer);

    // Redimensiona a 512x512 manteniendo proporción, con fondo transparente, formato webp
    await ejecutarFfmpeg([
      '-i', rutaEntrada,
      '-vf', "scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000",
      '-y', rutaSalida,
    ]);

    const webpBuffer = fs.readFileSync(rutaSalida);
    await sock.sendMessage(grupoId, { sticker: webpBuffer });
  } catch (e) {
    console.log('Error al generar sticker:', e.message);
    await sock.sendMessage(grupoId, {
      text: '❌ No pude generar el sticker. Intenta con otra imagen.',
    });
  } finally {
    // Limpieza de archivos temporales, sin importar si hubo error o no
    try { fs.unlinkSync(rutaEntrada); } catch (_) {}
    try { fs.unlinkSync(rutaSalida); } catch (_) {}
  }
}

module.exports = { manejarComandoSticker };
 
