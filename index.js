import "dotenv/config";
import express from "express";
import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder
} from "discord.js";

// 🌐 KEEP ALIVE
const app = express();
app.get("/", (_, res) => res.send("🏥 Hospital Bot Online"));
app.listen(3000);

// 🔐 ENV
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.log("❌ Falta TOKEN / CLIENT_ID / GUILD_ID");
  process.exit(1);
}

// 🛡️ CONFIG
const STAFF_ROLE = "1490431614055088128";

// 🧠 SISTEMA
let config = { painel: null, msgId: null };

const pontos = new Map();          // plantão
const chamados = new Map();        // pacientes ativos
const atendimentoAtivo = new Map();// médico -> paciente

const stats = new Map();           // médicos stats

// 🚀 CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

// ⏱ FORMAT
function format(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// 📌 COMANDOS
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel hospital")
    .addChannelOption(o =>
      o.setName("canal").setDescription("Canal painel").setRequired(true)),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("TOP 3 médicos")
].map(c => c.toJSON());

// 🔥 READY
client.once("ready", async () => {
  console.log(`🏥 Online como ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  setInterval(updatePanel, 15000);
});

// 🏥 PAINEL
function painel() {
  return new EmbedBuilder()
    .setColor("#0f172a")
    .setTitle("🏥 HOSPITAL RP SYSTEM")
    .setDescription(`
🟢 Sistema ativo

👨‍⚕️ Médicos em plantão: ${pontos.size}
📞 Pacientes ativos: ${chamados.size}

🩺 Atendimento em andamento: ${atendimentoAtivo.size}
    `);
}

// 🔘 BOTÕES
function row() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("iniciar")
      .setLabel("🟢 Iniciar")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("finalizar")
      .setLabel("🔴 Finalizar")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("chamar")
      .setLabel("📞 Chamar Médico")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("atender")
      .setLabel("🩺 Atender")
      .setStyle(ButtonStyle.Secondary)
  );
}

// 🔄 UPDATE PANEL
async function updatePanel() {
  try {
    if (!config.painel || !config.msgId) return;

    const channel = await client.channels.fetch(config.painel);
    const msg = await channel.messages.fetch(config.msgId);

    const embed = painel();

    await msg.edit({
      embeds: [embed],
      components: [row()]
    });
  } catch {}
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  // COMMANDS
  if (interaction.isChatInputCommand()) {

    // PAINEL
    if (interaction.commandName === "painelhp") {
      const canal = interaction.options.getChannel("canal");

      config.painel = canal.id;

      const msg = await canal.send({
        embeds: [painel()],
        components: [row()]
      });

      config.msgId = msg.id;

      return interaction.reply({ content: "✅ Painel criado!", ephemeral: true });
    }

    // RANKING TOP 3
    if (interaction.commandName === "rankinghp") {

      const sorted = [...stats.entries()]
        .sort((a, b) => b[1].atendimentos - a[1].atendimentos);

      const top = (i) => sorted[i]
        ? `<@${sorted[i][0]}> • 🩺 ${sorted[i][1].atendimentos}`
        : "Sem dados";

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🏆 TOP 3 MÉDICOS")
            .setColor("Gold")
            .setDescription(`
🥇 TOP 1
${top(0)}

🥈 TOP 2
${top(1)}

🥉 TOP 3
${top(2)}

────────────────
📊 Baseado em atendimentos
🏥 Hospital RP
            `)
        ]
      });
    }
  }

  // BUTTONS
  if (!interaction.isButton()) return;

  const id = interaction.user.id;

  // 🟢 INICIAR
  if (interaction.customId === "iniciar") {
    pontos.set(id, { inicio: Date.now() });
    return interaction.reply({ content: "🟢 Plantão iniciado!", ephemeral: true });
  }

  // 🔴 FINALIZAR
  if (interaction.customId === "finalizar") {

    const p = pontos.get(id);
    if (!p) return interaction.reply({ content: "❌ Não está em plantão", ephemeral: true });

    pontos.delete(id);

    return interaction.reply({
      content: `🔴 Finalizado: ${format(Date.now() - p.inicio)}`,
      ephemeral: true
    });
  }

  // 📞 CHAMAR
  if (interaction.customId === "chamar") {

    if (chamados.has(id)) {
      return interaction.reply({ content: "❌ Já tem chamado ativo", ephemeral: true });
    }

    chamados.set(id, true);

    return interaction.reply({
      content: "📞 Médico chamado!",
      ephemeral: true
    });
  }

  // 🩺 ATENDER
  if (interaction.customId === "atender") {

    const medicoId = id;

    if (atendimentoAtivo.has(medicoId)) {
      return interaction.reply({ content: "❌ Já atendendo alguém", ephemeral: true });
    }

    const paciente = [...chamados.keys()][0];

    if (!paciente) {
      return interaction.reply({ content: "❌ Nenhum chamado", ephemeral: true });
    }

    atendimentoAtivo.set(medicoId, paciente);
    chamados.delete(paciente);

    // 📊 stats
    if (!stats.has(medicoId)) {
      stats.set(medicoId, { atendimentos: 0 });
    }

    stats.get(medicoId).atendimentos++;

    return interaction.reply({
      content: `🩺 Atendendo <@${paciente}>`,
      ephemeral: true
    });
  }
});

client.login(TOKEN);
