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
  UserSelectMenuBuilder,
  ActivityType
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

/* =====================================================
   CONFIGURATION & TRACKING
===================================================== */

const CREATE_CHANNEL_ID = process.env.CREATE_CHANNEL_ID;
const MARKER = '\u200B'; // Hidden zero-width space to tag temp rooms
const tempRooms = new Map(); // Maps ChannelID -> OwnerID

const EMOJIS = {
  rename: '1553023298026086412',
  limit: '🔢',
  trust: '1261941119965593610',
  claim: '1553022553386385458',
  chat: '1553023637702058044',
  block: '1553023862621347997',
  privacy: '🔒',
  waiting: '🕒',
  untrust: '🚷',
  invite: '🔗',
  kick: '📞',
  region: '🌐',
  unblock: '🔓',
  transfer: '🔄'
};

/* =====================================================
   CORE HELPERS
===================================================== */

function isTempRoom(channel) {
  if (!channel || channel.type !== ChannelType.GuildVoice || channel.id === CREATE_CHANNEL_ID) {
    return false;
  }

  // 1. Check active memory
  if (tempRooms.has(channel.id)) return true;

  // 2. Check for hidden tag in name
  if (channel.name.includes(MARKER)) return true;

  // 3. Fallback: Is it in the same category as the Join-to-Create channel?
  const createChan = channel.guild.channels.cache.get(CREATE_CHANNEL_ID);
  if (createChan && createChan.parentId && channel.parentId === createChan.parentId) {
    return true;
  }

  return false;
}

function getOwnerId(channel) {
  if (!isTempRoom(channel)) return null;
  if (tempRooms.has(channel.id)) return tempRooms.get(channel.id);

  const overwrite = channel.permissionOverwrites.cache.find(
    o => o.type === 1 && o.allow.has(PermissionsBitField.Flags.ManageChannels)
  );
  return overwrite ? overwrite.id : null;
}

function buildPanel() {
  const embed = new EmbedBuilder()
    .setColor(0xFF2A55)
    .setTitle('TempVoice Interface')
    .setDescription(
      'Manage your temporary voice channel using the buttons below.\n\n' +
      `💳 **NAME**  •  🔢 **LIMIT**  •  🔒 **PRIVACY**\n` +
      `🕒 **WAITING**  •  💬 **CHAT**\n\n` +
      `👤 **TRUST**  •  🚷 **UNTRUST**  •  🔗 **INVITE**\n` +
      `📞 **KICK**  •  🌐 **REGION**\n\n` +
      `🚫 **BLOCK**  •  🔓 **UNBLOCK**  •  👑 **CLAIM**\n` +
      `🔄 **TRANSFER**  •  🗑️ **DELETE**`
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rename').setEmoji(EMOJIS.rename || '💳').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('limit').setEmoji(EMOJIS.limit).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('privacy').setEmoji(EMOJIS.privacy).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('waiting').setEmoji(EMOJIS.waiting).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('chat').setEmoji(EMOJIS.chat || '💬').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('trust').setEmoji(EMOJIS.trust || '👤').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('untrust').setEmoji(EMOJIS.untrust).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('invite').setEmoji(EMOJIS.invite).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('kick').setEmoji(EMOJIS.kick).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('region').setEmoji(EMOJIS.region).setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('block').setEmoji(EMOJIS.block || '🚫').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('unblock').setEmoji(EMOJIS.unblock).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('claim').setEmoji(EMOJIS.claim || '👑').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('transfer').setEmoji(EMOJIS.transfer).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

function createUserSelectRow(customId, placeholder) {
  return new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).setMinValues(1).setMaxValues(1)
  );
}

/* =====================================================
   BOT STARTUP & ORPHAN CLEANUP
===================================================== */

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('Fuegos Music', { type: ActivityType.Playing });

  // Delete orphaned empty temp rooms if the bot restarted while they existed
  for (const guild of client.guilds.cache.values()) {
    const channels = await guild.channels.fetch().catch(() => null);
    if (!channels) continue;

    for (const channel of channels.values()) {
      if (isTempRoom(channel) && channel.members.size === 0) {
        await channel.delete().catch(() => {});
        console.log(`[STARTUP] Cleaned up orphaned channel: ${channel.name}`);
      }
    }
  }
});

/* =====================================================
   VOICE STATE UPDATE (CREATE & AUTO-DELETE)
===================================================== */

client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    // --- 1. USER JOINS THE CREATOR CHANNEL ---
    if (newState.channelId === CREATE_CHANNEL_ID && oldState.channelId !== CREATE_CHANNEL_ID) {
      const { guild, member, channel: createChannel } = newState;
      if (!createChannel || !member) return;

      const room = await guild.channels.create({
        name: `${member.user.username}'s Room${MARKER}`,
        type: ChannelType.GuildVoice,
        parent: createChannel.parentId || undefined,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect]
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

      tempRooms.set(room.id, member.id);
      await member.voice.setChannel(room).catch(() => {});

      // Instant fallback: if they disconnected while the room was being made
      if (room.members.size === 0) {
        tempRooms.delete(room.id);
        await room.delete().catch(() => {});
        return;
      }

      await room.send(buildPanel()).catch(() => {});
    }

    // --- 2. USER LEAVES OR MOVES FROM A TEMP CHANNEL ---
    if (oldState.channel && oldState.channelId !== CREATE_CHANNEL_ID && isTempRoom(oldState.channel)) {
      const leftChannel = oldState.channel;

      // 300ms delay to allow Discord API member counts to update safely
      setTimeout(async () => {
        try {
          const fetchedChannel = await leftChannel.guild.channels.fetch(leftChannel.id).catch(() => null);
          if (fetchedChannel && fetchedChannel.members.size === 0) {
            tempRooms.delete(fetchedChannel.id);
            await fetchedChannel.delete().catch(err => console.error(`Failed to delete room: ${err.message}`));
          }
        } catch (e) {
          // Channel already deleted
        }
      }, 300);
    }
  } catch (error) {
    console.error('[VOICE STATE ERROR]', error);
  }
});

/* =====================================================
   INTERACTION HANDLERS (BUTTONS, DROPDOWNS, MODALS)
===================================================== */

client.on('interactionCreate', async interaction => {
  try {
    const { channel, user, customId } = interaction;

    if (!isTempRoom(channel)) {
      if (interaction.isButton() || interaction.isUserSelectMenu()) {
        return interaction.reply({ content: '❌ This interface belongs to a deleted room.', ephemeral: true });
      }
      return;
    }

    const ownerId = getOwnerId(channel);

    /* --- BUTTONS --- */
    if (interaction.isButton()) {
      
      // CLAIM (Anyone can click if owner left)
      if (customId === 'claim') {
        if (!channel.members.has(user.id)) return interaction.reply({ content: '❌ You must be in the room to claim it.', ephemeral: true });
        
        const oldOwner = ownerId ? await interaction.guild.members.fetch(ownerId).catch(() => null) : null;
        if (oldOwner && oldOwner.voice.channelId === channel.id) {
          return interaction.reply({ content: '❌ The current owner is still here.', ephemeral: true });
        }

        if (ownerId) await channel.permissionOverwrites.delete(ownerId).catch(() => {});
        await channel.permissionOverwrites.edit(user.id, { ViewChannel: true, Connect: true, Speak: true, ManageChannels: true });
        tempRooms.set(channel.id, user.id);
        return interaction.reply({ content: '👑 You claimed the room.', ephemeral: true });
      }

      // OWNER ONLY BEYOND THIS POINT
      if (user.id !== ownerId) return interaction.reply({ content: '❌ Only the room owner can do this.', ephemeral: true });

      // MODALS
      if (customId === 'rename') {
        const modal = new ModalBuilder().setCustomId('rename_modal').setTitle('Rename Room');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('New Name').setStyle(TextInputStyle.Short).setRequired(true)));
        return interaction.showModal(modal);
      }
      if (customId === 'limit') {
        const modal = new ModalBuilder().setCustomId('limit_modal').setTitle('User Limit (0-99)');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('limit').setLabel('0 = Unlimited').setStyle(TextInputStyle.Short).setRequired(true)));
        return interaction.showModal(modal);
      }
      if (customId === 'region') {
        const modal = new ModalBuilder().setCustomId('region_modal').setTitle('Voice Region');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('region').setLabel('auto / singapore / japan / etc').setStyle(TextInputStyle.Short).setRequired(true)));
        return interaction.showModal(modal);
      }

      // DIRECT TOGGLES
      if (customId === 'privacy') {
        const locked = channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id)?.deny.has(PermissionsBitField.Flags.Connect);
        await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { Connect: locked ? true : false });
        return interaction.reply({ content: locked ? '🔓 Room Unlocked.' : '🔒 Room Locked.', ephemeral: true });
      }
      if (customId === 'waiting') {
        await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { Connect: false });
        return interaction.reply({ content: '⏳ Waiting room enabled.', ephemeral: true });
      }
      if (customId === 'chat') return interaction.reply({ content: '💬 Text permissions are managed in Discord settings.', ephemeral: true });
      if (customId === 'delete') {
        tempRooms.delete(channel.id);
        await interaction.reply({ content: '🗑️ Deleting room...', ephemeral: true });
        return channel.delete().catch(() => {});
      }

      // DROPDOWN MENUS
      const menus = {
        'invite': 'Select user to DM an invite:',
        'trust': 'Select user to Trust (bypass locks):',
        'untrust': 'Select user to Untrust:',
        'kick': 'Select user to Kick from voice:',
        'block': 'Select user to Block (cannot join):',
        'unblock': 'Select user to Unblock:',
        'transfer': 'Select user to transfer ownership to:'
      };
      if (menus[customId]) {
        return interaction.reply({ content: menus[customId], components: [createUserSelectRow(`select_${customId}`, 'Choose a user...')], ephemeral: true });
      }
    }

    /* --- USER SELECT MENUS --- */
    if (interaction.isUserSelectMenu()) {
      if (user.id !== ownerId) return interaction.reply({ content: '❌ Only the room owner can do this.', ephemeral: true });

      const targetId = interaction.values[0];
      const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
      if (!targetMember) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

      if (customId === 'select_invite') {
        const invite = await channel.createInvite({ maxAge: 3600, maxUses: 1 });
        await targetMember.send(`📨 **${user.username}** invited you to their VC: ${invite.url}`).catch(() => {});
        return interaction.update({ content: `✅ Invite sent to <@${targetId}> (or they have DMs off).`, components: [] });
      }
      if (customId === 'select_trust') {
        await channel.permissionOverwrites.edit(targetId, { ViewChannel: true, Connect: true });
        return interaction.update({ content: `🟢 Trusted <@${targetId}>`, components: [] });
      }
      if (customId === 'select_untrust' || customId === 'select_unblock') {
        if (targetId === ownerId) return interaction.update({ content: '❌ Cannot perform on yourself.', components: [] });
        await channel.permissionOverwrites.delete(targetId).catch(() => {});
        return interaction.update({ content: `✅ Removed custom permissions for <@${targetId}>`, components: [] });
      }
      if (customId === 'select_kick') {
        if (targetId === ownerId) return interaction.update({ content: '❌ Cannot kick yourself.', components: [] });
        if (targetMember.voice.channelId === channel.id) await targetMember.voice.disconnect();
        return interaction.update({ content: `📞 Kicked <@${targetId}>`, components: [] });
      }
      if (customId === 'select_block') {
        if (targetId === ownerId) return interaction.update({ content: '❌ Cannot block yourself.', components: [] });
        await channel.permissionOverwrites.edit(targetId, { ViewChannel: false, Connect: false });
        if (targetMember.voice.channelId === channel.id) await targetMember.voice.disconnect();
        return interaction.update({ content: `🚫 Blocked <@${targetId}>`, components: [] });
      }
      if (customId === 'select_transfer') {
        if (targetId === ownerId) return interaction.update({ content: '❌ You already own it.', components: [] });
        await channel.permissionOverwrites.delete(ownerId).catch(() => {});
        await channel.permissionOverwrites.edit(targetId, { ViewChannel: true, Connect: true, ManageChannels: true });
        tempRooms.set(channel.id, targetId);
        return interaction.update({ content: `🔄 Ownership transferred to <@${targetId}>`, components: [] });
      }
    }

    /* --- MODALS --- */
    if (interaction.isModalSubmit()) {
      if (user.id !== ownerId) return interaction.reply({ content: '❌ Only the room owner can do this.', ephemeral: true });

      if (customId === 'rename_modal') {
        const name = interaction.fields.getTextInputValue('name').trim();
        await channel.setName(`${name}${MARKER}`);
        return interaction.reply({ content: `✏️ Renamed to **${name}**.`, ephemeral: true });
      }
      if (customId === 'limit_modal') {
        const limit = Number(interaction.fields.getTextInputValue('limit'));
        if (isNaN(limit) || limit < 0 || limit > 99) return interaction.reply({ content: '❌ Limit must be 0-99.', ephemeral: true });
        await channel.setUserLimit(limit);
        return interaction.reply({ content: `👥 Limit set to **${limit}**.`, ephemeral: true });
      }
      if (customId === 'region_modal') {
        const region = interaction.fields.getTextInputValue('region').toLowerCase();
        await channel.setRTCRegion(region === 'auto' ? null : region);
        return interaction.reply({ content: `🌐 Region set to **${region}**.`, ephemeral: true });
      }
    }
  } catch (error) {
    console.error('[INTERACTION ERROR]', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '⚠️ An error occurred.', ephemeral: true }).catch(() => {});
    }
  }
});

/* =====================================================
   START BOT
===================================================== */
client.login(process.env.TOKEN).catch(err => console.error('[LOGIN ERROR]', err));
