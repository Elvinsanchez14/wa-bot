// lib/juegos.js
// Comandos !trivia y !adivina -- juegos simples de texto para el grupo.
// El estado de cada juego activo vive en memoria, por grupo (no por persona,
// ya que son juegos grupales -- cualquiera puede responder).

const PREGUNTAS_TRIVIA = [
  { pregunta: '¿Cuál es el planeta más grande del sistema solar?', opciones: ['Marte', 'Júpiter', 'Saturno'], correcta: 1 },
  { pregunta: '¿En qué año llegó el ser humano a la luna?', opciones: ['1965', '1969', '1972'], correcta: 1 },
  { pregunta: '¿Cuál es el océano más grande del mundo?', opciones: ['Atlántico', 'Índico', 'Pacífico'], correcta: 2 },
  { pregunta: '¿Cuántos huesos tiene el cuerpo humano adulto?', opciones: ['186', '206', '226'], correcta: 1 },
  { pregunta: '¿Quién pintó la Mona Lisa?', opciones: ['Miguel Ángel', 'Da Vinci', 'Rafael'], correcta: 1 },
  { pregunta: '¿Cuál es el río más largo del mundo?', opciones: ['Nilo', 'Amazonas', 'Yangtsé'], correcta: 1 },
  { pregunta: '¿Cuál es el metal más abundante en la corteza terrestre?', opciones: ['Hierro', 'Aluminio', 'Cobre'], correcta: 1 },
  { pregunta: '¿En qué país se originó el café?', opciones: ['Brasil', 'Colombia', 'Etiopía'], correcta: 2 },
  { pregunta: '¿Cuál es el hueso más largo del cuerpo humano?', opciones: ['Fémur', 'Tibia', 'Húmero'], correcta: 0 },
  { pregunta: '¿Cuántos corazones tiene un pulpo?', opciones: ['1', '2', '3'], correcta: 2 },
];

const TIEMPO_LIMITE_TRIVIA_MS = 30 * 1000;
const TIEMPO_LIMITE_ADIVINA_MS = 60 * 1000;

const triviaActiva = new Map(); // grupoId -> { pregunta, correcta, timeout }
const adivinaActivo = new Map(); // grupoId -> { numero, intentos, min, max, timeout }

function elegirAlAzar(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

async function comandoTrivia(sock, grupoId) {
  if (triviaActiva.has(grupoId)) {
    await sock.sendMessage(grupoId, { text: 'Ya hay una trivia activa, respóndanla primero con !r <número>.' });
    return;
  }

  const item = elegirAlAzar(PREGUNTAS_TRIVIA);
  const opcionesTexto = item.opciones.map((op, i) => `${i + 1}. ${op}`).join('\n');

  const timeout = setTimeout(async () => {
    if (triviaActiva.get(grupoId)?.pregunta === item.pregunta) {
      triviaActiva.delete(grupoId);
      try {
        await sock.sendMessage(grupoId, {
          text: `⏱️ Se acabó el tiempo. La respuesta correcta era: *${item.opciones[item.correcta]}*`,
        });
      } catch (e) {
        console.log('No se pudo enviar el cierre de trivia:', e.message);
      }
    }
  }, TIEMPO_LIMITE_TRIVIA_MS);

  triviaActiva.set(grupoId, { pregunta: item.pregunta, correcta: item.correcta, timeout });

  await sock.sendMessage(grupoId, {
    text: `🧠 *Trivia*\n\n${item.pregunta}\n\n${opcionesTexto}\n\nResponde con !r <número>. Tienes 30 segundos.`,
  });
}

async function manejarRespuestaTrivia(sock, grupoId, sender, textoRespuesta) {
  const activa = triviaActiva.get(grupoId);
  if (!activa) return false;

  const numero = parseInt(textoRespuesta.trim(), 10);
  if (isNaN(numero)) return false;

  const esCorrecta = numero - 1 === activa.correcta;
  clearTimeout(activa.timeout);
  triviaActiva.delete(grupoId);

  const nombre = sender.split('@')[0];
  if (esCorrecta) {
    await sock.sendMessage(grupoId, {
      text: `🎉 @${nombre} ¡correcto! Bien ahí.`,
      mentions: [sender],
    });
  } else {
    await sock.sendMessage(grupoId, {
      text: `❌ @${nombre} no era esa. Se acabó la ronda.`,
      mentions: [sender],
    });
  }
  return true;
}

async function comandoAdivina(sock, grupoId) {
  if (adivinaActivo.has(grupoId)) {
    await sock.sendMessage(grupoId, { text: 'Ya hay un número por adivinar, sigan intentando con !n <número>.' });
    return;
  }

  const min = 1;
  const max = 50;
  const numero = Math.floor(Math.random() * (max - min + 1)) + min;

  const timeout = setTimeout(async () => {
    if (adivinaActivo.has(grupoId)) {
      adivinaActivo.delete(grupoId);
      try {
        await sock.sendMessage(grupoId, {
          text: `⏱️ Se acabó el tiempo. El número era: *${numero}*`,
        });
      } catch (e) {
        console.log('No se pudo enviar el cierre de adivina:', e.message);
      }
    }
  }, TIEMPO_LIMITE_ADIVINA_MS);

  adivinaActivo.set(grupoId, { numero, intentos: 0, min, max, timeout });

  await sock.sendMessage(grupoId, {
    text: `🔢 Pensé un número entre ${min} y ${max}. Adivínalo con !n <número>. Tienes 60 segundos.`,
  });
}

async function manejarRespuestaAdivina(sock, grupoId, sender, textoRespuesta) {
  const activo = adivinaActivo.get(grupoId);
  if (!activo) return false;

  const intento = parseInt(textoRespuesta.trim(), 10);
  if (isNaN(intento)) return false;

  activo.intentos++;
  const nombre = sender.split('@')[0];

  if (intento === activo.numero) {
    clearTimeout(activo.timeout);
    adivinaActivo.delete(grupoId);
    await sock.sendMessage(grupoId, {
      text: `🎉 @${nombre} ¡le atinaste! Era el *${activo.numero}*, en ${activo.intentos} intentos entre todos.`,
      mentions: [sender],
    });
  } else if (intento < activo.numero) {
    await sock.sendMessage(grupoId, { text: `📈 Más alto.` });
  } else {
    await sock.sendMessage(grupoId, { text: `📉 Más bajo.` });
  }
  return true;
}

/**
 * Se llama con cada mensaje de texto para ver si es una respuesta a un juego activo.
 * Devuelve true si el mensaje fue consumido por algún juego.
 */
async function manejarRespuestaJuego(sock, grupoId, sender, cmd, args) {
  if (cmd === 'r') {
    return manejarRespuestaTrivia(sock, grupoId, sender, args.join(' '));
  }
  if (cmd === 'n') {
    return manejarRespuestaAdivina(sock, grupoId, sender, args.join(' '));
  }
  return false;
}

module.exports = { comandoTrivia, comandoAdivina, manejarRespuestaJuego };
