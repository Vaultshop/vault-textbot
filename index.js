/* [VAULT] TEXT BOT — /text komanda su spalvota linija */
const http = require('http');
const {
  Client, GatewayIntentBits, EmbedBuilder, ModalBuilder, ActionRowBuilder,
  TextInputBuilder, TextInputStyle, PermissionFlagsBits
} = require('discord.js');

/* Keep-alive web serveris (kad UptimeRobot galėtų pingint) */
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('OK'); })
  .listen(PORT, () => console.log('Keep-alive:', PORT));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function isStaff(i) {
  if (i.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (process.env.STAFF_ROLE_ID && i.member.roles.cache.has(process.env.STAFF_ROLE_ID)) return true;
  return false;
}

client.once('ready', async () => {
  console.log('🟢 Text bot online:', client.user.tag);
  const cmds = [{
    name: 'text',
    description: 'Paskelbia tekstą kaip embed su spalvota linija (staff)',
    options: [
      { name: 'kanalas', type: 7, channel_types: [0], required: false, description: 'Kanalas, kuriame paskelbti' },
      { name: 'spalva', type: 3, required: false, description: 'Linijos spalva',
        choices: [
          { name: '🔴 Raudona', value: 'red' },
          { name: '🟢 Žalia', value: 'green' },
          { name: '🔵 Mėlyna', value: 'blue' }
        ] }
    ]
  }];
  for (const [, g] of client.guilds.cache) g.commands.set(cmds).catch(() => {});
});

const pending = {};

client.on('interactionCreate', async (i) => {
  try {
    if (i.isChatInputCommand() && i.commandName === 'text') {
      if (!isStaff(i)) return i.reply({ content: '🚫 Tik staff gali naudoti šią komandą.', ephemeral: true });
      pending[i.user.id] = {
        channelId: (i.options.getChannel('kanalas') || i.channel).id,
        color: i.options.getString('spalva') || 'red'
      };
      const modal = new ModalBuilder().setCustomId('m:text').setTitle('📜 Naujas pranešimas');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('title').setLabel('Pavadinimas (nebūtina)')
            .setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('Pvz.: 📜 VAULT — Taisyklės')),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('body').setLabel('Tekstas')
            .setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('• Punktai su **paryškintais** ir t.t.'))
      );
      return await i.showModal(modal);
    }
    if (i.isModalSubmit() && i.customId === 'm:text') {
      const title = (i.fields.getTextInputValue('title') || '').trim();
      const body = i.fields.getTextInputValue('body');
      const p = pending[i.user.id] || { channelId: i.channel.id, color: 'red' };
      delete pending[i.user.id];
      const ch = i.guild.channels.cache.get(p.channelId) || i.channel;
      const colors = { red: 0xff0000, green: 0x22c55e, blue: 0x5865f2 };
      const e = new EmbedBuilder().setColor(colors[p.color] || 0xff0000).setDescription(body);
      if (title) e.setTitle(title);
      await ch.send({ embeds: [e] });
      return i.reply({ content: '✅ Paskelbta: <#' + ch.id + '>', ephemeral: true });
    }
  } catch (e) {
    console.error(e);
    if (i.isRepliable() && !i.replied && !i.deferred) i.reply({ content: '❌ ' + String(e.message || e), ephemeral: true }).catch(() => {});
  }
});

const token = process.env.TOKEN;
if (!token) { console.error('❌ Nėra TOKEN env!'); process.exit(1); }
client.login(token);