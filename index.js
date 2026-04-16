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

// 🧠 SISTEMA
let config = { painel: null, msgId: null };

const pontos = new Map();
const chamados = new Map();
const atendimentoAtivo = new Map();
const stats = new Map();

// ⏱ FORMAT
function format(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// 🏥 PAINEL
function painel() {

  const medicosAtivos = [...pontos.entries()]
    .map(([id, d]) => {
      const tempo = Date.now() - d.inicio;
      return `┆ 🟢 <@${id}> • ${format(tempo)}`;
    })
    .join("\n") || "┆ Nenhum médico em serviço";

  const sorted = [...stats.entries()]
    .sort((a, b) => (b[1]?.atendimentos || 0) - (a[1]?.atendimentos || 0));

  const top = (i) =>
    sorted[i]
      ? `┆ ${i + 1}. <@${sorted[i][0]}> • ${sorted[i][1].atendimentos} 🩺`
      : `┆ ${i + 1}. Sem dados`;

  return new EmbedBuilder()
    .setColor("#0f172a")
    .setTitle("🏥 HOSPITAL RP SYSTEM")
    .setDescription(`
👨‍⚕️ Médicos em plantão: ${pontos.size}
📞 Pacientes na fila: ${chamados.size}
🩺 Atendimentos ativos: ${atendimentoAtivo.size}

👨‍⚕️ MÉDICOS ONLINE
${medicosAtivos}

🏆 TOP MÉDICOS
${top(0)}
${top(1)}
${top(2)}

⏱ Atualizado automaticamente
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

// 🚀 CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const rest = new REST({ version: 10 }).setToken(TOKEN);

// 📌 COMANDOS
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel hospital")
    .addChannelOption(o =>
      o.setName("canal").setDescription("Canal painel").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("Top médicos")
].map(c => c.toJSON());

// 🔥 READY
client.once("ready", async () => {
  console.log(`🏥 ONLINE COMO ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  setInterval(updatePanel, 15000);
});

// 🔄 UPDATE PAINEL
async function updatePanel() {
  try {
    if (!config.painel || !config.msgId) return;

    const channel = await client.channels.fetch(config.painel);
    const msg = await channel.messages.fetch(config.msgId);

    await msg.edit({
      embeds: [painel()],
      components: [row()]
    });

  } catch {}
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === "painelhp") {
      const canal = interaction.options.getChannel("canal");

      config.painel = canal.id;

      const msg = await canal.send({
        embeds: [painel()],
        components: [row()]
      });

      config.msgId = msg.id;

      return interaction.reply({
        content: "✅ Painel criado!",
        ephemeral: true
      });
    }

    if (interaction.commandName === "rankinghp") {

      const sorted = [...stats.entries()]
        .sort((a, b) => (b[1]?.atendimentos || 0) - (a[1]?.atendimentos || 0));

      const top = (i) =>
        sorted[i]
          ? `#${i + 1} <@${sorted[i][0]}> • ${sorted[i][1].atendimentos}`
          : `#${i + 1} Sem dados`;

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🏆 TOP MÉDICOS")
            .setColor("Gold")
            .setDescription(`${top(0)}\n${top(1)}\n${top(2)}`)
        ]
      });
    }
  }

  if (!interaction.isButton()) return;

  const id = interaction.user.id;

  if (!stats.has(id)) {
    stats.set(id, { atendimentos: 0 });
  }

  // 🟢 INICIAR
  if (interaction.customId === "iniciar") {
    pontos.set(id, { inicio: Date.now() });

    return interaction.reply({
      content: "🟢 Plantão iniciado!",
      ephemeral: true
    });
  }

  // 🔴 FINALIZAR
  if (interaction.customId === "finalizar") {

    const p = pontos.get(id);
    if (!p) {
      return interaction.reply({
        content: "❌ Você não está em plantão",
        ephemeral: true
      });
    }

    pontos.delete(id);

    return interaction.reply({
      content: `🔴 Finalizado: ${format(Date.now() - p.inicio)}`,
      ephemeral: true
    });
  }

  // 📞 CHAMAR
  if (interaction.customId === "chamar") {

    if (chamados.has(id)) {
      return interaction.reply({
        content: "❌ Já tem chamado ativo",
        ephemeral: true
      });
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
      return interaction.reply({
        content: "❌ Já está atendendo",
        ephemeral: true
      });
    }

    const paciente = chamados.keys().next().value;

    if (!paciente) {
      return interaction.reply({
        content: "❌ Nenhum chamado na fila",
        ephemeral: true
      });
    }

    atendimentoAtivo.set(medicoId, paciente);
    chamados.delete(paciente);

    stats.get(medicoId).atendimentos++;

    return interaction.reply({
      content: `🩺 Atendendo <@${paciente}>`,
      ephemeral: true
    });
  }
});

client.login(TOKEN);
