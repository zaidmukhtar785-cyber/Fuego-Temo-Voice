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
  return Boolean(
    channel &&
    channel.type === ChannelType.GuildVoice &&
    channel.parent &&
    channel.parent.name === TEMP_CATEGORY_NAME
  );
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

  console.log(`Deleted empty room: ${channel.name}`);
}

function buildPanel(channel, ownerId) {
  const embed = new EmbedBuilder()
    .setTitle('FUEGOS • ROOM CONTROL')
    .setDescription(
      `Manage **${channel.name}**\n\n` +
      `**Owner:** <@${ownerId}>\n` +
      `**Members:** ${channel.members.size}\n\n` +
      'Use the buttons below to manage your temporary room.'
    )
    .addFields(
      {
        name: 'ROOM',
        value: '✏️ Rename\n👥 User Limit\n🔗 Invite',
        inline: true
      },
      {
        name: 'PRIVACY',
        value: '🔒 Lock\n🔓 Unlock\n👁️ Hide\n👀 Show',
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

  console.log(`Recovered ${rooms.size} temporary room(s).`);
  console.log('Fuegos Temporary Voice Bot is ONLINE');
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    if (
      newState.channelId === CREATE_CHANNEL_ID &&
      oldState.channelId !== CREATE_CHANNEL_ID
    ) {
      const guild = newState.guild;
      const member = newState.member;

      let category = newState.channel.parent;

      if (!category || category.name !== TEMP_CATEGORY_NAME) {
        category = guild.channels.cache.find(
          channel =>
            channel.type === ChannelType.GuildCategory &&
            channel.name === TEMP_CATEGORY_NAME
        );
      }

      if (!category) {
        category = await guild.channels.create({
          name: TEMP_CATEGORY_NAME,
          type: ChannelType.GuildCategory
        });
      }

      const room = await guild.channels.create({
        name: `${member.user.username}'s Room`,
        type: ChannelType.GuildVoice,
        parent: category.id,

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

      console.log(`Created room: ${room.name}`);
    }

    if (oldState.channel) {
      await deleteIfEmpty(oldState.channel);
    }

  } catch (error) {
    console.error('VOICE ERROR:', error);
  }
});

client.on('interactionCreate', async interaction => {
  try {
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

      // CLAIM
      if (interaction.customId === 'claim') {
        const currentOwner = ownerId
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
          content: '👑 You are now the room owner.',
          ephemeral: true
        });
      }

      // OWNER CHECK
      if (interaction.user.id !== ownerId) {
        return interaction.reply({
          content: 'Only the current room owner can use this control.',
          ephemeral: true
        });
      }

      // RENAME
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

      // USER LIMIT
      if (interaction.customId === 'limit') {
        const modal = new ModalBuilder()
          .setCustomId('limit_modal')
          .setTitle('User Limit');

        const input = new TextInputBuilder()
          .setCustomId('user_limit')
          .setLabel('0 = unlimited | 1-99 = limit')
          .setPlaceholder('5')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(2)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(input)
        );

        return interaction.showModal(modal);
      }

      // INVITE
      if (interaction.customId === 'invite') {
        const invite = await channel.createInvite({
          maxAge: 3600,
          maxUses: 0
        });

        return interaction.reply({
          content:
            `🔗 **Room Invite**\n\n${invite.url}\n\n` +
            'Expires in **1 hour**.',
          ephemeral: true
        });
      }

      // LOCK
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

      // UNLOCK
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

      // HIDE
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

      // SHOW
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

      // DELETE
      if (interaction.customId === 'delete') {
        rooms.delete(channel.id);

        await interaction.reply({
          content: '🗑️ Deleting room...',
          ephemeral: true
        });

        await channel.delete().catch(() => {});
      }
    }

    // MODALS
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

      // RENAME
      if (interaction.customId === 'rename_modal') {
        const name = interaction.fields
          .getTextInputValue('room_name')
          .trim();

        if (!name) {
          return interaction.reply({
            content: 'Enter a valid name.',
            ephemeral: true
          });
        }

        await channel.setName(
          `${name}'s Room`
        );

        return interaction.reply({
          content:
            `✏️ Room renamed to **${name}'s Room**.`,
          ephemeral: true
        });
      }

      // USER LIMIT
      if (interaction.customId === 'limit_modal') {
        const value = Number(
          interaction.fields
            .getTextInputValue('user_limit')
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
    }

  } catch (error) {
    console.error(
      'INTERACTION ERROR:',
      error
    );

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

client.login(process.env.TOKEN).catch(error => {
  console.error(
    'DISCORD LOGIN ERROR:',
    error
  );
});
