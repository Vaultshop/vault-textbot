/* ============================================================
   [VAULT] TEXT BOT v6 — /text + rep su auto lentele (FINAL)
============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  Client, GatewayIntentBits, EmbedBuilder, ModalBuilder, ActionRowBuilder,
  TextInputBuilder, TextInputStyle, PermissionFlagsBits
} = require('discord.js');

const LOGO_URL = 'https://raw.githubusercontent.com/Vaultshop/Vaults/main/logo.png';
const state = { startedAt: null };

/* ---------------- Atsiliepimų DB ---------------- */
const REP_FILE = path.join(__dirname, 'rep.json');
let repDb = { products: {}, lastStats: {} };
function loadRep() {
  try { if (fs.existsSync(REP_FILE)) repDb = JSON.parse(fs.readFileSync(REP_FILE, 'utf8')); } catch (e) {}
  if (!repDb.products) repDb.products = {};
  if (!repDb.lastStats) repDb.lastStats = {};
}
function saveRep() { fs.writeFileSync(REP_FILE, JSON.stringify(repDb, null, 2)); }
function totalPos() { return Object.values(repDb.products).reduce((a, p) => a + (p.pos || 0), 0); }
function totalNeg() { return Object.values(repDb.products).reduce((a, p) => a + (p.neg || 0), 0); }
loadRep();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

function isStaff(i) {
  if (i.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (process.env.STAFF_ROLE_ID && i.member.roles.cache.has(process.env.STAFF_ROLE_ID)) return true;
  return false;
}

/* ---------------- Lentelė (embed) ---------------- */
function statsEmbed(voter, positive, product) {
  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('📊 Discord Atsiliepimai')
    .setDescription(
      (positive
        ? '✅ **Dėkojame už atsiliepimą,** <@' + voter + '>! 🙏'
        : '📝 **Ačiū už atsiliepimą,** <@' + voter + '>! Apgailestaujame, kad taip nutiko — perduosime administracijai. 🙏') +
      '\n\n🛍️ **Prekė:** ' + product + ' • ' + (positive ? '🟩 Teigiamas' : '🟥 Neigiamas') +
      '\n\n🟥 **Teigiami atsiliepimai:** ' + totalPos() +
      '\n🟧 **Neigiami atsiliepimai:** ' + totalNeg() +
      '\n🛒 **Prekių su atsiliepimais:** ' + Object.keys(repDb.products).length
    )
    .setFooter({ text: 'Vault • Patikima bendruomenė' });
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
<p class="muted">/text komanda + atsiliepimų sistema (+rep / -rep) tavo serveryje.</p>
<div class="status"><span class="dot" id="dot"></span><b id="st">KRAUNAMA...</b></div>
<p class="muted" style="margin-top:14px">Discord'e: <code>/text</code> • <code>+rep prekė</code> • <code>-rep prekė</code></p>
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

/* ---------------- /text komanda ---------------- */
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
          { name: '⚫ Juoda', value: 'black' }
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

/* ---------------- +rep / -rep su auto lentele ---------------- */
client.on('messageCreate', async (msg) => {
  try {
    if (msg.author.bot || !msg.guild) return;
    const content = msg.content.trim();
    if (!content.startsWith('+rep ') && !content.startsWith('-rep ')) return;

    const positive = content.startsWith('+');
    const product = content.slice(5).trim();
    if (!product) return msg.channel.send({ content: '❗ Įrašyk prekės pavadinimą: `+rep Prekė` arba `-rep Prekė`' });

    const key = product.toLowerCase();
    if (!repDb.products[key]) repDb.products[key] = { name: product, pos: 0, neg: 0 };
    const p = repDb.products[key];
    if (positive) p.pos++; else p.neg++;

    /* Ištrinam SENĄ lentelę šiame kanale */
    const oldId = repDb.lastStats[msg.channel.id];
    if (oldId) {
      const old = await msg.channel.messages.fetch(oldId).catch(() => null);
      if (old) await old.delete().catch(() => {});
    }

    /* Siunčiam NAUJĄ lentelę */
    const sent = await msg.channel.send({ embeds: [statsEmbed(msg.author.id, positive, p.name)] });
    repDb.lastStats[msg.channel.id] = sent.id;
    saveRep();
  } catch (e) { console.error('rep klaida:', e); }
});

/* ---------------- Start ---------------- */
const token = process.env.TOKEN;
if (!token) { console.error('❌ Nėra TOKEN env!'); process.exit(1); }
client.login(token);