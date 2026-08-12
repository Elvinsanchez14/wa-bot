// lib/sticker.js
// Bloque 5, parte 2: comando !sticker, disponible para todos los participantes,
// no solo admins. Convierte una imagen citada (respondida) a formato de sticker.
//
// Requiere la librería "sharp" para la conversión a webp. A diferencia de
// better-sqlite3, sharp normalmente sí tiene binarios precompilados para
// Android/arm64, pero si falla la instalación en Termux, avisamos aquí abajo
// cómo resolverlo o cómo desactivar este módulo sin romper el resto del bot.

const sharp = require('sharp');

async function manejarComandoSticker(sock, grupoId, sender, msg) {
  const contexto = msg.message?.extendedTextMessage?.contextInfo;
  const citado = contexto?.quotedMessage;

  if (!citado || !citado.imageMessage) {
    await sock.sendMessage(grupoId, {
      text: '⚠️ Responde a una imagen con !sticker para convertirla.',
    });
    return;
  }

  try {
    // Descargamos el buffer de la imagen citada usando el downloadMediaMessage de Baileys
    const { downloadMediaMessage } = require('@whiskeysockets/baileys');
    const buffer = await downloadMediaMessage(
      { message: citado, key: { remoteJid: grupoId, id: contexto.stanzaId, fromMe: false } },
      'buffer',
      {}
    );

    const webpBuffer = await sharp(buffer)
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp()
      .toBuffer();

    await sock.sendMessage(grupoId, {
      sticker: webpBuffer,
    });
  } catch (e) {
    console.log('Error al generar sticker:', e.message);
    await sock.sendMessage(grupoId, {
      text: '❌ No pude generar el sticker. Intenta con otra imagen.',
    });
  }
}

module.exports = { manejarComandoSticker };
