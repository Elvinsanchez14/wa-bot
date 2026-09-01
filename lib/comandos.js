// lib/comandos.js
// Bloque 4: sistema de comandos de moderación.
// Todos los comandos que modifican algo (warn, kick, promote, etc.) requieren
// que quien los use sea admin real del grupo en WhatsApp, o super admin del bot.

const db = require('./db');
const utilidad = require('./utilidad');
const { manejarComandoSticker, manejarComandoAImagen } = require('./sticker');
const { comandoClear } = require('./limpiar');
const { comandoTrivia, comandoAdivina, manejarRespuestaJuego } = require('./juegos');
const minar = require('./minar');

// Prefijos aceptados para invocar comandos. Se puede usar cualquiera de estos,
// ej. "!warn", ".warn", "#warn" hacen exactamente lo mismo.
const PREFIJOS = ['!', '.', '#'];

/**
 * Revisa si el mensaje es un comando (empieza con alguno de los PREFIJOS) y lo ejecuta si aplica.
 * Devuelve true si el mensaje era un comando (para que index.js sepa que ya se manejó).
 */
async function manejarComando(sock, grupoId, sender, msg, texto, helpers) {
  const prefijoUsado = PREFIJOS.find((p) => texto.startsWith(p));
  if (!prefijoUsado) return false;

  const [cmdRaw, ...args] = texto.slice(prefijoUsado.length).trim().split(/\s+/);
  const cmd = cmdRaw.toLowerCase();

  const esSuper = helpers.esSuperAdmin(sender);
  const esAdmin = esSuper || (await helpers.esAdminDelGrupo(sock, grupoId, sender));

  const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const objetivo = mentionedJid[0] || null;

  // Los comandos de respuesta de juego (!r, !n) se revisan aparte porque no
  // requieren ser admin y compiten con otros comandos de una sola letra.
  if (cmd === 'r' || cmd === 'n') {
    const fueRespuestaDeJuego = await manejarRespuestaJuego(sock, grupoId, sender, cmd, args);
    if (fueRespuestaDeJuego) return true;
  }

  switch (cmd) {
    case 'warn': {
      if (!esAdmin) return true;
      if (!objetivo) {
        await sock.sendMessage(grupoId, { text: '⚠️ Uso: !warn @usuario [motivo]' });
        return true;
      }
      const motivo = args.slice(1).join(' ') || 'Sin motivo especificado';
      db.agregarWarning(objetivo, grupoId, motivo, sender);
      db.agregarLog(grupoId, 'warn_manual', objetivo, sender, motivo);

      const total = db.contarWarnings(objetivo, grupoId);
      const limite = parseInt(db.getConfig(grupoId, 'limite_warns'), 10);
      const nombre = objetivo.split('@')[0];

      if (total >= limite) {
        const mensajeKick = `🚫 @${nombre} llegó al límite de ${limite} advertencias. Serás expulsado.`;
        await helpers.avisarYExpulsar(sock, grupoId, objetivo, mensajeKick);
      } else {
        await sock.sendMessage(grupoId, {
          text: `⚠️ *@${nombre}* recibió una advertencia _(${total}/${limite})_\nMotivo: ${motivo}`,
          mentions: [objetivo],
        });
      }
      return true;
    }

    case 'warns': {
      const jidConsulta = objetivo || sender;
      const total = db.contarWarnings(jidConsulta, grupoId);
      const limite = db.getConfig(grupoId, 'limite_warns');
      const nombre = jidConsulta.split('@')[0];
      await sock.sendMessage(grupoId, {
        text: `📋 @${nombre} tiene ${total}/${limite} advertencias.`,
        mentions: [jidConsulta],
      });
      return true;
    }

    case 'unwarn': {
      if (!esAdmin) return true;
      if (!objetivo) {
        await sock.sendMessage(grupoId, { text: '⚠️ Uso: !unwarn @usuario' });
        return true;
      }
      const quitado = db.quitarUltimoWarning(objetivo, grupoId);
      const nombre = objetivo.split('@')[0];
      if (quitado) {
        db.agregarLog(grupoId, 'unwarn', objetivo, sender, 'Se quitó la última advertencia');
        await sock.sendMessage(grupoId, {
          text: `✅ Se quitó la última advertencia de @${nombre}.`,
          mentions: [objetivo],
        });
      } else {
        await sock.sendMessage(grupoId, { text: `@${nombre} no tiene advertencias.`, mentions: [objetivo] });
      }
      return true;
    }

    case 'logs': {
      if (!esAdmin) return true;
      const limite = parseInt(args[0], 10) || 10;
      const logs = db.obtenerLogs(grupoId, Math.min(limite, 30));
      if (!logs.length) {
        await sock.sendMessage(grupoId, { text: 'No hay registros todavía.' });
        return true;
      }
      const texto2 = logs
        .map((l) => {
          const fecha = new Date(l.fecha).toLocaleString('es-MX');
          const afectado = l.jid_afectado ? l.jid_afectado.split('@')[0] : '-';
          return `[${fecha}] ${l.accion} → @${afectado} (${l.detalle || 'sin detalle'})`;
        })
        .join('\n');
      await sock.sendMessage(grupoId, { text: `📜 *Últimos registros:*\n\n${texto2}` });
      return true;
    }

    case 'kick': {
      if (!esAdmin) return true;
      if (!objetivo) {
        await sock.sendMessage(grupoId, { text: '⚠️ Uso: !kick @usuario' });
        return true;
      }
      const mensaje = `🚫 Un admin decidió expulsar a @${objetivo.split('@')[0]}.`;
      db.agregarLog(grupoId, 'kick_manual', objetivo, sender, 'Kick manual por admin');
      await helpers.avisarYExpulsar(sock, grupoId, objetivo, mensaje);
      return true;
    }

    case 'promote': {
      if (!esAdmin) return true;
      if (!objetivo) {
        await sock.sendMessage(grupoId, { text: '⚠️ Uso: !promote @usuario' });
        return true;
      }
      try {
        await sock.groupParticipantsUpdate(grupoId, [objetivo], 'promote');
        db.agregarLog(grupoId, 'promote', objetivo, sender, 'Promovido a admin');
        await sock.sendMessage(grupoId, {
          text: `✅ @${objetivo.split('@')[0]} ahora es admin.`,
          mentions: [objetivo],
        });
      } catch (e) {
        await sock.sendMessage(grupoId, { text: '❌ No se pudo promover (¿el bot es admin?).' });
      }
      return true;
    }

    case 'demote': {
      if (!esAdmin) return true;
      if (!objetivo) {
        await sock.sendMessage(grupoId, { text: '⚠️ Uso: !demote @usuario' });
        return true;
      }
      try {
        await sock.groupParticipantsUpdate(grupoId, [objetivo], 'demote');
        db.agregarLog(grupoId, 'demote', objetivo, sender, 'Removido como admin');
        await sock.sendMessage(grupoId, {
          text: `✅ @${objetivo.split('@')[0]} ya no es admin.`,
          mentions: [objetivo],
        });
      } catch (e) {
        await sock.sendMessage(grupoId, { text: '❌ No se pudo remover el rol (¿el bot es admin?).' });
      }
      return true;
    }

    case 'reglas': {
      const reglas = db.getConfig(grupoId, 'reglas_texto');
      await sock.sendMessage(grupoId, { text: `📋 *Reglas del grupo:*\n\n${reglas}` });
      return true;
    }

    case 'config': {
      // !config clave valor  -- solo admins, para ajustar límites sin tocar código
      if (!esAdmin) return true;
      const [clave, ...valorArr] = args;
      if (!clave) {
        const claves = Object.keys(db.DEFAULTS)
          .map((k) => `• ${k} = ${db.getConfig(grupoId, k)}`)
          .join('\n');
        await sock.sendMessage(grupoId, { text: `⚙️ *Configuración actual:*\n\n${claves}` });
        return true;
      }
      const valor = valorArr.join(' ');
      if (!valor) {
        await sock.sendMessage(grupoId, { text: '⚠️ Uso: !config clave valor' });
        return true;
      }
      db.setConfig(grupoId, clave, valor);
      db.agregarLog(grupoId, 'config_cambiada', null, sender, `${clave} = ${valor}`);
      await sock.sendMessage(grupoId, { text: `✅ Configuración actualizada: ${clave} = ${valor}` });
      return true;
    }

    case 'info': {
      await utilidad.comandoInfo(sock, grupoId, sender, objetivo);
      return true;
    }

    case 'top': {
      await utilidad.comandoTop(sock, grupoId);
      return true;
    }

    case 'purga': {
      if (!esAdmin) return true;
      if (args[0] !== 'inactivos') {
        await sock.sendMessage(grupoId, { text: '⚠️ Uso: !purga inactivos' });
        return true;
      }
      await utilidad.comandoPurga(sock, grupoId, sender, helpers.avisarYExpulsar);
      return true;
    }

    case 'antiraid': {
      if (!esAdmin) return true;
      const minutos = parseInt(args[0], 10);
      if (!minutos || minutos <= 0) {
        await sock.sendMessage(grupoId, { text: '⚠️ Uso: !antiraid <minutos>  (ej. !antiraid 15)' });
        return true;
      }
      // Límite de seguridad: evita que un typo (ej. !antiraid 999999) expulse
      // a medio grupo por accidente. Ajustable si de verdad lo necesitas más alto.
      const minutosSeguros = Math.min(minutos, 180);
      await utilidad.comandoAntiraid(sock, grupoId, sender, minutosSeguros);
      return true;
    }

    case 'silencio': {
      if (!esAdmin) return true;
      await utilidad.comandoSilencio(sock, grupoId, sender, args[0]);
      return true;
    }

    case 'sticker': {
      await manejarComandoSticker(sock, grupoId, sender, msg);
      return true;
    }

    case 'toimg': {
      await manejarComandoAImagen(sock, grupoId, sender, msg);
      return true;
    }

    case 'clear': {
      if (!esAdmin) return true;
      const cantidad = parseInt(args[0], 10) || 20;
      await comandoClear(sock, grupoId, Math.min(cantidad, 100));
      return true;
    }

    case 'trivia': {
      await comandoTrivia(sock, grupoId);
      return true;
    }

    case 'adivina': {
      await comandoAdivina(sock, grupoId);
      return true;
    }

    case 'bienvenida': {
      if (!esAdmin) return true;
      const nuevoTexto = args.join(' ');
      if (!nuevoTexto) {
        const actual = db.getConfig(grupoId, 'bienvenida_texto');
        await sock.sendMessage(grupoId, {
          text:
            `📋 *Mensaje de bienvenida actual:*\n\n${actual}\n\n` +
            `Para cambiarlo: !bienvenida <texto nuevo>\n` +
            `Puedes usar {nombre} y {minutos} como marcadores dinámicos.`,
        });
        return true;
      }
      db.setConfig(grupoId, 'bienvenida_texto', nuevoTexto);
      db.agregarLog(grupoId, 'bienvenida_cambiada', null, sender, nuevoTexto.slice(0, 100));
      await sock.sendMessage(grupoId, { text: '✅ Mensaje de bienvenida actualizado.' });
      return true;
    }
case 'idgrupo': {
  await sock.sendMessage(grupoId, { text: `ID de este grupo: ${grupoId}` });
  return true;
}
      
case 'registrar': {
  await minar.comandoRegistrar(sock, grupoId, sender, args[0]);
  return true;
}
      
case 'minar': case 'm': {
  await minar.comandoMinar(sock, grupoId, sender);
  return true;
}
case 'perfil': case 'p': {
  await minar.comandoPerfil(sock, grupoId, sender, objetivo);
  return true;
}
case 'tienda': case 't': {
  await minar.comandoTienda(sock, grupoId);
  return true;
}
case 'comprar': case 'c': {
  await minar.comandoComprar(sock, grupoId, sender, args[0], args[1]);
  return true;
}
case 'craftear': case 'cr': {
  await minar.comandoCraftear(sock, grupoId, sender);
  return true;
}
case 'mejorar': case 'mj': {
  await minar.comandoMejorar(sock, grupoId, sender);
  return true;
}
case 'reparar': case 'rp': {
  await minar.comandoReparar(sock, grupoId, sender);
  return true;
}
case 'inventario': case 'i': {
  await minar.comandoInventario(sock, grupoId, sender);
  return true;
}
case 'topmonedas': case 'tm': {
  await minar.comandoTopMonedas(sock, grupoId);
  return true;
}
      
    case 'menu': {
      await sock.sendMessage(grupoId, {
        text:
          '🤖 *KAI* — _menú de comandos_\n' +
          '━━━━━━━━━━━━━━━\n\n' +
          '🛡️ *MODERACIÓN* _(admin)_\n' +
          '```!warn @usuario [motivo]```Advertir\n' +
          '```!unwarn @usuario```Quitar advertencia\n' +
          '```!kick @usuario```Expulsar\n' +
          '```!promote / !demote @usuario```Roles de admin\n' +
          '```!clear [cantidad]```Borrar últimos mensajes (def. 20)\n' +
          '```!antiraid <minutos>```🚨 Expulsar entradas recientes\n' +
          '```!purga inactivos```Limpiar inactivos viejos\n' +
          '```!silencio on/off```Solo admins hablan\n\n' +
          '⚙️ *CONFIGURACIÓN* _(admin)_\n' +
          '```!config [clave valor]```Ver/ajustar ajustes\n' +
          '```!bienvenida [texto]```Editar mensaje de bienvenida\n' +
          '```!logs [cantidad]```Ver historial de acciones\n\n' +
          '📋 *INFORMACIÓN* _(todos)_\n' +
          '```!reglas```Ver reglas del grupo\n' +
          '```!info [@usuario]```Datos de un usuario\n' +
          '```!warns [@usuario]```Ver advertencias\n' +
          '```!top```Ranking de participación\n\n' +
          '🎉 *DIVERSIÓN* _(todos)_\n' +
          '```!trivia```Pregunta de cultura general\n' +
          '```!adivina```Adivina el número\n' +
          '```!sticker```Convierte imagen/video en sticker\n' +
          '```!toimg```Convierte sticker en imagen/video\n\n' +
          '💬 *KAI* — menciona "Kai" o responde a uno de mis mensajes para platicar.\n\n' +
          '_Prefijos válidos: ! . #_',
      });
      return true;
    }

    default:
      return false; // no era un comando reconocido, dejamos que otros módulos lo revisen (ej. conversación)
  }
}

module.exports = { manejarComando };
 
