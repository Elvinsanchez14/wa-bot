// index.js
// Bloque 1: conexión a WhatsApp + base de datos.
// Los bloques siguientes (moderación, comandos, conversación) se conectan
// escuchando los mismos eventos que ya están preparados aquí abajo.

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

// ==== SUPER ADMINS ====
// Estos números tienen control total sobre TODOS los grupos donde esté el bot,
// sin importar si son admins de WhatsApp ahí. Formato: codigopais+numero@s.whatsapp.net
const SUPER_ADMINS = [
  '521XXXXXXXXXX@s.whatsapp.net', // <-- cambia esto por tu número real
];

db.init();
console.log('✅ Base de datos inicializada en data/ (archivos JSON)');

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
      if (shouldReconnect) startBot();
      else console.log('❌ Sesión cerrada. Borra la carpeta auth_info y vuelve a escanear el QR.');
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

  // ==== Placeholder de eventos: aquí se conectan los bloques 2, 3, 4... ====
  sock.ev.on('group-participants.update', async (update) => {
    // Bloque 2 va a manejar esto: registrar entrada + bienvenida
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    // Bloque 2, 3, 4... van a manejar esto: comandos, antilink, flood, conversación
  });

  return sock;
}

startBot();
