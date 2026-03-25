// ============================================================
// MASTER TIERS – Discord Bot
// ============================================================
// Setup:
//   npm install discord.js @discordjs/builders
//   node bot.js
// ============================================================

const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ── CONFIG ────────────────────────────────────────────────
const CONFIG = {
  token:      process.env.BOT_TOKEN   || 'BOT_TOKEN',
  clientId:   process.env.CLIENT_ID   || 'CLIENT_ID',
  guildId:    process.env.GUILD_ID    || 'GUILD_ID',
      allowedRoleIds: (process.env.ALLOWED_ROLES || '').split(',').filter(Boolean),
  dataFile:   path.join(__dirname, 'tierdata.json'),
};

// ── TIER COLORS ───────────────────────────────────────────
const TIER_COLORS = {
  HT1: 0xFF3D3D, HT2: 0xFF6B3D, HT3: 0xFF923D,
  MT1: 0xFFB83D, MT2: 0xFFD93D, MT3: 0xFFE94B,
  LT1: 0xB8E84B, LT2: 0x7AE84B, LT3: 0x4BE87A,
  LT4: 0x4BE8B8, LT5: 0x4B9BE8,
};

const TRIM_COLORS = {
  'No-Trim':      0xAAAAAA,
  'Kupfer-Trim':  0xC97C4A,
  'Iron-Trim':    0xB4B4C0,
  'Gold-Trim':    0xFFD700,
  'Diamond-Trim': 0x32C8E6,
  'Redstone-Trim':0xDC3232,
  'Emerald-Trim': 0x32DC64,
  'Lapis-Trim':   0x3264DC,
};

const VALID_TIERS = ['HT1','HT2','HT3','MT1','MT2','MT3','LT1','LT2','LT3','LT4','LT5'];
const VALID_TRIMS = ['No-Trim','Kupfer-Trim','Iron-Trim','Gold-Trim','Diamond-Trim','Redstone-Trim','Emerald-Trim','Lapis-Trim'];

// ── DATA LAYER ────────────────────────────────────────────
function loadData() {
  if (!fs.existsSync(CONFIG.dataFile)) {
    const init = { players: [], trimPlayers: [] };
    fs.writeFileSync(CONFIG.dataFile, JSON.stringify(init, null, 2));
    return init;
  }
  return JSON.parse(fs.readFileSync(CONFIG.dataFile, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(CONFIG.dataFile, JSON.stringify(data, null, 2));
}

// ── SLASH COMMANDS ─────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('tier')
    .setDescription('Master Tiers Verwaltung')
    .addSubcommand(sub =>
      sub.setName('result')
        .setDescription('Spieler zur Tier List hinzufügen')
        .addStringOption(o => o.setName('mcname').setDescription('Minecraft Name').setRequired(true))
        .addStringOption(o => o.setName('rank').setDescription('Rang (z.B. HT1, MT2, LT5 – oder Trim-Name)').setRequired(true))
        .addStringOption(o => o.setName('kategorie').setDescription('Kategorie (z.B. Crystal, Sword, Trim)').setRequired(true))
        .addStringOption(o => o.setName('tierlist').setDescription('Tier List Name (z.B. 1v1, TrimList)').setRequired(true))
        .addStringOption(o => o.setName('see').setDescription('see:true für Manager (Redstone-Trim)').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Spieler aus der Tier List entfernen')
        .addStringOption(o => o.setName('mcname').setDescription('Minecraft Name').setRequired(true))
        .addStringOption(o => o.setName('tierlist').setDescription('Tier List Name').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('Spieler in der Tier List nachschlagen')
        .addStringOption(o => o.setName('mcname').setDescription('Minecraft Name').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Tier List anzeigen')
        .addStringOption(o => o.setName('tierlist').setDescription('Tier List Name').setRequired(false))
    )
];

// ── REGISTER COMMANDS ─────────────────────────────────────
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(CONFIG.token);
  try {
    console.log('🔄 Registriere Slash Commands...');
    await rest.put(
      Routes.applicationGuildCommands(CONFIG.clientId, CONFIG.guildId),
      { body: commands.map(c => c.toJSON()) }
    );
    console.log('✅ Commands registriert!');
  } catch (err) {
    console.error('❌ Command-Registrierung fehlgeschlagen:', err);
  }
}

// ── CHECK PERMISSION ──────────────────────────────────────
function hasPermission(member) {
  if (CONFIG.allowedRoleIds.length === 0) return true; // Kein Filter = alle
  return member.roles.cache.some(r => CONFIG.allowedRoleIds.includes(r.id));
}

// ── BUILD TIER EMBED ──────────────────────────────────────
function buildTierEmbed(player) {
  const color = TIER_COLORS[player.rank] || 0xE8B84B;
  return new EmbedBuilder()
    .setTitle('⚔ Yourname_Tiers – Neuer Eintrag')
    .setColor(color)
    .setThumbnail(`https://mc-heads.net/avatar/${player.name}/64`)
    .addFields(
      { name: '👤 Spieler', value: player.name, inline: true },
      { name: '🏆 Rang',   value: `**${player.rank}**`, inline: true },
      { name: '🎮 Kategorie', value: player.cat, inline: true },
      { name: '📋 Liste',  value: player.list, inline: true },
      { name: '📅 Datum',  value: new Date().toLocaleDateString('de-DE'), inline: true },
    )
    .setFooter({ text: 'Your.MC.Server.IP · Yourname_Tiers' })
    .setTimestamp();
}

function buildTrimEmbed(player) {
  const color = TRIM_COLORS[player.trim] || 0xE8B84B;
  const trimData = TRIMS_INFO[player.trim] || {};
  let roleField = '';
  if (player.role === 'Manager') roleField = '🔴 **Manager**';
  else if (player.role === 'Developer') roleField = '🔵 **Developer**';
  else if (player.role === 'Builder') roleField = '🟢 **Builder**';

  const embed = new EmbedBuilder()
    .setTitle('🏆 Master Tiers – Trim Eintrag')
    .setColor(color)
    .setThumbnail(`https://mc-heads.net/avatar/${player.name}/64`)
    .addFields(
      { name: '👤 Spieler', value: player.name, inline: true },
      { name: '🛡 Trim',   value: `**${player.trim}**`, inline: true },
      { name: '📅 Datum',  value: new Date().toLocaleDateString('de-DE'), inline: true },
    );

  if (roleField) embed.addFields({ name: '🎖 Rolle', value: roleField, inline: true });
  if (player.sideTrim) embed.addFields({ name: '⚡ Haupt-Trim', value: player.sideTrim, inline: true });

  embed.setFooter({ text: 'deanmaster.mooo.com · Master Tiers' }).setTimestamp();
  return embed;
}

const TRIMS_INFO = {
  'No-Trim': { managerOnly: false },
  'Kupfer-Trim': {}, 'Iron-Trim': {}, 'Gold-Trim': {}, 'Diamond-Trim': {},
  'Redstone-Trim': { managerOnly: true },
  'Emerald-Trim': { builderOnly: true },
  'Lapis-Trim': { devOnly: true },
};

// ── CLIENT ────────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('ready', () => {
  console.log(`✅ ${client.user.tag} ist online!`);
  console.log(`📡 Server: deanmaster.mooo.com`);
  client.user.setActivity('deanmaster.mooo.com', { type: 3 }); // Watching
  registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'tier') return;

  // Permission Check
  if (!hasPermission(interaction.member)) {
    return interaction.reply({
      content: '❌ Du hast keine Berechtigung für diesen Command!',
      ephemeral: true
    });
  }

  const sub = interaction.options.getSubcommand();
  const data = loadData();

  // ── /tier result ──────────────────────────────────────
  if (sub === 'result') {
    const mcname   = interaction.options.getString('mcname');
    const rank     = interaction.options.getString('rank').toUpperCase().replace('-TRIM', '-Trim').replace('NO-TRIM','No-Trim');
    const kategorie = interaction.options.getString('kategorie');
    const tierlist  = interaction.options.getString('tierlist');
    const seeRaw   = interaction.options.getString('see') || '';
    const seeTrue  = seeRaw.toLowerCase().includes('true');

    const isTrim = VALID_TRIMS.includes(rank) || tierlist.toLowerCase().includes('trim');
    const isTier = VALID_TIERS.includes(rank);

    if (!isTrim && !isTier) {
      return interaction.reply({ content: `❌ Unbekannter Rang: \`${rank}\`. Verwende HT1-LT5 oder einen Trim-Namen.`, ephemeral: true });
    }

    // Sofort antworten, Nachricht danach löschen
    await interaction.reply({ content: '✅ Verarbeite...', ephemeral: false });
    // Nachricht löschen (simuliert "gelöscht")
    setTimeout(async () => {
      try { await interaction.deleteReply(); } catch {}
    }, 100);

    if (isTrim) {
      // Trim-Validierung
      if (rank === 'Redstone-Trim' && !seeTrue) {
        return interaction.followUp({ content: '❌ Manager (Redstone-Trim) benötigt `see:true`!', ephemeral: true });
      }

      let role = '';
      if (rank === 'Redstone-Trim') role = 'Manager';
      else if (rank === 'Emerald-Trim') role = 'Builder';
      else if (rank === 'Lapis-Trim') role = 'Developer';

      // Entferne alten Eintrag wenn vorhanden
      data.trimPlayers = data.trimPlayers.filter(p => p.name.toLowerCase() !== mcname.toLowerCase());

      const newEntry = {
        id: Date.now(), name: mcname, dc: `${interaction.user.tag}`,
        trim: rank, sideTrim: kategorie !== 'Trim' ? kategorie : '',
        role, date: new Date().toISOString().split('T')[0]
      };

      data.trimPlayers.push(newEntry);
      saveData(data);

      const embed = buildTrimEmbed(newEntry);
      await interaction.channel.send({ embeds: [embed] });

    } else {
      // Standard Tier
      data.players = data.players.filter(
        p => !(p.name.toLowerCase() === mcname.toLowerCase() && p.list === tierlist)
      );

      const newEntry = {
        id: Date.now(), name: mcname, dc: `${interaction.user.tag}`,
        rank, cat: kategorie, list: tierlist,
        date: new Date().toISOString().split('T')[0]
      };

      data.players.push(newEntry);
      saveData(data);

      const embed = buildTierEmbed(newEntry);
      await interaction.channel.send({ embeds: [embed] });
    }
  }

  // ── /tier remove ─────────────────────────────────────
  else if (sub === 'remove') {
    const mcname  = interaction.options.getString('mcname');
    const tierlist = interaction.options.getString('tierlist');

    await interaction.deferReply();

    const isTrimList = tierlist.toLowerCase().includes('trim');
    let removed = false;

    if (isTrimList) {
      const before = data.trimPlayers.length;
      data.trimPlayers = data.trimPlayers.filter(p => p.name.toLowerCase() !== mcname.toLowerCase());
      removed = data.trimPlayers.length < before;
    } else {
      const before = data.players.length;
      data.players = data.players.filter(
        p => !(p.name.toLowerCase() === mcname.toLowerCase() && p.list === tierlist)
      );
      removed = data.players.length < before;
    }

    saveData(data);

    const embed = new EmbedBuilder()
      .setTitle(removed ? '✅ Spieler entfernt' : '⚠️ Spieler nicht gefunden')
      .setColor(removed ? 0x4BE87A : 0xFF3D3D)
      .addFields(
        { name: 'Spieler', value: mcname, inline: true },
        { name: 'Liste',   value: tierlist, inline: true }
      )
      .setFooter({ text: 'deanmaster.mooo.com · Master Tiers' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  // ── /tier info ───────────────────────────────────────
  else if (sub === 'info') {
    const mcname = interaction.options.getString('mcname');
    await interaction.deferReply();

    const p = data.players.filter(x => x.name.toLowerCase() === mcname.toLowerCase());
    const t = data.trimPlayers.find(x => x.name.toLowerCase() === mcname.toLowerCase());

    if (p.length === 0 && !t) {
      return interaction.editReply({ content: `❌ **${mcname}** wurde nicht gefunden.` });
    }

    const embeds = [];
    p.forEach(entry => embeds.push(buildTierEmbed(entry)));
    if (t) embeds.push(buildTrimEmbed(t));

    await interaction.editReply({ embeds: embeds.slice(0, 10) });
  }

  // ── /tier list ───────────────────────────────────────
  else if (sub === 'list') {
    const tierlist = interaction.options.getString('tierlist') || 'alle';
    await interaction.deferReply();

    const TIERS_ORDER = ['HT1','HT2','HT3','MT1','MT2','MT3','LT1','LT2','LT3','LT4','LT5'];
    let filtered = tierlist === 'alle' ? data.players : data.players.filter(p => p.list === tierlist);

    if (filtered.length === 0) {
      return interaction.editReply({ content: `⚠️ Keine Einträge für \`${tierlist}\` gefunden.` });
    }

    const embed = new EmbedBuilder()
      .setTitle(`⚔ Tier List – ${tierlist}`)
      .setColor(0xE8B84B)
      .setFooter({ text: 'deanmaster.mooo.com · Master Tiers' })
      .setTimestamp();

    TIERS_ORDER.forEach(tier => {
      const players = filtered.filter(p => p.rank === tier);
      if (players.length > 0) {
        embed.addFields({
          name: `**${tier}**`,
          value: players.map(p => `• ${p.name}`).join('\n'),
          inline: false
        });
      }
    });

    await interaction.editReply({ embeds: [embed] });
  }
});
require('http')
    .createServer((req, res) => res.end('Bot läuft'))
    .listen(process.env.PORT || 3000);

// ── START ────────────────────────────────────────────────
client.login(CONFIG.token).catch(err => {
  console.error('❌ Login fehlgeschlagen:', err.message);
  console.log('\n📋 Setup-Anleitung:');
  console.log('1. Gehe zu https://discord.com/developers/applications');
  console.log('2. Erstelle einen neuen Bot');
  console.log('3. Kopiere den Token und füge ihn in CONFIG.token ein');
  console.log('4. Lade den Bot auf deinen Server ein');
  console.log('5. Starte den Bot mit: node bot.js\n');
});
