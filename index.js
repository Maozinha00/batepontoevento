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
app.get("/", (_, res) => res.send("🏥 Hospital RP Online"));
app.listen(3000);

// 🔐 CONFIG
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = "1477683902041690342";

if (!TOKEN || !CLIENT_ID) {
  console.log("❌ TOKEN ou CLIENT_ID faltando");
  process.exit(1);
}

// 🛡️ STAFF ROLE
const STAFF_ROLE = "1195468742595985444";

// 🧠 SISTEMA
let config = { painel: null, msgId: null };

const stats = new Map();
/*
medicoId => {
  inicio: timestamp,
  horas: ms,
  chamados: number,
  tratamentos: number
}
*/

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

// 🏥 PAINEL
function painel() {

  const medicos = [...stats.entries()].map(([id, d]) => {
    const ativo = d.inicio ? Date.now() - d.inicio : 0;
    const total = (d.horas || 0) + ativo;
    return `┆ 🟢 <@${id}> • ${format(total)}`;
  }).join("\n") || "┆ Nenhum médico em serviço";

  const sorted = [...stats.entries()]
    .sort((a, b) => b[1].tratamentos - a[1].tratamentos);

  const top = (i) =>
    sorted[i]
      ? `┆ ${i + 1}. <@${sorted[i][0]}> • ${sorted[i][1].tratamentos} 💉`
      : `┆ ${i + 1}. Sem dados`;

  const totalChamados = [...stats.values()]
    .reduce((a, b) => a + (b.chamados || 0), 0);

  const totalTratamentos = [...stats.values()]
    .reduce((a, b) => a + (b.tratamentos || 0), 0);

  return new EmbedBuilder()
    .setColor("#0f172a")
    .setDescription(`
🏥 ═══════〔 HOSPITAL BELLA 〕═══════

╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🏥 Sistema Hospitalar Ativo
╰━━━━━━━━━━━━━━━━━━━━╯

👑 RESPONSÁVEL DO PLANTÃO
┆ Equipe em serviço

━━━━━━━━━━━━━━━━━━━━

👨‍⚕️ MÉDICOS EM SERVIÇO
${medicos}

━━━━━━━━━━━━━━━━━━━━

🏆 TOP 3 DO PLANTÃO
${top(0)}
${top(1)}
${top(2)}

━━━━━━━━━━━━━━━━━━━━

📊 STATUS DO SISTEMA
┆ 👥 Ativos: ${stats.size}
┆ 📞 Chamados: ${totalChamados}
┆ 💉 Tratamentos: ${totalTratamentos}

┆ ⏱️ Atualizado: <t:${Math.floor(Date.now()/1000)}:R>

━━━━━━━━━━━━━━━━━━━━

💉 Hospital Bella • Sistema Premium RP
    `);
}

// 🔘 BOTÕES
function row() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("iniciar")
      .setLabel("🟢 Iniciar Plantão")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("finalizar")
      .setLabel("🔴 Finalizar Plantão")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("chamado")
      .setLabel("📞 Chamado Aceito")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("tratamento")
      .setLabel("💉 Tratamento")
      .setStyle(ButtonStyle.Secondary)
  );
}

// 📌 COMANDOS
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel hospital")
    .addChannelOption(o =>
      o.setName("canal").setDescription("Canal do painel").setRequired(true)
    ),

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

      return interaction.reply({
        content: "✅ Painel criado!",
        ephemeral: true
      });
    }

    // RANKING
    if (interaction.commandName === "rankinghp") {

      const sorted = [...stats.entries()]
        .sort((a, b) => b[1].tratamentos - a[1].tratamentos);

      const top = (i) =>
        sorted[i]
          ? `#${i + 1} <@${sorted[i][0]}> • ${sorted[i][1].tratamentos} 💉`
          : `#${i + 1} Sem dados`;

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🏆 TOP 3 MÉDICOS")
            .setColor("Gold")
            .setDescription(`
🥇 ${top(0)}
🥈 ${top(1)}
🥉 ${top(2)}

🏥 Hospital RP System
            `)
        ]
      });
    }
  }

  if (!interaction.isButton()) return;

  const id = interaction.user.id;

  // 🟢 INICIAR
  if (interaction.customId === "iniciar") {

    if (!stats.has(id)) {
      stats.set(id, { inicio: Date.now(), horas: 0, chamados: 0, tratamentos: 0 });
    }

    stats.get(id).inicio = Date.now();

    return interaction.reply({
      content: "🟢 Plantão iniciado!",
      ephemeral: true
    });
  }

  // 🔴 FINALIZAR
  if (interaction.customId === "finalizar") {

    const data = stats.get(id);
    if (!data || !data.inicio) {
      return interaction.reply({
        content: "❌ Você não está em plantão",
        ephemeral: true
      });
    }

    const tempo = Date.now() - data.inicio;
    data.horas += tempo;
    data.inicio = null;

    return interaction.reply({
      content: `🔴 Plantão finalizado: ${format(tempo)}`,
      ephemeral: true
    });
  }

  // 📞 CHAMADO ACEITO
  if (interaction.customId === "chamado") {

    if (!stats.has(id)) {
      stats.set(id, { horas: 0, chamados: 0, tratamentos: 0 });
    }

    stats.get(id).chamados++;

    return interaction.reply({
      content: "📞 Chamado contabilizado!",
      ephemeral: true
    });
  }

  // 💉 TRATAMENTO
  if (interaction.customId === "tratamento") {

    if (!stats.has(id)) {
      stats.set(id, { horas: 0, chamados: 0, tratamentos: 0 });
    }

    stats.get(id).tratamentos++;

    return interaction.reply({
      content: "💉 Tratamento contabilizado!",
      ephemeral: true
    });
  }
});

client.login(TOKEN);
