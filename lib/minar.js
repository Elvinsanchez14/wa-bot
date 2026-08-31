// lib/minar.js
// Lógica del sistema de minería: !minar, !perfil, !tienda, !comprar, !craftear,
// !mejorar, !inventario, !reparar, y los rankings asociados.

const minarDb = require('./minarDb');
const cfg = require('./minarConfig');

function calcularBonusPico(nivelPico) {
  return 1 + (nivelPico - 1) * cfg.BONUS_POR_NIVEL_PICO;
}

function aleatorioEntre(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sube de nivel de jugador tantas veces como el XP acumulado lo permita.
 * Devuelve la lista de niveles alcanzados en esta subida (para poder avisar).
 */
function procesarSubidaDeNivel(jugador) {
  const nivelesGanados = [];
  while (jugador.xp >= cfg.xpParaSiguienteNivel(jugador.nivel_jugador)) {
    jugador.xp -= cfg.xpParaSiguienteNivel(jugador.nivel_jugador);
    jugador.nivel_jugador++;
    nivelesGanados.push(jugador.nivel_jugador);
  }
  return nivelesGanados;
}

async function comandoMinar(sock, grupoId, sender) {
  const jugador = minarDb.obtenerJugador(sender, grupoId);
  const ahora = Date.now();
  const nombre = sender.split('@')[0];

  const tiempoRestante = jugador.ultimo_minado + cfg.COOLDOWN_MINAR_MS - ahora;
  if (tiempoRestante > 0) {
    const minutosRestantes = Math.ceil(tiempoRestante / 60000);
    await sock.sendMessage(grupoId, {
      text: `⏳ @${nombre}, tu pico necesita descansar. Podrás minar de nuevo en ${minutosRestantes} min.`,
      mentions: [sender],
    });
    return;
  }

  if (jugador.pico_durabilidad <= 0) {
    await sock.sendMessage(grupoId, {
      text: `⛏️ @${nombre}, tu pico está roto. Repáralo con !rp antes de seguir minando.`,
      mentions: [sender],
    });
    return;
  }

  const bonus = calcularBonusPico(jugador.pico_nivel);
  const monedasGanadas = Math.round(aleatorioEntre(cfg.MONEDAS_MIN_BASE, cfg.MONEDAS_MAX_BASE) * bonus);
  const xpGanado = Math.round(aleatorioEntre(cfg.XP_MIN_BASE, cfg.XP_MAX_BASE) * bonus);

  jugador.monedas += monedasGanadas;
  jugador.xp += xpGanado;
  jugador.ultimo_minado = ahora;
  jugador.pico_durabilidad--;

  const nivelesGanados = procesarSubidaDeNivel(jugador);

  let seRompio = false;
  if (jugador.pico_durabilidad <= 0) {
    seRompio = true;
  }

  minarDb.guardarJugador(jugador);

  let texto =
    `⛏️ *@${nombre} minó*\n\n` +
    `+${monedasGanadas} monedas | +${xpGanado} XP\n` +
    `Durabilidad del pico: ${jugador.pico_durabilidad}/${cfg.DURABILIDAD_PICO_NUEVO}`;

  if (nivelesGanados.length) {
    texto += `\n\n🎉 ¡Subiste a nivel ${nivelesGanados[nivelesGanados.length - 1]}!`;
  }
  if (seRompio) {
    texto += `\n\n💥 Tu pico se rompió. Usa !rp para repararlo.`;
  }

  await sock.sendMessage(grupoId, { text: texto, mentions: [sender] });
}

async function comandoPerfil(sock, grupoId, sender, objetivo) {
  const jid = objetivo || sender;
  const jugador = minarDb.obtenerJugador(jid, grupoId);
  const nombre = jid.split('@')[0];
  const xpSiguiente = cfg.xpParaSiguienteNivel(jugador.nivel_jugador);

  await sock.sendMessage(grupoId, {
    text:
      `👤 *Perfil de @${nombre}*\n\n` +
      `📊 Nivel ${jugador.nivel_jugador} _(${jugador.xp}/${xpSiguiente} XP)_\n` +
      `💰 ${jugador.monedas} monedas\n` +
      `🪵 ${jugador.madera} madera | 🔩 ${jugador.hierro} hierro\n` +
      `⛏️ Pico nivel ${jugador.pico_nivel} _(durabilidad ${jugador.pico_durabilidad}/${cfg.DURABILIDAD_PICO_NUEVO})_\n` +
      `🔧 Picos extra: ${jugador.picos_extra}` +
      (jugador.mejora_en_progreso
        ? `\n\n⏳ Mejorando a nivel ${jugador.mejora_en_progreso.nivelDestino}`
        : ''),
    mentions: [jid],
  });
}

async function comandoTienda(sock, grupoId) {
  await sock.sendMessage(grupoId, {
    text:
      `🛒 *Tienda*\n\n` +
      `🪵 Madera — ${cfg.PRECIO_MADERA} monedas c/u\n` +
      `🔩 Hierro — ${cfg.PRECIO_HIERRO} monedas c/u\n\n` +
      `Compra con: !c madera <cantidad>  o  !c hierro <cantidad>\n\n` +
      `⛏️ Craftear pico extra: ${cfg.CRAFTEAR_PICO_MADERA} madera + ${cfg.CRAFTEAR_PICO_HIERRO} hierro + ${cfg.CRAFTEAR_PICO_MONEDAS} monedas\n` +
      `Craftea con: !cr`,
  });
}

async function comandoComprar(sock, grupoId, sender, material, cantidadTexto) {
  const cantidad = parseInt(cantidadTexto, 10);
  if (!cantidad || cantidad <= 0) {
    await sock.sendMessage(grupoId, { text: '⚠️ Uso: !c madera <cantidad>  o  !c hierro <cantidad>' });
    return;
  }

  const materialNormalizado = (material || '').toLowerCase();
  if (materialNormalizado !== 'madera' && materialNormalizado !== 'hierro') {
    await sock.sendMessage(grupoId, { text: '⚠️ Solo puedes comprar "madera" o "hierro".' });
    return;
  }

  const precioUnitario = materialNormalizado === 'madera' ? cfg.PRECIO_MADERA : cfg.PRECIO_HIERRO;
  const costoTotal = precioUnitario * cantidad;

  const jugador = minarDb.obtenerJugador(sender, grupoId);
  const nombre = sender.split('@')[0];

  if (jugador.monedas < costoTotal) {
    await sock.sendMessage(grupoId, {
      text: `❌ @${nombre}, te faltan monedas. Necesitas ${costoTotal}, tienes ${jugador.monedas}.`,
      mentions: [sender],
    });
    return;
  }

  jugador.monedas -= costoTotal;
  jugador[materialNormalizado] += cantidad;
  minarDb.guardarJugador(jugador);

  await sock.sendMessage(grupoId, {
    text: `✅ @${nombre} compró ${cantidad} de ${materialNormalizado} por ${costoTotal} monedas.`,
    mentions: [sender],
  });
}

async function comandoCraftear(sock, grupoId, sender) {
  const jugador = minarDb.obtenerJugador(sender, grupoId);
  const nombre = sender.split('@')[0];

  const faltaMadera = jugador.madera < cfg.CRAFTEAR_PICO_MADERA;
  const faltaHierro = jugador.hierro < cfg.CRAFTEAR_PICO_HIERRO;
  const faltanMonedas = jugador.monedas < cfg.CRAFTEAR_PICO_MONEDAS;

  if (faltaMadera || faltaHierro || faltanMonedas) {
    await sock.sendMessage(grupoId, {
      text:
        `❌ @${nombre}, te falta:\n` +
        (faltaMadera ? `🪵 Madera (tienes ${jugador.madera}/${cfg.CRAFTEAR_PICO_MADERA})\n` : '') +
        (faltaHierro ? `🔩 Hierro (tienes ${jugador.hierro}/${cfg.CRAFTEAR_PICO_HIERRO})\n` : '') +
        (faltanMonedas ? `💰 Monedas (tienes ${jugador.monedas}/${cfg.CRAFTEAR_PICO_MONEDAS})\n` : ''),
      mentions: [sender],
    });
    return;
  }

  jugador.madera -= cfg.CRAFTEAR_PICO_MADERA;
  jugador.hierro -= cfg.CRAFTEAR_PICO_HIERRO;
  jugador.monedas -= cfg.CRAFTEAR_PICO_MONEDAS;
  jugador.picos_extra++;
  minarDb.guardarJugador(jugador);

  await sock.sendMessage(grupoId, {
    text: `⛏️ @${nombre} crafteó un pico extra. Ahora tienes ${jugador.picos_extra}.`,
    mentions: [sender],
  });
}

async function comandoMejorar(sock, grupoId, sender) {
  const jugador = minarDb.obtenerJugador(sender, grupoId);
  const nombre = sender.split('@')[0];

  if (jugador.mejora_en_progreso) {
    const restanteMin = Math.ceil((jugador.mejora_en_progreso.completaEn - Date.now()) / 60000);
    await sock.sendMessage(grupoId, {
      text: `⏳ @${nombre}, ya tienes una mejora en progreso. Faltan ~${Math.max(restanteMin, 0)} min.`,
      mentions: [sender],
    });
    return;
  }

  const nivelDestino = jugador.pico_nivel + 1;
  const picosRequeridos = jugador.pico_nivel; // nivel actual = # de picos extra requeridos
  const monedasRequeridas = cfg.COSTO_MONEDAS_HERRERO_POR_NIVEL * jugador.pico_nivel;
  const nivelJugadorMinimo = cfg.nivelJugadorRequerido(nivelDestino);

  if (jugador.nivel_jugador < nivelJugadorMinimo) {
    await sock.sendMessage(grupoId, {
      text: `❌ @${nombre}, necesitas ser nivel ${nivelJugadorMinimo} de jugador para mejorar a pico nivel ${nivelDestino}. Eres nivel ${jugador.nivel_jugador}.`,
      mentions: [sender],
    });
    return;
  }

  if (jugador.picos_extra < picosRequeridos || jugador.monedas < monedasRequeridas) {
    await sock.sendMessage(grupoId, {
      text:
        `❌ @${nombre}, para mejorar a nivel ${nivelDestino} necesitas:\n` +
        `⛏️ ${picosRequeridos} picos extra (tienes ${jugador.picos_extra})\n` +
        `💰 ${monedasRequeridas} monedas (tienes ${jugador.monedas})`,
      mentions: [sender],
    });
    return;
  }

  const indiceTiempo = Math.min(jugador.pico_nivel - 1, cfg.TIEMPOS_MEJORA_MIN.length - 1);
  const minutosMejora = cfg.TIEMPOS_MEJORA_MIN[indiceTiempo];

  jugador.picos_extra -= picosRequeridos;
  jugador.monedas -= monedasRequeridas;
  jugador.mejora_en_progreso = {
    inicioEn: Date.now(),
    completaEn: Date.now() + minutosMejora * 60 * 1000,
    nivelDestino,
  };
  minarDb.guardarJugador(jugador);

  await sock.sendMessage(grupoId, {
    text: `🔨 @${nombre} le pagó al herrero. Mejorando pico a nivel ${nivelDestino}, listo en ${minutosMejora} minutos.`,
    mentions: [sender],
  });
}

async function comandoReparar(sock, grupoId, sender) {
  const jugador = minarDb.obtenerJugador(sender, grupoId);
  const nombre = sender.split('@')[0];

  if (jugador.pico_durabilidad > 0) {
    await sock.sendMessage(grupoId, {
      text: `Tu pico todavía funciona bien (${jugador.pico_durabilidad}/${cfg.DURABILIDAD_PICO_NUEVO}). No necesita reparación.`,
    });
    return;
  }

  if (jugador.madera < cfg.REPARAR_MADERA || jugador.hierro < cfg.REPARAR_HIERRO || jugador.monedas < cfg.REPARAR_MONEDAS) {
    await sock.sendMessage(grupoId, {
      text: `❌ @${nombre}, para reparar necesitas ${cfg.REPARAR_MADERA} madera, ${cfg.REPARAR_HIERRO} hierro y ${cfg.REPARAR_MONEDAS} monedas.`,
      mentions: [sender],
    });
    return;
  }

  jugador.madera -= cfg.REPARAR_MADERA;
  jugador.hierro -= cfg.REPARAR_HIERRO;
  jugador.monedas -= cfg.REPARAR_MONEDAS;
  jugador.pico_durabilidad = cfg.DURABILIDAD_PICO_NUEVO;
  minarDb.guardarJugador(jugador);

  await sock.sendMessage(grupoId, {
    text: `🔧 @${nombre} reparó su pico. Durabilidad restaurada a ${cfg.DURABILIDAD_PICO_NUEVO}.`,
    mentions: [sender],
  });
}

async function comandoInventario(sock, grupoId, sender) {
  const jugador = minarDb.obtenerJugador(sender, grupoId);
  const nombre = sender.split('@')[0];

  await sock.sendMessage(grupoId, {
    text:
      `🎒 *Inventario de @${nombre}*\n\n` +
      `🪵 Madera: ${jugador.madera}\n` +
      `🔩 Hierro: ${jugador.hierro}\n` +
      `⛏️ Picos extra: ${jugador.picos_extra}\n` +
      `💰 Monedas: ${jugador.monedas}`,
    mentions: [sender],
  });
}

async function comandoTopXP(sock, grupoId) {
  const top = minarDb.obtenerTopXP(grupoId, 10);
  if (!top.length) {
    await sock.sendMessage(grupoId, { text: 'Todavía nadie ha ganado XP en este grupo.' });
    return;
  }
  const lista = top.map((j, i) => `${i + 1}. @${j.jid.split('@')[0]} — Nivel ${j.nivel_jugador} (${j.xp} XP)`).join('\n');
  await sock.sendMessage(grupoId, { text: `🏆 *Top nivel/XP*\n\n${lista}`, mentions: top.map((j) => j.jid) });
}

async function comandoTopMonedas(sock, grupoId) {
  const top = minarDb.obtenerTopMonedas(grupoId, 10);
  if (!top.length) {
    await sock.sendMessage(grupoId, { text: 'Todavía nadie tiene monedas en este grupo.' });
    return;
  }
  const lista = top.map((j, i) => `${i + 1}. @${j.jid.split('@')[0]} — ${j.monedas} monedas`).join('\n');
  await sock.sendMessage(grupoId, { text: `💰 *Top monedas*\n\n${lista}`, mentions: top.map((j) => j.jid) });
}

/**
 * Revisor periódico: completa mejoras cuyo tiempo ya se cumplió, avisando
 * al jugador en el grupo. Se llama desde index.js con un setInterval.
 */
async function revisarMejorasCompletas(sock, grupoId) {
  const listas = minarDb.obtenerMejorasListas(grupoId);
  for (const jugador of listas) {
    jugador.pico_nivel = jugador.mejora_en_progreso.nivelDestino;
    jugador.pico_durabilidad = cfg.DURABILIDAD_PICO_NUEVO; // la mejora también renueva la durabilidad
    jugador.mejora_en_progreso = null;
    minarDb.guardarJugador(jugador);

    const nombre = jugador.jid.split('@')[0];
    try {
      await sock.sendMessage(grupoId, {
        text: `✅ @${nombre}, tu pico terminó de mejorarse. ¡Ahora es nivel ${jugador.pico_nivel}!`,
        mentions: [jugador.jid],
      });
    } catch (e) {
      console.log('No se pudo avisar mejora completada:', e.message);
    }
  }
}

module.exports = {
  comandoMinar,
  comandoPerfil,
  comandoTienda,
  comandoComprar,
  comandoCraftear,
  comandoMejorar,
  comandoReparar,
  comandoInventario,
  comandoTopXP,
  comandoTopMonedas,
  revisarMejorasCompletas,
};
