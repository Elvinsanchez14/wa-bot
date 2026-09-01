// lib/minar.js
// Lógica del sistema de minería: !registrar, !minar, !perfil, !tienda, !comprar,
// !craftear, !mejorar, !inventario, !reparar, y los rankings asociados.
//
// IMPORTANTE: el progreso vive por JID únicamente, no por grupo (ver minarDb.js) --
// así el mismo jugador tiene el mismo personaje sin importar en qué grupo esté
// jugando (ej. grupo principal y grupo de respaldo). Por eso todo comando de
// juego requiere haberse registrado antes con !registrar <nombre>.

const minarDb = require('./minarDb');
const cfg = require('./minarConfig');

const NOMBRE_USUARIO_REGEX = /^[A-Za-z0-9_]{3,16}$/;

function calcularBonusPico(nivelPico) {
  return 1 + (nivelPico - 1) * cfg.BONUS_POR_NIVEL_PICO;
}

function aleatorioEntre(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function requerirRegistro(sock, grupoId, sender) {
  const jugador = minarDb.obtenerJugador(sender);
  if (!jugador) {
    await sock.sendMessage(grupoId, {
      text: `⚠️ Necesitas registrarte para jugar.\n\nUsa: !registrar <nombre de usuario>\n_(3-16 caracteres, solo letras, números y guion bajo)_`,
    });
    return null;
  }
  return jugador;
}

async function comandoRegistrar(sock, grupoId, sender, nombreDeseado) {
  const yaRegistrado = minarDb.obtenerJugador(sender);
  if (yaRegistrado) {
    await sock.sendMessage(grupoId, {
      text: `Ya estás registrado como *${yaRegistrado.nombre_usuario}*. El nombre de usuario no se puede cambiar.`,
    });
    return;
  }

  if (!nombreDeseado || !NOMBRE_USUARIO_REGEX.test(nombreDeseado)) {
    await sock.sendMessage(grupoId, {
      text: `⚠️ Uso: !registrar <nombre>\n\nEl nombre debe tener entre 3 y 16 caracteres: letras, números o guion bajo, sin espacios.`,
    });
    return;
  }

  if (!minarDb.nombreUsuarioDisponible(nombreDeseado)) {
    await sock.sendMessage(grupoId, {
      text: `❌ El nombre "${nombreDeseado}" ya está en uso. Elige otro.`,
    });
    return;
  }

  const jugador = minarDb.registrarJugador(sender, nombreDeseado);
  const nombre = sender.split('@')[0];
  await sock.sendMessage(grupoId, {
    text: `✅ @${nombre} se registró como *${jugador.nombre_usuario}*. Ya puedes usar !minar para empezar.`,
    mentions: [sender],
  });
}

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
  const jugador = await requerirRegistro(sock, grupoId, sender);
  if (!jugador) return;

  const ahora = Date.now();
  const nombre = jugador.nombre_usuario;

  const tiempoRestante = jugador.ultimo_minado + cfg.COOLDOWN_MINAR_MS - ahora;
  if (tiempoRestante > 0) {
    const minutosRestantes = Math.ceil(tiempoRestante / 60000);
    await sock.sendMessage(grupoId, {
      text: `⏳ ${nombre}, tu pico necesita descansar. Podrás minar de nuevo en ${minutosRestantes} min.`,
    });
    return;
  }

  if (jugador.pico_durabilidad <= 0) {
    await sock.sendMessage(grupoId, {
      text: `⛏️ ${nombre}, tu pico está roto. Repáralo con !rp antes de seguir minando.`,
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
  const seRompio = jugador.pico_durabilidad <= 0;

  minarDb.guardarJugador(jugador);

  let texto =
    `⛏️ *${nombre} minó*\n\n` +
    `+${monedasGanadas} monedas | +${xpGanado} XP\n` +
    `Durabilidad del pico: ${jugador.pico_durabilidad}/${cfg.DURABILIDAD_PICO_NUEVO}`;

  if (nivelesGanados.length) {
    texto += `\n\n🎉 ¡Subiste a nivel ${nivelesGanados[nivelesGanados.length - 1]}!`;
  }
  if (seRompio) {
    texto += `\n\n💥 Tu pico se rompió. Usa !rp para repararlo.`;
  }

  await sock.sendMessage(grupoId, { text: texto });
}

async function comandoPerfil(sock, grupoId, sender, nombreObjetivo) {
  let jugador;
  if (nombreObjetivo) {
    jugador = minarDb.obtenerJugadorPorNombre(nombreObjetivo);
    if (!jugador) {
      await sock.sendMessage(grupoId, { text: `No encontré a ningún jugador registrado como "${nombreObjetivo}".` });
      return;
    }
  } else {
    jugador = await requerirRegistro(sock, grupoId, sender);
    if (!jugador) return;
  }

  const xpSiguiente = cfg.xpParaSiguienteNivel(jugador.nivel_jugador);

  await sock.sendMessage(grupoId, {
    text:
      `👤 *Perfil de ${jugador.nombre_usuario}*\n\n` +
      `📊 Nivel ${jugador.nivel_jugador} _(${jugador.xp}/${xpSiguiente} XP)_\n` +
      `💰 ${jugador.monedas} monedas\n` +
      `🪵 ${jugador.madera} madera | 🔩 ${jugador.hierro} hierro\n` +
      `⛏️ Pico nivel ${jugador.pico_nivel} _(durabilidad ${jugador.pico_durabilidad}/${cfg.DURABILIDAD_PICO_NUEVO})_\n` +
      `🔧 Picos extra: ${jugador.picos_extra}` +
      (jugador.mejora_en_progreso ? `\n\n⏳ Mejorando a nivel ${jugador.mejora_en_progreso.nivelDestino}` : ''),
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
  const jugador = await requerirRegistro(sock, grupoId, sender);
  if (!jugador) return;

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

  if (jugador.monedas < costoTotal) {
    await sock.sendMessage(grupoId, {
      text: `❌ ${jugador.nombre_usuario}, te faltan monedas. Necesitas ${costoTotal}, tienes ${jugador.monedas}.`,
    });
    return;
  }

  jugador.monedas -= costoTotal;
  jugador[materialNormalizado] += cantidad;
  minarDb.guardarJugador(jugador);

  await sock.sendMessage(grupoId, {
    text: `✅ ${jugador.nombre_usuario} compró ${cantidad} de ${materialNormalizado} por ${costoTotal} monedas.`,
  });
}

async function comandoCraftear(sock, grupoId, sender) {
  const jugador = await requerirRegistro(sock, grupoId, sender);
  if (!jugador) return;

  const faltaMadera = jugador.madera < cfg.CRAFTEAR_PICO_MADERA;
  const faltaHierro = jugador.hierro < cfg.CRAFTEAR_PICO_HIERRO;
  const faltanMonedas = jugador.monedas < cfg.CRAFTEAR_PICO_MONEDAS;

  if (faltaMadera || faltaHierro || faltanMonedas) {
    await sock.sendMessage(grupoId, {
      text:
        `❌ ${jugador.nombre_usuario}, te falta:\n` +
        (faltaMadera ? `🪵 Madera (tienes ${jugador.madera}/${cfg.CRAFTEAR_PICO_MADERA})\n` : '') +
        (faltaHierro ? `🔩 Hierro (tienes ${jugador.hierro}/${cfg.CRAFTEAR_PICO_HIERRO})\n` : '') +
        (faltanMonedas ? `💰 Monedas (tienes ${jugador.monedas}/${cfg.CRAFTEAR_PICO_MONEDAS})\n` : ''),
    });
    return;
  }

  jugador.madera -= cfg.CRAFTEAR_PICO_MADERA;
  jugador.hierro -= cfg.CRAFTEAR_PICO_HIERRO;
  jugador.monedas -= cfg.CRAFTEAR_PICO_MONEDAS;
  jugador.picos_extra++;
  minarDb.guardarJugador(jugador);

  await sock.sendMessage(grupoId, {
    text: `⛏️ ${jugador.nombre_usuario} crafteó un pico extra. Ahora tienes ${jugador.picos_extra}.`,
  });
}

async function comandoMejorar(sock, grupoId, sender) {
  const jugador = await requerirRegistro(sock, grupoId, sender);
  if (!jugador) return;

  if (jugador.mejora_en_progreso) {
    const restanteMin = Math.ceil((jugador.mejora_en_progreso.completaEn - Date.now()) / 60000);
    await sock.sendMessage(grupoId, {
      text: `⏳ ${jugador.nombre_usuario}, ya tienes una mejora en progreso. Faltan ~${Math.max(restanteMin, 0)} min.`,
    });
    return;
  }

  const nivelDestino = jugador.pico_nivel + 1;
  const picosRequeridos = jugador.pico_nivel;
  const monedasRequeridas = cfg.COSTO_MONEDAS_HERRERO_POR_NIVEL * jugador.pico_nivel;
  const nivelJugadorMinimo = cfg.nivelJugadorRequerido(nivelDestino);

  if (jugador.nivel_jugador < nivelJugadorMinimo) {
    await sock.sendMessage(grupoId, {
      text: `❌ ${jugador.nombre_usuario}, necesitas ser nivel ${nivelJugadorMinimo} de jugador para mejorar a pico nivel ${nivelDestino}. Eres nivel ${jugador.nivel_jugador}.`,
    });
    return;
  }

  if (jugador.picos_extra < picosRequeridos || jugador.monedas < monedasRequeridas) {
    await sock.sendMessage(grupoId, {
      text:
        `❌ ${jugador.nombre_usuario}, para mejorar a nivel ${nivelDestino} necesitas:\n` +
        `⛏️ ${picosRequeridos} picos extra (tienes ${jugador.picos_extra})\n` +
        `💰 ${monedasRequeridas} monedas (tienes ${jugador.monedas})`,
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
    text: `🔨 ${jugador.nombre_usuario} le pagó al herrero. Mejorando pico a nivel ${nivelDestino}, listo en ${minutosMejora} minutos.`,
  });
}

async function comandoReparar(sock, grupoId, sender) {
  const jugador = await requerirRegistro(sock, grupoId, sender);
  if (!jugador) return;

  if (jugador.pico_durabilidad > 0) {
    await sock.sendMessage(grupoId, {
      text: `Tu pico todavía funciona bien (${jugador.pico_durabilidad}/${cfg.DURABILIDAD_PICO_NUEVO}). No necesita reparación.`,
    });
    return;
  }

  if (jugador.madera < cfg.REPARAR_MADERA || jugador.hierro < cfg.REPARAR_HIERRO || jugador.monedas < cfg.REPARAR_MONEDAS) {
    await sock.sendMessage(grupoId, {
      text: `❌ ${jugador.nombre_usuario}, para reparar necesitas ${cfg.REPARAR_MADERA} madera, ${cfg.REPARAR_HIERRO} hierro y ${cfg.REPARAR_MONEDAS} monedas.`,
    });
    return;
  }

  jugador.madera -= cfg.REPARAR_MADERA;
  jugador.hierro -= cfg.REPARAR_HIERRO;
  jugador.monedas -= cfg.REPARAR_MONEDAS;
  jugador.pico_durabilidad = cfg.DURABILIDAD_PICO_NUEVO;
  minarDb.guardarJugador(jugador);

  await sock.sendMessage(grupoId, {
    text: `🔧 ${jugador.nombre_usuario} reparó su pico. Durabilidad restaurada a ${cfg.DURABILIDAD_PICO_NUEVO}.`,
  });
}

async function comandoInventario(sock, grupoId, sender) {
  const jugador = await requerirRegistro(sock, grupoId, sender);
  if (!jugador) return;

  await sock.sendMessage(grupoId, {
    text:
      `🎒 *Inventario de ${jugador.nombre_usuario}*\n\n` +
      `🪵 Madera: ${jugador.madera}\n` +
      `🔩 Hierro: ${jugador.hierro}\n` +
      `⛏️ Picos extra: ${jugador.picos_extra}\n` +
      `💰 Monedas: ${jugador.monedas}`,
  });
}

async function comandoTopXP(sock, grupoId) {
  const top = minarDb.obtenerTopXP(10);
  if (!top.length) {
    await sock.sendMessage(grupoId, { text: 'Todavía nadie se ha registrado en el juego.' });
    return;
  }
  const lista = top.map((j, i) => `${i + 1}. ${j.nombre_usuario} — Nivel ${j.nivel_jugador} (${j.xp} XP)`).join('\n');
  await sock.sendMessage(grupoId, { text: `🏆 *Top nivel/XP*\n\n${lista}` });
}

async function comandoTopMonedas(sock, grupoId) {
  const top = minarDb.obtenerTopMonedas(10);
  if (!top.length) {
    await sock.sendMessage(grupoId, { text: 'Todavía nadie tiene monedas.' });
    return;
  }
  const lista = top.map((j, i) => `${i + 1}. ${j.nombre_usuario} — ${j.monedas} monedas`).join('\n');
  await sock.sendMessage(grupoId, { text: `💰 *Top monedas*\n\n${lista}` });
}

/**
 * Revisor periódico: completa mejoras cuyo tiempo ya se cumplió. Como el
 * progreso es global (no por grupo), se llama UNA vez por ciclo y avisa en
 * el grupo que se le pase como "grupo de avisos".
 */
async function revisarMejorasCompletas(sock, grupoAvisos) {
  const listas = minarDb.obtenerMejorasListas();
  for (const jugador of listas) {
    jugador.pico_nivel = jugador.mejora_en_progreso.nivelDestino;
    jugador.pico_durabilidad = cfg.DURABILIDAD_PICO_NUEVO;
    jugador.mejora_en_progreso = null;
    minarDb.guardarJugador(jugador);

    try {
      await sock.sendMessage(grupoAvisos, {
        text: `✅ ${jugador.nombre_usuario}, tu pico terminó de mejorarse. ¡Ahora es nivel ${jugador.pico_nivel}!`,
      });
    } catch (e) {
      console.log('No se pudo avisar mejora completada:', e.message);
    }
  }
}

module.exports = {
  comandoRegistrar,
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
 
