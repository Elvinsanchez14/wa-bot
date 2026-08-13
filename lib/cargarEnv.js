// lib/cargarEnv.js
// Carga variables de entorno desde un archivo .env, sin depender de la
// librería "dotenv" (para no agregar una dependencia más que instalar en Termux).
// Formato esperado: una variable por línea, CLAVE=valor. Líneas que empiezan
// con # se ignoran (comentarios).

const fs = require('fs');
const path = require('path');

function cargarEnv() {
  const rutaEnv = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(rutaEnv)) return;

  const contenido = fs.readFileSync(rutaEnv, 'utf-8');
  for (const linea of contenido.split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;

    const igual = limpia.indexOf('=');
    if (igual === -1) continue;

    const clave = limpia.slice(0, igual).trim();
    const valor = limpia.slice(igual + 1).trim();

    // No sobreescribimos si ya existe en el entorno real (permite override manual)
    if (!(clave in process.env)) {
      process.env[clave] = valor;
    }
  }
}

module.exports = { cargarEnv };
