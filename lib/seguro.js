// lib/seguro.js
// Envoltorios seguros para las llamadas de red más comunes a Baileys.
// Motivo: sock.sendMessage (y otras llamadas de red) pueden fallar por timeout
// (código 408) cuando la conexión está inestable. Si ese error no se atrapa,
// sube sin control y TUMBA TODO EL PROCESO — no solo la acción que falló.
// Esto pasó en producción: un timeout en !top mató el bot completo.
//
// Regla desde ahora: cualquier llamada de red a WhatsApp debe pasar por estos
// envoltorios, nunca llamarse a sock.XXX directamente sin try/catch.

async function enviarSeguro(sock, jid, contenido) {
  try {
    await sock.sendMessage(jid, contenido);
    return true;
  } catch (e) {
    console.log(`⚠️ No se pudo enviar mensaje a ${jid}:`, e.message);
    return false;
  }
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
