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
const STAFF_ROLE = "1195468742595985438";

// 🧠 BANCO
const pontos = new Map();
const ranking = new Map();
const dados = new Map(); // atendimentos + chamados

let painel = { canal: null, msgId: null };

// 🤖 CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

// 📌 COMANDOS (SEM ERRO)
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
    .setDescription("Resetar todos os dados"),

  new SlashCommandBuilder()
    .setName("addhora")
    .setDescription("Adicionar horas a um usuário")
    .addUserOption(o =>
      o.setName("usuario")
        .setDescription("Usuário alvo")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("horas")
        .setDescription("Horas")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("removerhora")
    .setDescription("Remover horas de um usuário")
    .addUserOption(o =>
      o.setName("usuario")
        .setDescription("Usuário alvo")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("horas")
        .setDescription("Horas")
        .setRequired(true)
    )
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

// 🧠 GET USER
function getUser(id) {
  if (!dados.has(id)) {
    dados.set(id, { atendimentos: 0, chamados: 0 });
  }
  return dados.get(id);
}

// 🏥 ATUALIZAR PAINEL
async function updatePanel() {
  if (!painel.canal) return;

  const canal = await client.channels.fetch(painel.canal).catch(()=>null);
  if (!canal) return;

  const msg = await canal.messages.fetch(painel.msgId).catch(()=>null);
  if (!msg) return;

  let lista = "";
  for (const [id, data] of pontos) {
    lista += `┆ 🟢 <@${id}> • ${formatar(Date.now() - data.inicio)}\n`;
  }

  const top = [...ranking.entries()]
    .sort((a,b)=> b[1] - a[1])
    .slice(0,3)
    .map(([id,t],i)=>`
🏅 ${i+1}. <@${id}>
┆ ⏱️ ${formatar(t)}
┆ 🏥 ${getUser(id).atendimentos}
┆ 📞 ${getUser(id).chamados}
`)
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor("#0f172a")
    .setDescription(`╔══════════════════════════════╗
        🏥 **HOSPITAL BELLA**
╚══════════════════════════════╝

👨‍⚕️ **EM SERVIÇO**
${lista || "┆ ❌ Nenhum médico"}

━━━━━━━━━━━━━━━━━━━━

🏆 **TOP 3 DO PLANTÃO**
${top || "┆ ❌ Sem dados"}

━━━━━━━━━━━━━━━━━━━━

📊 **STATUS**
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

  msg.edit({ embeds: [embed], components: [row] });
}

// 🔐 STAFF
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
        .sort((a,b)=> b[1] - a[1])
        .map(([id,t],i)=>`${i+1}. <@${id}> • ${formatar(t)}`)
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

  // BOTÕES
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
        .sort((a,b)=> b[1] - a[1])
        .map(([id,t],i)=>`${i+1}. <@${id}> • ${formatar(t)}`)
        .join("\n");

      return interaction.reply({ content: lista || "Sem dados", ephemeral: true });
    }
  }
});

// 🚀 LOGIN
client.login(TOKEN);
