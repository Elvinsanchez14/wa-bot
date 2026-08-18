// lib/kai.js
// Bloque 6: lógica de activación de Kai, el bot conversacional.
// Kai responde en dos casos, sin necesidad de repetir su nombre cada vez:
// 1. Le hablan directo mencionando su nombre ("Kai, ...", "oye kai", etc.)
// 2. Citan/responden un mensaje anterior que Kai mismo mandó
//
// FLUJO DE RESPUESTA (en este orden):
// 1. Groq (IA) SIEMPRE se intenta primero -- así todas las respuestas de Kai
//    tienen el mismo tono natural, sin el contraste raro entre "frase fija" y
//    "respuesta de IA" que se sentía inconsistente.
// 2. Si Groq falla (sin API key, sin internet, error, timeout) -> banco de
//    frases fijo como respaldo, para no dejar a Kai sin poder responder nada.
// 3. Si ni el banco de frases reconoce la categoría -> fallback estático genérico.
// Kai SIEMPRE responde algo, nunca se queda en silencio por un fallo de red/API.

const { intentarRespuestaFija, respuestaFallback } = require('./kaiFrases');
const { preguntarAGroq } = require('./kaiIA');

const NOMBRE_KAI = 'kai';
const MENSAJES_DE_MEMORIA = 5; // últimos N intercambios que se le pasan a Groq como contexto

// Recuerda los últimos mensajes que Kai mandó, por grupo, para detectar citas.
const mensajesDeKai = new Map(); // grupoId -> Set de message IDs
const LIMITE_MENSAJES_RECORDADOS = 50;

// Memoria corta de conversación por persona (no por grupo entero, para no mezclar
// los intercambios de distintas personas con Kai). Guarda pares {role, content}
// en formato compatible con la API de Groq.
const historialPorPersona = new Map(); // "grupoId|sender" -> array de mensajes

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

function obtenerHistorial(claveMemoria) {
  return historialPorPersona.get(claveMemoria) || [];
}

function agregarAlHistorial(claveMemoria, textoUsuario, respuestaKai) {
  const historial = obtenerHistorial(claveMemoria);
  historial.push({ role: 'user', content: textoUsuario });
  historial.push({ role: 'assistant', content: respuestaKai });

  const maxEntradas = MENSAJES_DE_MEMORIA * 2;
  const recortado = historial.slice(-maxEntradas);
  historialPorPersona.set(claveMemoria, recortado);
}

/**
 * Revisa si Kai debe responder a este mensaje, y si es así, genera y envía la respuesta.
 * Devuelve true si Kai respondió (para que index.js sepa que ya se manejó el mensaje).
 */
async function manejarKai(sock, grupoId, sender, msg, texto) {
  if (!texto || !texto.trim()) return false;

  const debeResponder = loMencionaronPorNombre(texto) || esRespuestaAKai(grupoId, msg);
  if (!debeResponder) return false;

  const claveMemoria = `${grupoId}|${sender}`;

  // Paso 1: Groq (IA) siempre se intenta primero, con el historial reciente como contexto
  const historial = obtenerHistorial(claveMemoria);
  let respuesta = await preguntarAGroq(texto, historial);

  if (respuesta) {
    // Solo guardamos en el historial las respuestas que sí vinieron de la IA --
    // las respuestas de respaldo no aportan contexto útil para futuras preguntas.
    agregarAlHistorial(claveMemoria, texto, respuesta);
  } else {
    // Paso 2: Groq falló -- probamos el banco de frases fijo como respaldo
    respuesta = intentarRespuestaFija(texto, sender);
  }

  // Paso 3: ni Groq ni el banco de frases dieron algo -- fallback estático genérico
  if (!respuesta) {
    respuesta = respuestaFallback(sender);
  }

  const resultado = await sock.sendMessage(grupoId, { text: respuesta });

  if (resultado?.key?.id) {
    recordarMensajeDeKai(grupoId, resultado.key.id);
  }

  return true;
}

module.exports = { manejarKai };
 
