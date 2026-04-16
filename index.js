import dotenv from "dotenv";
dotenv.config();

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

// 🔐 CONFIG (COM PROTEÇÃO)
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = "1477683902041690342";

if (!TOKEN || !CLIENT_ID) {
  console.log("❌ FALTANDO TOKEN OU CLIENT_ID NO AMBIENTE");
  console.log("👉 Verifica .env ou Variables do Railway");
  // NÃO FECHA O BOT (evita crash)
}

// 🧠 SISTEMA
let config = { painel: null, msgId: null };

const stats = new Map();

// ⏱ FORMAT
function format(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// 🏥 PAINEL
function painel() {

  const medicosAtivos = [...stats.entries()]
    .filter(([_, d]) => d.inicio !== null)
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

  const totalChamados = [...stats.values()]
    .reduce((a, b) => a + (b.chamados || 0), 0);

  const totalTratamentos = [...stats.values()]
    .reduce((a, b) => a + (b.tratamentos || 0), 0);

  const medicosEmServico = [...stats.values()]
    .filter(d => d.inicio !== null).length;

  return new EmbedBuilder()
    .setColor("#0f172a")
    .setDescription(`
🏥 ═══════〔 HOSPITAL BELLA 〕═══════

👨‍⚕️ MÉDICOS EM SERVIÇO
${medicosAtivos}

🏆 TOP 3
${top(0)}
${top(1)}
${top(2)}

📊 STATUS
┆ 👥 Total: ${stats.size}
┆ 🟢 Em serviço: ${medicosEmServico}
┆ 📞 Chamados: ${totalChamados}
┆ 💉 Tratamentos: ${totalTratamentos}

⏱️ Atualizado agora
`);
}

// 🔘 BOTÕES
function row() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("iniciar").setLabel("🟢 Iniciar").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("finalizar").setLabel("🔴 Finalizar").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("chamado").setLabel("📞 Chamado").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("tratamento").setLabel("💉 Tratamento").setStyle(ButtonStyle.Secondary)
  );
}

// 🚀 CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const rest = new REST({ version: 10 }).setToken(TOKEN || "");

// 🔥 READY
client.once("clientReady", async () => {

  if (client.user) {
    console.log(`🏥 ONLINE COMO ${client.user.tag}`);
  }

  if (!TOKEN || !CLIENT_ID) return;

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    {
      body: [
        new SlashCommandBuilder()
          .setName("painelhp")
          .setDescription("Criar painel hospital")
          .addChannelOption(o =>
            o.setName("canal").setRequired(true)
          ),
        new SlashCommandBuilder()
          .setName("rankinghp")
          .setDescription("TOP médicos")
      ].map(c => c.toJSON())
    }
  );

  setInterval(updatePanel, 15000);
});

// 🔄 UPDATE
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

      return interaction.reply({ content: "✅ Painel criado!", ephemeral: true });
    }

    if (interaction.commandName === "rankinghp") {

      const sorted = [...stats.entries()]
        .sort((a, b) => b[1].tratamentos - a[1].tratamentos);

      const top = (i) =>
        sorted[i]
          ? `#${i + 1} <@${sorted[i][0]}> • ${sorted[i][1].tratamentos}`
          : `#${i + 1} Sem dados`;

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🏆 TOP MÉDICOS")
            .setColor("Gold")
            .setDescription(`${top(0)}\n${top(1)}\n${top(2)}`)
        ]
      });
    }
  }

  if (!interaction.isButton()) return;

  const id = interaction.user.id;

  if (!stats.has(id)) {
    stats.set(id, { inicio: null, horas: 0, chamados: 0, tratamentos: 0 });
  }

  const data = stats.get(id);

  if (interaction.customId === "iniciar") {
    data.inicio = Date.now();
    return interaction.reply({ content: "🟢 Iniciado!", ephemeral: true });
  }

  if (interaction.customId === "finalizar") {
    if (!data.inicio) return interaction.reply({ content: "❌ não está em serviço", ephemeral: true });

    const tempo = Date.now() - data.inicio;
    data.horas += tempo;
    data.inicio = null;

    return interaction.reply({ content: `🔴 Finalizado ${format(tempo)}`, ephemeral: true });
  }

  if (interaction.customId === "chamado") {
    if (!data.inicio) return interaction.reply({ content: "❌ precisa estar em serviço", ephemeral: true });

    data.chamados++;
    return interaction.reply({ content: "📞 contado", ephemeral: true });
  }

  if (interaction.customId === "tratamento") {
    if (!data.inicio) return interaction.reply({ content: "❌ precisa estar em serviço", ephemeral: true });

    data.tratamentos++;
    return interaction.reply({ content: "💉 contado", ephemeral: true });
  }
});

// 🚀 LOGIN
client.login(TOKEN || "");
