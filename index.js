/* ============================================================
   [VAULT] TEXT BOT — /text komanda + mini status svetainė
============================================================ */
const http = require('http');
const {
  Client, GatewayIntentBits, EmbedBuilder, ModalBuilder, ActionRowBuilder,
  TextInputBuilder, TextInputStyle, PermissionFlagsBits
} = require('discord.js');

const LOGO_URL = 'https://raw.githubusercontent.com/Vaultshop/Vaults/main/logo.png';
const state = { startedAt: null };

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function isStaff(i) {
  if (i.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (process.env.STAFF_ROLE_ID && i.member.roles.cache.has(process.env.STAFF_ROLE_ID)) return true;
  return false;
}

/* ---------------- Mini svetainė ---------------- */
const HTML = `<!doctype html>
<html lang="lt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vault | Text Bot</title>
<style>
body{background:#0a0a0a;color:#e5e7eb;font-family:'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#111;border:1px solid #2a2a2a;border-left:4px solid #ff0000;border-radius:14px;padding:36px;max-width:520px;text-align:center}
img{width:90px;height:90px;border-radius:50%;border:2px solid #ff0000;object-fit:cover}
h1{margin:14px 0 4px;font-size:24px}
.red{color:#ff4444}
.muted{color:#8b8b8b;font-size:14px}
.status{display:inline-flex;align-items:center;gap:8px;margin-top:14px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:20px;padding:8px 16px;font-size:13px}
.dot{width:10px;height:10px;border-radius:50%;background:#ef4444}
.dot.on{background:#22c55e}
code{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;padding:2px 8px;color:#ff6b6b}
</style>
</head>
<body>
<div class="card">
<img src="https://raw.githubusercontent.com/Vaultshop/Vaults/main/logo.png" alt="Vault">
<h1><span class="red">Vault</span> | Text Bot</h1>
<p class="muted">/text komanda — gražūs embed pranešimai su spalvota linija tavo serveryje.</p>
<div class="status"><span class="dot" id="dot"></span><b id="st">KRAUNAMA...</b></div>
<p class="muted" style="margin-top:14px">Discord'e rašyk <code>/text</code> → pasirink kanalą ir spalvą → įrašyk tekstą → Submit.</p>
</div>
<script>
function poll(){
  fetch('/api/state').then(function(r){ return r.json(); }).then(function(s){
    document.getElementById('st').textContent = s.online ? 'ONLINE — ' + s.tag : 'OFFLINE';
    document.getElementById('dot').className = s.online ? 'dot on' : 'dot';
  }).catch(function(){ document.getElementById('st').textContent = 'KLAIDA'; });
}
poll(); setInterval(poll, 5000);
</script>
</body>
</html>`;

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      online: client.isReady(),
      tag: client.user ? client.user.tag : null,
      startedAt: state.startedAt
    }));
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(HTML);
}).listen(process.env.PORT || 3000, () => console.log('Mini svetainė veikia'));

/* ---------------- Komandų registravimas ---------------- */
client.once('ready', async () => {
  state.startedAt = Date.now();
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
          { name: '🔵 Mėlyna', value: 'blue' },
          { name: '💀 Juoda/Balta', value: 'black' }
        ] }
    ]
  }];
  for (const [, g] of client.guilds.cache) g.commands.set(cmds).catch(() => {});
});

const pending = {};

/* ---------------- /text + modal ---------------- */
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
            .setStyle(TextInputStyle.Short).setRequired(false)
            .setPlaceholder('Pvz.: 📜 VAULT — Taisyklės')),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('body').setLabel('Tekstas')
            .setStyle(TextInputStyle.Paragraph).setRequired(true)
            .setPlaceholder('• Punktai su **paryškintais** ir t.t.'))
      );
      return await i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === 'm:text') {
      const title = (i.fields.getTextInputValue('title') || '').trim();
      const body = i.fields.getTextInputValue('body');
      const p = pending[i.user.id] || { channelId: i.channel.id, color: 'red' };
      delete pending[i.user.id];
      const ch = i.guild.channels.cache.get(p.channelId) || i.channel;
      const colors = { red: 0xff0000, green: 0x22c55e, blue: 0x5865f2, black: 0x000000 };
      const e = new EmbedBuilder().setColor(colors[p.color] || 0xff0000).setDescription(body);
      if (title) e.setTitle(title);
      e.setFooter({ text: 'Vault • ' + new Date().toLocaleDateString() });
      await ch.send({ embeds: [e] });
      return i.reply({ content: '✅ Paskelbta: <#' + ch.id + '>', ephemeral: true });
    }
  } catch (e) {
    console.error(e);
    if (i.isRepliable() && !i.replied && !i.deferred) i.reply({ content: '❌ ' + String(e.message || e), ephemeral: true }).catch(() => {});
  }
});

/* ---------------- Start ---------------- */
const token = process.env.TOKEN;
if (!token) { console.error('❌ Nėra TOKEN env! Render → Environment → TOKEN.'); process.exit(1); }
client.login(token);