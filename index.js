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

/* =====================================================
   CLIENT
===================================================== */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

/* =====================================================
   CONFIG
===================================================== */

const CREATE_CHANNEL_ID = '1548623536627650591';

const TEMP_CATEGORY_ID = '1548705352084758700';

/*
  Invisible marker.

  It is used so the bot knows which voice channels
  were created by this bot.

  It is NOT visible in Discord.
*/
const TEMP_MARKER = '\u200B';

const rooms = new Map();

/* =====================================================
   ROOM HELPERS
===================================================== */

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
      overwrite.allow.has(
        PermissionsBitField.Flags.ManageChannels
      )
  );

  return owner ? owner.id : null;
}

async function deleteIfEmpty(channel) {
  if (!isTempRoom(channel)) return;

  if (channel.members.size > 0) return;

  rooms.delete(channel.id);

  await channel.delete().catch(() => {});

  console.log(
    `Deleted empty room: ${cleanRoomName(channel.name)}`
  );
}

/* =====================================================
   PANEL
===================================================== */

function buildPanel(channel, ownerId) {

  const embed = new EmbedBuilder()
    .setTitle('TempVoice Interface')
    .setDescription(
      'This interface can be used to manage temporary voice channels.\n' +
      'Press the buttons below to use the interface.'
    )
    .addFields({
      name: '\u200B',
      value:
        '✏️ **NAME**　 👥 **LIMIT**　 🔒 **PRIVACY**　 ⏳ **WAITING ROOM**　 💬 **CHAT**\n' +
        '🟢 **TRUST**　 🔴 **UNTRUST**　 🔗 **INVITE**　 📵 **KICK**　 🌐 **REGION**\n' +
        '🚫 **BLOCK**　 🔓 **UNBLOCK**　 👑 **CLAIM**　 👑 **TRANSFER**　 🗑️ **DELETE**',
      inline: false
    })
    .setFooter({
      text: `Fuegos • ${cleanRoomName(channel.name)}`
    });

  /* ================= ROW 1 ================= */

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

  /* ================= ROW 2 ================= */

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

  /* ================= ROW 3 ================= */

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
    components: [
      row1,
      row2,
      row3
    ]
  };
}

/* =====================================================
   USER ID MODAL
===================================================== */

function createUserModal(customId, title, label) {

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

/* =====================================================
   BOT READY
===================================================== */

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
    'Bot status: Playing Fuegos Music'
  );

  /* Recover rooms after restart */

  for (const guild of client.guilds.cache.values()) {

    for (const channel of guild.channels.cache.values()) {

      if (isTempRoom(channel)) {

        const ownerId = getOwnerId(channel);

        if (ownerId) {
          rooms.set(
            channel.id,
            ownerId
          );
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

/* =====================================================
   VOICE STATE
===================================================== */

client.on(
  'voiceStateUpdate',
  async (oldState, newState) => {

    try {

      /* ================================================
         CREATE TEMP ROOM
      ================================================ */

      if (
        newState.channelId === CREATE_CHANNEL_ID &&
        oldState.channelId !== CREATE_CHANNEL_ID
      ) {

        const guild = newState.guild;
        const member = newState.member;

        /*
          IMPORTANT:
          This ALWAYS uses your exact category.
        */

        const room = await guild.channels.create({

          name:
            `${member.user.username}'s Room${TEMP_MARKER}`,

          type:
            ChannelType.GuildVoice,

          parent:
            TEMP_CATEGORY_ID,

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

        rooms.set(
          room.id,
          member.id
        );

        /* Move creator into room */

        await member.voice.setChannel(
          room
        );

        /* Send control panel */

        await room.send(
          buildPanel(
            room,
            member.id
          )
        );

        console.log(
          `Created room: ${cleanRoomName(room.name)}`
        );

        console.log(
          `Category: ${TEMP_CATEGORY_ID}`
        );
      }

      /* ================================================
         DELETE EMPTY ROOM
      ================================================ */

      if (oldState.channel) {

        await deleteIfEmpty(
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

/* =====================================================
   INTERACTIONS
===================================================== */

client.on(
  'interactionCreate',
  async interaction => {

    try {

      /* =================================================
         BUTTONS
      ================================================= */

      if (interaction.isButton()) {

        const channel =
          interaction.channel;

        /* Check temporary room */

        if (!isTempRoom(channel)) {

          return interaction.reply({
            content:
              'This room is no longer active.',
            ephemeral: true
          });
        }

        const ownerId =
          rooms.get(channel.id) ||
          getOwnerId(channel);

        /* =============================================
           CLAIM
        ============================================= */

        if (
          interaction.customId === 'claim'
        ) {

          const currentOwner =
            ownerId
              ? channel.guild.members.cache.get(
                  ownerId
                )
              : null;

          /*
            Owner is still inside room
          */

          if (
            currentOwner &&
            currentOwner.voice.channelId === channel.id
          ) {

            return interaction.reply({
              content:
                'The current owner is still in this room.',
              ephemeral: true
            });
          }

          /*
            User must be inside room
          */

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

          /*
            Remove old owner
          */

          if (ownerId) {

            await channel.permissionOverwrites
              .delete(ownerId)
              .catch(() => {});
          }

          /*
            Give new owner permission
          */

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
            content:
              '👑 You are now the room owner.',
            ephemeral: true
          });
        }

        /* =============================================
           OWNER CHECK
        ============================================= */

        if (
          interaction.user.id !== ownerId
        ) {

          return interaction.reply({
            content:
              'Only the current room owner can use this control.',
            ephemeral: true
          });
        }

        /* =============================================
           RENAME
        ============================================= */

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
                'room_name'
              )
              .setLabel(
                'New room name'
              )
              .setPlaceholder(
                'Enter a new name'
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

        /* =============================================
           LIMIT
        ============================================= */

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
                'user_limit'
              )
              .setLabel(
                '0 = Unlimited | 1-99 = Limit'
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

        /* =============================================
           INVITE
        ============================================= */

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
              `🔗 **Room Invite**\n\n${invite.url}\n\nExpires in **1 hour**.`,
            ephemeral: true
          });
        }

        /* =============================================
           LOCK
        ============================================= */

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

        /* =============================================
           UNLOCK
        ============================================= */

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

        /* =============================================
           HIDE
        ============================================= */

        if (
          interaction.customId === 'hide'
        ) {

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
            content:
              '👁️ Room hidden.',
            ephemeral: true
          });
        }

        /* =============================================
           SHOW
        ============================================= */

        if (
          interaction.customId === 'show'
        ) {

          await channel.permissionOverwrites.edit(
            channel.guild.roles.everyone,
            {
              ViewChannel: true
            }
          );

          return interaction.reply({
            content:
              '👀 Room visible.',
            ephemeral: true
          });
        }

        /* =============================================
           WAITING ROOM
        ============================================= */

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
              '⏳ Waiting room enabled. Only the owner can enter.',
            ephemeral: true
          });
        }

        /* =============================================
           CHAT
        ============================================= */

        if (
          interaction.customId === 'chat'
        ) {

          const everyone =
            channel.guild.roles.everyone;

          const current =
            channel.permissionOverwrites.cache.get(
              everyone.id
            );

          const currentlyAllowed =
            current &&
            current.allow.has(
              PermissionsBitField.Flags.SendMessages
            );

          await channel.permissionOverwrites.edit(
            everyone,
            {
              SendMessages: !currentlyAllowed
            }
          );

          return interaction.reply({
            content:
              currentlyAllowed
                ? '💬 Voice room chat disabled.'
                : '💬 Voice room chat enabled.',
            ephemeral: true
          });
        }

        /* =============================================
           TRUST
        ============================================= */

        if (
          interaction.customId === 'trust'
        ) {

          return interaction.showModal(
            createUserModal(
              'trust_modal',
              'Trust Member',
              'Discord User ID'
            )
          );
        }

        /* =============================================
           UNTRUST
        ============================================= */

        if (
          interaction.customId === 'untrust'
        ) {

          return interaction.showModal(
            createUserModal(
              'untrust_modal',
              'Untrust Member',
              'Discord User ID'
            )
          );
        }

        /* =============================================
           BLOCK
        ============================================= */

        if (
          interaction.customId === 'block'
        ) {

          return interaction.showModal(
            createUserModal(
              'block_modal',
              'Block Member',
              'Discord User ID'
            )
          );
        }

        /* =============================================
           UNBLOCK
        ============================================= */

        if (
          interaction.customId === 'unblock'
        ) {

          return interaction.showModal(
            createUserModal(
              'unblock_modal',
              'Unblock Member',
              'Discord User ID'
            )
          );
        }

        /* =============================================
           KICK
        ============================================= */

        if (
          interaction.customId === 'kick'
        ) {

          return interaction.showModal(
            createUserModal(
              'kick_modal',
              'Kick Member',
              'Discord User ID'
            )
          );
        }

        /* =============================================
           TRANSFER
        ============================================= */

        if (
          interaction.customId === 'transfer'
        ) {

          return interaction.showModal(
            createUserModal(
              'transfer_modal',
              'Transfer Ownership',
              'New Owner User ID'
            )
          );
        }

        /* =============================================
           REGION
        ============================================= */

        if (
          interaction.customId === 'region'
        ) {

          const modal =
            new ModalBuilder()
              .setCustomId(
                'region_modal'
              )
              .setTitle(
                'Voice Region'
              );

          const input =
            new TextInputBuilder()
              .setCustomId(
                'region'
              )
              .setLabel(
                'Region'
              )
              .setPlaceholder(
                'auto / us-east / singapore / india'
              )
              .setStyle(
                TextInputStyle.Short
              )
              .setMaxLength(30)
              .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder()
              .addComponents(input)
          );

          return interaction.showModal(
            modal
          );
        }

        /* =============================================
           DELETE
        ============================================= */

        if (
          interaction.customId === 'delete'
        ) {

          rooms.delete(
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

      /* =================================================
         MODALS
      ================================================= */

      if (interaction.isModalSubmit()) {

        const channel =
          interaction.channel;

        if (!isTempRoom(channel)) {

          return interaction.reply({
            content:
              'This room is no longer active.',
            ephemeral: true
          });
        }

        const ownerId =
          rooms.get(channel.id) ||
          getOwnerId(channel);

        /* =============================================
           OWNER CHECK
        ============================================= */

        if (
          interaction.user.id !== ownerId
        ) {

          return interaction.reply({
            content:
              'Only the room owner can use this.',
            ephemeral: true
          });
        }

        /* =============================================
           RENAME MODAL
        ============================================= */

        if (
          interaction.customId === 'rename_modal'
        ) {

          const name =
            interaction.fields
              .getTextInputValue(
                'room_name'
              )
              .trim();

          if (!name) {

            return interaction.reply({
              content:
                'Enter a valid name.',
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

        /* =============================================
           LIMIT MODAL
        ============================================= */

        if (
          interaction.customId === 'limit_modal'
        ) {

          const value =
            Number(
              interaction.fields
                .getTextInputValue(
                  'user_limit'
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
                ? '👥 User limit removed.'
                : `👥 User limit set to **${value}**.`,
            ephemeral: true
          });
        }

        /* =============================================
           REGION MODAL
        ============================================= */

        if (
          interaction.customId === 'region_modal'
        ) {

          const region =
            interaction.fields
              .getTextInputValue(
                'region'
              )
              .trim()
              .toLowerCase();

          const validRegions = [
            'auto',
            'brazil',
            'hongkong',
            'india',
            'japan',
            'rotterdam',
            'singapore',
            'south-korea',
            'southafrica',
            'sydney',
            'us-central',
            'us-east',
            'us-south',
            'us-west'
          ];

          if (
            !validRegions.includes(region)
          ) {

            return interaction.reply({
              content:
                '❌ Invalid region. Try **auto**, **india**, **singapore**, **japan**, **us-east**, etc.',
              ephemeral: true
            });
          }

          await channel.setRTCRegion(
            region === 'auto'
              ? null
              : region
          );

          return interaction.reply({
            content:
              `🌐 Voice region set to **${region}**.`,
            ephemeral: true
          });
        }

        /* =============================================
           GET MEMBER
        ============================================= */

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
              '❌ User not found in this server.',
            ephemeral: true
          });
        }

        /* =============================================
           TRUST
        ============================================= */

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
              `🟢 <@${member.id}> is now trusted.`,
            ephemeral: true
          });
        }

        /* =============================================
           UNTRUST
        ============================================= */

        if (
          interaction.customId === 'untrust_modal'
        ) {

          if (
            member.id === ownerId
          ) {

            return interaction.reply({
              content:
                '❌ You cannot untrust the room owner.',
              ephemeral: true
            });
          }

          await channel.permissionOverwrites
            .delete(member.id)
            .catch(() => {});

          return interaction.reply({
            content:
              `🔴 <@${member.id}> is no longer trusted.`,
            ephemeral: true
          });
        }

        /* =============================================
           BLOCK
        ============================================= */

        if (
          interaction.customId === 'block_modal'
        ) {

          if (
            member.id === ownerId
          ) {

            return interaction.reply({
              content:
                '❌ You cannot block the room owner.',
              ephemeral: true
            });
          }

          await channel.permissionOverwrites.edit(
            member.id,
            {
              ViewChannel: false,
              Connect: false
            }
          );

          return interaction.reply({
            content:
              `🚫 <@${member.id}> has been blocked.`,
            ephemeral: true
          });
        }

        /* =============================================
           UNBLOCK
        ============================================= */

        if (
          interaction.customId === 'unblock_modal'
        ) {

          if (
            member.id === ownerId
          ) {

            return interaction.reply({
              content:
                '❌ The owner does not need to be unblocked.',
              ephemeral: true
            });
          }

          await channel.permissionOverwrites
            .delete(member.id)
            .catch(() => {});

          return interaction.reply({
            content:
              `✅ <@${member.id}> has been unblocked.`,
            ephemeral: true
          });
        }

        /* =============================================
           KICK
        ============================================= */

        if (
          interaction.customId === 'kick_modal'
        ) {

          if (
            member.id === ownerId
          ) {

            return interaction.reply({
              content:
                '❌ You cannot kick the room owner.',
              ephemeral: true
            });
          }

          if (
            member.voice.channelId !== channel.id
          ) {

            return interaction.reply({
              content:
                '❌ That user is not inside your room.',
              ephemeral: true
            });
          }

          await member.voice.disconnect(
            'Kicked by temporary room owner'
          );

          return interaction.reply({
            content:
              `📵 <@${member.id}> was kicked.`,
            ephemeral: true
          });
        }

        /* =============================================
           TRANSFER
        ============================================= */

        if (
          interaction.customId === 'transfer_modal'
        ) {

          if (
            member.id === ownerId
          ) {

            return interaction.reply({
              content:
                '❌ You are already the owner.',
              ephemeral: true
            });
          }

          if (
            member.voice.channelId !== channel.id
          ) {

            return interaction.reply({
              content:
                '❌ The new owner must be inside your room.',
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

/* =====================================================
   LOGIN
===================================================== */

client.login(
  process.env.TOKEN
).catch(error => {

  console.error(
    'DISCORD LOGIN ERROR:',
    error
  );

});
