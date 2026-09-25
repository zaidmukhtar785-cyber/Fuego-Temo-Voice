require('dotenv').config();
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
   RAILWAY VARIABLES
===================================================== */
const TOKEN = process.env.TOKEN;
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
    channel.name.endsWith(MARKER)
  );
}

function getDisplayName(channel) {
  return channel.name.replace(MARKER, '');
}

function getOwnerId(channel) {
  if (!isTempRoom(channel)) return null;

  const overwrite = channel.permissionOverwrites.cache.find(
    o => o.type === 1 && o.allow.has(PermissionsBitField.Flags.ManageChannels)
  );

  return overwrite ? overwrite.id : null;
}

/* =====================================================
   EMBED & INTERFACE
===================================================== */
function buildPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x2b8cff)
    .setTitle('🎧 TempVoice Interface')
    .setDescription(
      'This interface can be used to manage temporary voice channels.\n' +
      'Press the buttons below to use the interface.'
    )
    .addFields({
      name: '\u200B',
      value:
        '✏️ **NAME**　 👥 **LIMIT**　 🔒 **PRIVACY**　 ⏳ **WAITING ROOM**　 💬 **CHAT**\n\n' +
        '🟢 **TRUST**　 🔴 **UNTRUST**　 🔗 **INVITE**　 📵 **KICK**　 🌐 **REGION**\n\n' +
        '🚫 **BLOCK**　 🔓 **UNBLOCK**　 👑 **CLAIM**　 🔄 **TRANSFER**　 🗑️ **DELETE**',
      inline: false
    })
    .setFooter({
      text: 'Fuegos TempVoice • Manage your voice room easily.'
    });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rename').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('limit').setEmoji('👥').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('privacy').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('waiting').setEmoji('⏳').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('chat').setEmoji('💬').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('trust').setEmoji('🟢').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('untrust').setEmoji('🔴').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('invite').setEmoji('🔗').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('kick').setEmoji('📵').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('region').setEmoji('🌐').setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('block').setEmoji('🚫').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('unblock').setEmoji('🔓').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('claim').setEmoji('👑').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('transfer').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );

  return {
    embeds: [embed],
    components: [row1, row2, row3]
  };
}

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
   VOICE STATE (AUTO CREATE & DELETE)
===================================================== */
client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    // 1. User Joined the "Join to Create" channel
    if (newState.channelId === CREATE_CHANNEL_ID && oldState.channelId !== CREATE_CHANNEL_ID) {
      const createChannel = newState.channel;
      const guild = newState.guild;
      const member = newState.member;

      if (!createChannel || !member) return;

      const parentId = createChannel.parentId;

      console.log(`CREATE ROOM detected: ${createChannel.name}`);

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

      tempRooms.set(room.id, member.id);

      await member.voice.setChannel(room);
      await room.send(buildPanel());

      console.log(`TEMP VC CREATED: ${getDisplayName(room)}`);
    }

    // 2. User Left - Delete if room is empty
    if (oldState.channel && oldState.channel.id !== CREATE_CHANNEL_ID && isTempRoom(oldState.channel)) {
      const leftChannel = oldState.channel;

      if (leftChannel.members.size === 0) {
        tempRooms.delete(leftChannel.id);

        await leftChannel.delete()
          .then(() => console.log(`DELETED EMPTY TEMP VC: ${getDisplayName(leftChannel)}`))
          .catch(error => console.error('FAILED TO DELETE TEMP VC:', error));
      }
    }
  } catch (error) {
    console.error('VOICE STATE ERROR:', error);
  }
});

/* =====================================================
   INTERACTIONS & BUTTONS
===================================================== */
client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isButton()) {
      const channel = interaction.channel;

      if (!isTempRoom(channel)) {
        return interaction.reply({
          content: 'This temporary room is no longer active.',
          ephemeral: true
        });
      }

      const ownerId = tempRooms.get(channel.id) || getOwnerId(channel);

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

        if (ownerId) await channel.permissionOverwrites.delete(ownerId).catch(() => {});

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

      if (interaction.user.id !== ownerId) {
        return interaction.reply({
          content: 'Only the current room owner can use this control.',
          ephemeral: true
        });
      }

      switch (interaction.customId) {
        case 'rename': {
          const modal = new ModalBuilder().setCustomId('rename_modal').setTitle('Rename Room');
          const input = new TextInputBuilder()
            .setCustomId('name').setLabel('New room name').setPlaceholder('My Room')
            .setStyle(TextInputStyle.Short).setMaxLength(80).setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          return interaction.showModal(modal);
        }
        case 'limit': {
          const modal = new ModalBuilder().setCustomId('limit_modal').setTitle('User Limit');
          const input = new TextInputBuilder()
            .setCustomId('limit').setLabel('0 = Unlimited | 1-99').setPlaceholder('5')
            .setStyle(TextInputStyle.Short).setMaxLength(2).setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          return interaction.showModal(modal);
        }
        case 'privacy': {
          const everyone = channel.guild.roles.everyone;
          const overwrite = channel.permissionOverwrites.cache.get(everyone.id);
          const locked = overwrite && overwrite.deny.has(PermissionsBitField.Flags.Connect);

          if (locked) {
            await channel.permissionOverwrites.edit(everyone, { Connect: true });
            return interaction.reply({ content: '🔓 Room unlocked.', ephemeral: true });
          }

          await channel.permissionOverwrites.edit(everyone, { Connect: false });
          await channel.permissionOverwrites.edit(ownerId, {
            ViewChannel: true, Connect: true, Speak: true, ManageChannels: true
          });
          return interaction.reply({ content: '🔒 Room locked.', ephemeral: true });
        }
        case 'waiting': {
          await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { Connect: false });
          await channel.permissionOverwrites.edit(ownerId, {
            ViewChannel: true, Connect: true, Speak: true, ManageChannels: true
          });
          return interaction.reply({ content: '⏳ Waiting room enabled.', ephemeral: true });
        }
        case 'chat': {
          return interaction.reply({ content: '💬 Room chat is controlled by Discord channel permissions.', ephemeral: true });
        }
        case 'invite': {
          const invite = await channel.createInvite({ maxAge: 3600, maxUses: 0 });
          return interaction.reply({ content: `🔗 **Room Invite**\n\n${invite.url}`, ephemeral: true });
        }
        case 'trust':
          return interaction.showModal(createUserModal('trust_modal', 'Trust Member'));
        case 'untrust':
          return interaction.showModal(createUserModal('untrust_modal', 'Untrust Member'));
        case 'kick':
          return interaction.showModal(createUserModal('kick_modal', 'Kick Member'));
        case 'region': {
          const modal = new ModalBuilder().setCustomId('region_modal').setTitle('Voice Region');
          const input = new TextInputBuilder()
            .setCustomId('region').setLabel('Region').setPlaceholder('auto / singapore / japan / us-east')
            .setStyle(TextInputStyle.Short).setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          return interaction.showModal(modal);
        }
        case 'block':
          return interaction.showModal(createUserModal('block_modal', 'Block Member'));
        case 'unblock':
          return interaction.showModal(createUserModal('unblock_modal', 'Unblock Member'));
        case 'transfer':
          return interaction.showModal(createUserModal('transfer_modal', 'Transfer Ownership'));
        case 'delete': {
          tempRooms.delete(channel.id);
          await interaction.reply({ content: '🗑️ Deleting room...', ephemeral: true });
          await channel.delete().catch(() => {});
          return;
        }
      }
    }

    if (interaction.isModalSubmit()) {
      const channel = interaction.channel;

      if (!isTempRoom(channel)) {
        return interaction.reply({ content: 'This room is no longer active.', ephemeral: true });
      }

      const ownerId = tempRooms.get(channel.id) || getOwnerId(channel);

      if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: 'Only the room owner can use this.', ephemeral: true });
      }

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

      const userId = interaction.fields.getTextInputValue('user_id').trim();
      const member = await interaction.guild.members.fetch(userId).catch(() => null);

      if (!member) {
        return interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });
      }

      switch (interaction.customId) {
        case 'trust_modal': {
          await channel.permissionOverwrites.edit(member.id, { ViewChannel: true, Connect: true, Speak: true });
          return interaction.reply({ content: `🟢 <@${member.id}> is now trusted.`, ephemeral: true });
        }
        case 'untrust_modal': {
          if (member.id === ownerId) return interaction.reply({ content: '❌ You cannot untrust the owner.', ephemeral: true });
          await channel.permissionOverwrites.delete(member.id).catch(() => {});
          return interaction.reply({ content: `🔴 <@${member.id}> is no longer trusted.`, ephemeral: true });
        }
        case 'block_modal': {
          if (member.id === ownerId) return interaction.reply({ content: '❌ You cannot block the owner.', ephemeral: true });
          await channel.permissionOverwrites.edit(member.id, { ViewChannel: false, Connect: false });
          return interaction.reply({ content: `🚫 <@${member.id}> has been blocked.`, ephemeral: true });
        }
        case 'unblock_modal': {
          await channel.permissionOverwrites.delete(member.id).catch(() => {});
          return interaction.reply({ content: `🔓 <@${member.id}> has been unblocked.`, ephemeral: true });
        }
        case 'kick_modal': {
          if (member.id === ownerId) return interaction.reply({ content: '❌ You cannot kick the room owner.', ephemeral: true });
          if (member.voice.channelId !== channel.id) {
            return interaction.reply({ content: '❌ That user is not inside this room.', ephemeral: true });
          }
          await member.voice.disconnect();
          return interaction.reply({ content: `📵 <@${member.id}> was kicked.`, ephemeral: true });
        }
        case 'transfer_modal': {
          if (member.voice.channelId !== channel.id) {
            return interaction.reply({ content: '❌ The new owner must be inside this room.', ephemeral: true });
          }
          if (member.id === ownerId) {
            return interaction.reply({ content: '❌ That user is already the owner.', ephemeral: true });
          }
          await channel.permissionOverwrites.delete(ownerId).catch(() => {});
          await channel.permissionOverwrites.edit(member.id, {
            ViewChannel: true, Connect: true, Speak: true, ManageChannels: true
          });
          tempRooms.set(channel.id, member.id);
          return interaction.reply({ content: `🔄 Ownership transferred to <@${member.id}>.`, ephemeral: true });
        }
      }
    }
  } catch (error) {
    console.error('INTERACTION ERROR:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Something went wrong.', ephemeral: true }).catch(() => {});
    }
  }
});

/* =====================================================
   LOGIN
===================================================== */
if (!TOKEN) {
  console.error('ERROR: TOKEN is missing from Railway Variables.');
} else if (!CREATE_CHANNEL_ID) {
  console.error('ERROR: CREATE_CHANNEL_ID is missing from Railway Variables.');
} else {
  client.login(TOKEN).catch(error => {
    console.error('DISCORD LOGIN ERROR:', error);
  });
}
