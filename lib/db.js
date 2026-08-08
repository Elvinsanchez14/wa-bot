// lib/db.js
// Capa de base de datos SQLite. Todo el estado persistente del bot vive aquí:
// usuarios (para auto-kick por inactividad), warnings, logs de auditoría, y config editable.

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'bot.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL'); // mejor rendimiento con escrituras concurrentes

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      jid TEXT NOT NULL,
      grupo TEXT NOT NULL,
      fecha_entrada INTEGER NOT NULL,
      ha_hablado INTEGER NOT NULL DEFAULT 0,
      ultimo_mensaje INTEGER,
      ultimo_link TEXT,
      contador_link_repetido INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (jid, grupo)
    );

    CREATE TABLE IF NOT EXISTS warnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jid TEXT NOT NULL,
      grupo TEXT NOT NULL,
      motivo TEXT,
      fecha INTEGER NOT NULL,
      aplicado_por TEXT
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grupo TEXT NOT NULL,
      accion TEXT NOT NULL,
      jid_afectado TEXT,
      admin TEXT,
      fecha INTEGER NOT NULL,
      detalle TEXT
    );

    CREATE TABLE IF NOT EXISTS config (
      grupo TEXT NOT NULL,
      clave TEXT NOT NULL,
      valor TEXT NOT NULL,
      PRIMARY KEY (grupo, clave)
    );
  `);
}

// ---- Config con valores por defecto ----
// Todo lo que definimos como "configurable por grupo" vive aquí.
// Si un grupo no tiene la clave guardada todavía, se usa el default.
const DEFAULTS = {
  dry_run: 'true',              // arranca en modo prueba: solo avisa, no expulsa. Cámbialo cuando confíes en el bot.
  limite_warns: '3',
  tolerancia_inactividad_min: '60',   // 1 hora
  flood_max_mensajes: '10',
  flood_ventana_seg: '5',
  antimencion_max: '10',
  purga_dias_inactivo: '30',
  reglas_texto: 'Sé respetuoso, no mandes enlaces de otros grupos, y participa. Si no hablas en 1 hora podrías ser expulsado.',
};

function getConfig(grupo, clave) {
  const row = db.prepare('SELECT valor FROM config WHERE grupo = ? AND clave = ?').get(grupo, clave);
  if (row) return row.valor;
  return DEFAULTS[clave] ?? null;
}

function setConfig(grupo, clave, valor) {
  db.prepare(`
    INSERT INTO config (grupo, clave, valor) VALUES (?, ?, ?)
    ON CONFLICT(grupo, clave) DO UPDATE SET valor = excluded.valor
  `).run(grupo, clave, String(valor));
}

// ---- Usuarios ----
function registrarEntrada(jid, grupo) {
  db.prepare(`
    INSERT INTO usuarios (jid, grupo, fecha_entrada, ha_hablado)
    VALUES (?, ?, ?, 0)
    ON CONFLICT(jid, grupo) DO UPDATE SET fecha_entrada = excluded.fecha_entrada, ha_hablado = 0
  `).run(jid, grupo, Date.now());
}

function marcarHabloYaVez(jid, grupo) {
  db.prepare(`
    UPDATE usuarios SET ha_hablado = 1, ultimo_mensaje = ? WHERE jid = ? AND grupo = ?
  `).run(Date.now(), jid, grupo);
}

function obtenerUsuario(jid, grupo) {
  return db.prepare('SELECT * FROM usuarios WHERE jid = ? AND grupo = ?').get(jid, grupo);
}

function usuariosInactivosNuevos(grupo, minutos) {
  const limite = Date.now() - minutos * 60 * 1000;
  return db.prepare(`
    SELECT * FROM usuarios WHERE grupo = ? AND ha_hablado = 0 AND fecha_entrada <= ?
  `).all(grupo, limite);
}

function usuariosInactivosViejos(grupo, dias) {
  const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
  return db.prepare(`
    SELECT * FROM usuarios
    WHERE grupo = ?
      AND (
        (ha_hablado = 1 AND ultimo_mensaje <= ?)
        OR (ha_hablado = 0 AND fecha_entrada <= ?)
      )
  `).all(grupo, limite, limite);
}

function eliminarUsuario(jid, grupo) {
  db.prepare('DELETE FROM usuarios WHERE jid = ? AND grupo = ?').run(jid, grupo);
}

// ---- Warnings ----
function agregarWarning(jid, grupo, motivo, aplicadoPor) {
  db.prepare(`
    INSERT INTO warnings (jid, grupo, motivo, fecha, aplicado_por) VALUES (?, ?, ?, ?, ?)
  `).run(jid, grupo, motivo || 'sin motivo', Date.now(), aplicadoPor || 'sistema');
}

function contarWarnings(jid, grupo) {
  const row = db.prepare('SELECT COUNT(*) as n FROM warnings WHERE jid = ? AND grupo = ?').get(jid, grupo);
  return row.n;
}

function quitarUltimoWarning(jid, grupo) {
  const row = db.prepare(`
    SELECT id FROM warnings WHERE jid = ? AND grupo = ? ORDER BY fecha DESC LIMIT 1
  `).get(jid, grupo);
  if (row) db.prepare('DELETE FROM warnings WHERE id = ?').run(row.id);
  return !!row;
}

// ---- Logs ----
function agregarLog(grupo, accion, jidAfectado, admin, detalle) {
  db.prepare(`
    INSERT INTO logs (grupo, accion, jid_afectado, admin, fecha, detalle) VALUES (?, ?, ?, ?, ?, ?)
  `).run(grupo, accion, jidAfectado || null, admin || 'sistema', Date.now(), detalle || '');
}

function obtenerLogs(grupo, limite = 20) {
  return db.prepare(`
    SELECT * FROM logs WHERE grupo = ? ORDER BY fecha DESC LIMIT ?
  `).all(grupo, limite);
}

module.exports = {
  init,
  getConfig,
  setConfig,
  DEFAULTS,
  registrarEntrada,
  marcarHabloYaVez,
  obtenerUsuario,
  usuariosInactivosNuevos,
  usuariosInactivosViejos,
  eliminarUsuario,
  agregarWarning,
  contarWarnings,
  quitarUltimoWarning,
  agregarLog,
  obtenerLogs,
};

