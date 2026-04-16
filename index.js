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
const GUILD_ID = "1494180157987229716";

if (!TOKEN || !CLIENT_ID) {
  console.error("❌ TOKEN ou CLIENT_ID não definido");
  process.exit(1);
}

// 🏷️ CONFIG
const STAFF_ROLE = "1195468742595985444";

// 🧠 BANCO
const db = new Map();
let painel = { canal: null, msgId: null };

// 🤖 CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.on("error", console.error);
process.on("unhandledRejection", console.error);

const rest = new REST({ version: "10" }).setToken(TOKEN);

// 📌 COMANDOS
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel hospital")
    .addChannelOption(o =>
      o.setName("canal")
        .setDescription("Canal do painel")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("Ver ranking"),

  new SlashCommandBuilder()
    .setName("resetponto")
    .setDescription("Resetar sistema"),

  new SlashCommandBuilder()
    .setName("addhora")
    .setDescription("Adicionar horas")
    .addUserOption(o =>
      o.setName("usuario")
        .setDescription("Usuário")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("horas")
        .setDescription("Horas")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("minutos")
        .setDescription("Minutos")
    ),

  new SlashCommandBuilder()
    .setName("removerhora")
    .setDescription("Remover horas")
    .addUserOption(o =>
      o.setName("usuario")
        .setDescription("Usuário")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("horas")
        .setDescription("Horas")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("minutos")
        .setDescription("Minutos")
    )

].map(c => c.toJSON());

// 🔥 READY
client.once("clientReady", async () => {
  console.log(`🔥 Online: ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  setInterval(updatePanel, 30000);
});

// 🧠 USER
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

// ⏱ FORMATAR
function format(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// 🏥 PAINEL
async function updatePanel() {
  if (!painel.canal || !painel.msgId) return;

  const canal = await client.channels.fetch(painel.canal).catch(() => null);
  if (!canal) return;

  const msg = await canal.messages.fetch(painel.msgId).catch(() => null);
  if (!msg) return;

  let lista = "";

  for (const [id, data] of db) {
    if (data.inicio) {
      lista += `🟢 <@${id}> • ${format(Date.now() - data.inicio)}\n`;
    }
  }

  const embed = new EmbedBuilder()
    .setColor("#0f172a")
    .setDescription(`
🏥 **═══════〔 HOSPITAL BELLA 〕═══════**

👨‍⚕️ EM SERVIÇO
${lista || "Nenhum médico"}

━━━━━━━━━━━━━━━━━━━━

📊 Ativos: ${[...db.values()].filter(u=>u.inicio).length}

💉 Sistema ativo
`)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("iniciar").setLabel("🟢 Iniciar").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("finalizar").setLabel("🔴 Finalizar").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("atendimento").setLabel("🏥 Atendimento").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("chamado").setLabel("📞 Chamado").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ranking").setLabel("🏆 Ranking").setStyle(ButtonStyle.Success)
  );

  msg.edit({ embeds: [embed], components: [row] }).catch(()=>{});
}

// 🔐 STAFF
function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE);
}

// 🎯 INTERAÇÃO
client.on("interactionCreate", async (interaction) => {

  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  // 🔒 COMANDOS
  if (interaction.isChatInputCommand() && !isStaff(interaction.member)) {
    return interaction.reply({ content: "❌ STAFF apenas", ephemeral: true });
  }

  if (interaction.isChatInputCommand()) {

    await interaction.deferReply({ ephemeral: true });

    if (interaction.commandName === "painelhp") {
      const canal = interaction.options.getChannel("canal");

      if (!canal || !canal.isTextBased()) {
        return interaction.editReply("❌ Canal inválido.");
      }

      const msg = await canal.send({
        content: "🏥 Painel iniciado..."
      }).catch(() => null);

      if (!msg) {
        return interaction.editReply("❌ Não consegui enviar no canal.");
      }

      painel = { canal: canal.id, msgId: msg.id };

      updatePanel();

      return interaction.editReply("✅ Painel criado!");
    }

    if (interaction.commandName === "rankinghp") {
      const lista = [...db.entries()]
        .sort((a,b)=> b[1].tempo - a[1].tempo)
        .map(([id,d],i)=>`${i+1}. <@${id}> • ${format(d.tempo)}`)
        .join("\n");

      return interaction.editReply(lista || "Sem dados");
    }

    if (interaction.commandName === "resetponto") {
      db.clear();
      updatePanel();
      return interaction.editReply("✅ Resetado");
    }

    if (interaction.commandName === "addhora") {
      const u = interaction.options.getUser("usuario");
      const h = interaction.options.getInteger("horas");
      const m = interaction.options.getInteger("minutos") || 0;

      const user = getUser(u.id);
      user.tempo += (h * 60 + m) * 60000;

      return interaction.editReply("✅ Adicionado");
    }

    if (interaction.commandName === "removerhora") {
      const u = interaction.options.getUser("usuario");
      const h = interaction.options.getInteger("horas");
      const m = interaction.options.getInteger("minutos") || 0;

      const user = getUser(u.id);
      user.tempo = Math.max(0, user.tempo - (h * 60 + m) * 60000);

      return interaction.editReply("❌ Removido");
    }
  }

  // 🔘 BOTÕES
  if (interaction.isButton()) {

    if (!isStaff(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas STAFF pode usar.",
        ephemeral: true
      });
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
      return interaction.reply({ content: "🏥 Atendimento", ephemeral: true });
    }

    if (interaction.customId === "chamado") {
      user.chamados++;
      return interaction.reply({ content: "📞 Chamado", ephemeral: true });
    }

    if (interaction.customId === "ranking") {
      const lista = [...db.entries()]
        .sort((a,b)=> b[1].tempo - a[1].tempo)
        .slice(0,10)
        .map(([id,d],i)=>`${i+1}. <@${id}> • ${format(d.tempo)}`)
        .join("\n");

      return interaction.reply({ content: lista || "Sem dados", ephemeral: true });
    }
  }
});

// 🚀 LOGIN
client.login(TOKEN);
