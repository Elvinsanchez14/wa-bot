// index.js
// Bloque 1: conexión a WhatsApp + base de datos.
// Los bloques siguientes (moderación, comandos, conversación) se conectan
// escuchando los mismos eventos que ya están preparados aquí abajo.

const { cargarEnv } = require('./lib/cargarEnv');
cargarEnv(); // debe ir antes de cualquier módulo que use process.env (ej. kaiIA.js con GROQ_API_KEY)

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const db = require('./lib/db');
const bienvenida = require('./lib/bienvenida');
const { iniciarRevisorInactividad } = require('./lib/inactividad');
const antispam = require('./lib/antispam');
const { revisarNumeroSpam } = require('./lib/antispamNumeros');
const { manejarComando } = require('./lib/comandos');
const utilidad = require('./lib/utilidad');
const { logMensaje } = require('./lib/logMensajes');
const { registrarReconexion } = require('./lib/monitoreo');
const { manejarKai } = require('./lib/kai');

// ==== SUPER ADMINS ====
// Estos números tienen control total sobre TODOS los grupos donde esté el bot,
// sin importar si son admins de WhatsApp ahí. Formato: codigopais+numero@s.whatsapp.net
const SUPER_ADMINS = [
  '521XXXXXXXXXX@s.whatsapp.net', // <-- cambia esto por tu número real
];

db.init();
console.log('✅ Base de datos inicializada en data/ (archivos JSON)');

// ==== RED DE SEGURIDAD GLOBAL ====
// Si algún error de red (timeout, conexión cerrada, etc.) se nos escapa sin
// un try/catch en alguna parte del código, esto evita que tumbe TODO el bot.
// En vez de eso, solo lo registramos y el bot sigue corriendo.
process.on('unhandledRejection', (reason) => {
  console.log('⚠️ Error no capturado (promesa rechazada), el bot sigue corriendo:', reason?.message || reason);
});
process.on('uncaughtException', (error) => {
  console.log('⚠️ Error no capturado (excepción), el bot sigue corriendo:', error?.message || error);
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('📱 Escanea este código QR desde WhatsApp (Dispositivos vinculados):');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`⚠️ Conexión cerrada (code ${statusCode}). Reconectando: ${shouldReconnect}`);
      if (shouldReconnect) {
        registrarReconexion(sock, SUPER_ADMINS, `código ${statusCode}`);
        startBot();
      } else {
        console.log('❌ Sesión cerrada. Borra la carpeta auth_info y vuelve a escanear el QR.');
      }
    } else if (connection === 'open') {
      console.log('✅ Bot conectado a WhatsApp');
    }
  });

  // ==== Helper: saber si un jid es super admin ====
  function esSuperAdmin(jid) {
    return SUPER_ADMINS.includes(jid);
  }

  // ==== Helper: saber si un jid es admin real del grupo en WhatsApp ====
  async function esAdminDelGrupo(sock, grupoId, jid) {
    try {
      const meta = await sock.groupMetadata(grupoId);
      const participante = meta.participants.find((p) => p.id === jid);
      return participante?.admin === 'admin' || participante?.admin === 'superadmin';
    } catch (e) {
      console.log('No se pudo leer metadata del grupo:', e.message);
      return false;
    }
  }

  // Helper para expulsar respetando la regla: aviso -> pausa -> kick
  async function avisarYExpulsar(sock, grupoId, jid, mensajeAviso, segundosEspera = 5) {
    try {
      await sock.sendMessage(grupoId, {
        text: mensajeAviso,
        mentions: [jid],
      });
      await new Promise((resolve) => setTimeout(resolve, segundosEspera * 1000));
      await sock.groupParticipantsUpdate(grupoId, [jid], 'remove');
      db.agregarLog(grupoId, 'kick', jid, 'sistema', mensajeAviso);
      db.eliminarUsuario(jid, grupoId);
    } catch (e) {
      console.log('Error al expulsar:', e.message);
      db.agregarLog(grupoId, 'kick_fallido', jid, 'sistema', e.message);
    }
  }

  // Exponer helpers y sock para que los siguientes bloques los usen
  sock._helpers = { esSuperAdmin, esAdminDelGrupo, avisarYExpulsar };

  // ==== Bloque 2: bienvenida + registro de usuarios ====
  sock.ev.on('group-participants.update', async (update) => {
    await bienvenida.manejarCambioParticipantes(sock, update);
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const remoteJid = msg.key.remoteJid;
    const isGroup = remoteJid.endsWith('@g.us');
    if (!isGroup) return;

    const sender = msg.key.participant || msg.key.remoteJid;
    logMensaje(sender, remoteJid, msg);

    bienvenida.registrarActividad(sender, remoteJid);
    utilidad.registrarMensajeParaTop(remoteJid, sender);

    const texto =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      '';

    // ==== Bloque 4: comandos (!warn, !kick, !logs, etc.) ====
    // Los comandos SÍ deben funcionar para super admins — antes había un bug
    // que cortaba el flujo completo para ti mismo antes de llegar aquí.
    const fueComando = await manejarComando(sock, remoteJid, sender, msg, texto, sock._helpers);
    if (fueComando) return;

    // A partir de aquí sí excluimos a super admins: nunca se les debe aplicar
    // una sanción automática (antilink, flood, número spam) por error.
    const esSuper = sock._helpers.esSuperAdmin(sender);

    if (!esSuper) {
      // ==== Bloque 3: antilink, flood, antimención ====
      const fueExpulsado = await antispam.revisarAntilink(
        sock, remoteJid, sender, msg, texto, avisarYExpulsar
      );
      if (fueExpulsado) return;

      await antispam.revisarFlood(sock, remoteJid, sender, msg);
      await antispam.revisarAntimencion(sock, remoteJid, sender, msg);
      await revisarNumeroSpam(sock, remoteJid, sender, msg, texto);
    }

    // ==== Bloque 6: Kai, el bot conversacional ====
    await manejarKai(sock, remoteJid, sender, msg, texto);
  });

  // Arranca el revisor periódico de inactividad (Bloque 2, parte 2)
  iniciarRevisorInactividad(sock, avisarYExpulsar);

  return sock;
}

startBot();
 
