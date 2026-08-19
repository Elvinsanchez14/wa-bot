// lib/db.js
// Capa de almacenamiento usando archivos JSON planos en vez de SQLite.
// Se eligió este enfoque porque better-sqlite3 requiere compilar código nativo
// (C++) y en Termux/Android eso falla frecuentemente por falta de binarios
// precompilados para arm64. JSON no requiere compilación y es suficiente
// para el volumen de datos de un bot de grupo (cientos de usuarios, no millones).
//
// Mantiene exactamente las mismas funciones exportadas que la versión SQLite,
// así que el resto del proyecto (index.js y los bloques futuros) no necesita cambios.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILES = {
  usuarios: path.join(DATA_DIR, 'usuarios.json'),
  warnings: path.join(DATA_DIR, 'warnings.json'),
  logs: path.join(DATA_DIR, 'logs.json'),
  config: path.join(DATA_DIR, 'config.json'),
};

// ---- Helpers internos de lectura/escritura ----

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
  // Escritura atómica: primero a un archivo temporal, luego rename.
  // Esto evita que el archivo quede corrupto si el proceso se corta a mitad de la escritura.
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function init() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const filePath of Object.values(FILES)) {
    if (!fs.existsSync(filePath)) escribirJSON(filePath, []);
  }
}

// ---- Config con valores por defecto ----
const DEFAULTS = {
  dry_run: 'true',
  limite_warns: '3',
  tolerancia_inactividad_min: '60',
  flood_max_mensajes: '10',
  flood_ventana_seg: '5',
  antimencion_max: '10',
  purga_dias_inactivo: '30',
  reglas_texto: 'Sé respetuoso, no mandes enlaces de otros grupos, y participa.',
  bienvenida_texto:
    '👋 Bienvenido/a {nombre}\n\n' +
    'Por favor preséntate: nombre, edad, país.\n' +
    'Lee las reglas con !reglas.\n\n' +
    '⏱️ Puedes ser expulsado por inactividad en {minutos} minutos.',
};

function getConfig(grupo, clave) {
  const configs = leerJSON(FILES.config);
  const row = configs.find((c) => c.grupo === grupo && c.clave === clave);
  if (row) return row.valor;
  return DEFAULTS[clave] ?? null;
}

function setConfig(grupo, clave, valor) {
  const configs = leerJSON(FILES.config);
  const idx = configs.findIndex((c) => c.grupo === grupo && c.clave === clave);
  const entry = { grupo, clave, valor: String(valor) };
  if (idx >= 0) configs[idx] = entry;
  else configs.push(entry);
  escribirJSON(FILES.config, configs);
}

// ---- Usuarios ----
function registrarEntrada(jid, grupo) {
  const usuarios = leerJSON(FILES.usuarios);
  const idx = usuarios.findIndex((u) => u.jid === jid && u.grupo === grupo);
  const entry = {
    jid,
    grupo,
    fecha_entrada: Date.now(),
    ha_hablado: false,
    ultimo_mensaje: null,
    ultimo_link: null,
    contador_link_repetido: 0,
  };
  if (idx >= 0) usuarios[idx] = entry;
  else usuarios.push(entry);
  escribirJSON(FILES.usuarios, usuarios);
}

function marcarHabloYaVez(jid, grupo) {
  const usuarios = leerJSON(FILES.usuarios);
  const idx = usuarios.findIndex((u) => u.jid === jid && u.grupo === grupo);
  if (idx >= 0) {
    usuarios[idx].ha_hablado = true;
    usuarios[idx].ultimo_mensaje = Date.now();
    escribirJSON(FILES.usuarios, usuarios);
  }
}

function obtenerUsuario(jid, grupo) {
  const usuarios = leerJSON(FILES.usuarios);
  return usuarios.find((u) => u.jid === jid && u.grupo === grupo) || null;
}

function usuariosInactivosNuevos(grupo, minutos) {
  const usuarios = leerJSON(FILES.usuarios);
  const limite = Date.now() - minutos * 60 * 1000;
  return usuarios.filter(
    (u) => u.grupo === grupo && !u.ha_hablado && u.fecha_entrada <= limite
  );
}

function usuariosInactivosViejos(grupo, dias) {
  const usuarios = leerJSON(FILES.usuarios);
  const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
  return usuarios.filter((u) => {
    if (u.grupo !== grupo) return false;
    if (u.ha_hablado) return u.ultimo_mensaje <= limite;
    return u.fecha_entrada <= limite;
  });
}

function eliminarUsuario(jid, grupo) {
  const usuarios = leerJSON(FILES.usuarios);
  const filtrados = usuarios.filter((u) => !(u.jid === jid && u.grupo === grupo));
  escribirJSON(FILES.usuarios, filtrados);
}

// ---- Warnings ----
function agregarWarning(jid, grupo, motivo, aplicadoPor) {
  const warnings = leerJSON(FILES.warnings);
  const nuevoId = warnings.length ? Math.max(...warnings.map((w) => w.id)) + 1 : 1;
  warnings.push({
    id: nuevoId,
    jid,
    grupo,
    motivo: motivo || 'sin motivo',
    fecha: Date.now(),
    aplicado_por: aplicadoPor || 'sistema',
  });
  escribirJSON(FILES.warnings, warnings);
}

function contarWarnings(jid, grupo) {
  const warnings = leerJSON(FILES.warnings);
  return warnings.filter((w) => w.jid === jid && w.grupo === grupo).length;
}

function quitarUltimoWarning(jid, grupo) {
  const warnings = leerJSON(FILES.warnings);
  const delUsuario = warnings.filter((w) => w.jid === jid && w.grupo === grupo);
  if (!delUsuario.length) return false;
  const ultimo = delUsuario.reduce((a, b) => (a.fecha > b.fecha ? a : b));
  const filtrados = warnings.filter((w) => w.id !== ultimo.id);
  escribirJSON(FILES.warnings, filtrados);
  return true;
}

// ---- Logs ----
function agregarLog(grupo, accion, jidAfectado, admin, detalle) {
  const logs = leerJSON(FILES.logs);
  const nuevoId = logs.length ? Math.max(...logs.map((l) => l.id)) + 1 : 1;
  logs.push({
    id: nuevoId,
    grupo,
    accion,
    jid_afectado: jidAfectado || null,
    admin: admin || 'sistema',
    fecha: Date.now(),
    detalle: detalle || '',
  });
  escribirJSON(FILES.logs, logs);
}

function obtenerLogs(grupo, limite = 20) {
  const logs = leerJSON(FILES.logs);
  return logs
    .filter((l) => l.grupo === grupo)
    .sort((a, b) => b.fecha - a.fecha)
    .slice(0, limite);
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
