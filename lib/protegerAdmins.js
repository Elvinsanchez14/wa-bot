// lib/protegerAdmins.js
// Comando !protegeradmins on/off: al activarse, toma una "foto" de quiénes son
// admin del grupo EN ESE MOMENTO y los guarda como lista autorizada. De ahí en
// adelante, si alguien nuevo aparece como admin sin estar en esa lista (por
// error o mala intención de otro admin), el bot lo degrada automáticamente
// y avisa en el grupo -- previene que alguien "por accidente" le dé admin a
// quien no debía y esa persona alcance a hacer daño antes de que se note.

const db = require('./db');

/**
 * Activa la protección: guarda la lista actual de admins como la lista
 * autorizada para este grupo, y marca la protección como activa.
 */
async function activarProteccion(sock, grupoId, sender) {
  let meta;
  try {
    meta = await sock.groupMetadata(grupoId);
  } catch (e) {
    console.log('No se pudo leer metadata del grupo para proteger admins:', e.message);
    await sock.sendMessage(grupoId, { text: '❌ No pude leer la lista de admins actuales. Intenta de nuevo.' });
    return;
  }

  const adminsActuales = meta.participants
    .filter((p) => p.admin === 'admin' || p.admin === 'superadmin')
    .map((p) => p.id);

  db.setConfig(grupoId, 'admins_autorizados', JSON.stringify(adminsActuales));
  db.setConfig(grupoId, 'proteccion_admins', 'true');
  db.agregarLog(grupoId, 'proteccion_admins_activada', null, sender, `${adminsActuales.length} admins autorizados`);

  const lista = adminsActuales.map((jid) => `@${jid.split('@')[0]}`).join(', ');
  await sock.sendMessage(grupoId, {
    text: `🛡️ *Protección de admins activada*\n\nAdmins autorizados: ${lista}\n\nSi alguien más es promovido a admin sin estar en esta lista, será degradado automáticamente.`,
    mentions: adminsActuales,
  });
}

async function desactivarProteccion(sock, grupoId, sender) {
  db.setConfig(grupoId, 'proteccion_admins', 'false');
  db.agregarLog(grupoId, 'proteccion_admins_desactivada', null, sender, '');
  await sock.sendMessage(grupoId, { text: '🛡️ Protección de admins desactivada.' });
}

async function comandoProtegerAdmins(sock, grupoId, sender, valor) {
  if (valor === 'on') {
    await activarProteccion(sock, grupoId, sender);
  } else if (valor === 'off') {
    await desactivarProteccion(sock, grupoId, sender);
  } else {
    const activa = db.getConfig(grupoId, 'proteccion_admins') === 'true';
    await sock.sendMessage(grupoId, {
      text: `🛡️ Protección de admins: ${activa ? 'activada' : 'desactivada'}.\n\nUso: !protegeradmins on / off`,
    });
  }
}

/**
 * Se llama desde el evento group-participants.update de index.js cuando la
 * acción es 'promote'. Revisa si el/los promovidos están autorizados; si no,
 * los degrada de inmediato y avisa.
 */
async function manejarPromocion(sock, grupoId, participantesPromovidos) {
  const proteccionActiva = db.getConfig(grupoId, 'proteccion_admins') === 'true';
  if (!proteccionActiva) return;

  const autorizadosRaw = db.getConfig(grupoId, 'admins_autorizados');
  let autorizados = [];
  try {
    autorizados = JSON.parse(autorizadosRaw || '[]');
  } catch (e) {
    autorizados = [];
  }

  const noAutorizados = participantesPromovidos.filter((jid) => !autorizados.includes(jid));
  if (!noAutorizados.length) return;

  try {
    await sock.groupParticipantsUpdate(grupoId, noAutorizados, 'demote');
  } catch (e) {
    console.log('No se pudo revertir promoción no autorizada:', e.message);
    return;
  }

  for (const jid of noAutorizados) {
    db.agregarLog(grupoId, 'promocion_revertida', jid, 'sistema', 'No estaba en la lista de admins autorizados');
  }

  const nombres = noAutorizados.map((jid) => `@${jid.split('@')[0]}`).join(', ');
  await sock.sendMessage(grupoId, {
    text: `🚨 *Promoción no autorizada revertida*\n\n${nombres} fue degradado automáticamente por no estar en la lista de admins autorizados.\n\nUsa !protegeradmins on de nuevo si quieres actualizar la lista.`,
    mentions: noAutorizados,
  });
}

module.exports = { comandoProtegerAdmins, manejarPromocion };
