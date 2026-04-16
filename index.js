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
app.get("/", (_, res) => res.send("Bot online 🔥"));
app.listen(3000);

// 🔐 ENV (ARRUMADO)
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = "1477683902041690342";
// 🏷️ CONFIG
const STAFF_ROLE = "1195468742595985444";

// 🧠 DATABASE
const db = new Map();
let painel = { canal: null, msgId: null };

// 👤 USER DATA
function getUser(id) {
  if (!db.has(id)) {
    db.set(id, {
      inicio: null,
      tempo: 0,
      atendimentos: 0,
      chamados: 0
    });
  }
  return db.get(id);
}

// ⏱ FORMAT
function format(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// 🧮 SCORE (ranking real competitivo)
function score(u) {
  return u.tempo + (u.atendimentos * 300000) + (u.chamados * 180000);
}

// 🤖 CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

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
    .setDescription("Ver ranking geral"),

  new SlashCommandBuilder()
    .setName("resethp")
    .setDescription("Resetar sistema")
].map(c => c.toJSON());

// 🚀 READY
client.once("ready", async () => {
  console.log(`🔥 ${client.user.tag} online`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  setInterval(updatePanel, 10000);
});

// 🏥 UPDATE PANEL
async function updatePanel() {
  try {
    if (!painel.canal || !painel.msgId) return;

    const canal = await client.channels.fetch(painel.canal);
    const msg = await canal.messages.fetch(painel.msgId);

    let lista = "";

    for (const [id, data] of db) {
      if (data.inicio) {
        lista += `┆ 🟢 <@${id}> • ${format(Date.now() - data.inicio)}\n`;
      }
    }

    const top = [...db.entries()]
      .sort((a, b) => score(b[1]) - score(a[1]))
      .slice(0, 3)
      .map(([id, d], i) => `
🏅 ${i + 1}. <@${id}>
┆ ⏱️ ${format(d.tempo)}
┆ 🏥 ${d.atendimentos}
┆ 📞 ${d.chamados}
`).join("\n");

    const embed = new EmbedBuilder()
      .setColor("#0f172a")
      .setDescription(`
╔══════════════════════════════╗
        🏥 **HOSPITAL BELLA**
╚══════════════════════════════╝

👨‍⚕️ **EM SERVIÇO**
${lista || "┆ ❌ Nenhum médico"}

╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🏆 **TOP 3 COMPETITIVO**
╰━━━━━━━━━━━━━━━━━━━━╯
${top || "┆ ❌ Sem dados"}

╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📊 **STATUS**
╰━━━━━━━━━━━━━━━━━━━━╯
┆ 🟢 Ativos: ${[...db.values()].filter(u=>u.inicio).length}
┆ ⏱️ Atualizado: <t:${Math.floor(Date.now()/1000)}:R>

╭━━━━━━━━━━━━━━━━━━━━╮
┃ 💉 **SISTEMA**
╰━━━━━━━━━━━━━━━━━━━━╯
┆ 🏥 RP: Bella
┆ ⚙️ Modo: Competitivo
┆ 🔥 Ranking: Ativo
`)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("iniciar").setLabel("🟢 Iniciar").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("finalizar").setLabel("🔴 Finalizar").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("atendimento").setLabel("🏥 Atendimento").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("chamado").setLabel("📞 Chamado").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ranking").setLabel("🏆 Ranking").setStyle(ButtonStyle.Success)
    );

    await msg.edit({ embeds: [embed], components: [row] });

  } catch (e) {
    console.log("Erro painel:", e);
  }
}

// 🔐 STAFF
function isStaff(member) {
  return member.roles.cache.has(STAFF_ROLE);
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  // COMANDOS
  if (interaction.isChatInputCommand()) {

    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (!isStaff(member)) {
      return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });
    }

    if (interaction.commandName === "painelhp") {
      const canal = interaction.options.getChannel("canal");

      const msg = await canal.send({ content: "🏥 Carregando painel..." });

      painel = { canal: canal.id, msgId: msg.id };
      updatePanel();

      return interaction.reply({ content: "✅ Painel criado!", ephemeral: true });
    }

    if (interaction.commandName === "rankinghp") {
      const lista = [...db.entries()]
        .sort((a,b)=> score(b[1]) - score(a[1]))
        .map(([id,d],i)=>`${i+1}. <@${id}> • ${format(d.tempo)} | 🏥 ${d.atendimentos} | 📞 ${d.chamados}`)
        .join("\n");

      return interaction.reply({ content: lista || "Sem dados" });
    }

    if (interaction.commandName === "resethp") {
      db.clear();
      return interaction.reply({ content: "♻️ Resetado!", ephemeral: true });
    }
  }

  // BOTÕES
  if (interaction.isButton()) {

    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (!isStaff(member)) {
      return interaction.reply({ content: "❌ Apenas STAFF", ephemeral: true });
    }

    const user = getUser(interaction.user.id);

    if (interaction.customId === "iniciar") {
      user.inicio = Date.now();
      return interaction.reply({ content: "🟢 Iniciado", ephemeral: true });
    }

    if (interaction.customId === "finalizar") {
      if (!user.inicio) return interaction.reply({ content: "❌ Não iniciou", ephemeral: true });

      const tempo = Date.now() - user.inicio;
      user.tempo += tempo;
      user.inicio = null;

      return interaction.reply({ content: `🔴 ${format(tempo)}`, ephemeral: true });
    }

    if (interaction.customId === "atendimento") {
      user.atendimentos++;
      return interaction.reply({ content: "🏥 Atendimento registrado", ephemeral: true });
    }

    if (interaction.customId === "chamado") {
      user.chamados++;
      return interaction.reply({ content: "📞 Chamado registrado", ephemeral: true });
    }

    if (interaction.customId === "ranking") {
      const lista = [...db.entries()]
        .sort((a,b)=> score(b[1]) - score(a[1]))
        .slice(0,10)
        .map(([id,d],i)=>`${i+1}. <@${id}> • ${format(d.tempo)}`)
        .join("\n");

      return interaction.reply({ content: lista || "Sem dados", ephemeral: true });
    }
  }
});

// 🚀 LOGIN
client.login(TOKEN);
