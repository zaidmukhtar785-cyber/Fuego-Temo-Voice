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
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

/* ================= CONFIG ================= */

const CREATE_CHANNEL_ID = '1548623536627650591';
const TEMP_CATEGORY_ID = '1548705352084758700';

// Invisible marker used internally to identify temporary rooms.
// It does NOT visibly appear in the channel name.
const TEMP_MARKER = '\u200B';

const rooms = new Map();

/* ================= HELPERS ================= */

function isTempRoom(channel) {
  return Boolean(
    channel &&
    channel.type === ChannelType.GuildVoice &&
    channel.id !== CREATE_CHANNEL_ID &&
    channel.parentId === TEMP_CATEGORY_ID &&
    channel.name.endsWith(TEMP_MARKER)
  );
}

function cleanRoomName(name) {
  return name.replace(TEMP_MARKER, '');
}

function getOwnerId(channel) {
  if (!isTempRoom(channel)) return null;

  const owner = channel.permissionOverwrites.cache.find(
    overwrite =>
      overwrite.type === 1 &&
      overwrite.allow.has(PermissionsBitField.Flags.ManageChannels)
  );

  return owner ? owner.id : null;
}

async function deleteIfEmpty(channel) {
  if (!isTempRoom(channel)) return;
  if (channel.members.size > 0) return;

  rooms.delete(channel.id);

  await channel.delete().catch(() => {});

  console.log(`Deleted empty room: ${cleanRoomName(channel.name)}`);
}

/* ================= PANEL ================= */

function buildPanel(channel, ownerId) {
  const embed = new EmbedBuilder()
    .setTitle('FUEGOS • TEMP VOICE')
    .setDescription(
      `**${cleanRoomName(channel.name)}**\n\n` +
      `👑 **Owner:** <@${ownerId}>\n` +
      `👥 **Members:** ${channel.members.size}\n\n` +
      `Use the controls below to manage your temporary voice room.`
    )
    .addFields(
      {
        name: 'ROOM',
        value:
          '✏️ Rename  •  👥 Limit  •  🔗 Invite\n' +
          '🔒 Lock  •  👁️ Hide',
        inline: false
      },
      {
        name: 'MEMBERS',
        value:
          '🟢 Trust  •  🔴 Untrust  •  ❌ Kick\n' +
          '👑 Transfer  •  ♛ Claim',
        inline: false
      }
    )
    .setFooter({
      text: 'Fuegos • Temporary Voice System'
    })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rename')
      .setLabel('Name')
      .setEmoji('✏️')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('limit')
      .setLabel('Limit')
      .setEmoji('👥')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('lock')
      .setLabel('Lock')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('hide')
      .setLabel('Hide')
      .setEmoji('👁️')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('invite')
      .setLabel('Invite')
      .setEmoji('🔗')
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('trust')
      .setLabel('Trust')
      .setEmoji('🟢')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId('untrust')
      .setLabel('Untrust')
      .setEmoji('🔴')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('kick')
      .setLabel('Kick')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId('transfer')
      .setLabel('Transfer')
      .setEmoji('👑')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('claim')
      .setLabel('Claim')
      .setEmoji('♛')
      .setStyle(ButtonStyle.Success)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('block')
      .setLabel('Block')
      .setEmoji('🚫')
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId('unblock')
      .setLabel('Unblock')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('unlock')
      .setLabel('Unlock')
      .setEmoji('🔓')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('show')
      .setLabel('Show')
      .setEmoji('👀')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('delete')
      .setLabel('Delete')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger)
  );

  return {
    embeds: [embed],
    components: [row1, row2, row3]
  };
}

/* ================= MODAL HELPER ================= */

function userModal(customId, title, label) {
  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title);

  const input = new TextInputBuilder()
    .setCustomId('user_id')
    .setLabel(label)
    .setPlaceholder('Enter Discord User ID')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(25)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(input)
  );

  return modal;
}

/* ================= BOT READY ================= */

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.user.setActivity('Fuegos Music', {
    type: ActivityType.Playing
  });

  console.log('Status: Playing Fuegos Music');

  // Recover existing temporary rooms after restart
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

  console.log(`Recovered ${rooms.size} temporary room(s).`);
  console.log('Fuegos Temporary Voice Bot is ONLINE');
});

/* ================= CREATE ROOM ================= */

client.on('voiceStateUpdate', async (oldState, newState) => {
  try {

    // User joined CREATE ROOM
    if (
      newState.channelId === CREATE_CHANNEL_ID &&
      oldState.channelId !== CREATE_CHANNEL_ID
    ) {
      const guild = newState.guild;
      const member = newState.member;

      // ALWAYS use your exact category
      const room = await guild.channels.create({
        name: `${member.user.username}'s Room${TEMP_MARKER}`,
        type: ChannelType.GuildVoice,
        parent: TEMP_CATEGORY_ID,

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

      rooms.set(room.id, member.id);

      await member.voice.setChannel(room);

      await room.send(
        buildPanel(room, member.id)
      );

      console.log(
        `Created room ${cleanRoomName(room.name)} in category ${TEMP_CATEGORY_ID}`
      );
    }

    // Delete old temporary room when empty
    if (oldState.channel) {
      await deleteIfEmpty(oldState.channel);
    }

  } catch (error) {
    console.error('VOICE ERROR:', error);
  }
});

/* ================= BUTTONS ================= */

client.on('interactionCreate', async interaction => {
  try {

    /* ---------- BUTTON ---------- */

    if (interaction.isButton()) {

      const channel = interaction.channel;

      if (!isTempRoom(channel)) {
        return interaction.reply({
          content: 'This room is no longer active.',
          ephemeral: true
        });
      }

      const ownerId =
        rooms.get(channel.id) ||
        getOwnerId(channel);

      /* ---------- CLAIM ---------- */

      if (interaction.customId === 'claim') {

        const currentOwner =
          ownerId
            ? channel.guild.members.cache.get(ownerId)
            : null;

        if (
          currentOwner &&
          currentOwner.voice.channelId === channel.id
        ) {
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
          await channel.permissionOverwrites
            .delete(ownerId)
            .catch(() => {});
        }

        await channel.permissionOverwrites.edit(
          interaction.user.id,
          {
            ViewChannel: true,
            Connect: true,
            Speak: true,
            ManageChannels: true
          }
        );

        rooms.set(
          channel.id,
          interaction.user.id
        );

        return interaction.reply({
          content: '♛ You are now the room owner.',
          ephemeral: true
        });
      }

      /* ---------- OWNER CHECK ---------- */

      if (interaction.user.id !== ownerId) {
        return interaction.reply({
          content: 'Only the current room owner can use this control.',
          ephemeral: true
        });
      }

      /* ---------- RENAME ---------- */

      if (interaction.customId === 'rename') {

        const modal = new ModalBuilder()
          .setCustomId('rename_modal')
          .setTitle('Rename Room');

        const input = new TextInputBuilder()
          .setCustomId('room_name')
          .setLabel('New room name')
          .setPlaceholder('Enter a new name')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(80)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(input)
        );

        return interaction.showModal(modal);
      }

      /* ---------- LIMIT ---------- */

      if (interaction.customId === 'limit') {

        const modal = new ModalBuilder()
          .setCustomId('limit_modal')
          .setTitle('User Limit');

        const input = new TextInputBuilder()
          .setCustomId('user_limit')
          .setLabel('0 = Unlimited | 1-99 = Limit')
          .setPlaceholder('5')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(2)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(input)
        );

        return interaction.showModal(modal);
      }

      /* ---------- INVITE ---------- */

      if (interaction.customId === 'invite') {

        const invite = await channel.createInvite({
          maxAge: 3600,
          maxUses: 0
        });

        return interaction.reply({
          content:
            `🔗 **Room Invite**\n\n${invite.url}\n\nExpires in **1 hour**.`,
          ephemeral: true
        });
      }

      /* ---------- LOCK ---------- */

      if (interaction.customId === 'lock') {

        await channel.permissionOverwrites.edit(
          channel.guild.roles.everyone,
          {
            Connect: false
          }
        );

        return interaction.reply({
          content: '🔒 Room locked.',
          ephemeral: true
        });
      }

      /* ---------- UNLOCK ---------- */

      if (interaction.customId === 'unlock') {

        await channel.permissionOverwrites.edit(
          channel.guild.roles.everyone,
          {
            Connect: true
          }
        );

        return interaction.reply({
          content: '🔓 Room unlocked.',
          ephemeral: true
        });
      }

      /* ---------- HIDE ---------- */

      if (interaction.customId === 'hide') {

        await channel.permissionOverwrites.edit(
          channel.guild.roles.everyone,
          {
            ViewChannel: false
          }
        );

        await channel.permissionOverwrites.edit(
          ownerId,
          {
            ViewChannel: true,
            Connect: true,
            Speak: true,
            ManageChannels: true
          }
        );

        return interaction.reply({
          content: '👁️ Room hidden.',
          ephemeral: true
        });
      }

      /* ---------- SHOW ---------- */

      if (interaction.customId === 'show') {

        await channel.permissionOverwrites.edit(
          channel.guild.roles.everyone,
          {
            ViewChannel: true
          }
        );

        return interaction.reply({
          content: '👀 Room visible.',
          ephemeral: true
        });
      }

      /* ---------- TRUST ---------- */

      if (interaction.customId === 'trust') {
        return interaction.showModal(
          userModal(
            'trust_modal',
            'Trust Member',
            'Discord User ID'
          )
        );
      }

      /* ---------- UNTRUST ---------- */

      if (interaction.customId === 'untrust') {
        return interaction.showModal(
          userModal(
            'untrust_modal',
            'Untrust Member',
            'Discord User ID'
          )
        );
      }

      /* ---------- BLOCK ---------- */

      if (interaction.customId === 'block') {
        return interaction.showModal(
          userModal(
            'block_modal',
            'Block Member',
            'Discord User ID'
          )
        );
      }

      /* ---------- UNBLOCK ---------- */

      if (interaction.customId === 'unblock') {
        return interaction.showModal(
          userModal(
            'unblock_modal',
            'Unblock Member',
            'Discord User ID'
          )
        );
      }

      /* ---------- KICK ---------- */

      if (interaction.customId === 'kick') {
        return interaction.showModal(
          userModal(
            'kick_modal',
            'Kick Member',
            'Discord User ID'
          )
        );
      }

      /* ---------- TRANSFER ---------- */

      if (interaction.customId === 'transfer') {
        return interaction.showModal(
          userModal(
            'transfer_modal',
            'Transfer Ownership',
            'New Owner User ID'
          )
        );
      }

      /* ---------- DELETE ---------- */

      if (interaction.customId === 'delete') {

        rooms.delete(channel.id);

        await interaction.reply({
          content: '🗑️ Deleting room...',
          ephemeral: true
        });

        await channel.delete().catch(() => {});

        return;
      }
    }

    /* ================= MODALS ================= */

    if (interaction.isModalSubmit()) {

      const channel = interaction.channel;

      if (!isTempRoom(channel)) {
        return interaction.reply({
          content: 'This room is no longer active.',
          ephemeral: true
        });
      }

      const ownerId =
        rooms.get(channel.id) ||
        getOwnerId(channel);

      if (interaction.user.id !== ownerId) {
        return interaction.reply({
          content: 'Only the room owner can use this.',
          ephemeral: true
        });
      }

      /* ---------- RENAME ---------- */

      if (interaction.customId === 'rename_modal') {

        const name =
          interaction.fields
            .getTextInputValue('room_name')
            .trim();

        if (!name) {
          return interaction.reply({
            content: 'Enter a valid name.',
            ephemeral: true
          });
        }

        await channel.setName(
          `${name}'s Room${TEMP_MARKER}`
        );

        return interaction.reply({
          content:
            `✏️ Room renamed to **${name}'s Room**.`,
          ephemeral: true
        });
      }

      /* ---------- LIMIT ---------- */

      if (interaction.customId === 'limit_modal') {

        const value = Number(
          interaction.fields
            .getTextInputValue('user_limit')
            .trim()
        );

        if (
          !Number.isInteger(value) ||
          value < 0 ||
          value > 99
        ) {
          return interaction.reply({
            content: 'Enter a number from 0 to 99.',
            ephemeral: true
          });
        }

        await channel.setUserLimit(value);

        return interaction.reply({
          content:
            value === 0
              ? '👥 User limit removed.'
              : `👥 User limit set to **${value}**.`,
          ephemeral: true
        });
      }

      /* ---------- GET USER ---------- */

      const userId =
        interaction.fields
          .getTextInputValue('user_id')
          .trim();

      const member =
        await interaction.guild.members
          .fetch(userId)
          .catch(() => null);

      if (!member) {
        return interaction.reply({
          content: '❌ User not found in this server.',
          ephemeral: true
        });
      }

      /* ---------- TRUST ---------- */

      if (interaction.customId === 'trust_modal') {

        await channel.permissionOverwrites.edit(
          member.id,
          {
            ViewChannel: true,
            Connect: true,
            Speak: true
          }
        );

        return interaction.reply({
          content: `🟢 <@${member.id}> is now trusted.`,
          ephemeral: true
        });
      }

      /* ---------- UNTRUST ---------- */

      if (interaction.customId === 'untrust_modal') {

        await channel.permissionOverwrites
          .delete(member.id)
          .catch(() => {});

        return interaction.reply({
          content: `🔴 <@${member.id}> is no longer trusted.`,
          ephemeral: true
        });
      }

      /* ---------- BLOCK ---------- */

      if (interaction.customId === 'block_modal') {

        await channel.permissionOverwrites.edit(
          member.id,
          {
            ViewChannel: false,
            Connect: false
          }
        );

        return interaction.reply({
          content: `🚫 <@${member.id}> has been blocked.`,
          ephemeral: true
        });
      }

      /* ---------- UNBLOCK ---------- */

      if (interaction.customId === 'unblock_modal') {

        await channel.permissionOverwrites
          .delete(member.id)
          .catch(() => {});

        return interaction.reply({
          content: `✅ <@${member.id}> has been unblocked.`,
          ephemeral: true
        });
      }

      /* ---------- KICK ---------- */

      if (interaction.customId === 'kick_modal') {

        if (
          !member.voice.channelId ||
          member.voice.channelId !== channel.id
        ) {
          return interaction.reply({
            content: '❌ That user is not in your room.',
            ephemeral: true
          });
        }

        if (member.id === ownerId) {
          return interaction.reply({
            content: '❌ You cannot kick yourself as owner.',
            ephemeral: true
          });
        }

        await member.voice.disconnect(
          'Kicked by temporary room owner'
        );

        return interaction.reply({
          content: `❌ <@${member.id}> was kicked.`,
          ephemeral: true
        });
      }

      /* ---------- TRANSFER ---------- */

      if (interaction.customId === 'transfer_modal') {

        if (
          !member.voice.channelId ||
          member.voice.channelId !== channel.id
        ) {
          return interaction.reply({
            content: '❌ The new owner must be inside your room.',
            ephemeral: true
          });
        }

        if (member.id === ownerId) {
          return interaction.reply({
            content: '❌ You are already the owner.',
            ephemeral: true
          });
        }

        await channel.permissionOverwrites
          .delete(ownerId)
          .catch(() => {});

        await channel.permissionOverwrites.edit(
          member.id,
          {
            ViewChannel: true,
            Connect: true,
            Speak: true,
            ManageChannels: true
          }
        );

        rooms.set(
          channel.id,
          member.id
        );

        return interaction.reply({
          content:
            `👑 Ownership transferred to <@${member.id}>.`,
          ephemeral: true
        });
      }
    }

  } catch (error) {

    console.error('INTERACTION ERROR:', error);

    if (
      !interaction.replied &&
      !interaction.deferred
    ) {
      await interaction.reply({
        content:
          'Something went wrong. Check Railway logs.',
        ephemeral: true
      }).catch(() => {});
    }
  }
});

/* ================= LOGIN ================= */

client.login(process.env.TOKEN).catch(error => {
  console.error('DISCORD LOGIN ERROR:', error);
});
