// lib/minarConfig.js
// Todos los valores numéricos del sistema de minería en un solo lugar,
// para poder ajustar el balance del juego sin buscar por todo el código.

module.exports = {
  COOLDOWN_MINAR_MS: 45 * 60 * 1000, // 45 minutos entre usos de !minar

  MONEDAS_MIN_BASE: 10,
  MONEDAS_MAX_BASE: 25,
  XP_MIN_BASE: 5,
  XP_MAX_BASE: 10,
  BONUS_POR_NIVEL_PICO: 0.15, // +15% por cada nivel de pico por encima de 1

  DURABILIDAD_PICO_NUEVO: 20, // usos antes de romperse (bajar a nivel anterior)

  PRECIO_MADERA: 15,
  PRECIO_HIERRO: 30,

  CRAFTEAR_PICO_MADERA: 3,
  CRAFTEAR_PICO_HIERRO: 2,
  CRAFTEAR_PICO_MONEDAS: 50,

  REPARAR_MADERA: 1,
  REPARAR_HIERRO: 1,
  REPARAR_MONEDAS: 20,

  // Tiempo de mejora progresivo por nivel destino (índice 0 = subir a nivel 2, etc.)
  TIEMPOS_MEJORA_MIN: [5, 7, 10, 15, 20, 30, 45, 60],

  COSTO_MONEDAS_HERRERO_POR_NIVEL: 100, // se multiplica por el nivel actual

  // XP requerido para pasar del nivel de jugador N al N+1 (fórmula simple creciente)
  xpParaSiguienteNivel(nivelActual) {
    return 100 * nivelActual * nivelActual;
  },

  // Nivel mínimo de jugador requerido para poder mejorar el pico a cierto nivel
  // (evita que alguien con monedas rápidas salte a picos altos sin haber jugado)
  nivelJugadorRequerido(nivelPicoDestino) {
    return Math.max(1, (nivelPicoDestino - 1) * 2);
  },
};
 
