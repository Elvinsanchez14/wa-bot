// lib/kai.js
// Bloque 6: lógica de activación de Kai, el bot conversacional.
// Kai responde en dos casos, sin necesidad de repetir su nombre cada vez:
// 1. Le hablan directo mencionando su nombre ("Kai, ...", "oye kai", etc.)
// 2. Citan/responden un mensaje anterior que Kai mismo mandó
//
// Guardamos en memoria qué IDs de mensaje son "de Kai" para poder detectar el caso 2.

const { generarRespuesta } = require('./kaiFrases');

const NOMBRE_KAI = 'kai';

// Recuerda los últimos mensajes que Kai mandó, por grupo, para detectar citas.
// Se limita el tamaño para no crecer sin límite en una conversación muy larga.
const mensajesDeKai = new Map(); // grupoId -> Set de message IDs
const LIMITE_MENSAJES_RECORDADOS = 50;

function recordarMensajeDeKai(grupoId, messageId) {
  if (!mensajesDeKai.has(grupoId)) mensajesDeKai.set(grupoId, new Set());
  const set = mensajesDeKai.get(grupoId);
  set.add(messageId);
  if (set.size > LIMITE_MENSAJES_RECORDADOS) {
    const primero = set.values().next().value;
    set.delete(primero);
  }
}

function esRespuestaAKai(grupoId, msg) {
  const contexto = msg.message?.extendedTextMessage?.contextInfo;
  const idCitado = contexto?.stanzaId;
  if (!idCitado) return false;
  const set = mensajesDeKai.get(grupoId);
  return set ? set.has(idCitado) : false;
}

function loMencionaronPorNombre(texto) {
  return texto.toLowerCase().includes(NOMBRE_KAI);
}

/**
 * Revisa si Kai debe responder a este mensaje, y si es así, genera y envía la respuesta.
 * Devuelve true si Kai respondió (para que index.js sepa que ya se manejó el mensaje).
 */
async function manejarKai(sock, grupoId, sender, msg, texto) {
  if (!texto || !texto.trim()) return false;

  const debeResponder = loMencionaronPorNombre(texto) || esRespuestaAKai(grupoId, msg);
  if (!debeResponder) return false;

  const respuesta = generarRespuesta(texto);
  const resultado = await sock.sendMessage(grupoId, { text: respuesta });

  // Guardamos el ID del mensaje que Kai acaba de mandar, para poder detectar
  // si alguien le responde citándolo, sin que tenga que volver a decir "Kai".
  if (resultado?.key?.id) {
    recordarMensajeDeKai(grupoId, resultado.key.id);
  }

  return true;
}

module.exports = { manejarKai };
