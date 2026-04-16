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

// 🌐 KEEP ALIVE (Railway)
const app = express();
app.get("/", (_, res) => res.send("Bot online 🔥"));
app.listen(3000);

// 🔐 ENV
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !CLIENT_ID) throw new Error("TOKEN ou CLIENT_ID não definido");

// 🤖 CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// 🧠 BANCO UNIFICADO
const db = {
  users: {}
};

function getUser(id) {
  if (!db.users[id]) {
    db.users[id] = {
      inicio: null,
      tempoTotal: 0,
      atendimentos: 0,
      chamados: 0,
      horas: 0
    };
  }
  return db.users[id];
}

// ⏱ FORMATAR TEMPO
function formatar(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// 📌 COMANDO
const commands = [
  new SlashCommandBuilder()
    .setName("painel")
    .setDescription("Criar painel hospital")
    .addChannelOption(o =>
      o.setName("canal").setDescription("Canal do painel").setRequired(true))
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

// 🔥 READY
client.once("ready", async () => {
  console.log(`🔥 Online: ${client.user.tag}`);

  await rest.put(Routes.applicationCommands(CLIENT_ID), {
    body: commands
  });

  setInterval(atualizarPainel, 30000);
});

// 📊 CONFIG PAINEL
let painelConfig = {
  canal: null,
  msgId: null
};

// 🔘 BOTÕES
function criarBotoes() {
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
      .setCustomId("atendimento")
      .setLabel("🏥 Atendimento")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("chamado")
      .setLabel("📞 Chamado")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("ranking")
      .setLabel("🏆 Ranking")
      .setStyle(ButtonStyle.Success)
  );
}

// 🏥 ATUALIZAR PAINEL
async function atualizarPainel() {
  if (!painelConfig.canal || !painelConfig.msgId) return;

  const canal = await client.channels.fetch(painelConfig.canal).catch(() => null);
  if (!canal) return;

  const msg = await canal.messages.fetch(painelConfig.msgId).catch(() => null);
  if (!msg) return;

  let lista = "";

  for (const id in db.users) {
    const u = db.users[id];
    if (u.inicio) {
      const tempo = Date.now() - u.inicio;
      lista += `┆ 🟢 <@${id}> • ${formatar(tempo)}\n`;
    }
  }

  const embed = new EmbedBuilder()
    .setColor("#0f172a")
    .setDescription(`
🏥 ═══════〔 HOSPITAL BELLA 〕═══════

👨‍⚕️ **EM SERVIÇO**
${lista || "┆ Nenhum médico ativo"}

━━━━━━━━━━━━━━━━━━━━

📊 **EVENTO**
🏥 Atendimentos registrados  
📞 Chamados registrados  
⏱ Controle de horas  

━━━━━━━━━━━━━━━━━━━━

💉 Sistema completo ativo
`)
    .setFooter({ text: "Bella System • Completo" })
    .setTimestamp();

  msg.edit({
    embeds: [embed],
    components: [criarBotoes()]
  }).catch(() => {});
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  // 📌 COMANDO
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "painel") {
      const canal = interaction.options.getChannel("canal");

      const msg = await canal.send({
        embeds: [new EmbedBuilder().setDescription("Carregando painel...")],
        components: [criarBotoes()]
      });

      painelConfig.canal = canal.id;
      painelConfig.msgId = msg.id;

      atualizarPainel();

      return interaction.reply({
        content: "✅ Painel criado!",
        ephemeral: true
      });
    }
  }

  // 🔘 BOTÕES
  if (interaction.isButton()) {
    const user = getUser(interaction.user.id);

    // 🟢 INICIAR
    if (interaction.customId === "iniciar") {
      user.inicio = Date.now();

      return interaction.reply({
        content: "🟢 Turno iniciado!",
        ephemeral: true
      });
    }

    // 🔴 FINALIZAR
    if (interaction.customId === "finalizar") {
      if (!user.inicio) {
        return interaction.reply({
          content: "❌ Você não iniciou!",
          ephemeral: true
        });
      }

      const tempo = Date.now() - user.inicio;
      user.tempoTotal += tempo;
      user.inicio = null;

      return interaction.reply({
        content: `🔴 Finalizado: ${formatar(tempo)}`,
        ephemeral: true
      });
    }

    // 🏥 ATENDIMENTO
    if (interaction.customId === "atendimento") {
      user.atendimentos++;
      return interaction.reply({
        content: "🏥 Atendimento registrado!",
        ephemeral: true
      });
    }

    // 📞 CHAMADO
    if (interaction.customId === "chamado") {
      user.chamados++;
      return interaction.reply({
        content: "📞 Chamado registrado!",
        ephemeral: true
      });
    }

    // 🏆 RANKING
    if (interaction.customId === "ranking") {
      const ranking = Object.entries(db.users)
        .sort((a, b) => {
          const totalA = a[1].tempoTotal + (a[1].atendimentos + a[1].chamados) * 60000;
          const totalB = b[1].tempoTotal + (b[1].atendimentos + b[1].chamados) * 60000;
          return totalB - totalA;
        })
        .slice(0, 10);

      let texto = "🏆 **RANKING GERAL**\n\n";

      if (ranking.length === 0) {
        texto += "Nenhum dado ainda.";
      } else {
        ranking.forEach(([id, data], i) => {
          texto += `**${i + 1}. <@${id}>**\n⏱ ${formatar(data.tempoTotal)} | 🏥 ${data.atendimentos} | 📞 ${data.chamados}\n\n`;
        });
      }

      return interaction.reply({
        content: texto,
        ephemeral: true
      });
    }
  }
});

// 🚀 LOGIN
client.login(TOKEN);
