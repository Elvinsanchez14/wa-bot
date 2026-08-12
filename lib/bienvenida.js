// lib/bienvenida.js
// Bloque 2, parte 1: registra usuarios nuevos y les manda mensaje de bienvenida con las reglas.

const db = require('./db');

/**
 * Maneja el evento group-participants.update de Baileys.
 * Se llama desde index.js pasándole el sock y el update recibido.
 */
async function manejarCambioParticipantes(sock, update) {
  const { id: grupoId, participants, action } = update;

  if (action === 'add') {
    for (const jid of participants) {
      db.registrarEntrada(jid, grupoId);
      db.agregarLog(grupoId, 'entrada', jid, 'sistema', 'Usuario se unió al grupo');

      const reglas = db.getConfig(grupoId, 'reglas_texto');
      const toleranciaMin = db.getConfig(grupoId, 'tolerancia_inactividad_min');
      const nombre = jid.split('@')[0];

      try {
        await sock.sendMessage(grupoId, {
          text:
            `👋 ¡Bienvenido/a @${nombre}!\n\n` +
            `*Reglas del grupo:*\n${reglas}\n\n` +
            `⏱️ Tienes ${toleranciaMin} minutos para participar o podrías ser expulsado automáticamente por inactividad.`,
          mentions: [jid],
        });
      } catch (e) {
        console.log('No se pudo enviar mensaje de bienvenida:', e.message);
      }
    }
  }

  if (action === 'remove') {
    // Alguien salió o fue expulsado (por el bot o manualmente).
    // No borramos su registro aquí porque podría haber sido un kick nuestro
    // que ya limpia el registro por su cuenta (ver avisarYExpulsar en index.js).
    // Si salió por su cuenta, dejamos el registro — no estorba y sirve de historial.
  }
}

/**
 * Se llama cada vez que llega un mensaje de texto en un grupo.
 * Marca al usuario como "ya habló" para que no aplique el auto-kick por inactividad.
 */
function registrarActividad(jid, grupoId) {
  const usuario = db.obtenerUsuario(jid, grupoId);
  if (usuario && !usuario.ha_hablado) {
    db.marcarHabloYaVez(jid, grupoId);
  } else if (!usuario) {
    // Por si el bot arrancó después de que el usuario ya estaba en el grupo:
    // lo registramos igual, ya marcado como que habló, para no expulsarlo luego por error.
    db.registrarEntrada(jid, grupoId);
    db.marcarHabloYaVez(jid, grupoId);
  }
}

module.exports = { manejarCambioParticipantes, registrarActividad };
