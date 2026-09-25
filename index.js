const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const CREATE_CHANNEL_ID = process.env.CREATE_CHANNEL_ID;
const TEMP_CATEGORY_NAME = 'Fuegos • Temporary Rooms';

const rooms = new Map();

function isTempRoom(channel) {
  if (!channel || channel.type !== ChannelType.GuildVoice) return false;

  const category = channel.parent;

  return Boolean(
    category && category.name === TEMP_CATEGORY_NAME
  );
}

function getOwnerId(channel) {
  if (!isTempRoom(channel)) return null;

  const owner = channel.permissionOverwrites.cache.find(
    overwrite =>
      overwrite.type === 1 &&
      overwrite.allow.has(
        PermissionsBitField.Flags.ManageChannels
      )
  );

  return owner ? owner.id : null;
}

async function findOrCreateCategory(guild, preferredParentId) {
  if (preferredParentId) {
    const preferred = guild.channels.cache.get(preferredParentId);

    if (
      preferred &&
      preferred.type === ChannelType.GuildCategory &&
      preferred.name === TEMP_CATEGORY_NAME
    ) {
      return preferred;
    }
  }

  let category = guild.channels.cache.find(
    channel =>
      channel.type === ChannelType.GuildCategory &&
      channel.name === TEMP_CATEGORY_NAME
  );

  if (!category) {
    category = await guild.channels.create({
      name: TEMP_CATEGORY_NAME,
      type: ChannelType.GuildCategory
    });
  }

  return category;
}

function buildPanel(channel, ownerId) {
  const embed = new EmbedBuilder()
    .setTitle('FUEGOS • ROOM CONTROL')
    .setDescription(
      'Manage your temporary voice room from the controls below.\n\n' +
      `**Owner:** <@${ownerId}>\n` +
      `**Members:** ${channel.members.size}\n\n` +
      'Only the current owner can use owner controls.'
    )
    .addFields(
      {
        name: 'ROOM',
        value:
          '✏️ Rename\n' +
          '👥 User Limit\n' +
          '🔗 Invite',
        inline: true
      },
      {
        name: 'PRIVACY',
        value:
          '🔒 Lock\n' +
          '🔓 Unlock\n' +
          '👁️ Hide\n' +
          '👀 Show',
        inline: true
      }
    )
    .setFooter({
      text: 'Fuegos • Temporary Voice System'
    })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rename')
      .setLabel('Rename')
      .setEmoji('✏️')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('limit')
      .setLabel('User Limit')
      .setEmoji('👥')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('invite')
      .setLabel('Invite')
      .setEmoji('🔗')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('claim')
      .setLabel('Claim')
      .setEmoji('👑')
      .setStyle(ButtonStyle.Success)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('lock')
      .setLabel('Lock')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('unlock')
      .setLabel('Unlock')
      .setEmoji('🔓')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('hide')
      .setLabel('Hide')
      .setEmoji('👁️')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('show')
      .setLabel('Show')
      .setEmoji('👀')
      .setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('delete')
      .setLabel('Delete Room')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger)
  );

  return {
    embeds: [embed],
    components: [row1, row2, row3]
  };
}

async function deleteIfEmpty(channel) {
  if (!isTempRoom(channel)) return;

  if (channel.members.size !== 0) return;

  rooms.delete(channel.id);

  await channel.delete().catch(() => {});

  console.log(`Deleted empty room: ${channel.name}`);
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    for (const channel of guild.channels.cache.values()) {
      if (isTempRoom(channel)) {
        const ownerId = getOwnerId(channel);

        if (ownerId) {
          rooms.set(channel.id, ownerId);
        }

        await deleteIfEmpty(channel);
      }
    }
  }

  console.log(
    `Recovered ${rooms.size} temporary room(s).`
  );

  console.log(
    'Fuegos Temporary Voice Bot is ONLINE'
  );
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    // CREATE ROOM
    if (
      newState.channelId === CREATE_CHANNEL_ID &&
      oldState.channelId !== CREATE_CHANNEL_ID
    ) {
      const guild = newState.guild;
      const member = newState.member;

      const category = await findOrCreateCategory(
        guild,
        newState.channel.parentId
      );

      const room = await guild.channels.create({
        name: `${member.user.username}'s Room`,
        type: ChannelType.GuildVoice,
        parent: category.id,

        permissionOverwrites: [
          {
           
