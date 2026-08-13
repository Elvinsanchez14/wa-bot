// lib/seguro.js
// Envoltorios seguros para las llamadas de red más comunes a Baileys.
// Motivo: sock.sendMessage (y otras llamadas de red) pueden fallar por timeout
// (código 408) cuando la conexión está inestable. Si ese error no se atrapa,
// sube sin control y TUMBA TODO EL PROCESO — no solo la acción que falló.
// Esto pasó en producción: un timeout en !top mató el bot completo.
//
// Regla desde ahora: cualquier llamada de red a WhatsApp debe pasar por estos
// envoltorios, nunca llamarse a sock.XXX directamente sin try/catch.

const MAX_REINTENTOS = 2;
const ESPERA_ENTRE_REINTENTOS_MS = 2000;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envía un mensaje con reintentos automáticos ante fallos de red (timeout, etc.).
 * Si después de MAX_REINTENTOS sigue fallando, se rinde y solo lo loggea
 * (nunca deja que el error suba sin control).
 */
async function enviarSeguro(sock, jid, contenido) {
  for (let intento = 1; intento <= MAX_REINTENTOS + 1; intento++) {
    try {
      await sock.sendMessage(jid, contenido);
      return true;
    } catch (e) {
      const esUltimoIntento = intento === MAX_REINTENTOS + 1;
      if (esUltimoIntento) {
        console.log(`⚠️ No se pudo enviar mensaje a ${jid} tras ${intento} intentos:`, e.message);
        return false;
      }
      console.log(`⚠️ Fallo al enviar a ${jid} (intento ${intento}/${MAX_REINTENTOS + 1}), reintentando...`, e.message);
      await esperar(ESPERA_ENTRE_REINTENTOS_MS);
    }
  }
  return false;
}

async function ejecutarSeguro(fn, descripcion) {
  try {
    return await fn();
  } catch (e) {
    console.log(`⚠️ Error en "${descripcion}":`, e.message);
    return null;
  }
}

module.exports = { enviarSeguro, ejecutarSeguro };
