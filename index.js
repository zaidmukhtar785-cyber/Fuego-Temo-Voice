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
  ActivityType
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
   TEMP ROOM DATABASE
   channelId -> ownerId
===================================================== */

const tempRooms = new Map();

/* =====================================================
   SETTINGS
===================================================== */

const DELETE_DELAY = 1200;
const CLEANUP_INTERVAL = 5000;

/* =====================================================
   LOGGER
===================================================== */

function log(message) {
  console.log(`[TEMPVOICE] ${message}`);
}

/* =====================================================
   PANEL
===================================================== */

function buildPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x2b8cff)
    .setTitle('🎧 TempVoice Interface')
    .setDescription(
      'Manage your temporary voice channel using the controls below.'
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
    new ButtonBuilder()
      .setCustomId('rename')
      .setEmoji('✏️')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('limit')
      .setEmoji('👥')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('privacy')
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
      .setEmoji('🔄')
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
      `CREATED: ${room.name} | ID: ${room.id} | OWNER: ${member.user.tag}`
    );

    await member.voice.setChannel(room);

    await room.send(buildPanel());

    return room;

  } catch (error) {
    console.error('[TEMPVOICE] CREATE ERROR:', error);
    return null;
  }
}

/* =====================================================
   DELETE TEMP ROOM
===================================================== */

async function checkAndDeleteRoom(channelId) {
  if (!tempRooms.has(channelId)) return;

  try {
    const channel = await client.channels
      .fetch(channelId)
      .catch(() => null);

    if (!channel) {
      tempRooms.delete(channelId);
      return;
    }

    if (channel.type !== ChannelType.GuildVoice) {
      tempRooms.delete(channelId);
      return;
    }

    const memberCount = channel.members.size;

    log(
      `CHECKING ${channel.name} | MEMBERS: ${memberCount}`
    );

    if (memberCount > 0) return;

    tempRooms.delete(channelId);

    log(`EMPTY ROOM: ${channel.name}`);

    await channel.delete(
      'Temporary voice channel became empty'
    );

    log(`DELETED: ${channel.name}`);

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

client.on(
  'voiceStateUpdate',
  async (oldState, newState) => {

    try {

      /* ===============================================
         CREATE ROOM
      =============================================== */

      if (
        newState.channelId === CREATE_CHANNEL_ID &&
        oldState.channelId !== CREATE_CHANNEL_ID
      ) {

        const member = newState.member;
        const createChannel = newState.channel;

        if (!member || !createChannel) return;

        log(
          `${member.user.tag} JOINED CREATE CHANNEL`
        );

        await createTempRoom(
          member,
          createChannel
        );
      }

      /* ===============================================
         DELETE WHEN EMPTY
      =============================================== */

      if (
        oldState.channelId &&
        tempRooms.has(oldState.channelId)
      ) {

        const channelId = oldState.channelId;

        log(
          `USER LEFT TEMP ROOM: ${channelId}`
        );

        setTimeout(() => {
          checkAndDeleteRoom(channelId);
        }, DELETE_DELAY);
      }

    } catch (error) {

      console.error(
        '[TEMPVOICE] VOICE STATE ERROR:',
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

      /* ===============================================
         BUTTONS
      =============================================== */

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

        /* =============================================
           CLAIM
        ============================================= */

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
           BUTTON ACTIONS
        ============================================= */

        switch (interaction.customId) {

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
                content: '🔓 Room unlocked.',
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
              content: '🔒 Room locked.',
              ephemeral: true
            });
          }

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
                '⏳ Waiting room enabled.',
              ephemeral: true
            });
          }

          case 'chat':

            return interaction.reply({
              content:
                '💬 Room chat is controlled by Discord channel permissions.',
              ephemeral: true
            });

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

          /* ===========================================
             TRUST USER SELECT
          =========================================== */

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

          /* ===========================================
             UNTRUST USER SELECT
          =========================================== */

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

          /* ===========================================
             KICK USER SELECT
          =========================================== */

          case 'kick':

            return interaction.reply({
              content:
                '📵 **Select a member to kick:**',
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

          /* ===========================================
             REGION
          =========================================== */

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

          /* ===========================================
             BLOCK USER SELECT
          =========================================== */

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

          /* ===========================================
             UNBLOCK USER SELECT
          =========================================== */

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

          /* ===========================================
             TRANSFER USER SELECT
          =========================================== */

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

          /* ===========================================
             DELETE
          =========================================== */

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

      /* ===============================================
         USER SELECT MENUS
      =============================================== */

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

        /* =============================================
           TRUST
        ============================================= */

        if (
          interaction.customId ===
          'trust_select'
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

        /* =============================================
           UNTRUST
        ============================================= */

        if (
          interaction.customId ===
          'untrust_select'
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

        /* =============================================
           KICK
        ============================================= */

        if (
          interaction.customId ===
          'kick_select'
        ) {

          if (member.id === ownerId) {

            return interaction.update({
              content:
                '❌ You cannot kick the room owner.',
              components: []
            });
          }

          if (
            member.voice.channelId !==
            channel.id
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
              `📵 <@${member.id}> was **kicked**.`,
            components: []
          });
        }

        /* =============================================
           BLOCK
        ============================================= */

        if (
          interaction.customId ===
          'block_select'
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

          return interaction.update({
            content:
              `🚫 <@${member.id}> has been **blocked**.`,
            components: []
          });
        }

        /* =============================================
           UNBLOCK
        ============================================= */

        if (
          interaction.customId ===
          'unblock_select'
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

        /* =============================================
           TRANSFER
        ============================================= */

        if (
          interaction.customId ===
          'transfer_select'
        ) {

          if (member.id === ownerId) {

            return interaction.update({
              content:
                '❌ That member is already the owner.',
              components: []
            });
          }

          if (
            member.voice.channelId !==
            channel.id
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

      /* ===============================================
         MODALS
         Rename / Limit / Region
      =============================================== */

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

        /* =============================================
           RENAME
        ============================================= */

        if (
          interaction.customId ===
          'rename_modal'
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

        /* =============================================
           LIMIT
        ============================================= */

        if (
          interaction.customId ===
          'limit_modal'
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

        /* =============================================
           REGION
        ============================================= */

        if (
          interaction.customId ===
          'region_modal'
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

          await channel.setRTCRegion(region);

          return interaction.reply({
            content:
              `🌐 Voice region set to **${region}**.`,
            ephemeral: true
          });
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
  }
);

/* =====================================================
   CLIENT READY
===================================================== */

client.once(
  'clientReady',
  () => {

    log(
      `Logged in as ${client.user.tag}`
    );

    client.user.setActivity(
      'Fuegos Music',
      {
        type: ActivityType.Playing
      }
    );

    log(
      'Fuegos TempVoice is ONLINE'
    );

    /* Backup cleanup every 5 seconds */

    setInterval(() => {

      cleanupAllRooms().catch(error => {

        console.error(
          '[TEMPVOICE] BACKUP CLEANUP ERROR:',
          error
        );

      });

    }, CLEANUP_INTERVAL);
  }
);

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
