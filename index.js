// ============================================================
// MC Manager Bot — Discord bot to manage a Minecraft container
// Slash command edition (/start /stop /status /help /mc)
// ============================================================
import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import Docker from "dockerode";

// Configuration
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CONTAINER_NAME = process.env.CONTAINER_NAME;

// Comma-separated list of allowed Discord server (guild) IDs
const ALLOWED_GUILD_IDS = process.env.ALLOWED_GUILD_IDS
  ? process.env.ALLOWED_GUILD_IDS.split(",").map((id) => id.trim()).filter(Boolean)
  : [];

if (!DISCORD_TOKEN) throw new Error("Missing env var: DISCORD_TOKEN");
if (!CLIENT_ID) throw new Error("Missing env var: CLIENT_ID");
if (!CONTAINER_NAME) throw new Error("Missing env var: CONTAINER_NAME");
if (!ALLOWED_GUILD_IDS.length) {
  console.warn("⚠️  ALLOWED_GUILD_IDS is not set — commands will be registered globally (may take up to 1 hour to propagate).");
}

// Slash command definitions
const COMMANDS = [
  new SlashCommandBuilder()
    .setName("start")
    .setDescription("🚀 Start the Minecraft server container."),
  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("🛑 Stop the Minecraft server safely."),
  new SlashCommandBuilder()
    .setName("status")
    .setDescription("📊 Show the current state and uptime of the server."),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("📋 List all available bot commands."),
  new SlashCommandBuilder()
    .setName("mc")
    .setDescription("📋 Alias for /help — list all available bot commands."),
].map((cmd) => cmd.toJSON());

// Register slash commands via REST
async function registerCommands(client) {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  try {
    if (ALLOWED_GUILD_IDS.length) {
      // Only register in guilds where the bot is actually a member
      for (const guildId of ALLOWED_GUILD_IDS) {
        if (!client.guilds.cache.has(guildId)) {
          console.warn(`⚠️  Skipping guild ${guildId} — bot is not a member of that server.`);
          continue;
        }
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body: COMMANDS });
        console.log(`✅  Slash commands registered in guild ${guildId}`);
      }
    } else {
      // Global: up to 1 hour propagation across all servers
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: COMMANDS });
      console.log("✅  Slash commands registered globally");
    }
  } catch (err) {
    console.error("❌  Failed to register slash commands:", err);
  }
}

// Docker client (Unix socket)
const docker = new Docker({ socketPath: "/var/run/docker.sock" });

// Resolve the container object, throwing a friendly error if not found.
async function getContainer() {
  const containers = await docker.listContainers({ all: true });
  const info = containers.find(
    (c) =>
      c.Names.includes(`/${CONTAINER_NAME}`) ||
      c.Names.includes(CONTAINER_NAME)
  );
  if (!info) throw new Error(`Container **${CONTAINER_NAME}** not found.`);
  return docker.getContainer(info.Id);
}

/** Convert an ISO start-time string to a human-readable uptime. */
function calcUptime(startedAt) {
  if (!startedAt || startedAt.startsWith("0001")) return null;
  const seconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

// Embed helpers
const COLOR = { green: 0x2ecc71, red: 0xe74c3c, yellow: 0xf1c40f, blue: 0x3498db };

function baseEmbed(color) {
  return new EmbedBuilder()
    .setColor(color)
    .setFooter({ text: `Container: ${CONTAINER_NAME}` })
    .setTimestamp();
}

function successEmbed(title, description) {
  return baseEmbed(COLOR.green).setTitle(`✅ ${title}`).setDescription(description);
}

function errorEmbed(title, description) {
  return baseEmbed(COLOR.red).setTitle(`❌ ${title}`).setDescription(description);
}

function codeBlock(text) {
  return `\`\`\`\n${text.slice(0, 1900)}\n\`\`\``;
}

// Command handlers (receive a ChatInputCommandInteraction)

// /start — Start the Minecraft container
async function handleStart(interaction) {
  await interaction.deferReply();
  try {
    const container = await getContainer();
    const info = await container.inspect();

    if (info.State.Running) {
      return interaction.editReply({
        embeds: [errorEmbed("Already Running", `The server is already **online**.\nUptime: \`${calcUptime(info.State.StartedAt) ?? "N/A"}\``)],
      });
    }

    await container.start();
    return interaction.editReply({
      embeds: [successEmbed("Server Started! 🚀", `**${CONTAINER_NAME}** has been started successfully.\nGive it a few seconds to fully boot up.`)],
    });
  } catch (err) {
    console.error("[/start]", err);
    return interaction.editReply({ embeds: [errorEmbed("Start Failed", codeBlock(err.message))] });
  }
}

// /stop — Stop the Minecraft container
async function handleStop(interaction) {
  await interaction.deferReply();
  try {
    const container = await getContainer();
    const info = await container.inspect();

    if (!info.State.Running) {
      return interaction.editReply({
        embeds: [errorEmbed("Already Stopped", `The server is not running (state: \`${info.State.Status}\`).`)],
      });
    }

    await container.stop();
    return interaction.editReply({
      embeds: [
        baseEmbed(COLOR.red)
          .setTitle("🛑 Server Stopped")
          .setDescription(`**${CONTAINER_NAME}** has been stopped safely.`),
      ],
    });
  } catch (err) {
    console.error("[/stop]", err);
    return interaction.editReply({ embeds: [errorEmbed("Stop Failed", codeBlock(err.message))] });
  }
}

// /status — Inspect the container and report its state
async function handleStatus(interaction) {
  await interaction.deferReply();
  try {
    const container = await getContainer();
    const info = await container.inspect();
    const state = info.State;

    const statusLabel = state.Running
      ? "🟢 Running"
      : state.Paused
        ? "🟡 Paused"
        : "🔴 Stopped";

    const color = state.Running ? COLOR.green : state.Paused ? COLOR.yellow : COLOR.red;
    const uptime = state.Running ? calcUptime(state.StartedAt) : null;

    const embed = baseEmbed(color)
      .setTitle("📊 Server Status")
      .addFields(
        { name: "Status", value: statusLabel, inline: true },
        { name: "Container", value: `\`${CONTAINER_NAME}\``, inline: true },
        { name: "Image", value: `\`${info.Config.Image}\``, inline: true }
      );

    if (uptime) {
      embed.addFields({ name: "Uptime", value: `\`${uptime}\``, inline: true });
    }
    if (!state.Running && state.FinishedAt && !state.FinishedAt.startsWith("0001")) {
      embed.addFields({ name: "Stopped At", value: `\`${new Date(state.FinishedAt).toUTCString()}\``, inline: false });
    }

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("[/status]", err);
    return interaction.editReply({ embeds: [errorEmbed("Status Error", codeBlock(err.message))] });
  }
}

// /help & /mc — Show available commands
async function handleHelp(interaction) {
  const embed = baseEmbed(COLOR.blue)
    .setTitle("🎮 MC Manager Bot — Commands")
    .addFields(
      { name: "`/start`", value: "Start the Minecraft server container.", inline: false },
      { name: "`/stop`", value: "Stop the Minecraft server safely.", inline: false },
      { name: "`/status`", value: "Show the current state and uptime.", inline: false },
      { name: "`/help`", value: "Show this help message.", inline: false }
    );
  return interaction.reply({ embeds: [embed] });
}

// Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds], // Only Guilds needed for slash commands
});

client.once("clientReady", async () => {
  console.log(`✅  Logged in as ${client.user.tag}`);
  console.log(`📦  Managing container: ${CONTAINER_NAME}`);
  await registerCommands(client);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Guild whitelist check — silently ignore unauthorized servers
  if (ALLOWED_GUILD_IDS.length && (!interaction.guildId || !ALLOWED_GUILD_IDS.includes(interaction.guildId))) {
    return;
  }

  switch (interaction.commandName) {
    case "start": return handleStart(interaction);
    case "stop": return handleStop(interaction);
    case "status": return handleStatus(interaction);
    case "help":
    case "mc": return handleHelp(interaction);
  }
});

// Handle unexpected errors gracefully — keep the bot alive
client.on("error", (err) => console.error("Discord client error:", err));
process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));

client.login(DISCORD_TOKEN);
