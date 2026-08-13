// lib/logMensajes.js
// Muestra en la consola de Termux cada mensaje que llega, con el número de quien
// lo mandó y qué tipo de contenido es (texto, sticker, imagen, audio, video, etc.).
// Es solo para depuración/visibilidad, no afecta el funcionamiento del bot.

function identificarTipo(msg) {
  const contenido = msg.message;
  if (!contenido) return null;

  if (contenido.conversation || contenido.extendedTextMessage) {
    const texto = contenido.conversation || contenido.extendedTextMessage.text;
    return { tipo: 'mensaje', detalle: texto };
  }
  if (contenido.imageMessage) return { tipo: 'foto', detalle: contenido.imageMessage.caption || '(sin texto)' };
  if (contenido.videoMessage) return { tipo: 'video', detalle: contenido.videoMessage.caption || '(sin texto)' };
  if (contenido.audioMessage) return { tipo: 'audio', detalle: contenido.audioMessage.ptt ? 'nota de voz' : 'audio' };
  if (contenido.stickerMessage) return { tipo: 'sticker', detalle: '' };
  if (contenido.documentMessage) return { tipo: 'documento', detalle: contenido.documentMessage.fileName || '' };
  if (contenido.contactMessage) return { tipo: 'contacto', detalle: contenido.contactMessage.displayName || '' };
  if (contenido.locationMessage) return { tipo: 'ubicación', detalle: '' };
  if (contenido.reactionMessage) return { tipo: 'reacción', detalle: contenido.reactionMessage.text || '' };

  return { tipo: 'otro', detalle: Object.keys(contenido)[0] || 'desconocido' };
}

function logMensaje(sender, grupoId, msg) {
  const info = identificarTipo(msg);
  if (!info) return;

  const numero = sender.split('@')[0];
  const grupoCorto = grupoId.split('@')[0].slice(-6); // últimos 6 dígitos, para no saturar la línea

  if (info.tipo === 'mensaje') {
    console.log(`💬 [grupo ...${grupoCorto}] ${numero}: "${info.detalle}"`);
  } else if (info.detalle && info.detalle !== '(sin texto)') {
    console.log(`📎 [grupo ...${grupoCorto}] ${numero}: ${info.tipo} (${info.detalle})`);
  } else {
    console.log(`📎 [grupo ...${grupoCorto}] ${numero}: ${info.tipo}`);
  }
}

module.exports = { logMensaje };
