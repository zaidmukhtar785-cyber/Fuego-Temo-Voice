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
  UserSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActivityType,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

/* =====================================================
   CLIENT
===================================================== */

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
   TEMP ROOMS
===================================================== */

const tempRooms = new Map();

const CLEANUP_INTERVAL = 3000;

function log(message) {
  console.log(`[TEMPVOICE] ${message}`);
}

/* =====================================================
   SLASH COMMANDS
===================================================== */

const commands = [
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Member to kick')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for the kick')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Member to ban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(false)
    )
].map(command => command.toJSON());

/* =====================================================
   TEMPVOICE PANEL
===================================================== */

function buildPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x2b8cff)
    .setTitle('🎧 FUEGOS TEMPVOICE')
    .setDescription(
      '**Your temporary voice room is ready.**\n' +
      'Use the controls below to manage your room.'
    )
    .addFields(
      {
        name: '━━━━━━━━ ROOM SETTINGS ━━━━━━━━',
        value:
          '✏️ **Rename** — Change your room name\n' +
          '👥 **Limit** — Set maximum users\n' +
          '👁️ **Visibility** — Show / hide your room\n' +
          '🔒 **Privacy** — Lock / unlock your room\n' +
          '⏳ **Waiting Room** — Control room entry',
        inline: false
      },
      {
        name: '━━━━━━━━ MEMBER MANAGEMENT ━━━━━━━━',
        value:
          '🟢 **Trust** — Allow a member to join\n' +
          '🔴 **Untrust** — Remove trusted access\n' +
          '📵 **Kick** — Remove someone from your room\n' +
          '🚫 **Block** — Prevent someone from joining\n' +
          '🔓 **Unblock** — Remove a block',
        inline: false
      },
      {
        name: '━━━━━━━━ OWNER CONTROLS ━━━━━━━━',
        value:
          '👑 **Claim** — Claim an available room\n' +
          '🔄 **Transfer** — Transfer ownership\n' +
          '🔗 **Invite** — Create a room invite\n' +
          '🌐 **Region** — Change voice region\n' +
          '🗑️ **Delete** — Delete your room',
        inline: false
      }
    )
    .setFooter({
      text: 'Fuegos TempVoice • Only the room owner can manage these controls.'
    });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rename')
      .setEmoji('✏️')
      .setLabel('Rename')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('limit')
      .setEmoji('👥')
      .setLabel('Limit')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('visibility')
      .setEmoji('👁️')
      .setLabel('Visibility')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('privacy')
      .setEmoji('🔒')
      .setLabel('Privacy')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('waiting')
      .setEmoji('⏳')
      .setLabel('Waiting')
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('trust')
      .setEmoji('🟢')
      .setLabel('Trust')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('untrust')
      .setEmoji('🔴')
      .setLabel('Untrust')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('kick')
      .setEmoji('📵')
      .setLabel('Kick')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('block')
      .setEmoji('🚫')
      .setLabel('Block')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('unblock')
      .setEmoji('🔓')
      .setLabel('Unblock')
      .setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('claim')
      .setEmoji('👑')
      .setLabel('Claim')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('transfer')
      .setEmoji('🔄')
      .setLabel('Transfer')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('invite')
      .setEmoji('🔗')
      .setLabel('Invite')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('region')
      .setEmoji('🌐')
      .setLabel('Region')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('delete')
      .setEmoji('🗑️')
      .setLabel('Delete')
      .setStyle(ButtonStyle.Danger)
  );

  return {
    embeds: [embed],
    components: [row1, row2, row3]
  };
}

/* =====================================================
   CREATE TEMP ROOM
===================================================== */

async function createTempRoom(member, createChannel) {
  try {
    const guild = member.guild;

    const room = await guild.channels.create({
      name: `${member.user.username}'s Room`,
      type: ChannelType.GuildVoice,
      parent: createChannel.parentId || undefined,

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
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.MoveMembers,
            PermissionsBitField.Flags.MuteMembers,
            PermissionsBitField.Flags.DeafenMembers
          ]
        }
      ]
    });

    tempRooms.set(room.id, member.id);

    log(
      `CREATED: ${room.name} | ${room.id} | OWNER: ${member.user.tag}`
    );

    await member.voice.setChannel(room);

    await room.send(buildPanel());

    setTimeout(() => {
      checkAndDeleteRoom(room.id);
    }, 500);

    return room;
  } catch (error) {
    console.error('[TEMPVOICE] CREATE ERROR:', error);
    return null;
  }
}

/* =====================================================
   DELETE EMPTY ROOM
===================================================== */

async function checkAndDeleteRoom(channelId) {
  if (!tempRooms.has(channelId)) return;

  const channel = client.channels.cache.get(channelId);

  if (!channel) {
    tempRooms.delete(channelId);
    return;
  }

  if (channel.type !== ChannelType.GuildVoice) {
    tempRooms.delete(channelId);
    return;
  }

  if (channel.members.size > 0) return;

  tempRooms.delete(channelId);

  log(`DELETING EMPTY ROOM: ${channel.name} | ${channel.id}`);

  try {
    await channel.delete('Temporary voice channel became empty');
    log(`DELETED: ${channelId}`);
  } catch (error) {
    console.error(
      `[TEMPVOICE] DELETE ERROR ${channelId}:`,
      error
    );
  }
}

/* =====================================================
   BACKUP CLEANUP
===================================================== */

async function cleanupAllRooms() {
  const rooms = [...tempRooms.keys()];

  for (const channelId of rooms) {
    await checkAndDeleteRoom(channelId);
  }
}

/* =====================================================
   VOICE STATE
===================================================== */

client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    /* CREATE ROOM */

    if (
      newState.channelId === CREATE_CHANNEL_ID &&
      oldState.channelId !== CREATE_CHANNEL_ID
    ) {
      const member = newState.member;
      const createChannel = newState.channel;

      if (!member || !createChannel) return;

      log(`${member.user.tag} JOINED CREATE CHANNEL`);

      await createTempRoom(member, createChannel);
    }

    /* DELETE EMPTY ROOM */

    if (
      oldState.channelId &&
      tempRooms.has(oldState.channelId)
    ) {
      const channelId = oldState.channelId;

      log(`USER LEFT TEMP ROOM: ${channelId}`);

      await checkAndDeleteRoom(channelId);

      setTimeout(() => {
        checkAndDeleteRoom(channelId);
      }, 500);
    }
  } catch (error) {
    console.error(
      '[TEMPVOICE] VOICE STATE ERROR:',
      error
    );
  }
});

/* =====================================================
   INTERACTIONS
===================================================== */

client.on('interactionCreate', async interaction => {
  try {

    /* =================================================
       /KICK + /BAN
    ================================================= */

    if (interaction.isChatInputCommand()) {

      if (
        interaction.commandName !== 'kick' &&
        interaction.commandName !== 'ban'
      ) {
        return;
      }

      const isAdmin =
        interaction.member.permissions.has(
          PermissionsBitField.Flags.Administrator
        );

      const requiredPermission =
        interaction.commandName === 'ban'
          ? PermissionsBitField.Flags.BanMembers
          : PermissionsBitField.Flags.KickMembers;

      if (
        !isAdmin &&
        !interaction.member.permissions.has(requiredPermission)
      ) {
        return interaction.reply({
          content:
            '❌ You do not have permission to use this command.',
          ephemeral: true
        });
      }

      const user =
        interaction.options.getUser('user');

      const reason =
        interaction.options.getString('reason') ||
        'No reason provided';

      const member =
        await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

      if (!member) {
        return interaction.reply({
          content:
            '❌ That user is not in this server.',
          ephemeral: true
        });
      }

      /* Cannot target yourself */

      if (user.id === interaction.user.id) {
        return interaction.reply({
          content:
            '❌ You cannot use this command on yourself.',
          ephemeral: true
        });
      }

      /* Cannot target server owner */

      if (user.id === interaction.guild.ownerId) {
        return interaction.reply({
          content:
            '❌ The server owner cannot be moderated.',
          ephemeral: true
        });
      }

      const botMember =
        interaction.guild.members.me;

      if (!botMember) {
        return interaction.reply({
          content:
            '❌ I cannot find my bot member.',
          ephemeral: true
        });
      }

      /* Bot role must be higher */

      if (
        member.roles.highest.position >=
        botMember.roles.highest.position
      ) {
        return interaction.reply({
          content:
            '❌ My bot role must be higher than the target member role.',
          ephemeral: true
        });
      }

      /* Moderator role hierarchy */

      if (
        !isAdmin &&
        member.roles.highest.position >=
        interaction.member.roles.highest.position
      ) {
        return interaction.reply({
          content:
            '❌ You cannot moderate a member with an equal or higher role.',
          ephemeral: true
        });
      }

      /* ===============================
         KICK
      =============================== */

      if (interaction.commandName === 'kick') {
        try {
          await member.kick(
            `${reason} | Moderator: ${interaction.user.tag}`
          );

          return interaction.reply({
            content:
              `📤 **${user.tag}** has been kicked.\nReason: **${reason}**`
          });
        } catch (error) {
          console.error('[SECURITY] KICK ERROR:', error);

          return interaction.reply({
            content:
              '❌ Kick failed. Check the bot role position and **Kick Members** permission.',
            ephemeral: true
          });
        }
      }

      /* ===============================
         BAN
      =============================== */

      if (interaction.commandName === 'ban') {
        try {
          await member.ban({
            deleteMessageSeconds: 0,
            reason:
              `${reason} | Moderator: ${interaction.user.tag}`
          });

          return interaction.reply({
            content:
              `🔨 **${user.tag}** has been banned.\nReason: **${reason}**`
          });
        } catch (error) {
          console.error('[SECURITY] BAN ERROR:', error);

          return interaction.reply({
            content:
              '❌ Ban failed. Check the bot role position and **Ban Members** permission.',
            ephemeral: true
          });
        }
      }
    }

    /* =================================================
       BUTTONS
    ================================================= */

    if (interaction.isButton()) {

      const channel = interaction.channel;

      if (
        !channel ||
        !tempRooms.has(channel.id)
      ) {
        return interaction.reply({
          content:
            'This temporary room is no longer active.',
          ephemeral: true
        });
      }

      const ownerId =
        tempRooms.get(channel.id);

      /* CLAIM */

      if (interaction.customId === 'claim') {

        if (
          !channel.members.has(
            interaction.user.id
          )
        ) {
          return interaction.reply({
            content:
              'Join this voice room first to claim it.',
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
            ManageChannels: true,
            MoveMembers: true,
            MuteMembers: true,
            DeafenMembers: true
          }
        );

        tempRooms.set(
          channel.id,
          interaction.user.id
        );

        return interaction.reply({
          content:
            '👑 You are now the room owner.',
          ephemeral: true
        });
      }

      /* OWNER ONLY */

      if (
        interaction.user.id !== ownerId
      ) {
        return interaction.reply({
          content:
            'Only the current room owner can use this control.',
          ephemeral: true
        });
      }

      switch (interaction.customId) {

        /* RENAME */

        case 'rename': {

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

          modal.addComponents(
            new ActionRowBuilder().addComponents(input)
          );

          return interaction.showModal(modal);
        }

        /* LIMIT */

        case 'limit': {

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

          modal.addComponents(
            new ActionRowBuilder().addComponents(input)
          );

          return interaction.showModal(modal);
        }

        /* VISIBILITY */

        case 'visibility': {

          const everyone =
            channel.guild.roles.everyone;

          const overwrite =
            channel.permissionOverwrites.cache.get(
              everyone.id
            );

          const hidden =
            overwrite &&
            overwrite.deny.has(
              PermissionsBitField.Flags.ViewChannel
            );

          if (hidden) {

            await channel.permissionOverwrites.edit(
              everyone,
              {
                ViewChannel: true,
                Connect: true
              }
            );

            return interaction.reply({
              content:
                '👁️ **Room is now visible.**\nEveryone can see and join your room.',
              ephemeral: true
            });
          }

          await channel.permissionOverwrites.edit(
            everyone,
            {
              ViewChannel: false,
              Connect: false
            }
          );

          await channel.permissionOverwrites.edit(
            ownerId,
            {
              ViewChannel: true,
              Connect: true,
              Speak: true,
              ManageChannels: true,
              MoveMembers: true,
              MuteMembers: true,
              DeafenMembers: true
            }
          );

          return interaction.reply({
            content:
              '🙈 **Room is now hidden.**\nOnly users with permission can see or join it.',
            ephemeral: true
          });
        }

        /* PRIVACY */

        case 'privacy': {

          const everyone =
            channel.guild.roles.everyone;

          const overwrite =
            channel.permissionOverwrites.cache.get(
              everyone.id
            );

          const locked =
            overwrite &&
            overwrite.deny.has(
              PermissionsBitField.Flags.Connect
            );

          if (locked) {

            await channel.permissionOverwrites.edit(
              everyone,
              {
                ViewChannel: true,
                Connect: true
              }
            );

            return interaction.reply({
              content:
                '🔓 **Room unlocked.**',
              ephemeral: true
            });
          }

          await channel.permissionOverwrites.edit(
            everyone,
            {
              ViewChannel: true,
              Connect: false
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
            content:
              '🔒 **Room locked.**',
            ephemeral: true
          });
        }

        /* WAITING */

        case 'waiting': {

          await channel.permissionOverwrites.edit(
            channel.guild.roles.everyone,
            {
              ViewChannel: true,
              Connect: false
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
            content:
              '⏳ **Waiting room enabled.**',
            ephemeral: true
          });
        }

        /* INVITE */

        case 'invite': {

          const invite =
            await channel.createInvite({
              maxAge: 3600,
              maxUses: 0
            });

          return interaction.reply({
            content:
              `🔗 **Room Invite**\n\n${invite.url}`,
            ephemeral: true
          });
        }

        /* TRUST */

        case 'trust':
          return interaction.reply({
            content:
              '🟢 **Select a member to trust:**',
            components: [
              new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                  .setCustomId('trust_select')
                  .setPlaceholder(
                    'Select member to trust'
                  )
                  .setMinValues(1)
                  .setMaxValues(1)
              )
            ],
            ephemeral: true
          });

        /* UNTRUST */

        case 'untrust':
          return interaction.reply({
            content:
              '🔴 **Select a member to untrust:**',
            components: [
              new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                  .setCustomId('untrust_select')
                  .setPlaceholder(
                    'Select member to untrust'
                  )
                  .setMinValues(1)
                  .setMaxValues(1)
              )
            ],
            ephemeral: true
          });

        /* ROOM KICK */

        case 'kick':
          return interaction.reply({
            content:
              '📵 **Select a member to kick from your room:**',
            components: [
              new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                  .setCustomId('kick_select')
                  .setPlaceholder(
                    'Select member to kick'
                  )
                  .setMinValues(1)
                  .setMaxValues(1)
              )
            ],
            ephemeral: true
          });

        /* BLOCK */

        case 'block':
          return interaction.reply({
            content:
              '🚫 **Select a member to block:**',
            components: [
              new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                  .setCustomId('block_select')
                  .setPlaceholder(
                    'Select member to block'
                  )
                  .setMinValues(1)
                  .setMaxValues(1)
              )
            ],
            ephemeral: true
          });

        /* UNBLOCK */

        case 'unblock':
          return interaction.reply({
            content:
              '🔓 **Select a member to unblock:**',
            components: [
              new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                  .setCustomId('unblock_select')
                  .setPlaceholder(
                    'Select member to unblock'
                  )
                  .setMinValues(1)
                  .setMaxValues(1)
              )
            ],
            ephemeral: true
          });

        /* TRANSFER */

        case 'transfer':
          return interaction.reply({
            content:
              '🔄 **Select the new room owner:**',
            components: [
              new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                  .setCustomId('transfer_select')
                  .setPlaceholder(
                    'Select new owner'
                  )
                  .setMinValues(1)
                  .setMaxValues(1)
              )
            ],
            ephemeral: true
          });

        /* REGION */

        case 'region': {

          const modal = new ModalBuilder()
            .setCustomId('region_modal')
            .setTitle('Voice Region');

          const input = new TextInputBuilder()
            .setCustomId('region')
            .setLabel('Region')
            .setPlaceholder(
              'auto / singapore / japan / us-east'
            )
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(input)
          );

          return interaction.showModal(modal);
        }

        /* DELETE */

        case 'delete': {

          tempRooms.delete(channel.id);

          await interaction.reply({
            content:
              '🗑️ Deleting room...',
            ephemeral: true
          });

          await channel.delete(
            'Room deleted by owner'
          ).catch(error => {
            console.error(
              '[TEMPVOICE] MANUAL DELETE ERROR:',
              error
            );
          });

          return;
        }
      }
    }

    /* =================================================
       USER SELECT MENUS
    ================================================= */

    if (interaction.isUserSelectMenu()) {

      const channel = interaction.channel;

      if (
        !channel ||
        !tempRooms.has(channel.id)
      ) {
        return interaction.update({
          content:
            'This temporary room is no longer active.',
          components: []
        });
      }

      const ownerId =
        tempRooms.get(channel.id);

      if (
        interaction.user.id !== ownerId
      ) {
        return interaction.update({
          content:
            'Only the current room owner can use this control.',
          components: []
        });
      }

      const selectedId =
        interaction.values[0];

      const member =
        await interaction.guild.members
          .fetch(selectedId)
          .catch(() => null);

      if (!member) {
        return interaction.update({
          content:
            '❌ Member not found.',
          components: []
        });
      }

      /* TRUST */

      if (
        interaction.customId === 'trust_select'
      ) {

        await channel.permissionOverwrites.edit(
          member.id,
          {
            ViewChannel: true,
            Connect: true,
            Speak: true
          }
        );

        return interaction.update({
          content:
            `🟢 <@${member.id}> is now **trusted**.`,
          components: []
        });
      }

      /* UNTRUST */

      if (
        interaction.customId === 'untrust_select'
      ) {

        if (member.id === ownerId) {
          return interaction.update({
            content:
              '❌ You cannot untrust the room owner.',
            components: []
          });
        }

        await channel.permissionOverwrites
          .delete(member.id)
          .catch(() => {});

        return interaction.update({
          content:
            `🔴 <@${member.id}> is no longer **trusted**.`,
          components: []
        });
      }

      /* ROOM KICK */

      if (
        interaction.customId === 'kick_select'
      ) {

        if (member.id === ownerId) {
          return interaction.update({
            content:
              '❌ You cannot kick the room owner.',
            components: []
          });
        }

        if (
          member.voice.channelId !== channel.id
        ) {
          return interaction.update({
            content:
              '❌ That member is not inside your room.',
            components: []
          });
        }

        await member.voice.disconnect();

        return interaction.update({
          content:
            `📵 <@${member.id}> was **kicked from the room**.`,
          components: []
        });
      }

      /* BLOCK */

      if (
        interaction.customId === 'block_select'
      ) {

        if (member.id === ownerId) {
          return interaction.update({
            content:
              '❌ You cannot block the room owner.',
            components: []
          });
        }

        await channel.permissionOverwrites.edit(
          member.id,
          {
            ViewChannel: false,
            Connect: false
          }
        );

        if (
          member.voice.channelId === channel.id
        ) {
          await member.voice.disconnect()
            .catch(() => {});
        }

        return interaction.update({
          content:
            `🚫 <@${member.id}> has been **blocked**.`,
          components: []
        });
      }

      /* UNBLOCK */

      if (
        interaction.customId === 'unblock_select'
      ) {

        await channel.permissionOverwrites
          .delete(member.id)
          .catch(() => {});

        return interaction.update({
          content:
            `🔓 <@${member.id}> has been **unblocked**.`,
          components: []
        });
      }

      /* TRANSFER */

      if (
        interaction.customId === 'transfer_select'
      ) {

        if (member.id === ownerId) {
          return interaction.update({
            content:
              '❌ That member is already the owner.',
            components: []
          });
        }

        if (
          member.voice.channelId !== channel.id
        ) {
          return interaction.update({
            content:
              '❌ The new owner must be inside this room.',
            components: []
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
            ManageChannels: true,
            MoveMembers: true,
            MuteMembers: true,
            DeafenMembers: true
          }
        );

        tempRooms.set(
          channel.id,
          member.id
        );

        return interaction.update({
          content:
            `🔄 Room ownership transferred to <@${member.id}>.`,
          components: []
        });
      }
    }

    /* =================================================
       MODALS
    ================================================= */

    if (interaction.isModalSubmit()) {

      const channel = interaction.channel;

      if (
        !channel ||
        !tempRooms.has(channel.id)
      ) {
        return interaction.reply({
          content:
            'This room is no longer active.',
          ephemeral: true
        });
      }

      const ownerId =
        tempRooms.get(channel.id);

      if (
        interaction.user.id !== ownerId
      ) {
        return interaction.reply({
          content:
            'Only the room owner can use this.',
          ephemeral: true
        });
      }

      /* RENAME */

      if (
        interaction.customId === 'rename_modal'
      ) {

        const name =
          interaction.fields
            .getTextInputValue('name')
            .trim();

        if (!name) {
          return interaction.reply({
            content:
              'Enter a valid name.',
            ephemeral: true
          });
        }

        await channel.setName(name);

        return interaction.reply({
          content:
            `✏️ Room renamed to **${name}**.`,
          ephemeral: true
        });
      }

      /* LIMIT */

      if (
        interaction.customId === 'limit_modal'
      ) {

        const value =
          Number(
            interaction.fields
              .getTextInputValue('limit')
              .trim()
          );

        if (
          !Number.isInteger(value) ||
          value < 0 ||
          value > 99
        ) {
          return interaction.reply({
            content:
              'Enter a number from 0 to 99.',
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

      /* REGION */

      if (
        interaction.customId === 'region_modal'
      ) {

        const region =
          interaction.fields
            .getTextInputValue('region')
            .trim()
            .toLowerCase();

        if (region === 'auto') {

          await channel.setRTCRegion(null);

          return interaction.reply({
            content:
              '🌐 Region set to automatic.',
            ephemeral: true
          });
        }

        try {

          await channel.setRTCRegion(region);

          return interaction.reply({
            content:
              `🌐 Voice region set to **${region}**.`,
            ephemeral: true
          });

        } catch {
          return interaction.reply({
            content:
              '❌ Invalid or unavailable voice region.',
            ephemeral: true
          });
        }
      }
    }

  } catch (error) {

    console.error(
      '[TEMPVOICE] INTERACTION ERROR:',
      error
    );

    if (
      !interaction.replied &&
      !interaction.deferred
    ) {
      await interaction.reply({
        content:
          'Something went wrong.',
        ephemeral: true
      }).catch(() => {});
    }
  }
});

/* =====================================================
   READY
===================================================== */

client.once('clientReady', async () => {

  log(`Logged in as ${client.user.tag}`);

  client.user.setActivity('Fuegos Music', {
    type: ActivityType.Playing
  });

  log('Fuegos TempVoice is ONLINE');

  try {

    const rest =
      new REST({ version: '10' })
        .setToken(TOKEN);

    /*
     * IMPORTANT:
     * Remove ALL GLOBAL commands first.
     * This fixes duplicate /kick and /ban.
     */

    await rest.put(
      Routes.applicationCommands(
        client.user.id
      ),
      {
        body: []
      }
    );

    log('ALL OLD GLOBAL COMMANDS REMOVED');

    /*
     * Reset every guild and register commands once.
     */

    for (
      const guild of client.guilds.cache.values()
    ) {

      await rest.put(
        Routes.applicationGuildCommands(
          client.user.id,
          guild.id
        ),
        {
          body: []
        }
      );

      await rest.put(
        Routes.applicationGuildCommands(
          client.user.id,
          guild.id
        ),
        {
          body: commands
        }
      );

      log(
        `COMMANDS REGISTERED: ${guild.name}`
      );
    }

    log(
      'SLASH COMMANDS READY: /kick /ban'
    );

  } catch (error) {

    console.error(
      '[SECURITY] COMMAND REGISTRATION ERROR:',
      error
    );
  }

  /* BACKUP CLEANUP */

  setInterval(() => {

    cleanupAllRooms()
      .catch(error => {

        console.error(
          '[TEMPVOICE] BACKUP CLEANUP ERROR:',
          error
        );

      });

  }, CLEANUP_INTERVAL);
});

/* =====================================================
   LOGIN
===================================================== */

if (!TOKEN) {

  console.error(
    'ERROR: TOKEN is missing from Railway Variables.'
  );

} else if (!CREATE_CHANNEL_ID) {

  console.error(
    'ERROR: CREATE_CHANNEL_ID is missing from Railway Variables.'
  );

} else {

  client.login(TOKEN)
    .then(() => {
      console.log(
        '[TEMPVOICE] Discord login successful.'
      );
    })
    .catch(error => {
      console.error(
        '[TEMPVOICE] DISCORD LOGIN ERROR:',
        error
      );
    });
}
