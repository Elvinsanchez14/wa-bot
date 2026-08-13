// lib/monitoreo.js
// Vigila cuántas veces se reconecta el bot en poco tiempo. Si reconecta
// demasiado seguido (señal de conexión inestable), te avisa por mensaje
// privado a ti (super admin) para que lo sepas sin tener que revisar la consola.

const VENTANA_MS = 10 * 60 * 1000; // 10 minutos
const UMBRAL_RECONEXIONES = 3; // si reconecta 3+ veces en la ventana, avisa
const COOLDOWN_NOTIFICACION_MS = 15 * 60 * 1000; // no repetir el aviso antes de 15 min

let historialReconexiones = [];
let ultimaNotificacion = 0;

/**
 * Se llama cada vez que el bot se reconecta (en el evento connection.update de index.js).
 * Si detecta reconexiones excesivas, notifica por privado al primer super admin de la lista.
 */
async function registrarReconexion(sock, superAdmins, motivo) {
  const ahora = Date.now();
  historialReconexiones.push(ahora);
  historialReconexiones = historialReconexiones.filter((t) => ahora - t <= VENTANA_MS);

  if (historialReconexiones.length < UMBRAL_RECONEXIONES) return;
  if (ahora - ultimaNotificacion < COOLDOWN_NOTIFICACION_MS) return; // evita spamear al admin

  ultimaNotificacion = ahora;
  const destinatario = superAdmins[0];
  if (!destinatario) return;

  try {
    await sock.sendMessage(destinatario, {
      text:
        `⚠️ *Aviso del bot*\n\n` +
        `El bot se ha reconectado ${historialReconexiones.length} veces en los últimos ` +
        `${VENTANA_MS / 60000} minutos (último motivo: ${motivo}).\n\n` +
        `Esto puede indicar una conexión inestable. Revisa la consola de Termux si sigue pasando.`,
    });
  } catch (e) {
    // Si ni siquiera esto se puede enviar, solo lo dejamos en consola —
    // no tiene caso reintentar una notificación sobre problemas de conexión
    // usando la misma conexión que está fallando.
    console.log('No se pudo notificar al super admin sobre reconexiones:', e.message);
  }
}

module.exports = { registrarReconexion };
