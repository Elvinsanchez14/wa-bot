// lib/antispam.js
// Bloque 3: antilink por repetición, antispam/flood, antimención masiva.
//
// Todo esto se vigila en memoria (no en la base de datos) porque son ventanas
// de tiempo muy cortas (segundos) — no tiene sentido persistirlo a disco.
// Si el bot se reinicia, el conteo en memoria se resetea, lo cual está bien:
// no queremos castigar a alguien por un patrón de hace horas.

const db = require('./db');

// Estructura en memoria: { "grupoId|jid": { ...datos de seguimiento } }
const seguimientoLinks = new Map();
const seguimientoFlood = new Map();

const LINK_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
const VENTANA_LINK_REPETIDO_MS = 60 * 1000; // 60 segundos entre links iguales para que cuenten como "seguidos"

function clave(grupoId, jid) {
  return `${grupoId}|${jid}`;
}

/**
 * Revisa si el mensaje contiene el mismo link repetido 3 veces seguidas.
 * Devuelve true si se debe expulsar (y ya se encargó de avisar+expulsar).
 */
async function revisarAntilink(sock, grupoId, jid, msg, texto, avisarYExpulsar) {
  const links = texto.match(LINK_REGEX);
  if (!links || !links.length) return false;

  const linkActual = links[0].toLowerCase();
  const key = clave(grupoId, jid);
  const ahora = Date.now();
  const registro = seguimientoLinks.get(key);

  let contador = 1;
  if (registro && registro.link === linkActual && ahora - registro.ultimaVez <= VENTANA_LINK_REPETIDO_MS) {
    contador = registro.contador + 1;
  }

  seguimientoLinks.set(key, { link: linkActual, contador, ultimaVez: ahora });

  if (contador >= 3) {
    // Borra el mensaje que disparó el límite
    try {
      await sock.sendMessage(grupoId, { delete: msg.key });
    } catch (e) {
      console.log('No se pudo borrar mensaje de link repetido:', e.message);
    }

    const nombre = jid.split('@')[0];
    const mensaje = `🚫 @${nombre}, enviaste el mismo enlace repetidamente (spam). Serás expulsado.`;
    await avisarYExpulsar(sock, grupoId, jid, mensaje);

    seguimientoLinks.delete(key); // limpia el registro, ya se resolvió
    return true;
  }

  return false;
}

/**
 * Revisa si el usuario está mandando mensajes en ráfaga (flood).
 * Si excede el límite, borra el mensaje y aplica un warning (no kick directo).
 */
async function revisarFlood(sock, grupoId, jid, msg) {
  const maxMensajes = parseInt(db.getConfig(grupoId, 'flood_max_mensajes'), 10);
  const ventanaSeg = parseInt(db.getConfig(grupoId, 'flood_ventana_seg'), 10);

  const key = clave(grupoId, jid);
  const ahora = Date.now();
  const registro = seguimientoFlood.get(key) || { timestamps: [] };

  // Solo nos quedamos con los timestamps dentro de la ventana activa
  registro.timestamps = registro.timestamps.filter((t) => ahora - t <= ventanaSeg * 1000);
  registro.timestamps.push(ahora);
  seguimientoFlood.set(key, registro);

  if (registro.timestamps.length >= maxMensajes) {
    try {
      await sock.sendMessage(grupoId, { delete: msg.key });
    } catch (e) {
      console.log('No se pudo borrar mensaje de flood:', e.message);
    }

    db.agregarWarning(jid, grupoId, 'Flood (mensajes en ráfaga)', 'sistema');
    db.agregarLog(grupoId, 'warning_flood', jid, 'sistema', `${registro.timestamps.length} mensajes en ${ventanaSeg}s`);

    const nombre = jid.split('@')[0];
    await sock.sendMessage(grupoId, {
      text: `⚠️ @${nombre}, estás enviando mensajes demasiado rápido. Se te aplicó una advertencia.`,
      mentions: [jid],
    });

    seguimientoFlood.delete(key); // reinicia el conteo tras aplicar la sanción
    return true;
  }

  return false;
}

/**
 * Revisa si el mensaje menciona a demasiadas personas de golpe.
 */
async function revisarAntimencion(sock, grupoId, jid, msg) {
  const maxMenciones = parseInt(db.getConfig(grupoId, 'antimencion_max'), 10);
  const mencionados = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

  if (mencionados.length >= maxMenciones) {
    try {
      await sock.sendMessage(grupoId, { delete: msg.key });
    } catch (e) {
      console.log('No se pudo borrar mensaje de antimención:', e.message);
    }

    db.agregarWarning(jid, grupoId, 'Mención masiva', 'sistema');
    db.agregarLog(grupoId, 'warning_antimencion', jid, 'sistema', `${mencionados.length} menciones`);

    const nombre = jid.split('@')[0];
    await sock.sendMessage(grupoId, {
      text: `⚠️ @${nombre}, mencionaste a demasiadas personas de golpe. Se te aplicó una advertencia.`,
      mentions: [jid],
    });

    return true;
  }

  return false;
}

module.exports = { revisarAntilink, revisarFlood, revisarAntimencion };
