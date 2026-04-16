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

// 🧠 SISTEMA
let config = { painel: null, msgId: null };

const stats = new Map();
/*
id => {
  inicio: timestamp | null,
  horas: ms,
  chamados: number,
  tratamentos: number
}
*/

// 🚀 CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const rest = new REST({ version: 10 }).setToken(TOKEN);

// ⏱ FORMAT
function format(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// 🏥 PAINEL
function painel() {

  const medicos = [...stats.entries()]
    .filter(([_, d]) => d.inicio)
    .map(([id, d]) => {
      const ativo = Date.now() - d.inicio;
      const total = d.horas + ativo;
      return `┆ 🟢 <@${id}> • ${format(total)}`;
    })
    .join("\n") || "┆ Nenhum médico em serviço";

  const sorted = [...stats.entries()]
    .sort((a, b) => b[1].tratamentos - a[1].tratamentos);

  const top = (i) =>
    sorted[i]
      ? `┆ ${i + 1}. <@${sorted[i][0]}> • ${sorted[i][1].tratamentos} 💉`
      : `┆ ${i + 1}. Sem dados`;

  const totalChamados = [...stats.values()].reduce((a, b) => a + (b.chamados || 0), 0);
  const totalTratamentos = [...stats.values()].reduce((a, b) => a + (b.tratamentos || 0), 0);

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
┆ 👥 Médicos: ${stats.size}
┆ 📞 Chamados: ${totalChamados}
┆ 💉 Tratamentos: ${totalTratamentos}

┆ ⏱️ Atualizado: <t:${Math.floor(Date.now() / 1000)}:R>

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

  // 📞 CHAMADO
  if (interaction.customId === "chamado") {

    const data = stats.get(id);

    if (!data || !data.inicio) {
      return interaction.reply({
        content: "❌ Você precisa estar em plantão!",
        ephemeral: true
      });
    }

    data.chamados++;

    return interaction.reply({
      content: "📞 Chamado contabilizado!",
      ephemeral: true
    });
  }

  // 💉 TRATAMENTO
  if (interaction.customId === "tratamento") {

    const data = stats.get(id);

    if (!data || !data.inicio) {
      return interaction.reply({
        content: "❌ Você precisa estar em plantão!",
        ephemeral: true
      });
    }

    data.tratamentos++;

    return interaction.reply({
      content: "💉 Tratamento contabilizado!",
      ephemeral: true
    });
  }
});

client.login(TOKEN);
