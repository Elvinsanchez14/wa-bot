// lib/inactividad.js
// Bloque 2, parte 2: revisa periódicamente si hay usuarios nuevos que no han
// hablado dentro del tiempo límite, y los expulsa (o solo avisa, si dry_run está activo).
// Sigue la regla acordada: aviso -> pausa -> kick, nunca al revés.

const db = require('./db');

const INTERVALO_REVISION_MS = 5 * 60 * 1000; // revisa cada 5 minutos
const ESPERA_INICIAL_MS = 30 * 1000; // espera 30s tras conectar antes del primer intento,
                                       // para no chocar con la conexión aún asentándose
const FALLOS_CONSECUTIVOS_PARA_AVISAR = 3; // solo mostramos el error si falla 3 veces seguidas

let fallosConsecutivos = 0;

/**
 * Arranca el revisor periódico. Se llama una sola vez desde index.js,
 * pasándole el sock ya conectado.
 */
function iniciarRevisorInactividad(sock, avisarYExpulsar) {
  setTimeout(() => {
    setInterval(async () => {
      await revisarTodosLosGrupos(sock, avisarYExpulsar);
    }, INTERVALO_REVISION_MS);
  }, ESPERA_INICIAL_MS);

  console.log(`🕐 Revisor de inactividad activo (cada ${INTERVALO_REVISION_MS / 60000} min, primer chequeo en ${ESPERA_INICIAL_MS / 1000}s)`);
}

async function revisarTodosLosGrupos(sock, avisarYExpulsar) {
  let grupos;
  try {
    grupos = await sock.groupFetchAllParticipating();
    fallosConsecutivos = 0; // se recuperó, reiniciamos el contador
  } catch (e) {
    fallosConsecutivos++;
    // Solo mostramos el error si ya falló varias veces seguidas -- una falla
    // aislada por un timeout momentáneo de red no amerita llenar la consola.
    if (fallosConsecutivos >= FALLOS_CONSECUTIVOS_PARA_AVISAR) {
      console.log(`⚠️ No se pudo obtener la lista de grupos (${fallosConsecutivos} intentos fallidos seguidos):`, e.message);
    }
    return;
  }

  for (const grupoId of Object.keys(grupos)) {
    const toleranciaMin = parseInt(db.getConfig(grupoId, 'tolerancia_inactividad_min'), 10);
    const dryRun = db.getConfig(grupoId, 'dry_run') === 'true';

    const inactivos = db.usuariosInactivosNuevos(grupoId, toleranciaMin);

    for (const usuario of inactivos) {
      const nombre = usuario.jid.split('@')[0];

      if (dryRun) {
        // Modo prueba: solo avisamos en consola y en el log, NO expulsamos de verdad.
        console.log(`[DRY RUN] Se expulsaría a @${nombre} en ${grupoId} por inactividad`);
        db.agregarLog(
          grupoId,
          'dry_run_inactividad',
          usuario.jid,
          'sistema',
          'Habría sido expulsado por inactividad (dry_run activo, no se ejecutó)'
        );
        // En dry_run no borramos el registro, para poder seguir viéndolo en pruebas.
        continue;
      }

      const mensaje =
        `⏱️ @${nombre}, no participaste dentro del tiempo límite. ` +
        `Serás removido del grupo en unos segundos.`;

      await avisarYExpulsar(sock, grupoId, usuario.jid, mensaje);
    }
  }
}

module.exports = { iniciarRevisorInactividad };
