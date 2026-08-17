/* ============================================================
   [VAULT] TEXT BOT v9 — /text /rep /balsuoti /giveaway
============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  Client, GatewayIntentBits, EmbedBuilder, ModalBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, TextInputBuilder, TextInputStyle, PermissionFlagsBits
} = require('discord.js');

const LOGO_URL = 'https://raw.githubusercontent.com/Vaultshop/Vaults/main/logo.png';
const state = { startedAt: null };

/* ---------------- DB ---------------- */
function loadJson(f, d) { try { if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {} return d; }
function saveJson(f, o) { fs.writeFileSync(f, JSON.stringify(o, null, 2)); }

const REP_FILE = path.join(__dirname, 'rep.json');
let repDb = loadJson(REP_FILE, { products: {} });
if (!repDb.products) repDb.products = {};

const POLLS_FILE = path.join(__dirname, 'polls.json');
let pollsDb = loadJson(POLLS_FILE, {});

const GW_FILE = path.join(__dirname, 'giveaways.json');
let gwDb = loadJson(GW_FILE, {});

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

function isStaff(i) {
  if (i.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (process.env.STAFF_ROLE_ID && i.member.roles.cache.has(process.env.STAFF_ROLE_ID)) return true;
  return false;
}

/* ---------------- REP ---------------- */
function totalPos() { return Object.values(repDb.products).reduce((a, p) => a + (p.pos || 0), 0); }
function totalNeg() { return Object.values(repDb.products).reduce((a, p) => a + (p.neg || 0), 0); }
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
async function handleRep(channel, userId, positive, product) {
  const key = product.toLowerCase();
  if (!repDb.products[key]) repDb.products[key] = { name: product, pos: 0, neg: 0 };
  const p = repDb.products[key];
  if (positive) p.pos++; else p.neg++;
  saveJson(REP_FILE, repDb);
  await channel.send({ embeds: [statsEmbed(userId, positive, p.name)] });
}

/* ---------------- BALSAVIMAI ---------------- */
function pollEmbed(p) {
  const c1 = Object.values(p.votes).filter(v => v === 1).length;
  const c2 = Object.values(p.votes).filter(v => v === 2).length;
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🗳️ Balsavimas')
    .setDescription('**' + p.q + '**\n\n👍 **' + p.o1 + ':** ' + c1 + '\n👎 **' + p.o2 + ':** ' + c2 + '\n\n*Iš viso balsų: ' + (c1 + c2) + '*')
    .setFooter({ text: 'Vault • Balsavimas' });
}
function pollRows(id, p) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('poll:' + id + ':1').setLabel(p.o1).setEmoji('👍').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('poll:' + id + ':2').setLabel(p.o2).setEmoji('👎').setStyle(ButtonStyle.Danger)
  )];
}

/* ---------------- GIVEAWAY ---------------- */
function gwEmbed(g) {
  return new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle('🎉 GIVEAWAY')
    .setDescription('🎁 **Prizas:** ' + g.prize +
      '\n⏰ **Baigiasi:** <t:' + Math.floor(g.endsAt / 1000) + ':R>' +
      '\n👥 **Dalyvių:** ' + g.participants.length +
      '\n🏆 **Nugalėtojų:** ' + g.winnersCount)
    .setFooter({ text: 'Vault • Giveaway — spausk 🎉 kad dalyvautum!' });
}
function gwEndedEmbed(g, winners) {
  return new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle('🎉 GIVEAWAY BAIGĖSI')
    .setDescription('🎁 **Prizas:** ' + g.prize +
      '\n🏆 **Nugalėtojai:** ' + (winners.length ? winners.map(w => '<@' + w + '>').join(', ') : '—') +
      '\n👥 **Dalyvių buvo:** ' + g.participants.length)
    .setFooter({ text: 'Vault • Giveaway' });
}
function gwRows(id) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gw:' + id).setLabel('DALYVAUTI').setEmoji('🎉').setStyle(ButtonStyle.Success)
  )];
}
function scheduleGw(id) {
  const g = gwDb[id];
  if (!g || g.ended) return;
  setTimeout(() => endGw(id), Math.max(0, g.endsAt - Date.now()));
}
async function endGw(id) {
  const g = gwDb[id];
  if (!g || g.ended) return;
  g.ended = true;
  saveJson(GW_FILE, gwDb);
  const guild = client.guilds.cache.first();
  const ch = guild && guild.channels.cache.get(g.channelId);
  const pool = g.participants.slice();
  const winners = [];
  const n = Math.min(g.winnersCount || 1, pool.length);
  for (let k = 0; k < n; k++) winners.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  if (ch) {
    const m = await ch.messages.fetch(g.messageId).catch(() => null);
    if (m) await m.edit({ embeds: [gwEndedEmbed(g, winners)], components: [] }).catch(() => {});
    await ch.send({ content: winners.length
      ? '🎉 **Giveaway baigėsi!** Nugalėtojas: ' + winners.map(w => '<@' + w + '>').join(', ') + ' 🏆'
      : '😢 Giveaway baigėsi — dalyvių nebuvo.' }).catch(() => {});
  }
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
<p class="muted">/text • /rep • /balsuoti • /giveaway</p>
<div class="status"><span class="dot" id="dot"></span><b id="st">KRAUNAMA...</b></div>
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
    return res.end(JSON.stringify({ online: client.isReady(), tag: client.user ? client.user.tag : null, startedAt: state.startedAt }));
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(HTML);
}).listen(process.env.PORT || 3000, () => console.log('Mini svetainė veikia'));

/* ---------------- Komandų registravimas ---------------- */
client.once('ready', async () => {
  state.startedAt = Date.now();
  console.log('🟢 Text bot online:', client.user.tag);
  const cmds = [
    {
      name: 'text',
      description: 'Paskelbia tekstą kaip embed su spalvota linija (staff)',
      options: [
        { name: 'kanalas', type: 7, channel_types: [0], required: false, description: 'Kanalas, kuriame paskelbti' },
        { name: 'spalva', type: 3, required: false, description: 'Linijos spalva',
          choices: [
            { name: '🔴 Raudona', value: 'red' }, { name: '🟢 Žalia', value: 'green' },
            { name: '🔵 Mėlyna', value: 'blue' }, { name: '⚫ Juoda', value: 'black' }
          ] }
      ]
    },
    {
      name: 'rep',
      description: 'Palikti atsiliepimą apie prekę',
      options: [
        { name: 'tipas', type: 3, required: true, description: 'Teigiamas ar neigiamas',
          choices: [ { name: '👍 Teigiamas (+rep)', value: 'pos' }, { name: '👎 Neigiamas (-rep)', value: 'neg' } ] },
        { name: 'preke', type: 3, required: true, description: 'Prekės pavadinimas' }
      ]
    },
    {
      name: 'balsuoti',
      description: 'Sukurti balsavimą su dviem mygtukais (staff)',
      options: [
        { name: 'klausimas', type: 3, required: true, description: 'Balsavimo klausimas' },
        { name: 'pasirinkimas1', type: 3, required: true, description: 'Pirmo mygtuko tekstas (pvz. TAIP)' },
        { name: 'pasirinkimas2', type: 3, required: true, description: 'Antro mygtuko tekstas (pvz. NE)' }
      ]
    },
    {
      name: 'giveaway',
      description: 'Sukurti giveaway (staff)',
      options: [
        { name: 'prizas', type: 3, required: true, description: 'Kas laimima' },
        { name: 'trukme_min', type: 4, required: false, description: 'Kiek minučių truks (default 5)' },
        { name: 'nugaletojai', type: 4, required: false, description: 'Kiek nugalėtojų (default 1)' }
      ]
    }
  ];
  for (const [, g] of client.guilds.cache) g.commands.set(cmds).catch(() => {});
  /* Pratęsimas nebaigtų giveaway'ų po restarto */
  Object.keys(gwDb).forEach(id => {
    const g = gwDb[id];
    if (!g.ended) { if (g.endsAt <= Date.now()) endGw(id); else scheduleGw(id); }
  });
});

const pending = {};

client.on('interactionCreate', async (i) => {
  try {
    /* ---------- /text ---------- */
    if (i.isChatInputCommand() && i.commandName === 'text') {
      if (!isStaff(i)) return i.reply({ content: '🚫 Tik staff gali naudoti šią komandą.', ephemeral: true });
      pending[i.user.id] = { channelId: (i.options.getChannel('kanalas') || i.channel).id, color: i.options.getString('spalva') || 'red' };
      const modal = new ModalBuilder().setCustomId('m:text').setTitle('📜 Naujas pranešimas');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Pavadinimas (nebūtina)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('Pvz.: 📜 VAULT — Taisyklės')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('body').setLabel('Tekstas').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('• Punktai su **paryškintais** ir t.t.'))
      );
      return await i.showModal(modal);
    }

    /* ---------- /rep ---------- */
    if (i.isChatInputCommand() && i.commandName === 'rep') {
      const positive = i.options.getString('tipas') === 'pos';
      const product = (i.options.getString('preke') || '').trim();
      if (!product) return i.reply({ content: '❗ Įrašyk prekės pavadinimą.', ephemeral: true });
      await handleRep(i.channel, i.user.id, positive, product);
      return i.reply({ content: '✅ Ačiū už atsiliepimą!', ephemeral: true });
    }

    /* ---------- /balsuoti ---------- */
    if (i.isChatInputCommand() && i.commandName === 'balsuoti') {
      if (!isStaff(i)) return i.reply({ content: '🚫 Tik staff gali kurti balsavimus.', ephemeral: true });
      const id = Date.now().toString(36);
      const p = {
        q: i.options.getString('klausimas'),
        o1: i.options.getString('pasirinkimas1'),
        o2: i.options.getString('pasirinkimas2'),
        votes: {}, channelId: i.channel.id, messageId: null
      };
      const msg = await i.channel.send({ embeds: [pollEmbed(p)], components: pollRows(id, p) });
      p.messageId = msg.id;
      pollsDb[id] = p;
      saveJson(POLLS_FILE, pollsDb);
      return i.reply({ content: '✅ Balsavimas paskelbtas!', ephemeral: true });
    }

    /* ---------- /giveaway ---------- */
    if (i.isChatInputCommand() && i.commandName === 'giveaway') {
      if (!isStaff(i)) return i.reply({ content: '🚫 Tik staff gali kurti giveaway.', ephemeral: true });
      const id = Date.now().toString(36);
      const min = i.options.getInteger('trukme_min') || 5;
      const g = {
        prize: i.options.getString('prizas'),
        winnersCount: i.options.getInteger('nugaletojai') || 1,
        endsAt: Date.now() + min * 60000,
        participants: [], channelId: i.channel.id, messageId: null, ended: false
      };
      const msg = await i.channel.send({ embeds: [gwEmbed(g)], components: gwRows(id) });
      g.messageId = msg.id;
      gwDb[id] = g;
      saveJson(GW_FILE, gwDb);
      scheduleGw(id);
      return i.reply({ content: '✅ Giveaway paleistas! Baigsis po ' + min + ' min.', ephemeral: true });
    }

    /* ---------- Balsavimo mygtukai ---------- */
    if (i.isButton() && i.customId.startsWith('poll:')) {
      const parts = i.customId.split(':');
      const p = pollsDb[parts[1]];
      if (!p) return i.reply({ content: '❌ Balsavimas nerastas.', ephemeral: true });
      const opt = Number(parts[2]);
      p.votes[i.user.id] = opt;
      saveJson(POLLS_FILE, pollsDb);
      const ch = i.guild.channels.cache.get(p.channelId) || i.channel;
      const m = await ch.messages.fetch(p.messageId).catch(() => null);
      if (m) await m.edit({ embeds: [pollEmbed(p)] }).catch(() => {});
      return i.reply({ content: '✅ Tavo balsas: **' + (opt === 1 ? p.o1 : p.o2) + '**', ephemeral: true });
    }

    /* ---------- Giveaway mygtukas ---------- */
    if (i.isButton() && i.customId.startsWith('gw:')) {
      const g = gwDb[i.customId.split(':')[1]];
      if (!g || g.ended) return i.reply({ content: '🚫 Giveaway jau baigėsi.', ephemeral: true });
      if (!g.participants.includes(i.user.id)) g.participants.push(i.user.id);
      saveJson(GW_FILE, gwDb);
      const ch = i.guild.channels.cache.get(g.channelId) || i.channel;
      const m = await ch.messages.fetch(g.messageId).catch(() => null);
      if (m) await m.edit({ embeds: [gwEmbed(g)] }).catch(() => {});
      return i.reply({ content: '🎉 Tu dalyvauji giveaway!', ephemeral: true });
    }

    /* ---------- /text modal ---------- */
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
if (!token) { console.error('❌ Nėra TOKEN env!'); process.exit(1); }
client.login(token);