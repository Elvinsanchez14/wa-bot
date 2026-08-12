// lib/sticker.js
// Bloque 5, parte 2: comando !sticker, disponible para todos los participantes.
//
// NOTA TÉCNICA: originalmente esto usaba "sharp", pero sharp requiere compilar
// libvips nativo y eso falla en Termux/Android (arm64) sin binarios precompilados.
// Se reemplazó por "wa-sticker-formatter", que usa ffmpeg por debajo — ffmpeg sí
// se instala limpio en Termux vía "pkg install ffmpeg", sin compilar nada en Node.

const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

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
    const buffer = await downloadMediaMessage(
      { message: citado, key: { remoteJid: grupoId, id: contexto.stanzaId, fromMe: false } },
      'buffer',
      {}
    );

    const sticker = new Sticker(buffer, {
      pack: 'wa-bot',
      author: 'wa-bot',
      type: StickerTypes.FULL,
      quality: 70,
    });

    const webpBuffer = await sticker.toBuffer();

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
 
