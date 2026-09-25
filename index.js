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
  TextInputStyle,
  ActivityType
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

/* =====================================================
   RAILWAY
===================================================== */

const CREATE_CHANNEL_ID = process.env.CREATE_CHANNEL_ID;

/* =====================================================
   TEMP ROOM SYSTEM
===================================================== */

const MARKER = '\u200B';
const tempRooms = new Map();

/* =====================================================
   HELPERS
===================================================== */

function isTempRoom(channel) {
  return Boolean(
    channel &&
    channel.type === ChannelType.GuildVoice &&
    channel.id !== CREATE_CHANNEL_ID &&
    (tempRooms.has(channel.id) || channel.name.includes(MARKER))
  );
}

function getDisplayName(channel) {
  return channel.name.replace(MARKER, '');
}

function getOwnerId(channel) {
  if (!isTempRoom(channel)) return null;

  if (tempRooms.has(channel.id)) {
    return tempRooms.get(channel.id);
  }

  const overwrite = channel.permissionOverwrites.cache.find(
    o => o.type === 1 && o.allow.has(PermissionsBitField.Flags.ManageChannels)
  );

  return overwrite ? overwrite.id : null;
}

/* =====================================================
   EMOJI CONFIGURATION
===================================================== */

const EMOJIS = {
  rename: '1553023298026086412',    // :skribbl:
  members: '1261941119965593610',   // :Members: (LIMIT & TRUST)
  claim: '1553022553386385458',     // <a:crown:...> (Animated)
  chat: '1553023637702058044',      // :val_Chatting:
  block: '1553023862621347997',     // :block:
  
  // Empty values fall back to clean standard emojis automatically
  privacy: '',
  waiting: '',
  untrust: '',
  invite: '',
  kick: '',
  region: '',
  unblock: '',
  transfer: ''
};

/* =====================================================
   EMBED
===================================================== */

function buildPanel(channel) {
  const FUEGOS_BANNER_URL = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop';

  const renameTag = EMOJIS.rename ? `<:skribbl:${EMOJIS.rename}>` : '💳';
  const membersTag = EMOJIS.members ? `<:Members:${EMOJIS.members}>` : '👥';
  const claimTag = EMOJIS.claim ? `<a:crown:${EMOJIS.claim}>` : '👑';
  const chatTag = EMOJIS.chat ? `<:val_Chatting:${EMOJIS.chat}>` : '💬';
  const blockTag = EMOJIS.block ? `<:block:${EMOJIS.block}>` : '🚫';

  const embed = new EmbedBuilder()
    .setColor(0xFF2A55)
    .setTitle('TempVoice Interface')
    .setImage(FUEGOS_BANNER_URL)
    .setDescription(
      'This interface can be used to manage temporary voice channels. More options are available with **/voice** commands.\n\n' +
      `${renameTag} **NAME**　${membersTag} **LIMIT**　🔒 **PRIVACY**　🕒 **WAITING ROOM**　${chatTag} **CHAT**\n\n` +
      `${membersTag} **TRUST**　🚷 **UNTRUST**　🔗 **INVITE**　📞 **KICK**　🌐 **REGION**\n\n` +
      `${blockTag} **BLOCK**　🔓 **UNBLOCK**　${claimTag} **CLAIM**　🔄 **TRANSFER**　🗑️ **DELETE**\n\n` +
      'Press the buttons below to use the interface'
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rename').setEmoji(EMOJIS.rename || '💳').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('limit').setEmoji(EMOJIS.members || '👥').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('privacy').setEmoji(EMOJIS.privacy || '🔒').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('waiting').setEmoji(EMOJIS.waiting || '🕒').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('chat').setEmoji(EMOJIS.chat || '💬').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('trust').setEmoji(EMOJIS.members || '👤').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('untrust').setEmoji(EMOJIS.untrust || '🚷').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('invite').setEmoji(EMOJIS.invite || '🔗').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('kick').setEmoji(EMOJIS.kick || '📞').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('region').setEmoji(EMOJIS.region || '🌐').setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('block').setEmoji(EMOJIS.block || '🚫').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('unblock').setEmoji(EMOJIS.unblock || '🔓').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('claim').setEmoji(EMOJIS.claim || '👑').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('transfer').setEmoji(EMOJIS.transfer || '🔄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );

  return {
    content: 'Welcome to your custom VC.',
    embeds: [embed],
    components: [row1, row2, row3]
  };
}

/* =====================================================
   USER MODAL
===================================================== */

function createUserModal(customId, title) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);

  const input = new TextInputBuilder()
    .setCustomId('user_id')
    .setLabel('Discord User ID')
    .setPlaceholder('Enter Discord User ID')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(25)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  return modal;
}

/* =====================================================
   READY
===================================================== */

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.user.setActivity('Fuegos Music', {
    type: ActivityType.Playing
  });

  console.log('Playing Fuegos Music');
  console.log('Fuegos TempVoice is ONLINE');
});

/* =====================================================
   VOICE STATE
===================================================== */

client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    /* ===============================================
       CREATE TEMP VC
    =============================================== */

    if (
      newState.channelId === CREATE_CHANNEL_ID &&
      oldState.channelId !== CREATE_CHANNEL_ID
    ) {
      const createChannel = newState.channel;
      const guild = newState.guild;
      const member = newState.member;

      if (!createChannel || !member) return;

      const parentId = createChannel.parentId;

      console.log(`CREATE ROOM detected: ${createChannel.name}`);
      console.log(`Using category: ${parentId || 'NONE'}`);

      const room = await guild.channels.create({
        name: `${member.user.username}'s Room${MARKER}`,
        type: ChannelType.GuildVoice,
        parent: parentId || undefined,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.Connect
            ]
          },
          {
            id: member.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak,
              PermissionsBitField.Flags.ManageChannels
            ]
          }
        ]
      });

      // Track channel ID in memory
      tempRooms.set(room.id, member.id);

      // Attempt to move member to the new room
      await member.voice.setChannel(room).catch(() => {});

      // If member left before or during creation, delete the empty channel immediately
      if (room.members.size === 0) {
        tempRooms.delete(room.id);
        await room.delete().catch(() => {});
        console.log(`DELETED EMPTY TEMP VC (User left during creation): ${getDisplayName(room)}`);
        return;
      }

      await room.send(buildPanel(room)).catch(() => {});

      console.log(`TEMP VC CREATED: ${getDisplayName(room)}`);
    }

    /* ===============================================
       DIRECT / INSTANT DELETE
    =============================================== */

    if (
      oldState.channel &&
      oldState.channel.id !== CREATE_CHANNEL_ID &&
      isTempRoom(oldState.channel)
    ) {
      const leftChannelId = oldState.channel.id;

      // Fetch fresh channel object to prevent cache issues
      const fetchedChannel = await oldState.guild.channels.fetch(leftChannelId).catch(() => null);

      if (fetchedChannel && fetchedChannel.members.size === 0) {
        tempRooms.delete(fetchedChannel.id);

        await fetchedChannel.delete().then(() => {
          console.log(`DELETED EMPTY TEMP VC: ${getDisplayName(fetchedChannel)}`);
        }).catch(error => {
          console.error('FAILED TO DELETE TEMP VC:', error);
        });
      }
    }
  } catch (error) {
    console.error('VOICE STATE ERROR:', error);
  }
});

/* =====================================================
   INTERACTIONS
===================================================== */

client.on('interactionCreate', async interaction => {
  try {
    /* =================================================
       BUTTONS
    ================================================= */

    if (interaction.isButton()) {
      const channel = interaction.channel;

      if (!isTempRoom(channel)) {
        return interaction.reply({
          content: 'This temporary room is no longer active.',
          ephemeral: true
        });
      }

      const ownerId = tempRooms.get(channel.id) || getOwnerId(channel);

      /* =============================================
         CLAIM
      ============================================= */

      if (interaction.customId === 'claim') {
        const oldOwner = ownerId
          ? await interaction.guild.members.fetch(ownerId).catch(() => null)
          : null;

        if (oldOwner && oldOwner.voice.channelId === channel.id) {
          return interaction.reply({
            content: 'The current owner is still in this room.',
            ephemeral: true
          });
        }

        if (!channel.members.has(interaction.user.id)) {
          return interaction.reply({
            content: 'Join this voice room first to claim it.',
            ephemeral: true
          });
        }

        if (ownerId) {
          await channel.permissionOverwrites.delete(ownerId).catch(() => {});
        }

        await channel.permissionOverwrites.edit(interaction.user.id, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
          ManageChannels: true
        });

        tempRooms.set(channel.id, interaction.user.id);

        return interaction.reply({
          content: '👑 You are now the room owner.',
          ephemeral: true
        });
      }

      /* =============================================
         OWNER CHECK
      ============================================= */

      if (interaction.user.id !== ownerId) {
        return interaction.reply({
          content: 'Only the current room owner can use this control.',
          ephemeral: true
        });
      }

      /* =============================================
         RENAME
      ============================================= */

      if (interaction.customId === 'rename') {
        const modal = new ModalBuilder()
          .setCustomId('rename_modal')
          .setTitle('Rename Room');

        const input = new TextInputBuilder()
          .setCustomId('name')
          .setLabel('New room name')
          .setPlaceholder('My Room')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(80)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));

        return interaction.showModal(modal);
      }

      /* =============================================
         LIMIT
      ============================================= */

      if (interaction.customId === 'limit') {
        const modal = new ModalBuilder()
          .setCustomId('limit_modal')
          .setTitle('User Limit');

        const input = new TextInputBuilder()
          .setCustomId('limit')
          .setLabel('0 = Unlimited | 1-99')
          .setPlaceholder('5')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(2)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));

        return interaction.showModal(modal);
      }

      /* =============================================
         PRIVACY / LOCK
      ============================================= */

      if (interaction.customId === 'privacy') {
        const everyone = channel.guild.roles.everyone;
        const overwrite = channel.permissionOverwrites.cache.get(everyone.id);
        const locked = overwrite && overwrite.deny.has(PermissionsBitField.Flags.Connect);

        if (locked) {
          await channel.permissionOverwrites.edit(everyone, { Connect: true });
          return interaction.reply({ content: '🔓 Room unlocked.', ephemeral: true });
        }

        await channel.permissionOverwrites.edit(everyone, { Connect: false });
        await channel.permissionOverwrites.edit(ownerId, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
          ManageChannels: true
        });

        return interaction.reply({ content: '🔒 Room locked.', ephemeral: true });
      }

      /* =============================================
         WAITING ROOM
      ============================================= */

      if (interaction.customId === 'waiting') {
        await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { Connect: false });
        await channel.permissionOverwrites.edit(ownerId, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
          ManageChannels: true
        });

        return interaction.reply({ content: '⏳ Waiting room enabled.', ephemeral: true });
      }

      /* =============================================
         CHAT
      ============================================= */

      if (interaction.customId === 'chat') {
        return interaction.reply({
          content: '💬 Room chat is controlled by Discord channel permissions.',
          ephemeral: true
        });
      }

      /* =============================================
         INVITE
      ============================================= */

      if (interaction.customId === 'invite') {
        const invite = await channel.createInvite({ maxAge: 3600, maxUses: 0 });

        return interaction.reply({
          content: `🔗 **Room Invite**\n\n${invite.url}`,
          ephemeral: true
        });
      }

      /* =============================================
         TRUST
      ============================================= */

      if (interaction.customId === 'trust') {
        return interaction.showModal(createUserModal('trust_modal', 'Trust Member'));
      }

      /* =============================================
         UNTRUST
      ============================================= */

      if (interaction.customId === 'untrust') {
        return interaction.showModal(createUserModal('untrust_modal', 'Untrust Member'));
      }

      /* =============================================
         KICK
      ============================================= */

      if (interaction.customId === 'kick') {
        return interaction.showModal(createUserModal('kick_modal', 'Kick Member'));
      }

      /* =============================================
         REGION
      ============================================= */

      if (interaction.customId === 'region') {
        const modal = new ModalBuilder()
          .setCustomId('region_modal')
          .setTitle('Voice Region');

        const input = new TextInputBuilder()
          .setCustomId('region')
          .setLabel('Region')
          .setPlaceholder('auto / singapore / japan / us-east')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));

        return interaction.showModal(modal);
      }

      /* =============================================
         BLOCK
      ============================================= */

      if (interaction.customId === 'block') {
        return interaction.showModal(createUserModal('block_modal', 'Block Member'));
      }

      /* =============================================
         UNBLOCK
      ============================================= */

      if (interaction.customId === 'unblock') {
        return interaction.showModal(createUserModal('unblock_modal', 'Unblock Member'));
      }

      /* =============================================
         TRANSFER
      ============================================= */

      if (interaction.customId === 'transfer') {
        return interaction.showModal(createUserModal('transfer_modal', 'Transfer Ownership'));
      }

      /* =============================================
         DELETE
      ============================================= */

      if (interaction.customId === 'delete') {
        tempRooms.delete(channel.id);

        await interaction.reply({ content: '🗑️ Deleting room...', ephemeral: true });
        await channel.delete().catch(() => {});
        return;
      }
    }

    /* =================================================
       MODALS
    ================================================= */

    if (interaction.isModalSubmit()) {
      const channel = interaction.channel;

      if (!isTempRoom(channel)) {
        return interaction.reply({
          content: 'This room is no longer active.',
          ephemeral: true
        });
      }

      const ownerId = tempRooms.get(channel.id) || getOwnerId(channel);

      if (interaction.user.id !== ownerId) {
        return interaction.reply({
          content: 'Only the room owner can use this.',
          ephemeral: true
        });
      }

      /* =============================================
         RENAME
      ============================================= */

      if (interaction.customId === 'rename_modal') {
        const name = interaction.fields.getTextInputValue('name').trim();

        if (!name) {
          return interaction.reply({ content: 'Enter a valid name.', ephemeral: true });
        }

        await channel.setName(`${name}${MARKER}`);

        return interaction.reply({
          content: `✏️ Room renamed to **${name}**.`,
          ephemeral: true
        });
      }

      /* =============================================
         LIMIT
      ============================================= */

      if (interaction.customId === 'limit_modal') {
        const value = Number(interaction.fields.getTextInputValue('limit').trim());

        if (!Number.isInteger(value) || value < 0 || value > 99) {
          return interaction.reply({
            content: 'Enter a number from 0 to 99.',
            ephemeral: true
          });
        }

        await channel.setUserLimit(value);

        return interaction.reply({
          content: value === 0 ? '👥 User limit removed.' : `👥 User limit set to **${value}**.`,
          ephemeral: true
        });
      }

      /* =============================================
         REGION
      ============================================= */

      if (interaction.customId === 'region_modal') {
        const region = interaction.fields.getTextInputValue('region').trim().toLowerCase();

        if (region === 'auto') {
          await channel.setRTCRegion(null);
          return interaction.reply({ content: '🌐 Region set to automatic.', ephemeral: true });
        }

        await channel.setRTCRegion(region);

        return interaction.reply({
          content: `🌐 Voice region set to **${region}**.`,
          ephemeral: true
        });
      }

      /* =============================================
         GET MEMBER
      ============================================= */

      const userId = interaction.fields.getTextInputValue('user_id').trim();

      const member = await interaction.guild.members.fetch(userId).catch(() => null);

      if (!member) {
        return interaction.reply({
          content: '❌ User not found in this server.',
          ephemeral: true
        });
      }

      /* =============================================
         TRUST
      ============================================= */

      if (interaction.customId === 'trust_modal') {
        await channel.permissionOverwrites.edit(member.id, {
          ViewChannel: true,
          Connect: true,
          Speak: true
        });

        return interaction.reply({
          content: `🟢 <@${member.id}> is now trusted.`,
          ephemeral: true
        });
      }

      /* =============================================
         UNTRUST
      ============================================= */

      if (interaction.customId === 'untrust_modal') {
        if (member.id === ownerId) {
          return interaction.reply({
            content: '❌ You cannot untrust the owner.',
            ephemeral: true
          });
        }

        await channel.permissionOverwrites.delete(member.id).catch(() => {});

        return interaction.reply({
          content: `🔴 <@${member.id}> is no longer trusted.`,
          ephemeral: true
        });
      }

      /* =============================================
         BLOCK
      ============================================= */

      if (interaction.customId === 'block_modal') {
        if (member.id === ownerId) {
          return interaction.reply({
            content: '❌ You cannot block the owner.',
            ephemeral: true
          });
        }

        await channel.permissionOverwrites.edit(member.id, {
          ViewChannel: false,
          Connect: false
        });

        return interaction.reply({
          content: `🚫 <@${member.id}> has been blocked.`,
          ephemeral: true
        });
      }

      /* =============================================
         UNBLOCK
      ============================================= */

      if (interaction.customId === 'unblock_modal') {
        await channel.permissionOverwrites.delete(member.id).catch(() => {});

        return interaction.reply({
          content: `🔓 <@${member.id}> has been unblocked.`,
          ephemeral: true
        });
      }

      /* =============================================
         KICK
      ============================================= */

      if (interaction.customId === 'kick_modal') {
        if (member.id === ownerId) {
          return interaction.reply({
            content: '❌ You cannot kick the room owner.',
            ephemeral: true
          });
        }

        if (member.voice.channelId !== channel.id) {
          return interaction.reply({
            content: '❌ That user is not inside this room.',
            ephemeral: true
          });
        }

        await member.voice.disconnect();

        return interaction.reply({
          content: `📵 <@${member.id}> was kicked.`,
          ephemeral: true
        });
      }

      /* =============================================
         TRANSFER
      ============================================= */

      if (interaction.customId === 'transfer_modal') {
        if (member.voice.channelId !== channel.id) {
          return interaction.reply({
            content: '❌ The new owner must be inside this room.',
            ephemeral: true
          });
        }

        if (member.id === ownerId) {
          return interaction.reply({
            content: '❌ That user is already the owner.',
            ephemeral: true
          });
        }

        await channel.permissionOverwrites.delete(ownerId).catch(() => {});

        await channel.permissionOverwrites.edit(member.id, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
          ManageChannels: true
        });

        tempRooms.set(channel.id, member.id);

        return interaction.reply({
          content: `🔄 Ownership transferred to <@${member.id}>.`,
          ephemeral: true
        });
      }
    }
  } catch (error) {
    console.error('INTERACTION ERROR:', error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'Something went wrong. Check Railway logs.',
        ephemeral: true
      }).catch(() => {});
    }
  }
});

/* =====================================================
   LOGIN
===================================================== */

if (!process.env.TOKEN) {
  console.error('ERROR: TOKEN is missing from Railway Variables.');
} else if (!CREATE_CHANNEL_ID) {
  console.error('ERROR: CREATE_CHANNEL_ID is missing from Railway Variables.');
} else {
  client.login(process.env.TOKEN).catch(error => {
    console.error('DISCORD LOGIN ERROR:', error);
  });
}
