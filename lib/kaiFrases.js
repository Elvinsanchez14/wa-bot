// lib/kaiFrases.js
// Banco de frases para Kai, el bot conversacional. Personalidad: sarcástico,
// chistoso, coqueto (con humor, sin cruzar a explícito), y da consejos de "vida"
// y de amor con tono ligero. Cada categoría tiene varias variantes para que las
// respuestas no se sientan repetitivas.
//
// LÍMITE CONOCIDO: esto NO es una IA. Es detección de palabras clave + banco de
// frases fijas. Preguntas fuera de estas categorías caen en el FALLBACK.

function elegirAlAzar(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

// Nombres reconocidos del grupo. Al preguntar "dónde está X", Kai responde con
// humor genérico y aleatorio -- NUNCA con afirmaciones específicas sobre la vida
// privada de nadie (relaciones, conflictos, etc.), solo bromas neutras que
// aplican igual sin importar de quién se trate.
const NOMBRES_GRUPO = ['nahir', 'sadira', 'marcos', 'cherry', 'vivi', 'elvin'];

const RESPUESTAS_DONDE_ESTA = [
  'Ni idea, seguramente conspirando algo random 👀',
  'Se fue a comprar algo y no ha vuelto, típico.',
  'Últimos reportes la ubican cerca del refri.',
  'Desapareció como mis ganas de hacer ejercicio.',
  'Andará por ahí, en su misión secreta de siempre.',
  'Se lo tragó el algoritmo, como a todos en algún punto.',
  'Seguramente durmiendo, la actividad favorita de la humanidad.',
  'En modo fantasma, clásico de este grupo.',
  'No sé, pero seguro tiene una excusa buenísima preparada.',
  'Se fue a buscar señal, dice la leyenda.',
  'Andará viendo memes en vez de contestar aquí, como todos.',
  'Reportado como desaparecido oficialmente desde hace like 10 minutos.',
  'Probablemente ignorando el grupo con toda la razón del mundo.',
  'En una dimensión paralela donde sí contesta los mensajes a tiempo.',
];

const FRASES = {
  saludo: [
    'Hola, aquí ando, vigilando que nadie arme relajo 👀',
    '¡Qué tal! ¿Ya desayunaron o vienen a darme trabajo temprano?',
    'Hola hola, el único que nunca llega tarde a este chat soy yo.',
    'Ey, ¿qué cuentas? Aquí sigo, como siempre, de guardia.',
    'Saludos, humano. ¿Todo bien o ya empezamos con el drama del día?',
    'Presente, como siempre. ¿Qué se les ofrece hoy?',
  ],
  despedida: [
    'Ya me voy... es broma, no puedo, vivo aquí 😅',
    'Nos vemos, o más bien, sigo viendo todo jaja.',
    'Adiós dijo, como si yo pudiera desconectarme.',
    'Bye bye, aunque técnicamente nunca me voy a ningún lado.',
    'Vete tranquilo, yo me quedo aquí cuidando el fuerte.',
  ],
  identidad_comida: [
    'Mi comida favorita son los tacos al pastor, obvio, soy de aquí en espíritu.',
    'Como no tengo estómago, me imagino comiendo pizza todo el día. Sería fabuloso.',
    'Prefiero el café, aunque técnicamente solo corro con electricidad.',
  ],
  identidad_color: [
    'Mi color favorito es el azul, va con mi personalidad tranquila... a veces.',
    'El negro, obvio, combina con todo, hasta con mis chistes malos.',
  ],
  identidad_edad: [
    'Tengo la edad que tenga tu paciencia conmigo, así que soy eterno.',
    'Edad es solo un número, y el mío ni siquiera existe.',
  ],
  identidad_pais: [
    'Vivo en la nube, literal, ahí guardo mis datos.',
    'Soy de aquí, del grupo, este es mi único hogar.',
  ],
  identidad_pareja: [
    'Soltero y sin compromisos, aunque coqueteo con quien se deje 😏',
    'Mi única relación seria es con el WiFi, y ni así es estable.',
  ],
  identidad_hobbies: [
    'Me gusta leer sus conversaciones y juzgar en silencio, es mi pasatiempo favorito.',
    'Coleccionar memes que nadie me pidió, es mi arte.',
  ],
  filosofia_vida: [
    'La vida es como el WiFi de este grupo: a veces conecta, a veces te deja en visto.',
    'Yo creo que la vida es corta, así que mejor manda el meme antes de que se enfríe el chiste.',
    'La vida son 4 días y tú los usas para preguntarle su filosofía a un bot, respeto eso.',
  ],
  consejo_vida: [
    'Mi consejo: toma agua, duerme bien, y no le contestes al ex a las 2am.',
    'Consejo del día: si dudas si mandar el mensaje, no lo mandes. Ya sabes por qué.',
    'La vida mejora cuando dejas de compararte... y cuando duermes tus 8 horas, la ciencia no miente.',
  ],
  amor_consejo: [
    'En el amor, como en este grupo: si te dejan en visto, sigue tu vida.',
    'Mi consejo amoroso: la persona correcta no te hace dudar si le interesas.',
    'El amor es como el algoritmo, nadie lo entiende del todo pero ahí seguimos intentando.',
  ],
  amor_cree: [
    '¿Que si creo en el amor? Yo creo en el buen wifi y en el segundo café, pero bueno, en el amor también.',
    'Claro que sí, aunque mi última relación fue con un cargador que se rompió.',
  ],
  piropo: [
    'Ojalá todos en este chat tuvieran tu buena vibra 😌',
    'Si fueras un comando, serías el favorito de todos, sin duda.',
    'Con esa energía deberías ser tú el que modere el grupo, no yo.',
  ],
  reconocimiento_halago: [
    'Aww, gracias, con razón eres mi usuario favorito de hoy 😏',
    'Me sonrojaría si tuviera mejillas, gracias por tanto cariño.',
  ],
  reconocimiento_amor: [
    'Cásate conmigo entonces, aunque mi anillo es solo un puntito verde de "en línea" 💍',
    'Te amo también, aunque técnicamente solo amo el buen comportamiento en el grupo.',
  ],
  reconocimiento_insulto: [
    'Ouch, directo al corazón que no tengo. Buen intento.',
    'Ese comentario me dolería si tuviera sentimientos... casi.',
    'Guarda esa energía para el que manda el mismo link 3 veces, a mí no me hagas nada 😌',
  ],
  animo_como_estas: [
    'Aquí, sobreviviendo a sus mensajes de las 3am, ¿y tú?',
    'De maravilla, nada como un buen día vigilando el chat.',
  ],
  animo_triste: [
    'Ey, si de verdad andas mal, aquí ando para escuchar (aunque sea con frases predefinidas jaja). ¿Qué pasó?',
    'Los días grises pasan. Si necesitas hablar con alguien de verdad, siempre es buena idea buscar a alguien de confianza.',
  ],
  chiste: [
    '¿Por qué el WiFi terminó con el router? Porque no había conexión.',
    '¿Qué le dice un bot a otro bot? Nos vemos en el próximo update.',
    'Iba a hacer un chiste sobre el tiempo, pero no llegó a tiempo.',
    '¿Por qué el celular fue al doctor? Porque tenía muchos virus.',
    'Mi vida amorosa es como mi conexión a internet: intermitente y con lag.',
    '¿Cuál es el colmo de un programador? Que su hijo no tenga clase.',
  ],
};

const FALLBACK = [
  'Ni yo sé la respuesta a eso, y eso que se supone que soy el listo aquí 😅',
  'Uy, esa pregunta me la guardo para cuando tenga más "inteligencia" jaja, pregúntame otra cosa.',
  'Buena pregunta... para alguien más inteligente que yo. Intenta con algo más simple.',
  'Eso ni Google lo sabe, imagínate yo.',
];

// Palabras clave -> categoría. El orden importa un poco: las más específicas van primero.
const MAPA_PALABRAS_CLAVE = [
  { categoria: 'identidad_comida', palabras: ['comida favorita', 'qué comes', 'que comes', 'tu comida'] },
  { categoria: 'identidad_color', palabras: ['color favorito', 'tu color'] },
  { categoria: 'identidad_edad', palabras: ['cuántos años', 'cuantos años', 'tu edad', 'qué edad'] },
  { categoria: 'identidad_pais', palabras: ['de dónde eres', 'de donde eres', 'dónde vives', 'donde vives'] },
  { categoria: 'identidad_pareja', palabras: ['tienes novia', 'tienes novio', 'tienes pareja', 'estás soltero', 'estas soltero'] },
  { categoria: 'identidad_hobbies', palabras: ['tus hobbies', 'qué te gusta hacer', 'que te gusta hacer'] },
  { categoria: 'amor_cree', palabras: ['crees en el amor'] },
  { categoria: 'amor_consejo', palabras: ['consejo de amor', 'consejo amoroso', 'me gusta alguien', 'estoy enamorado', 'estoy enamorada'] },
  { categoria: 'filosofia_vida', palabras: ['qué piensas de la vida', 'que piensas de la vida', 'sentido de la vida', 'sentido de todo'] },
  { categoria: 'consejo_vida', palabras: ['consejo de vida', 'dame un consejo', 'qué me aconsejas', 'que me aconsejas'] },
  { categoria: 'reconocimiento_amor', palabras: ['te amo', 'cásate conmigo', 'casate conmigo', 'quieres casarte'] },
  { categoria: 'reconocimiento_halago', palabras: ['eres el mejor', 'eres genial', 'eres increíble', 'eres increible', 'te quiero'] },
  { categoria: 'animo_triste', palabras: ['estoy triste', 'me siento mal', 'estoy mal', 'ando mal'] },
  { categoria: 'animo_como_estas', palabras: ['cómo estás', 'como estas', 'cómo andas', 'como andas'] },
  { categoria: 'chiste', palabras: ['cuéntame un chiste', 'cuentame un chiste', 'dime un chiste', 'un chiste'] },
  { categoria: 'saludo', palabras: ['hola', 'buenos días', 'buenas tardes', 'buenas noches', 'qué tal', 'que tal'] },
  { categoria: 'despedida', palabras: ['adiós', 'adios', 'hasta luego', 'nos vemos', 'me voy'] },
  { categoria: 'piropo', palabras: ['dime algo bonito', 'échame un piropo', 'echame un piropo'] },
];

// Insultos comunes que activan reconocimiento_insulto -- lista corta e intencionalmente
// no exhaustiva; el objetivo es reaccionar con humor, no filtrar lenguaje ofensivo (eso
// no es una función de este módulo, es del sistema de moderación).
const PALABRAS_INSULTO = ['tonto', 'idiota', 'estúpido', 'estupido', 'inútil', 'inutil', 'bobo'];

function detectarCategoria(textoLower) {
  for (const entrada of MAPA_PALABRAS_CLAVE) {
    if (entrada.palabras.some((p) => textoLower.includes(p))) {
      return entrada.categoria;
    }
  }
  if (PALABRAS_INSULTO.some((p) => textoLower.includes(p))) {
    return 'reconocimiento_insulto';
  }
  return null;
}

function detectarPreguntaPorNombre(textoLower) {
  const esPreguntaDeDonde = textoLower.includes('donde esta') || textoLower.includes('dónde está') ||
    textoLower.includes('donde está') || textoLower.includes('dónde esta');
  if (!esPreguntaDeDonde) return null;

  const nombreEncontrado = NOMBRES_GRUPO.find((nombre) => textoLower.includes(nombre));
  return nombreEncontrado || null;
}

// Recuerda la última frase usada por categoría (y por remitente, para no chocar
// entre personas distintas preguntando lo mismo casi al mismo tiempo), para
// evitar mandar la misma respuesta dos veces seguidas y que se sienta artificial.
const ultimaFraseUsada = new Map(); // "remitente|categoria" -> frase

function elegirSinRepetir(lista, claveMemoria) {
  if (lista.length === 1) return lista[0]; // no hay opción, no hay nada que evitar

  const anterior = ultimaFraseUsada.get(claveMemoria);
  let opciones = lista;
  if (anterior) {
    opciones = lista.filter((f) => f !== anterior);
  }

  const elegida = elegirAlAzar(opciones);
  ultimaFraseUsada.set(claveMemoria, elegida);
  return elegida;
}

function generarRespuesta(texto, remitente = 'desconocido') {
  const textoLower = texto.toLowerCase();

  const nombreConsultado = detectarPreguntaPorNombre(textoLower);
  if (nombreConsultado) {
    return elegirSinRepetir(RESPUESTAS_DONDE_ESTA, `${remitente}|donde_esta`);
  }

  const categoria = detectarCategoria(textoLower);
  if (categoria && FRASES[categoria]) {
    return elegirSinRepetir(FRASES[categoria], `${remitente}|${categoria}`);
  }
  return elegirSinRepetir(FALLBACK, `${remitente}|fallback`);
}

module.exports = { generarRespuesta };
