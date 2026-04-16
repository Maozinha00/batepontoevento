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

import express from "express";

// 🌐 KEEP ALIVE
const app = express();
app.get("/", (_, res) => res.send("Bot online 🔥"));
app.listen(3000);

// 🔐 ENV
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = "1477683902041690342";

if (!TOKEN || !CLIENT_ID) {
  console.log("❌ TOKEN ou CLIENT_ID faltando");
  process.exit(1);
}

// 🏷️ CONFIG
const STAFF_ROLE = "1195468742595985444";

// 🧠 BANCO
const pontos = new Map();
const ranking = new Map();
const dados = new Map();

let painel = { canal: null, msgId: null };

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
      o.setName("canal")
        .setDescription("Canal onde será enviado o painel")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("Ver ranking completo"),

  new SlashCommandBuilder()
    .setName("resetponto")
    .setDescription("Resetar todos os dados")
].map(c => c.toJSON());

// 🔥 READY
client.once("ready", async () => {
  console.log(`🔥 Online: ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  setInterval(updatePanel, 30000);
});

// ⏱ FORMATAR
function formatar(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// 🧠 USER DATA
function getUser(id) {
  if (!dados.has(id)) {
    dados.set(id, { atendimentos: 0, chamados: 0 });
  }
  return dados.get(id);
}

// 🧮 SCORE COMPETITIVO
function getScore(id) {
  const tempo = ranking.get(id) || 0;
  const user = getUser(id);

  return tempo + (user.atendimentos * 300000) + (user.chamados * 180000);
}

// 👑 RESPONSÁVEL
function getBoss() {
  let boss = null;
  let best = 0;

  for (const [id] of pontos) {
    const score = getScore(id);
    if (score > best) {
      best = score;
      boss = id;
    }
  }

  return boss ? `<@${boss}>` : "Nenhum";
}

// 🏥 PAINEL
async function updatePanel() {
  if (!painel.canal) return;

  const channel = await client.channels.fetch(painel.canal).catch(() => null);
  if (!channel) return;

  const msg = await channel.messages.fetch(painel.msgId).catch(() => null);
  if (!msg) return;

  let lista = "";

  for (const [id, data] of pontos) {
    lista += `┆ 🟢 <@${id}> • ${formatar(Date.now() - data.inicio)}\n`;
  }

  const top = [...pontos.keys()]
    .map(id => ({ id, score: getScore(id) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((u, i) => {
      const d = getUser(u.id);
      return `
🏅 ${i + 1}. <@${u.id}>
┆ 🧠 Score: ${u.score}
┆ ⏱️ Tempo: ${formatar(ranking.get(u.id) || 0)}
┆ 🏥 Atend: ${d.atendimentos}
┆ 📞 Cham: ${d.chamados}
`;
    })
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor("#0f172a")
    .setDescription(`╔══════════════════════════════╗
🏥 **HOSPITAL BELLA**
╚══════════════════════════════╝

👑 **RESPONSÁVEL DO PLANTÃO**
${getBoss()}

👨‍⚕️ **EM SERVIÇO**
${lista || "┆ ❌ Nenhum médico"}

🏆 **TOP 3 COMPETITIVO**
${top || "┆ ❌ Sem dados"}

📊 **STATUS**
┆ 🟢 Ativos: ${pontos.size}
┆ ⏱️ Atualizado: <t:${Math.floor(Date.now() / 1000)}:R>

💉 Sistema Premium RP`)
    .setTimestamp();

  const totalAtend = [...dados.values()].reduce((a, b) => a + b.atendimentos, 0);
  const totalCham = [...dados.values()].reduce((a, b) => a + b.chamados, 0);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("iniciar").setLabel("🟢 Iniciar").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("finalizar").setLabel("🔴 Finalizar").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("atendimento").setLabel(`🏥 Atendimento (${totalAtend})`).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("chamado").setLabel(`📞 Chamado (${totalCham})`).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ranking").setLabel("🏆 Ranking").setStyle(ButtonStyle.Success)
  );

  await msg.edit({ embeds: [embed], components: [row] });
}

// 🔐 STAFF CHECK
function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE);
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  if (interaction.isChatInputCommand()) {

    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: "❌ STAFF apenas", ephemeral: true });
    }

    if (interaction.commandName === "painelhp") {
      const canal = interaction.options.getChannel("canal");

      const msg = await canal.send({ content: "🏥 Carregando painel..." });

      painel = { canal: canal.id, msgId: msg.id };

      updatePanel();

      return interaction.reply({ content: "✅ Painel criado!", ephemeral: true });
    }

    if (interaction.commandName === "rankinghp") {
      const lista = [...ranking.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, t], i) => `${i + 1}. <@${id}> • ${formatar(t)}`)
        .join("\n");

      return interaction.reply({ content: lista || "Sem dados", ephemeral: true });
    }

    if (interaction.commandName === "resetponto") {
      pontos.clear();
      ranking.clear();
      dados.clear();

      updatePanel();

      return interaction.reply({ content: "✅ Resetado", ephemeral: true });
    }
  }

  if (interaction.isButton()) {

    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: "❌ STAFF apenas", ephemeral: true });
    }

    const id = interaction.user.id;

    if (interaction.customId === "iniciar") {
      pontos.set(id, { inicio: Date.now() });
      return interaction.reply({ content: "🟢 Iniciado", ephemeral: true });
    }

    if (interaction.customId === "finalizar") {
      const ponto = pontos.get(id);
      if (!ponto) return interaction.reply({ content: "❌ Não iniciou", ephemeral: true });

      const tempo = Date.now() - ponto.inicio;
      ranking.set(id, (ranking.get(id) || 0) + tempo);
      pontos.delete(id);

      return interaction.reply({ content: `🔴 ${formatar(tempo)}`, ephemeral: true });
    }

    if (interaction.customId === "atendimento") {
      getUser(id).atendimentos++;
      return interaction.reply({ content: "🏥 Atendimento registrado", ephemeral: true });
    }

    if (interaction.customId === "chamado") {
      getUser(id).chamados++;
      return interaction.reply({ content: "📞 Chamado registrado", ephemeral: true });
    }

    if (interaction.customId === "ranking") {
      const lista = [...ranking.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, t], i) => `${i + 1}. <@${id}> • ${formatar(t)}`)
        .join("\n");

      return interaction.reply({ content: lista || "Sem dados", ephemeral: true });
    }
  }
});

// 🚀 LOGIN
client.login(TOKEN);
