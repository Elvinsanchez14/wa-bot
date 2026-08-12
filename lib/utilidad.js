// lib/utilidad.js
// Bloque 5, parte 1: comandos de utilidad para la comunidad y limpieza manual.
// Se integra con el sistema de comandos existente (lib/comandos.js las importa y usa).

const db = require('./db');

// Contador de mensajes por usuario para el !top, en memoria (se resetea si el bot se reinicia).
// Si más adelante quieres que persista, se puede mover a un archivo JSON como los demás datos.
const contadorMensajes = new Map(); // "grupoId|jid" -> cantidad

function registrarMensajeParaTop(grupoId, jid) {
  const key = `${grupoId}|${jid}`;
  contadorMensajes.set(key, (contadorMensajes.get(key) || 0) + 1);
}

function obtenerTop(grupoId, cantidad = 10) {
  const entradas = [...contadorMensajes.entries()]
    .filter(([key]) => key.startsWith(`${grupoId}|`))
    .map(([key, count]) => ({ jid: key.split('|')[1], count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, cantidad);
  return entradas;
}

async function comandoInfo(sock, grupoId, sender, objetivo) {
  const jidConsulta = objetivo || sender;
  const usuario = db.obtenerUsuario(jidConsulta, grupoId);
  const warnings = db.contarWarnings(jidConsulta, grupoId);
  const nombre = jidConsulta.split('@')[0];

  if (!usuario) {
    await sock.sendMessage(grupoId, {
      text: `No tengo información registrada de @${nombre} todavía.`,
      mentions: [jidConsulta],
    });
    return;
  }

  const diasEnGrupo = Math.floor((Date.now() - usuario.fecha_entrada) / (1000 * 60 * 60 * 24));
  const key = `${grupoId}|${jidConsulta}`;
  const mensajesEnviados = contadorMensajes.get(key) || 0;

  await sock.sendMessage(grupoId, {
    text:
      `ℹ️ *Info de @${nombre}*\n\n` +
      `📅 Días en el grupo: ${diasEnGrupo}\n` +
      `💬 Ha hablado: ${usuario.ha_hablado ? 'Sí' : 'No'}\n` +
      `✉️ Mensajes registrados: ${mensajesEnviados}\n` +
      `⚠️ Advertencias: ${warnings}`,
    mentions: [jidConsulta],
  });
}

async function comandoTop(sock, grupoId) {
  const top = obtenerTop(grupoId, 10);
  if (!top.length) {
    await sock.sendMessage(grupoId, { text: 'Todavía no hay datos suficientes para el ranking.' });
    return;
  }
  const lista = top
    .map((e, i) => `${i + 1}. @${e.jid.split('@')[0]} — ${e.count} mensajes`)
    .join('\n');
  await sock.sendMessage(grupoId, {
    text: `🏆 *Top participantes*\n\n${lista}`,
    mentions: top.map((e) => e.jid),
  });
}

async function comandoPurga(sock, grupoId, sender, avisarYExpulsar) {
  const dias = parseInt(db.getConfig(grupoId, 'purga_dias_inactivo'), 10);
  const inactivos = db.usuariosInactivosViejos(grupoId, dias);

  if (!inactivos.length) {
    await sock.sendMessage(grupoId, { text: `No hay usuarios inactivos por más de ${dias} días.` });
    return;
  }

  await sock.sendMessage(grupoId, {
    text: `🧹 Iniciando purga de ${inactivos.length} usuario(s) inactivo(s) por más de ${dias} días...`,
  });

  for (const usuario of inactivos) {
    const nombre = usuario.jid.split('@')[0];
    const mensaje = `🧹 @${nombre}, fuiste removido por inactividad prolongada (más de ${dias} días).`;
    db.agregarLog(grupoId, 'purga', usuario.jid, sender, `Inactivo por ${dias}+ días`);
    await avisarYExpulsar(sock, grupoId, usuario.jid, mensaje, 3);
  }
}

// ---- Modo silencio ----
// Guardado en config, así que persiste igual que las demás configuraciones por grupo.
async function comandoSilencio(sock, grupoId, sender, valor) {
  if (valor !== 'on' && valor !== 'off') {
    await sock.sendMessage(grupoId, { text: '⚠️ Uso: !silencio on  ó  !silencio off' });
    return;
  }
  db.setConfig(grupoId, 'modo_silencio', valor === 'on' ? 'true' : 'false');
  db.agregarLog(grupoId, 'modo_silencio', null, sender, valor);

  try {
    // groupSettingUpdate 'announcement' = solo admins pueden escribir
    await sock.groupSettingUpdate(grupoId, valor === 'on' ? 'announcement' : 'not_announcement');
  } catch (e) {
    console.log('No se pudo cambiar el ajuste nativo del grupo:', e.message);
  }

  await sock.sendMessage(grupoId, {
    text: valor === 'on' ? '🔇 Modo silencio activado. Solo admins pueden hablar.' : '🔊 Modo silencio desactivado.',
  });
}

module.exports = {
  registrarMensajeParaTop,
  comandoInfo,
  comandoTop,
  comandoPurga,
  comandoSilencio,
};
