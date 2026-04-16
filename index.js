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
  console.log("❌ TOKEN / CLIENT_ID faltando");
  process.exit(1);
}

// 🛡️ STAFF ROLE
const STAFF_ROLE = "1195468742595985444";

// 🧠 SISTEMA
let config = { painel: null, msgId: null };

const pontos = new Map(); // plantão
const stats = new Map();  // médicos

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

// 📊 ADD TRATAMENTO
function addTratamento(id) {
  if (!stats.has(id)) {
    stats.set(id, { tratamentos: 0 });
  }
  stats.get(id).tratamentos++;
}

// 🏥 PAINEL
function painel() {

  const medicos = [...pontos.entries()].map(([id, data]) => {
    const tempo = Date.now() - data.inicio;
    return `┆ 🟢 <@${id}> • ${format(tempo)}`;
  }).join("\n") || "┆ Nenhum médico em serviço";

  const sorted = [...stats.entries()]
    .sort((a, b) => b[1].tratamentos - a[1].tratamentos);

  const top = (i) =>
    sorted[i]
      ? `┆ ${i + 1}. <@${sorted[i][0]}> • ${sorted[i][1].tratamentos} tratamentos`
      : `┆ ${i + 1}. Sem dados`;

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
┆ 🟢 Ativos: ${pontos.size}
┆ 💉 Tratamentos: ${[...stats.values()].reduce((a,b)=>a+b.tratamentos,0)}

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
      .setStyle(ButtonStyle.Danger)
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
    .setDescription("Ver TOP 3 médicos")
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

    // RANKING TOP 3
    if (interaction.commandName === "rankinghp") {

      const sorted = [...stats.entries()]
        .sort((a, b) => b[1].tratamentos - a[1].tratamentos);

      const top = (i) =>
        sorted[i]
          ? `#${i + 1} <@${sorted[i][0]}> • ${sorted[i][1].tratamentos} tratamentos`
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
    addTratamento(id);

    return interaction.reply({
      content: `🔴 Finalizado: ${format(Date.now() - p.inicio)}`,
      ephemeral: true
    });
  }
});

client.login(TOKEN);
