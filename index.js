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

// 🔐 ENV
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.log("❌ ENV faltando");
  process.exit(1);
}

// 🛡️ CONFIG
const STAFF_ROLE = "1490431614055088128";

// 👑 HIERARQUIA
const HIERARQUIA = [
  { id: "1477683902121509018", nome: "👑 Diretor" },
  { id: "1477683902121509017", nome: "🎖️ Vice Diretor" },
  { id: "1477683902121509016", nome: "🔱 Supervisor" },
  { id: "1477683902121509015", nome: "🩺 Coordenador" }
];

// 🧠 BANCO
let config = { painel: null, logs: null, msgId: null };
const pontos = new Map();
const ranking = new Map();
const dados = new Map(); // atendimentos + chamados

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
      o.setName("canal").setDescription("Canal do painel").setRequired(true))
    .addChannelOption(o =>
      o.setName("logs").setDescription("Canal de logs").setRequired(true)),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("Ver ranking completo"),

  new SlashCommandBuilder()
    .setName("resethp")
    .setDescription("Resetar sistema"),

  new SlashCommandBuilder()
    .setName("addhora")
    .setDescription("Adicionar horas")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true))
    .addIntegerOption(o =>
      o.setName("horas").setDescription("Horas").setRequired(true)),

  new SlashCommandBuilder()
    .setName("removerhora")
    .setDescription("Remover horas")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true))
    .addIntegerOption(o =>
      o.setName("horas").setDescription("Horas").setRequired(true))
].map(c => c.toJSON());

// 🔥 READY
client.once("ready", async () => {
  console.log(`🔥 ${client.user.tag} online`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  setInterval(updatePanel, 15000);
});

// ⏱ FORMAT
function format(ms) {
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

// 👑 RESPONSÁVEL
function getBoss(guild) {
  for (const roleData of HIERARQUIA) {
    const role = guild.roles.cache.get(roleData.id);
    if (role && role.members.size > 0) {
      const user = role.members.first();
      return `<@${user.id}> • ${roleData.nome}`;
    }
  }
  return "❌ Nenhum";
}

// 🏥 PAINEL
async function updatePanel() {
  try {
    if (!config.painel) return;

    const channel = await client.channels.fetch(config.painel);
    const msg = await channel.messages.fetch(config.msgId);

    let lista = "";
    for (const [id, data] of pontos) {
      lista += `┆ 🟢 <@${id}> • ${format(Date.now() - data.inicio)}\n`;
    }

    const top = [...ranking.entries()]
      .sort((a,b)=> b[1] - a[1])
      .slice(0,3)
      .map(([id,t],i)=>`
🏅 ${i+1}. <@${id}>
┆ ⏱️ ${format(t)}
┆ 🏥 ${getUser(id).atendimentos}
┆ 📞 ${getUser(id).chamados}
`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor("#0f172a")
      .setDescription(`╔══════════════════════════════╗
        🏥 **HOSPITAL BELLA**
╚══════════════════════════════╝

👑 **RESPONSÁVEL DO PLANTÃO**
${getBoss(channel.guild)}

╭━━━━━━━━━━━━━━━━━━━━╮
┃ 👨‍⚕️ **EM SERVIÇO**
╰━━━━━━━━━━━━━━━━━━━━╯
${lista || "┆ ❌ Nenhum médico"}

╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🏆 **TOP 3 DO PLANTÃO**
╰━━━━━━━━━━━━━━━━━━━━╯
${top || "┆ ❌ Sem dados"}

╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📊 **STATUS**
╰━━━━━━━━━━━━━━━━━━━━╯
┆ 🟢 Ativos: ${pontos.size}
┆ ⏱️ Atualizado: <t:${Math.floor(Date.now()/1000)}:R>

💉 Sistema Premium RP`)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("iniciar").setLabel("🟢 INICIAR").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("finalizar").setLabel("🔴 FINALIZAR").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("atendimento").setLabel("🏥 ATENDIMENTO").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("chamado").setLabel("📞 CHAMADO").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ranking").setLabel("🏆 RANKING").setStyle(ButtonStyle.Success)
    );

    await msg.edit({ embeds: [embed], components: [row] });

  } catch {}
}

// 🔐 STAFF
function isStaff(member) {
  return member.roles.cache.has(STAFF_ROLE);
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  if (interaction.isChatInputCommand()) {

    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!isStaff(member)) {
      return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });
    }

    if (interaction.commandName === "painelhp") {
      const canal = interaction.options.getChannel("canal");
      const logs = interaction.options.getChannel("logs");

      const msg = await canal.send({ content: "🏥 Carregando painel..." });

      config = { painel: canal.id, logs: logs.id, msgId: msg.id };

      updatePanel();

      return interaction.reply({ content: "✅ Painel criado!", ephemeral: true });
    }

    if (interaction.commandName === "rankinghp") {
      const lista = [...ranking.entries()]
        .sort((a,b)=> b[1] - a[1])
        .map(([id,t],i)=>`${i+1}. <@${id}> • ${format(t)}`)
        .join("\n");

      return interaction.reply({ content: lista || "Sem dados", ephemeral: true });
    }

    if (interaction.commandName === "resethp") {
      pontos.clear();
      ranking.clear();
      dados.clear();
      return interaction.reply({ content: "♻️ Resetado!", ephemeral: true });
    }

    if (interaction.commandName === "addhora") {
      const u = interaction.options.getUser("usuario");
      const h = interaction.options.getInteger("horas");

      ranking.set(u.id, (ranking.get(u.id) || 0) + h * 3600000);

      return interaction.reply({ content: "✅ Adicionado!", ephemeral: true });
    }

    if (interaction.commandName === "removerhora") {
      const u = interaction.options.getUser("usuario");
      const h = interaction.options.getInteger("horas");

      ranking.set(u.id, Math.max(0, (ranking.get(u.id) || 0) - h * 3600000));

      return interaction.reply({ content: "❌ Removido!", ephemeral: true });
    }
  }

  // 🔘 BOTÕES
  if (interaction.isButton()) {

    const id = interaction.user.id;

    if (interaction.customId === "iniciar") {
      pontos.set(id, { inicio: Date.now() });
      return interaction.reply({ content: "🟢 Turno iniciado", ephemeral: true });
    }

    if (interaction.customId === "finalizar") {
      const p = pontos.get(id);
      if (!p) return interaction.reply({ content: "❌ Não iniciou", ephemeral: true });

      const time = Date.now() - p.inicio;
      ranking.set(id, (ranking.get(id) || 0) + time);
      pontos.delete(id);

      return interaction.reply({ content: `🔴 ${format(time)}`, ephemeral: true });
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
        .sort((a,b)=> b[1] - a[1])
        .map(([id,t],i)=>`${i+1}. <@${id}> • ${format(t)}`)
        .join("\n");

      return interaction.reply({ content: lista || "Sem dados", ephemeral: true });
    }
  }
});

client.login(TOKEN);
