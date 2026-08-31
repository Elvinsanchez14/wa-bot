// lib/minarDb.js
// Capa de datos del sistema de minería. El perfil del jugador vive por JID
// únicamente (no por grupo) -- así el progreso es el mismo sin importar en
// qué grupo esté jugando (ej. grupo principal y grupo de respaldo comparten
// el mismo personaje). Requiere registro previo con !registrar <nombre>,
// y ese nombre de usuario es único en todo el sistema y permanente.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_JUGADORES = path.join(DATA_DIR, 'minar_jugadores.json');

function leerJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf-8').trim();
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.log(`⚠️ Error leyendo ${filePath}, se usará un arreglo vacío:`, e.message);
    return [];
  }
}

function escribirJSON(filePath, data) {
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function init() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE_JUGADORES)) escribirJSON(FILE_JUGADORES, []);
}

function jugadorPorDefecto(jid, nombreUsuario) {
  return {
    jid,
    nombre_usuario: nombreUsuario,
    xp: 0,
    nivel_jugador: 1,
    monedas: 0,
    madera: 0,
    hierro: 0,
    picos_extra: 0,
    pico_nivel: 1,
    pico_durabilidad: 20,
    ultimo_minado: 0,
    mejora_en_progreso: null,
    registrado_en: Date.now(),
  };
}

/**
 * Devuelve el perfil del jugador, o null si no está registrado todavía.
 */
function obtenerJugador(jid) {
  const jugadores = leerJSON(FILE_JUGADORES);
  return jugadores.find((j) => j.jid === jid) || null;
}

function obtenerJugadorPorNombre(nombreUsuario) {
  const jugadores = leerJSON(FILE_JUGADORES);
  const nombreLower = nombreUsuario.toLowerCase();
  return jugadores.find((j) => j.nombre_usuario.toLowerCase() === nombreLower) || null;
}

function nombreUsuarioDisponible(nombreUsuario) {
  return obtenerJugadorPorNombre(nombreUsuario) === null;
}

/**
 * Registra un nuevo jugador. Devuelve el jugador creado, o null si el jid
 * ya estaba registrado o el nombre ya estaba en uso (revisar antes con
 * obtenerJugador y nombreUsuarioDisponible para dar el mensaje adecuado).
 */
function registrarJugador(jid, nombreUsuario) {
  if (obtenerJugador(jid)) return null;
  if (!nombreUsuarioDisponible(nombreUsuario)) return null;

  const jugadores = leerJSON(FILE_JUGADORES);
  const nuevo = jugadorPorDefecto(jid, nombreUsuario);
  jugadores.push(nuevo);
  escribirJSON(FILE_JUGADORES, jugadores);
  return nuevo;
}

function guardarJugador(jugador) {
  const jugadores = leerJSON(FILE_JUGADORES);
  const idx = jugadores.findIndex((j) => j.jid === jugador.jid);
  if (idx >= 0) jugadores[idx] = jugador;
  else jugadores.push(jugador);
  escribirJSON(FILE_JUGADORES, jugadores);
}

function obtenerTopXP(cantidad = 10) {
  return leerJSON(FILE_JUGADORES)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, cantidad);
}

function obtenerTopMonedas(cantidad = 10) {
  return leerJSON(FILE_JUGADORES)
    .sort((a, b) => b.monedas - a.monedas)
    .slice(0, cantidad);
}

/**
 * Todos los jugadores (de cualquier grupo, ya que el progreso es global) con
 * una mejora en progreso cuyo tiempo ya se cumplió.
 */
function obtenerMejorasListas() {
  const ahora = Date.now();
  return leerJSON(FILE_JUGADORES).filter(
    (j) => j.mejora_en_progreso && j.mejora_en_progreso.completaEn <= ahora
  );
}

module.exports = {
  init,
  obtenerJugador,
  obtenerJugadorPorNombre,
  nombreUsuarioDisponible,
  registrarJugador,
  guardarJugador,
  obtenerTopXP,
  obtenerTopMonedas,
  obtenerMejorasListas,
};
