// lib/antispamNumeros.js
// Detecta patrones típicos de spam con números de teléfono sueltos, comunes en
// grupos grandes: "gana dinero, contáctame al 55-1234-5678", "invierte ya, wsp +52...".
// Se basa en reglas (regex + palabras clave), no en IA — es simple pero cubre
// el patrón más común de este tipo de spam.

const db = require('./db');

// Detecta secuencias de dígitos que parecen un número de teléfono:
// 8 a 15 dígitos seguidos, permitiendo espacios, guiones o paréntesis entre ellos.
const NUMERO_REGEX = /(\+?\d[\d\s\-().]{7,17}\d)/g;

// Palabras clave que, combinadas con un número, son casi siempre spam.
const PALABRAS_SPAM = [
  'gana dinero', 'gana ya', 'invierte', 'inversión', 'préstamo', 'prestamos',
  'contáctame', 'contactame', 'escríbeme al', 'escribeme al', 'wsp al', 'whatsapp al',
  'trabajo desde casa', 'dinero fácil', 'dinero facil', 'oportunidad única',
  'cripto', 'bitcoin', 'forex', 'trading', 'gana $', 'ganancias garantizadas',
];

function contieneNumeroSpam(texto) {
  const tieneNumero = NUMERO_REGEX.test(texto);
  if (!tieneNumero) return false;

  const textoLower = texto.toLowerCase();
  const tienePalabraClave = PALABRAS_SPAM.some((palabra) => textoLower.includes(palabra));

  return tienePalabraClave;
}

/**
 * Revisa si el mensaje es spam de número de contacto. Si lo es, borra el mensaje
 * y aplica un warning (no expulsión directa, ya que puede haber falsos positivos).
 */
async function revisarNumeroSpam(sock, grupoId, jid, msg, texto) {
  // Reseteamos el lastIndex del regex global antes de cada test, si no, falla en llamadas repetidas
  NUMERO_REGEX.lastIndex = 0;

  if (!contieneNumeroSpam(texto)) return false;

  try {
    await sock.sendMessage(grupoId, { delete: msg.key });
  } catch (e) {
    console.log('No se pudo borrar mensaje de número spam:', e.message);
  }

  db.agregarWarning(jid, grupoId, 'Posible spam de número/contacto', 'sistema');
  db.agregarLog(grupoId, 'warning_numero_spam', jid, 'sistema', texto.slice(0, 100));

  const nombre = jid.split('@')[0];
  try {
    await sock.sendMessage(grupoId, {
      text: `⚠️ @${nombre}, tu mensaje parece spam de contacto/publicidad y fue eliminado. Se te aplicó una advertencia.`,
      mentions: [jid],
    });
  } catch (e) {
    console.log('No se pudo avisar de número spam:', e.message);
  }

  return true;
}

module.exports = { revisarNumeroSpam };
