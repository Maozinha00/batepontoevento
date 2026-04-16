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
const GUILD_ID = "1195468742595985443";

if (!TOKEN || !CLIENT_ID) throw new Error("TOKEN ou CLIENT_ID não definido");

// 🏷️ CARGOS
const CARGO_EM = "1492553421973356795";
const CARGO_FORA = "1492553631642288160";
const STAFF_ROLE = "1490431614055088128";

// 👑 HIERARQUIA
const HIERARQUIA = [
  { cargo: "1195468742595985443", nome: "👑 Diretor(a)", peso: 4 },
  { cargo: "1477683902121509017", nome: "🎖️ Vice-Diretor(a)", peso: 3 },
  { cargo: "1477683902121509016", nome: "🔱 Supervisor(a)", peso: 2 },
  { cargo: "1477683902121509015", nome: "🩺 Coordenador(a)", peso: 1 }
];

// 🧠 BANCO
let config = { canal: null, msgId: null };
const db = new Map();

// 🤖 CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

// 📌 COMANDOS (100% CORRIGIDO)
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel hospital completo")
    .addChannelOption(o =>
      o.setName("canal")
       .setDescription("Canal onde será enviado o painel")
       .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("Ver ranking geral"),

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
client.once("ready", async () => {
  console.log(`🔥 Online: ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  setInterval(atualizarPainel, 30000);
});

// ⏱ FORMATAR
function formatar(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

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

// 👑 RESPONSÁVEL
async function getResponsavel(guild) {
  let melhor = null;
  let pesoMax = 0;

  for (const id of db.keys()) {
    const m = await guild.members.fetch(id).catch(() => null);
    if (!m) continue;

    for (const h of HIERARQUIA) {
      if (m.roles.cache.has(h.cargo) && h.peso > pesoMax) {
        pesoMax = h.peso;
        melhor = { id: m.id, nome: h.nome };
      }
    }
  }

  return melhor;
}

// 🏥 PAINEL
async function atualizarPainel() {
  if (!config.canal || !config.msgId) return;

  const canal = await client.channels.fetch(config.canal).catch(() => null);
  if (!canal) return;

  const msg = await canal.messages.fetch(config.msgId).catch(() => null);
  if (!msg) return;

  let lista = "";

  for (const [id, data] of db) {
    if (data.inicio) {
      const tempo = Date.now() - data.inicio;
      lista += `┆ 🟢 <@${id}> • ${formatar(tempo)}\n`;
    }
  }

  const guild = client.guilds.cache.get(GUILD_ID);
  const responsavel = await getResponsavel(guild);

  const embed = new EmbedBuilder()
    .setColor("#0f172a")
    .setDescription(`
🏥 **═══════〔 HOSPITAL BELLA 〕═══════**

👑 **RESPONSÁVEL**
${
responsavel
  ? `╭─ ${responsavel.nome}\n╰─ <@${responsavel.id}>`
  : "╰─ Nenhum"
}

━━━━━━━━━━━━━━━━━━━━

👨‍⚕️ **EM SERVIÇO**
${lista || "Nenhum médico"}

━━━━━━━━━━━━━━━━━━━━

📊 **STATUS**
🟢 Ativos: ${[...db.values()].filter(u => u.inicio).length}

💉 Sistema completo
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

  const member = interaction.member;

  if (interaction.isChatInputCommand() && !isStaff(member)) {
    return interaction.reply({ content: "❌ STAFF apenas.", ephemeral: true });
  }

  // 📌 COMANDOS
  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === "painelhp") {
      const canal = interaction.options.getChannel("canal");

      const msg = await canal.send({ content: "Carregando painel..." });

      config.canal = canal.id;
      config.msgId = msg.id;

      atualizarPainel();

      return interaction.reply({ content: "✅ Painel criado!", ephemeral: true });
    }

    if (interaction.commandName === "rankinghp") {
      const ranking = [...db.entries()]
        .sort((a,b)=> b[1].tempo - a[1].tempo)
        .map(([id,data],i)=>`**${i+1}. <@${id}>** • ${formatar(data.tempo)}`)
        .join("\n");

      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle("🏆 Ranking").setDescription(ranking || "Sem dados")],
        ephemeral: true
      });
    }

    if (interaction.commandName === "resetponto") {
      db.clear();
      atualizarPainel();
      return interaction.reply({ content: "✅ Resetado!", ephemeral: true });
    }

    if (interaction.commandName === "addhora") {
      const u = interaction.options.getUser("usuario");
      const h = interaction.options.getInteger("horas");
      const m = interaction.options.getInteger("minutos") || 0;

      const user = getUser(u.id);
      user.tempo += (h * 60 + m) * 60000;

      return interaction.reply({ content: "✅ Adicionado!", ephemeral: true });
    }

    if (interaction.commandName === "removerhora") {
      const u = interaction.options.getUser("usuario");
      const h = interaction.options.getInteger("horas");
      const m = interaction.options.getInteger("minutos") || 0;

      const user = getUser(u.id);
      user.tempo = Math.max(0, user.tempo - (h * 60 + m) * 60000);

      return interaction.reply({ content: "❌ Removido!", ephemeral: true });
    }
  }

  // 🔘 BOTÕES
  if (interaction.isButton()) {

    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: "❌ Apenas STAFF.", ephemeral: true });
    }

    const user = getUser(interaction.user.id);

    if (interaction.customId === "iniciar") {
      user.inicio = Date.now();
      return interaction.reply({ content: "🟢 Iniciado!", ephemeral: true });
    }

    if (interaction.customId === "finalizar") {
      if (!user.inicio) return interaction.reply({ content: "❌ Não iniciou!", ephemeral: true });

      const tempo = Date.now() - user.inicio;
      user.tempo += tempo;
      user.inicio = null;

      return interaction.reply({ content: `🔴 Finalizado: ${formatar(tempo)}`, ephemeral: true });
    }

    if (interaction.customId === "atendimento") {
      user.atendimentos++;
      return interaction.reply({ content: "🏥 Atendimento!", ephemeral: true });
    }

    if (interaction.customId === "chamado") {
      user.chamados++;
      return interaction.reply({ content: "📞 Chamado!", ephemeral: true });
    }

    if (interaction.customId === "ranking") {
      const ranking = [...db.entries()]
        .sort((a,b)=> b[1].tempo - a[1].tempo)
        .slice(0,10)
        .map(([id,data],i)=>`**${i+1}. <@${id}>** • ${formatar(data.tempo)}`)
        .join("\n");

      return interaction.reply({ content: ranking || "Sem dados", ephemeral: true });
    }
  }
});

// 🚀 LOGIN
client.login(TOKEN);
