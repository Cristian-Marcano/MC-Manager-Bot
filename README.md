# 🎮 MC Manager Bot

> Discord bot para gestionar un contenedor Docker de Minecraft desde cualquier canal de Discord.

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen?logo=node.js)
![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## ✨ Características

- **Slash commands** nativos de Discord (`/start`, `/stop`, `/status`, `/help`, `/mc`)
- **Respuestas con Embeds** con colores e iconos según el estado del servidor
- **Whitelist de servidores** — el bot sólo responde a los guilds que tú configures
- **Registro de comandos por guild** para propagación instantánea (o global si prefieres)
- **Imagen Docker multi-stage** ligera, ejecutada como usuario no-root
- **Healthcheck** integrado en el contenedor

---

## 🛠️ Comandos disponibles

| Comando   | Descripción                                      |
|-----------|--------------------------------------------------|
| `/start`  | 🚀 Inicia el contenedor del servidor de Minecraft |
| `/stop`   | 🛑 Detiene el servidor de forma segura           |
| `/status` | 📊 Muestra el estado actual y el uptime          |
| `/help`   | 📋 Lista todos los comandos disponibles          |
| `/mc`     | 📋 Alias de `/help`                              |

---

## 📋 Requisitos previos

- **Node.js** `>= 20`
- **pnpm** `>= 9` (o npm/yarn)
- **Docker** corriendo en la misma máquina (socket en `/var/run/docker.sock`)
- Una **aplicación de Discord** creada en el [Developer Portal](https://discord.com/developers/applications)
  - Bot token
  - Client ID
  - Bot invitado al servidor con el scope `bot` + `applications.commands`

---

## ⚙️ Configuración

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/MC-manager-bot.git
cd MC-manager-bot
```

### 2. Instalar dependencias

```bash
pnpm install
```

### 3. Crear el archivo `.env`

Copia el ejemplo y completa tus valores:

```bash
cp .env.example .env
```

```env
# Token del bot de Discord (del Developer Portal)
DISCORD_TOKEN=tu_token_aqui

# Client ID de la aplicación de Discord
CLIENT_ID=tu_client_id_aqui

# IDs de los servidores de Discord autorizados (separados por comas)
# Si se omite, los comandos se registran globalmente (hasta 1 hora de propagación)
ALLOWED_GUILD_IDS=123456789012345678,987654321098765432

# Nombre exacto del contenedor Docker de Minecraft
CONTAINER_NAME=mc-server
```

---

## 🚀 Ejecución

### Local (desarrollo)

```bash
# Con recarga automática al guardar cambios
pnpm dev

# Sin recarga automática
pnpm start
```

### Con Docker

**Construir la imagen:**

```bash
docker build -t mc-manager-bot .
```

**Ejecutar el contenedor:**

```bash
docker run -d \
  --name mc-manager-bot \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --env-file .env \
  mc-manager-bot
```

> **Nota:** El montaje de `-v /var/run/docker.sock` es necesario para que el bot pueda controlar los contenedores del host.

---

## 🏗️ Estructura del proyecto

```
MC-manager-bot/
├── index.js          # Código principal del bot
├── Dockerfile        # Imagen Docker multi-stage
├── package.json      # Dependencias y scripts
├── pnpm-lock.yaml    # Lockfile de pnpm
├── .env              # Variables de entorno (NO subir al repo)
├── .env.example      # Plantilla de ejemplo para .env
└── .gitignore
```

---

## 🔐 Seguridad y whitelist de servidores

La variable `ALLOWED_GUILD_IDS` controla en qué servidores de Discord puede actuar el bot:

- **Con IDs configurados:** Los comandos se registran únicamente en esos servidores (propagación instantánea) y el bot ignora cualquier interacción proveniente de otros servidores.
- **Sin IDs configurados:** Los comandos se registran de forma **global** y cualquier servidor donde el bot esté presente podrá ejecutarlos.

Se recomienda siempre configurar `ALLOWED_GUILD_IDS` para evitar acceso no autorizado al servidor de Minecraft.

---

## 📦 Dependencias

| Paquete        | Versión  | Uso                                        |
|----------------|----------|--------------------------------------------|
| `discord.js`   | `^14`    | Cliente de Discord y manejo de slash commands |
| `dockerode`    | `^4`     | SDK para controlar Docker vía socket Unix  |
| `dotenv`       | `^16`    | Carga de variables de entorno desde `.env` |

