// lib/limpiar.js
// Comando !clear: borra los últimos N mensajes del grupo.
//
// LIMITACIÓN IMPORTANTE DE WHATSAPP: el bot solo puede borrar mensajes que
// él mismo mandó directamente, salvo que sea admin del grupo (en cuyo caso
// puede borrar los de cualquiera, pero solo dentro de una ventana de tiempo
// que WhatsApp controla del lado del servidor, no algo que podamos ajustar
// desde aquí). Por eso este comando funciona mejor mientras más reciente sea
// el mensaje, y puede fallar silenciosamente en mensajes muy viejos.
//
// Mantenemos en memoria un registro de los últimos mensajes vistos por grupo,
// para poder ubicarlos y pedir su borrado.

const HISTORIAL_MAXIMO = 200; // cuántos mensajes recientes recordamos por grupo

const historialMensajes = new Map(); // grupoId -> array de {key} en orden cronológico

function registrarMensajeParaClear(grupoId, msg) {
  if (!historialMensajes.has(grupoId)) historialMensajes.set(grupoId, []);
  const historial = historialMensajes.get(grupoId);
  historial.push(msg.key);
  if (historial.length > HISTORIAL_MAXIMO) {
    historial.shift();
  }
}

async function comandoClear(sock, grupoId, cantidad = 20) {
  const historial = historialMensajes.get(grupoId) || [];
  const aBorrar = historial.slice(-cantidad);

  if (!aBorrar.length) {
    await sock.sendMessage(grupoId, { text: 'No tengo mensajes recientes registrados para borrar.' });
    return;
  }

  let borrados = 0;
  for (const key of aBorrar) {
    try {
      await sock.sendMessage(grupoId, { delete: key });
      borrados++;
    } catch (e) {
      // Fallo esperado en mensajes viejos o fuera del alcance de borrado de WhatsApp;
      // seguimos con el resto en vez de detenernos por uno solo.
    }
  }

  // Quitamos del historial los que sí se lograron borrar (evita reintentar sobre ellos después)
  historialMensajes.set(grupoId, historial.filter((k) => !aBorrar.includes(k)));

  await sock.sendMessage(grupoId, {
    text: `🧹 Se borraron ${borrados} de ${aBorrar.length} mensajes solicitados.`,
  });
}

module.exports = { registrarMensajeParaClear, comandoClear };
 
