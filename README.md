# wa-bot 🤖 (Beta)

Un bot de moderación para grupos de WhatsApp, hecho para correr directo desde un
celular Android usando **Termux**, sin necesidad de una computadora ni un servidor.

> ⚠️ **Versión Beta.** El bot funciona, pero todavía está en desarrollo activo.
> Pueden aparecer errores, comportamientos inesperados, o funciones incompletas.
> Se recomienda probarlo primero en un grupo de prueba antes de usarlo en un
> grupo con gente real.

---

## ¿Qué es esto?

Es un programa que se conecta a tu cuenta de WhatsApp (como si fuera un
"dispositivo vinculado" más, igual que WhatsApp Web) y vigila un grupo para
ayudar a mantenerlo ordenado de forma automática. No necesitas estar pendiente
todo el día — el bot actúa solo, según reglas que tú puedes ajustar.

## ¿Qué hace exactamente?

**Modera el grupo automáticamente:**
- 👋 Da la bienvenida a quien se une, junto con las reglas del grupo
- ⏱️ Si alguien entra y nunca escribe nada, lo expulsa después de un tiempo (para
  filtrar cuentas que solo entran a "espiar" sin participar)
- 🔗 Detecta si alguien manda el mismo enlace varias veces seguidas (spam) y lo expulsa
- 🚫 Detecta ráfagas de mensajes muy rápidos (flood) y menciones masivas, y advierte
- 🧹 Puede limpiar usuarios que llevan mucho tiempo sin hablar (bajo tu comando)

**Da herramientas a los admins reales del grupo:**
- Advertencias acumulables (`!warn`) con expulsión automática al llegar a un límite
- Historial de todo lo que el bot ha hecho (`!logs`), para poder revisar después
- Comandos para expulsar, promover o quitar admins directamente desde el chat

**Le da algo de vida al grupo:**
- `!top` — ranking de quién participa más
- `!info` — cuánto tiempo lleva alguien en el grupo, sus advertencias, etc.
- `!sticker` — convierte cualquier imagen en sticker al instante
- `!silencio on/off` — modo "solo admins hablan", útil para anuncios

Todo esto es **configurable**: los límites de tiempo, cuántas advertencias se
permiten antes de expulsar, etc. se pueden ajustar sin tocar código, directo
desde el chat con el comando `!config`.

## ¿Necesito saber programar para usarlo?

No para usarlo día a día, pero sí vas a necesitar copiar y pegar algunos
comandos en una aplicación llamada Termux (una terminal para Android). Este
README te guía paso a paso.

---

## Instalación

### 1. Instala Termux

Descárgalo desde [F-Droid](https://f-droid.org/packages/com.termux/) (recomendado,
la versión de Play Store está desactualizada).

### 2. Instala las herramientas necesarias

Abre Termux y copia esto:

```bash
pkg update && pkg upgrade -y
pkg install nodejs git python make clang ffmpeg -y
```

### 3. Descarga el proyecto

```bash
git clone <URL-DE-TU-REPO> wa-bot
cd wa-bot
```

### 4. Instala las dependencias del bot

```bash
npm install
```

Esto puede tardar varios minutos la primera vez.

### 5. Configura tu número como administrador principal

```bash
nano index.js
```

Busca la línea `SUPER_ADMINS` y cambia el número de ejemplo por el tuyo, en
este formato: `codigopais+numero@s.whatsapp.net` (sin el símbolo `+`, sin
espacios). Ejemplo para México: `5215512345678@s.whatsapp.net`.

Guarda con `Ctrl+X`, luego `Y`, luego `Enter`.

### 6. Ejecuta el bot

```bash
node index.js
```

Va a aparecer un código QR dibujado en la terminal. Escanéalo desde tu
WhatsApp: **Ajustes → Dispositivos vinculados → Vincular un dispositivo**.

Cuando veas el mensaje `✅ Bot conectado a WhatsApp`, ya está funcionando.

---

## Mantenerlo corriendo todo el tiempo

Si cierras Termux, el bot se detiene. Para que siga funcionando en segundo
plano:

```bash
pkg install tmux -y
tmux new -s bot
node index.js
```

Para salir sin apagar el bot: presiona `Ctrl+B`, suelta, y luego presiona `D`.
Para volver a verlo más tarde: `tmux attach -t bot`.

---

## Comandos disponibles

Escribe `!menu` dentro del grupo para ver la lista completa en cualquier momento.

| Comando | Quién puede usarlo | Qué hace |
|---|---|---|
| `!warn @usuario [motivo]` | Admins | Da una advertencia |
| `!warns [@usuario]` | Todos | Muestra cuántas advertencias tiene alguien |
| `!unwarn @usuario` | Admins | Quita la última advertencia |
| `!kick @usuario` | Admins | Expulsa a alguien |
| `!promote` / `!demote` `@usuario` | Admins | Da o quita el rol de admin |
| `!logs [cantidad]` | Admins | Muestra el historial de acciones del bot |
| `!config [clave valor]` | Admins | Ver o cambiar la configuración del grupo |
| `!reglas` | Todos | Muestra las reglas del grupo |
| `!info [@usuario]` | Todos | Información de un usuario |
| `!top` | Todos | Ranking de participación |
| `!purga inactivos` | Admins | Expulsa usuarios inactivos desde hace mucho |
| `!silencio on/off` | Admins | Solo admins pueden escribir |
| `!sticker` | Todos | Convierte una imagen (respondiéndola) en sticker |

---

## Modo de prueba (dry run)

Por seguridad, el bot **arranca en modo de prueba**: cuando detecta que
"debería" expulsar a alguien por inactividad, **no lo hace de verdad** —
solo lo anota en los registros, para que puedas observar si el
comportamiento es el que esperas.

Cuando confíes en el bot, desactívalo así desde el chat:

```
!config dry_run false
```

---

## Estado del proyecto

- [x] Conexión a WhatsApp + almacenamiento de datos
- [x] Bienvenida + registro de usuarios + auto-kick por inactividad
- [x] Antilink por repetición + antispam/flood + antimención masiva
- [x] Advertencias + historial + roles de administrador
- [x] Utilidades: info, top, purga, stickers, modo silencio
- [ ] Bot conversacional con personalidad propia

---

## Cosas importantes que debes saber

- **Usa un número de WhatsApp secundario**, no tu número principal. Los bots
  no oficiales (como este) van contra los Términos de Servicio de WhatsApp, y
  existe riesgo real de que el número sea bloqueado.
- El bot necesita **ser administrador del grupo** para poder expulsar gente o
  borrar mensajes — agrégalo como admin después de vincularlo.
- Tu sesión (`auth_info/`) y tus datos (`data/`) nunca se suben a GitHub — son
  privados de tu instalación (ver `.gitignore`).
- Este proyecto está en fase **Beta**: repórtame cualquier comportamiento raro
  para seguir mejorándolo.
