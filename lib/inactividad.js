// lib/inactividad.js
// Bloque 2, parte 2: revisa periódicamente si hay usuarios nuevos que no han
// hablado dentro del tiempo límite, y los expulsa (o solo avisa, si dry_run está activo).
// Sigue la regla acordada: aviso -> pausa -> kick, nunca al revés.

const db = require('./db');

const INTERVALO_REVISION_MS = 5 * 60 * 1000; // revisa cada 5 minutos

/**
 * Arranca el revisor periódico. Se llama una sola vez desde index.js,
 * pasándole el sock ya conectado y la lista de grupos a vigilar se obtiene
 * dinámicamente (no hace falta configurarla a mano).
 */
function iniciarRevisorInactividad(sock, avisarYExpulsar) {
  setInterval(async () => {
    try {
      await revisarTodosLosGrupos(sock, avisarYExpulsar);
    } catch (e) {
      console.log('Error en revisor de inactividad:', e.message);
    }
  }, INTERVALO_REVISION_MS);

  console.log(`🕐 Revisor de inactividad activo (cada ${INTERVALO_REVISION_MS / 60000} min)`);
}

async function revisarTodosLosGrupos(sock, avisarYExpulsar) {
  let grupos;
  try {
    grupos = await sock.groupFetchAllParticipating();
  } catch (e) {
    console.log('No se pudo obtener la lista de grupos:', e.message);
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
