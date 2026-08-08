# wa-bot

Bot de moderación de grupos de WhatsApp usando Baileys, pensado para correr en Termux.

## Instalación en Termux

```bash
pkg update && pkg upgrade -y
pkg install nodejs git python make clang -y

git clone <URL-DE-TU-REPO> wa-bot
cd wa-bot

npm install
```

## Configuración

Antes de correrlo, edita `index.js` y cambia el número en `SUPER_ADMINS` por el tuyo,
en formato `codigopais+numero@s.whatsapp.net` (ej. `521XXXXXXXXXX@s.whatsapp.net`).

## Ejecutar

```bash
node index.js
```

Va a mostrar un código QR en la terminal. Escanéalo desde WhatsApp:
**Ajustes → Dispositivos vinculados → Vincular un dispositivo**.

## Mantenerlo corriendo en segundo plano

```bash
pkg install tmux -y
tmux new -s bot
node index.js
```

Para salir sin cerrar el proceso: `Ctrl+B`, luego `D`.
Para volver a verlo: `tmux attach -t bot`.

## Estado del proyecto

- [x] Bloque 1: conexión a WhatsApp + base de datos SQLite
- [ ] Bloque 2: registro de usuarios + bienvenida + auto-kick por inactividad
- [ ] Bloque 3: antilink por repetición + antispam/flood + antimención masiva
- [ ] Bloque 4: warnings + logs + roles de WhatsApp
- [ ] Bloque 5: utilidad (info, top, purga, stickers, modo silencio)
- [ ] Bloque 6: bot conversacional con banco de frases

## Importante

- Usa un número de WhatsApp secundario, no tu principal — bots no oficiales van
  contra los Términos de Servicio de WhatsApp y existe riesgo real de baneo.
- Las carpetas `auth_info/` (tu sesión) y `data/` (tu base de datos) nunca se suben
  al repo (ver `.gitignore`) — son locales y sensibles a cada instalación.
