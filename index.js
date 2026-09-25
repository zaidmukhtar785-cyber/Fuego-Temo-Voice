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

/* =========================
   RAILWAY VARIABLES
========================= */

const CREATE_CHANNEL_ID = process.env.CREATE_CHANNEL_ID;

/*
  Do NOT put your bot token here.
  Railway should already have:
  TOKEN = your bot token

  CREATE_CHANNEL_ID = your CREATE ROOM channel ID
*/

/* =========================
   TEMP ROOM STORAGE
========================= */

const tempRooms = new Map();

/*
  Invisible character used internally
  to identify bot-created rooms.
*/
const MARKER = '\u200B';

/* =========================
   HELPERS
========================= */

function isTempRoom(channel) {
  return (
    channel &&
    channel.type === ChannelType.GuildVoice &&
    channel.id !== CREATE_CHANNEL_ID &&
    channel.name.endsWith(MARKER)
  );
}

function displayName(channel) {
  return channel.name.replace(MARKER, '');
}

function getOwner(channel) {
  const overwrite = channel.permissionOverwrites.cache.find(
    o =>
      o.type === 1 &&
      o.allow.has(
        PermissionsBitField.Flags.ManageChannels
      )
  );

  return overwrite ? overwrite.id : null;
}

async function removeEmptyRoom(channel) {
  if (!isTempRoom(channel)) return;

  if (channel.members.size !== 0) return;

  tempRooms.delete(channel.id);

  await channel.delete().catch(() => {});

  console.log(
    `Deleted empty room: ${displayName(channel)}`
  );
}

/* =========================
   EMBED
========================= */

function createPanel(channel, ownerId) {

  const embed = new EmbedBuilder()
    .setTitle('TempVoice Interface')
    .setDescription(
      'This interface can be used to manage temporary voice channels.\n' +
      'Press the buttons below to use the interface.'
    )
    .addFields({
      name: '\u200B',
      value:
        '✏️ **NAME**　 👥 **LIMIT**　 🔒 **LOCK**　 ⏳ **WAITING**　 💬 **CHAT**\n' +
        '🟢 **TRUST**　 🔴 **UNTRUST**　 🔗 **INVITE**　 📵 **KICK**　 🌐 **REGION**\n' +
        '🚫 **BLOCK**　 🔓 **UNBLOCK**　 👑 **CLAIM**　 👑 **TRANSFER**　 🗑️ **DELETE**',
      inline: false
    })
    .setFooter({
      text: `Fuegos • ${displayName(channel)}`
    });

  /* ROW 1 */

  const row1 = new ActionRowBuilder().addComponents(

    new ButtonBuilder()
      .setCustomId('rename')
      .setEmoji('✏️')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('limit')
      .setEmoji('👥')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('lock')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('waiting')
      .setEmoji('⏳')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('chat')
      .setEmoji('💬')
      .setStyle(ButtonStyle.Secondary)
  );

  /* ROW 2 */

  const row2 = new ActionRowBuilder().addComponents(

    new ButtonBuilder()
      .setCustomId('trust')
      .setEmoji('🟢')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('untrust')
      .setEmoji('🔴')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('invite')
      .setEmoji('🔗')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('kick')
      .setEmoji('📵')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('region')
      .setEmoji('🌐')
      .setStyle(ButtonStyle.Secondary)
  );

  /* ROW 3 */

  const row3 = new ActionRowBuilder().addComponents(

    new ButtonBuilder()
      .setCustomId('block')
      .setEmoji('🚫')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('unblock')
      .setEmoji('🔓')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('claim')
      .setEmoji('👑')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('transfer')
      .setEmoji('👑')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('delete')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger)
  );

  return {
    embeds: [embed],
    components: [row1, row2, row3]
  };
}

/* =========================
   USER MODAL
========================= */

function userModal(id, title) {

  const modal = new ModalBuilder()
    .setCustomId(id)
    .setTitle(title);

  const input = new TextInputBuilder()
    .setCustomId('user_id')
    .setLabel('Discord User ID')
    .setPlaceholder('Enter user ID')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(input)
  );

  return modal;
}

/* =========================
   READY
========================= */

client.once('ready', async () => {

  console.log(
    `Logged in as ${client.user.tag}`
  );

  client.user.setActivity(
    'Fuegos Music',
    {
      type: ActivityType.Playing
    }
  );

  console.log(
    'Playing Fuegos Music'
  );

  /*
    Recover rooms after restart.
  */

  for (const guild of client.guilds.cache.values()) {

    for (const channel of guild.channels.cache.values()) {

      if (isTempRoom(channel)) {

        const owner = getOwner(channel);

        if (owner) {
          tempRooms.set(
            channel.id,
            owner
          );
        }

        await removeEmptyRoom(channel);
      }
    }
  }

  console.log(
    'Fuegos TempVoice is ONLINE'
  );
});

/* =========================
   VOICE STATE
========================= */

client.on(
  'voiceStateUpdate',
  async (oldState, newState) => {

    try {

      /*
        USER ENTERS CREATE CHANNEL
      */

      if (
        newState.channelId === CREATE_CHANNEL_ID &&
        oldState.channelId !== CREATE_CHANNEL_ID
      ) {

        const createChannel =
          newState.channel;

        const guild =
          newState.guild;

        const member =
          newState.member;

        /*
          IMPORTANT:

          We get the CATEGORY DIRECTLY
          from CREATE ROOM.

          No category is created.
          No category name is searched.
        */

        const categoryId =
          createChannel.parentId;

        /*
          Create room inside the SAME CATEGORY.
        */

        const room =
          await guild.channels.create({

            name:
              `${member.user.username}'s Room${MARKER}`,

            type:
              ChannelType.GuildVoice,

            /*
              THIS IS THE IMPORTANT LINE
            */

            parent:
              categoryId || undefined,

            permissionOverwrites: [

              {
                id:
                  guild.roles.everyone.id,

                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.Connect
                ]
              },

              {
                id:
                  member.id,

                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.Connect,
                  PermissionsBitField.Flags.Speak,
                  PermissionsBitField.Flags.ManageChannels
                ]
              }
            ]
          });

        tempRooms.set(
          room.id,
          member.id
        );

        /*
          Move user into room
        */

        await member.voice.setChannel(
          room
        );

        /*
          Send control panel
        */

        await room.send(
          createPanel(
            room,
            member.id
          )
        );

        console.log(
          `Created ${displayName(room)}`
        );

        console.log(
          `Parent category: ${categoryId || 'NONE'}`
        );
      }

      /*
        DELETE EMPTY TEMP ROOM
      */

      if (oldState.channel) {

        await removeEmptyRoom(
          oldState.channel
        );
      }

    } catch (error) {

      console.error(
        'VOICE ERROR:',
        error
      );
    }
  }
);

/* =========================
   INTERACTIONS
========================= */

client.on(
  'interactionCreate',
  async interaction => {

    try {

      /* =====================
         BUTTON
      ===================== */

      if (interaction.isButton()) {

        const channel =
          interaction.channel;

        if (!isTempRoom(channel)) {

          return interaction.reply({
            content:
              'This temporary room no longer exists.',
            ephemeral: true
          });
        }

        const ownerId =
          tempRooms.get(channel.id) ||
          getOwner(channel);

        /* =====================
           CLAIM
        ===================== */

        if (
          interaction.customId === 'claim'
        ) {

          const oldOwner =
            ownerId
              ? channel.guild.members.cache.get(
                  ownerId
                )
              : null;

          if (
            oldOwner &&
            oldOwner.voice.channelId === channel.id
          ) {

            return interaction.reply({
              content:
                'The current owner is still in the room.',
              ephemeral: true
            });
          }

          if (
            !channel.members.has(
              interaction.user.id
            )
          ) {

            return interaction.reply({
              content:
                'Join the room first to claim it.',
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

        /* =====================
           OWNER CHECK
        ===================== */

        if (
          interaction.user.id !== ownerId
        ) {

          return interaction.reply({
            content:
              'Only the room owner can use this.',
            ephemeral: true
          });
        }

        /* =====================
           RENAME
        ===================== */

        if (
          interaction.customId === 'rename'
        ) {

          const modal =
            new ModalBuilder()
              .setCustomId(
                'rename_modal'
              )
              .setTitle(
                'Rename Room'
              );

          const input =
            new TextInputBuilder()
              .setCustomId(
                'name'
              )
              .setLabel(
                'Room name'
              )
              .setPlaceholder(
                'My Room'
              )
              .setStyle(
                TextInputStyle.Short
              )
              .setMaxLength(80)
              .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder()
              .addComponents(input)
          );

          return interaction.showModal(
            modal
          );
        }

        /* =====================
           LIMIT
        ===================== */

        if (
          interaction.customId === 'limit'
        ) {

          const modal =
            new ModalBuilder()
              .setCustomId(
                'limit_modal'
              )
              .setTitle(
                'User Limit'
              );

          const input =
            new TextInputBuilder()
              .setCustomId(
                'limit'
              )
              .setLabel(
                '0 = Unlimited / 1-99'
              )
              .setPlaceholder(
                '5'
              )
              .setStyle(
                TextInputStyle.Short
              )
              .setMaxLength(2)
              .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder()
              .addComponents(input)
          );

          return interaction.showModal(
            modal
          );
        }

        /* =====================
           LOCK
        ===================== */

        if (
          interaction.customId === 'lock'
        ) {

          await channel.permissionOverwrites.edit(
            channel.guild.roles.everyone,
            {
              Connect: false
            }
          );

          return interaction.reply({
            content:
              '🔒 Room locked.',
            ephemeral: true
          });
        }

        /* =====================
           WAITING
        ===================== */

        if (
          interaction.customId === 'waiting'
        ) {

          await channel.permissionOverwrites.edit(
            channel.guild.roles.everyone,
            {
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
              '⏳ Waiting room enabled.',
            ephemeral: true
          });
        }

        /* =====================
           CHAT
        ===================== */

        if (
          interaction.customId === 'chat'
        ) {

          return interaction.reply({
            content:
              '💬 Voice-channel chat is controlled by Discord permissions.',
            ephemeral: true
          });
        }

        /* =====================
           UNLOCK
        ===================== */

        if (
          interaction.customId === 'unlock'
        ) {

          await channel.permissionOverwrites.edit(
            channel.guild.roles.everyone,
            {
              Connect: true
            }
          );

          return interaction.reply({
            content:
              '🔓 Room unlocked.',
            ephemeral: true
          });
        }

        /* =====================
           INVITE
        ===================== */

        if (
          interaction.customId === 'invite'
        ) {

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

        /* =====================
           TRUST
        ===================== */

        if (
          interaction.customId === 'trust'
        ) {

          return interaction.showModal(
            userModal(
              'trust_modal',
              'Trust Member'
            )
          );
        }

        /* =====================
           UNTRUST
        ===================== */

        if (
          interaction.customId === 'untrust'
        ) {

          return interaction.showModal(
            userModal(
              'untrust_modal',
              'Untrust Member'
            )
          );
        }

        /* =====================
           KICK
        ===================== */

        if (
          interaction.customId === 'kick'
        ) {

          return interaction.showModal(
            userModal(
              'kick_modal',
              'Kick Member'
            )
          );
        }

        /* =====================
           BLOCK
        ===================== */

        if (
          interaction.customId === 'block'
        ) {

          return interaction.showModal(
            userModal(
              'block_modal',
              'Block Member'
            )
          );
        }

        /* =====================
           UNBLOCK
        ===================== */

        if (
          interaction.customId === 'unblock'
        ) {

          return interaction.showModal(
            userModal(
              'unblock_modal',
              'Unblock Member'
            )
          );
        }

        /* =====================
           TRANSFER
        ===================== */

        if (
          interaction.customId === 'transfer'
        ) {

          return interaction.showModal(
            userModal(
              'transfer_modal',
              'Transfer Ownership'
            )
          );
        }

        /* =====================
           DELETE
        ===================== */

        if (
          interaction.customId === 'delete'
        ) {

          tempRooms.delete(
            channel.id
          );

          await interaction.reply({
            content:
              '🗑️ Deleting room...',
            ephemeral: true
          });

          await channel.delete()
            .catch(() => {});

          return;
        }
      }

      /* =====================
         MODALS
      ===================== */

      if (
        interaction.isModalSubmit()
      ) {

        const channel =
          interaction.channel;

        if (!isTempRoom(channel)) {

          return interaction.reply({
            content:
              'This room no longer exists.',
            ephemeral: true
          });
        }

        const ownerId =
          tempRooms.get(channel.id) ||
          getOwner(channel);

        if (
          interaction.user.id !== ownerId
        ) {

          return interaction.reply({
            content:
              'Only the room owner can use this.',
            ephemeral: true
          });
        }

        /* =====================
           RENAME
        ===================== */

        if (
          interaction.customId === 'rename_modal'
        ) {

          const name =
            interaction.fields
              .getTextInputValue(
                'name'
              )
              .trim();

          if (!name) {

            return interaction.reply({
              content:
                'Invalid name.',
              ephemeral: true
            });
          }

          await channel.setName(
            `${name}${MARKER}`
          );

          return interaction.reply({
            content:
              `✏️ Room renamed to **${name}**.`,
            ephemeral: true
          });
        }

        /* =====================
           LIMIT
        ===================== */

        if (
          interaction.customId === 'limit_modal'
        ) {

          const value =
            Number(
              interaction.fields
                .getTextInputValue(
                  'limit'
                )
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

          await channel.setUserLimit(
            value
          );

          return interaction.reply({
            content:
              value === 0
                ? '👥 Limit removed.'
                : `👥 Limit set to **${value}**.`,
            ephemeral: true
          });
        }

        /* =====================
           USER MODALS
        ===================== */

        const userId =
          interaction.fields
            .getTextInputValue(
              'user_id'
            )
            .trim();

        const member =
          await interaction.guild.members
            .fetch(userId)
            .catch(() => null);

        if (!member) {

          return interaction.reply({
            content:
              '❌ User not found.',
            ephemeral: true
          });
        }

        /* TRUST */

        if (
          interaction.customId === 'trust_modal'
        ) {

          await channel.permissionOverwrites.edit(
            member.id,
            {
              ViewChannel: true,
              Connect: true,
              Speak: true
            }
          );

          return interaction.reply({
            content:
              `🟢 <@${member.id}> trusted.`,
            ephemeral: true
          });
        }

        /* UNTRUST */

        if (
          interaction.customId === 'untrust_modal'
        ) {

          await channel.permissionOverwrites
            .delete(member.id)
            .catch(() => {});

          return interaction.reply({
            content:
              `🔴 <@${member.id}> untrusted.`,
            ephemeral: true
          });
        }

        /* BLOCK */

        if (
          interaction.customId === 'block_modal'
        ) {

          await channel.permissionOverwrites.edit(
            member.id,
            {
              ViewChannel: false,
              Connect: false
            }
          );

          return interaction.reply({
            content:
              `🚫 <@${member.id}> blocked.`,
            ephemeral: true
          });
        }

        /* UNBLOCK */

        if (
          interaction.customId === 'unblock_modal'
        ) {

          await channel.permissionOverwrites
            .delete(member.id)
            .catch(() => {});

          return interaction.reply({
            content:
              `✅ <@${member.id}> unblocked.`,
            ephemeral: true
          });
        }

        /* KICK */

        if (
          interaction.customId === 'kick_modal'
        ) {

          if (
            member.id === ownerId
          ) {

            return interaction.reply({
              content:
                '❌ You cannot kick the owner.',
              ephemeral: true
            });
          }

          if (
            member.voice.channelId !== channel.id
          ) {

            return interaction.reply({
              content:
                '❌ User is not in this room.',
              ephemeral: true
            });
          }

          await member.voice.disconnect();

          return interaction.reply({
            content:
              `📵 <@${member.id}> kicked.`,
            ephemeral: true
          });
        }

        /* TRANSFER */

        if (
          interaction.customId === 'transfer_modal'
        ) {

          if (
            member.voice.channelId !== channel.id
          ) {

            return interaction.reply({
              content:
                '❌ User must be inside the room.',
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

          tempRooms.set(
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
  }
);

/* =========================
   LOGIN
========================= */

if (!process.env.TOKEN) {

  console.error(
    'TOKEN is missing from Railway Variables.'
  );

} else {

  client.login(
    process.env.TOKEN
  );
}
