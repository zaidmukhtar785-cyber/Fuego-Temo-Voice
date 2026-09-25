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
    GatewayIntentBits.GuildVoiceStates
  ]
});

/* =====================================================
   RAILWAY & TEMP ROOM TRACKING
===================================================== */

const CREATE_CHANNEL_ID = process.env.CREATE_CHANNEL_ID;
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
  limit: '🔢',                      // Unique icon for LIMIT
  trust: '1261941119965593610',     // :Members:
  claim: '1553022553386385458',     // <a:crown:...>
  chat: '1553023637702058044',      // :val_Chatting:
  block: '1553023862621347997',     // :block:
  
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
   EMBED & INTERFACE PANEL
===================================================== */

function buildPanel(channel) {
  const renameTag = EMOJIS.rename ? `<:skribbl:${EMOJIS.rename}>` : '💳';
  const limitTag = EMOJIS.limit;
  const trustTag = EMOJIS.trust ? `<:Members:${EMOJIS.trust}>` : '👤';
  const claimTag = EMOJIS.claim ? `<a:crown:${EMOJIS.claim}>` : '👑';
  const chatTag = EMOJIS.chat ? `<:val_Chatting:${EMOJIS.chat}>` : '💬';
  const blockTag = EMOJIS.block ? `<:block:${EMOJIS.block}>` : '🚫';

  const embed = new EmbedBuilder()
    .setColor(0xFF2A55)
    .setTitle('TempVoice Interface')
    .setDescription(
      'This interface can be used to manage temporary voice channels. More options are available with **/voice** commands.\n\n' +
      `${renameTag} **NAME**  •  ${limitTag} **LIMIT**  •  🔒 **PRIVACY**\n` +
      `🕒 **WAITING**  •  ${chatTag} **CHAT**\n\n` +
      `${trustTag} **TRUST**  •  🚷 **UNTRUST**  •  🔗 **INVITE**\n` +
      `📞 **KICK**  •  🌐 **REGION**\n\n` +
      `${blockTag} **BLOCK**  •  🔓 **UNBLOCK**  •  ${claimTag} **CLAIM**\n` +
      `🔄 **TRANSFER**  •  🗑️ **DELETE**\n\n` +
      'Press the buttons below to use the interface'
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

  return {
    content: 'Welcome to your custom VC.',
    embeds: [embed],
    components: [row1, row2, row3]
  };
}

/* =====================================================
   USER SELECT DROPDOWN HELPER
===================================================== */

function createUserSelectRow(customId, placeholder) {
  const userSelect = new UserSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(1)
    .setMaxValues(1);

  return new ActionRowBuilder().addComponents(userSelect);
}

/* =====================================================
   READY & STARTUP CLEANUP
===================================================== */

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('Fuegos Music', { type: ActivityType.Playing });
  console.log('Fuegos TempVoice is ONLINE');

  // Sweep and clean any orphaned empty channels on bot startup
  try {
    for (const guild of client.guilds.cache.values()) {
      const channels = await guild.channels.fetch().catch(() => null);
      if (!channels) continue;

      for (const channel of channels.values()) {
        if (channel && channel.type === ChannelType.GuildVoice && channel.id !== CREATE_CHANNEL_ID) {
          if (channel.name.includes(MARKER) && channel.members.size === 0) {
            await channel.delete().catch(() => {});
            console.log(`STARTUP CLEANUP: Deleted orphaned room ${getDisplayName(channel)}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('STARTUP CLEANUP ERROR:', err);
  }
});

/* =====================================================
   VOICE STATE UPDATE (CREATION & DELETION)
===================================================== */

client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    /* --- CREATE TEMP VC --- */
    if (newState.channelId === CREATE_CHANNEL_ID && oldState.channelId !== CREATE_CHANNEL_ID) {
      const createChannel = newState.channel;
      const guild = newState.guild;
      const member = newState.member;

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

      // Immediate check if user left during room creation
      if (room.members.size === 0) {
        tempRooms.delete(room.id);
        await room.delete().catch(() => {});
        return;
      }

      await room.send(buildPanel(room)).catch(() => {});
    }

    /* --- FAST AUTO-DELETE ON LEAVE OR MOVE --- */
    if (
      oldState.channel &&
      oldState.channel.id !== CREATE_CHANNEL_ID &&
      isTempRoom(oldState.channel)
    ) {
      const leftChannel = oldState.channel;

      // 300ms delay: prevents Discord API state race conditions when shifting rooms
      setTimeout(async () => {
        try {
          const fetchedChannel = await leftChannel.guild.channels.fetch(leftChannel.id).catch(() => null);

          if (fetchedChannel && fetchedChannel.members.size === 0) {
            tempRooms.delete(fetchedChannel.id);
            await fetchedChannel.delete().catch(() => {});
            console.log(`DELETED EMPTY TEMP VC: ${getDisplayName(fetchedChannel)}`);
          }
        } catch (err) {
          // Ignore if channel was already deleted
        }
      }, 300);
    }
  } catch (error) {
    console.error('VOICE STATE ERROR:', error);
  }
});

/* =====================================================
   INTERACTION HANDLER
===================================================== */

client.on('interactionCreate', async interaction => {
  try {
    const channel = interaction.channel;

    if (!isTempRoom(channel)) {
      if (interaction.isButton() || interaction.isUserSelectMenu()) {
        return interaction.reply({ content: 'This room is no longer active.', ephemeral: true });
      }
      return;
    }

    const ownerId = tempRooms.get(channel.id) || getOwnerId(channel);

    /* =================================================
       BUTTON ACTIONS
    ================================================= */

    if (interaction.isButton()) {
      // CLAIM (Available to anyone if owner left channel)
      if (interaction.customId === 'claim') {
        const oldOwner = ownerId ? await interaction.guild.members.fetch(ownerId).catch(() => null) : null;

        if (oldOwner && oldOwner.voice.channelId === channel.id) {
          return interaction.reply({ content: 'The current owner is still in this room.', ephemeral: true });
        }

        if (!channel.members.has(interaction.user.id)) {
          return interaction.reply({ content: 'Join this voice room first to claim it.', ephemeral: true });
        }

        if (ownerId) await channel.permissionOverwrites.delete(ownerId).catch(() => {});

        await channel.permissionOverwrites.edit(interaction.user.id, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
          ManageChannels: true
        });

        tempRooms.set(channel.id, interaction.user.id);
        return interaction.reply({ content: '👑 You are now the room owner.', ephemeral: true });
      }

      // OWNER CHECK
      if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: 'Only the room owner can use this control.', ephemeral: true });
      }

      // MODALS (Text Settings)
      if (interaction.customId === 'rename') {
        const modal = new ModalBuilder().setCustomId('rename_modal').setTitle('Rename Room');
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

      if (interaction.customId === 'limit') {
        const modal = new ModalBuilder().setCustomId('limit_modal').setTitle('User Limit');
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

      if (interaction.customId === 'region') {
        const modal = new ModalBuilder().setCustomId('region_modal').setTitle('Voice Region');
        const input = new TextInputBuilder()
          .setCustomId('region')
          .setLabel('Region')
          .setPlaceholder('auto / singapore / japan / us-east')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      // DIRECT TOGGLES
      if (interaction.customId === 'privacy') {
        const everyone = channel.guild.roles.everyone;
        const overwrite = channel.permissionOverwrites.cache.get(everyone.id);
        const locked = overwrite && overwrite.deny.has(PermissionsBitField.Flags.Connect);

        if (locked) {
          await channel.permissionOverwrites.edit(everyone, { Connect: true });
          return interaction.reply({ content: '🔓 Room unlocked.', ephemeral: true });
        }

        await channel.permissionOverwrites.edit(everyone, { Connect: false });
        return interaction.reply({ content: '🔒 Room locked.', ephemeral: true });
      }

      if (interaction.customId === 'waiting') {
        await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { Connect: false });
        return interaction.reply({ content: '⏳ Waiting room enabled.', ephemeral: true });
      }

      if (interaction.customId === 'chat') {
        return interaction.reply({ content: '💬 Room chat is controlled by Discord permissions.', ephemeral: true });
      }

      if (interaction.customId === 'delete') {
        tempRooms.delete(channel.id);
        await interaction.reply({ content: '🗑️ Deleting room...', ephemeral: true });
        await channel.delete().catch(() => {});
        return;
      }

      // USER SELECT DROPDOWNS
      if (interaction.customId === 'invite') {
        return interaction.reply({
          content: 'Select a user to send a direct DM invite to:',
          components: [createUserSelectRow('select_invite', 'Choose user to invite...')],
          ephemeral: true
        });
      }

      if (interaction.customId === 'trust') {
        return interaction.reply({
          content: 'Select a user to trust:',
          components: [createUserSelectRow('select_trust', 'Choose user to trust...')],
          ephemeral: true
        });
      }

      if (interaction.customId === 'untrust') {
        return interaction.reply({
          content: 'Select a user to untrust:',
          components: [createUserSelectRow('select_untrust', 'Choose user to untrust...')],
          ephemeral: true
        });
      }

      if (interaction.customId === 'kick') {
        return interaction.reply({
          content: 'Select a user to kick from voice:',
          components: [createUserSelectRow('select_kick', 'Choose user to kick...')],
          ephemeral: true
        });
      }

      if (interaction.customId === 'block') {
        return interaction.reply({
          content: 'Select a user to block:',
          components: [createUserSelectRow('select_block', 'Choose user to block...')],
          ephemeral: true
        });
      }

      if (interaction.customId === 'unblock') {
        return interaction.reply({
          content: 'Select a user to unblock:',
          components: [createUserSelectRow('select_unblock', 'Choose user to unblock...')],
          ephemeral: true
        });
      }

      if (interaction.customId === 'transfer') {
        return interaction.reply({
          content: 'Select a new owner for this room:',
          components: [createUserSelectRow('select_transfer', 'Choose new owner...')],
          ephemeral: true
        });
      }
    }

    /* =================================================
       USER SELECT DROPDOWN HANDLERS
    ================================================= */

    if (interaction.isUserSelectMenu()) {
      if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: 'Only the room owner can perform this action.', ephemeral: true });
      }

      const targetId = interaction.values[0];
      const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);

      if (!targetMember) {
        return interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });
      }

      // DM INVITE
      if (interaction.customId === 'select_invite') {
        const invite = await channel.createInvite({ maxAge: 3600, maxUses: 1 });
        
        try {
          await targetMember.send(`📨 You have been invited to join **${channel.name}** by <@${interaction.user.id}>!\nJoin here: ${invite.url}`);
          return interaction.update({ content: `✅ DM Invite sent directly to <@${targetMember.id}>!`, components: [] });
        } catch (err) {
          return interaction.update({ content: `⚠️ Could not DM <@${targetMember.id}> (their DMs may be disabled). Direct Link: ${invite.url}`, components: [] });
        }
      }

      // TRUST
      if (interaction.customId === 'select_trust') {
        await channel.permissionOverwrites.edit(targetMember.id, { ViewChannel: true, Connect: true, Speak: true });
        return interaction.update({ content: `🟢 <@${targetMember.id}> is now trusted in this room.`, components: [] });
      }

      // UNTRUST
      if (interaction.customId === 'select_untrust') {
        if (targetMember.id === ownerId) return interaction.update({ content: '❌ You cannot untrust the room owner.', components: [] });
        await channel.permissionOverwrites.delete(targetMember.id).catch(() => {});
        return interaction.update({ content: `🔴 <@${targetMember.id}> is no longer trusted.`, components: [] });
      }

      // KICK
      if (interaction.customId === 'select_kick') {
        if (targetMember.id === ownerId) return interaction.update({ content: '❌ You cannot kick the room owner.', components: [] });
        if (targetMember.voice.channelId !== channel.id) return interaction.update({ content: '❌ That user is not inside this voice room.', components: [] });

        await targetMember.voice.disconnect();
        return interaction.update({ content: `📵 <@${targetMember.id}> was kicked from the channel.`, components: [] });
      }

      // BLOCK
      if (interaction.customId === 'select_block') {
        if (targetMember.id === ownerId) return interaction.update({ content: '❌ You cannot block the room owner.', components: [] });
        await channel.permissionOverwrites.edit(targetMember.id, { ViewChannel: false, Connect: false });

        if (targetMember.voice.channelId === channel.id) {
          await targetMember.voice.disconnect().catch(() => {});
        }
        return interaction.update({ content: `🚫 <@${targetMember.id}> has been blocked from joining.`, components: [] });
      }

      // UNBLOCK
      if (interaction.customId === 'select_unblock') {
        await channel.permissionOverwrites.delete(targetMember.id).catch(() => {});
        return interaction.update({ content: `🔓 <@${targetMember.id}> has been unblocked.`, components: [] });
      }

      // TRANSFER
      if (interaction.customId === 'select_transfer') {
        if (targetMember.id === ownerId) return interaction.update({ content: '❌ That user is already the room owner.', components: [] });
        if (targetMember.voice.channelId !== channel.id) return interaction.update({ content: '❌ The new owner must be inside this voice room.', components: [] });

        await channel.permissionOverwrites.delete(ownerId).catch(() => {});
        await channel.permissionOverwrites.edit(targetMember.id, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
          ManageChannels: true
        });

        tempRooms.set(channel.id, targetMember.id);
        return interaction.update({ content: `🔄 Room ownership transferred to <@${targetMember.id}>.`, components: [] });
      }
    }

    /* =================================================
       MODAL SUBMIT HANDLERS
    ================================================= */

    if (interaction.isModalSubmit()) {
      if (interaction.user.id !== ownerId) return interaction.reply({ content: 'Only the room owner can use this.', ephemeral: true });

      if (interaction.customId === 'rename_modal') {
        const name = interaction.fields.getTextInputValue('name').trim();
        if (!name) return interaction.reply({ content: 'Enter a valid name.', ephemeral: true });
        await channel.setName(`${name}${MARKER}`);
        return interaction.reply({ content: `✏️ Room renamed to **${name}**.`, ephemeral: true });
      }

      if (interaction.customId === 'limit_modal') {
        const value = Number(interaction.fields.getTextInputValue('limit').trim());
        if (!Number.isInteger(value) || value < 0 || value > 99) {
          return interaction.reply({ content: 'Enter a number from 0 to 99.', ephemeral: true });
        }
        await channel.setUserLimit(value);
        return interaction.reply({
          content: value === 0 ? '👥 User limit removed.' : `👥 User limit set to **${value}**.`,
          ephemeral: true
        });
      }

      if (interaction.customId === 'region_modal') {
        const region = interaction.fields.getTextInputValue('region').trim().toLowerCase();
        if (region === 'auto') {
          await channel.setRTCRegion(null);
          return interaction.reply({ content: '🌐 Region set to automatic.', ephemeral: true });
        }
        await channel.setRTCRegion(region);
        return interaction.reply({ content: `🌐 Voice region set to **${region}**.`, ephemeral: true });
      }
    }
  } catch (error) {
    console.error('INTERACTION ERROR:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Something went wrong processing this interaction.', ephemeral: true }).catch(() => {});
    }
  }
});

/* =====================================================
   LOGIN
===================================================== */

if (!process.env.TOKEN || !CREATE_CHANNEL_ID) {
  console.error('ERROR: Missing TOKEN or CREATE_CHANNEL_ID environment variables.');
} else {
  client.login(process.env.TOKEN).catch(error => console.error('LOGIN ERROR:', error));
}
