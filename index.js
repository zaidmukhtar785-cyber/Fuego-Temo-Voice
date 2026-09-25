const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const CREATE_CHANNEL_ID = process.env.CREATE_CHANNEL_ID;

const temporaryChannels = new Set();
const channelOwners = new Map();

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log("Fuegos Temporary Voice Bot is ONLINE");
});

function controlPanel() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("rename_room")
      .setLabel("Rename")
      .setEmoji("✏️")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("lock_room")
      .setLabel("Lock")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("unlock_room")
      .setLabel("Unlock")
      .setEmoji("🔓")
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("hide_room")
      .setLabel("Hide")
      .setEmoji("👁️")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("unhide_room")
      .setLabel("Unhide")
      .setEmoji("👀")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("limit_room")
      .setLabel("User Limit")
      .setEmoji("👥")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("delete_room")
      .setLabel("Delete")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger)
  );

  return [row1, row2];
}

client.on("voiceStateUpdate", async (oldState, newState) => {
  try {
    // CREATE ROOM
    if (
      newState.channelId === CREATE_CHANNEL_ID &&
      oldState.channelId !== CREATE_CHANNEL_ID
    ) {
      const guild = newState.guild;
      const member = newState.member;

      const room = await guild.channels.create({
        name: `🔥 ${member.user.username}'s Room`,
        type: ChannelType.GuildVoice,
        parent: newState.channel.parentId,

        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.SendMessages
            ]
          },
          {
            id: member.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ManageChannels
            ]
          }
        ]
      });

      temporaryChannels.add(room.id);
      channelOwners.set(room.id, member.id);

      await member.voice.setChannel(room);

      // CONTROL PANEL
      await room.send({
        content:
          `## 🎛️ ${member.user.username}'s Room\n` +
          `**Room Owner:** <@${member.id}>\n\n` +
          `Use the buttons below to control your temporary voice room.`,
        components: controlPanel()
      });

      console.log(`Created: ${room.name}`);
    }

    // DELETE EMPTY ROOM
    if (
      oldState.channelId &&
      temporaryChannels.has(oldState.channelId) &&
      oldState.channel.members.size === 0
    ) {
      const channel = oldState.channel;

      temporaryChannels.delete(channel.id);
      channelOwners.delete(channel.id);

      await channel.delete().catch(() => {});

      console.log(`Deleted: ${channel.name}`);
    }
  } catch (error) {
    console.error("VOICE ERROR:", error);
  }
});

// BUTTONS
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isButton()) return;

    const channel = interaction.channel;

    if (!channel || !temporaryChannels.has(channel.id)) {
      return interaction.reply({
        content: "❌ This room is no longer active.",
        ephemeral: true
      });
    }

    const ownerId = channelOwners.get(channel.id);

    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: "❌ Only the room owner can use these controls.",
        ephemeral: true
      });
    }

    // RENAME
    if (interaction.customId === "rename_room") {
      const modal = new ModalBuilder()
        .setCustomId("rename_modal")
        .setTitle("Rename Your Room");

      const input = new TextInputBuilder()
        .setCustomId("room_name")
        .setLabel("New room name")
        .setPlaceholder("Enter a new name")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(50)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(input)
      );

      return interaction.showModal(modal);
    }

    // LOCK
    if (interaction.customId === "lock_room") {
      await channel.permissionOverwrites.edit(
        channel.guild.roles.everyone,
        {
          Connect: false
        }
      );

      await interaction.reply({
        content: "🔒 Room locked.",
        ephemeral: true
      });
    }

    // UNLOCK
    if (interaction.customId === "unlock_room") {
      await channel.permissionOverwrites.edit(
        channel.guild.roles.everyone,
        {
          Connect: true
        }
      );

      await interaction.reply({
        content: "🔓 Room unlocked.",
        ephemeral: true
      });
    }

    // HIDE
    if (interaction.customId === "hide_room") {
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
          Connect: true
        }
      );

      await interaction.reply({
        content: "👁️ Room hidden.",
        ephemeral: true
      });
    }

    // UNHIDE
    if (interaction.customId === "unhide_room") {
      await channel.permissionOverwrites.edit(
        channel.guild.roles.everyone,
        {
          ViewChannel: true
        }
      );

      await interaction.reply({
        content: "👀 Room visible again.",
        ephemeral: true
      });
    }

    // USER LIMIT
    if (interaction.customId === "limit_room") {
      const modal = new ModalBuilder()
        .setCustomId("limit_modal")
        .setTitle("Set User Limit");

      const input = new TextInputBuilder()
        .setCustomId("user_limit")
        .setLabel("Maximum users (0-99)")
        .setPlaceholder("Example: 5")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(2)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(input)
      );

      return interaction.showModal(modal);
    }

    // DELETE
    if (interaction.customId === "delete_room") {
      temporaryChannels.delete(channel.id);
      channelOwners.delete(channel.id);

      await interaction.reply({
        content: "🗑️ Deleting your room...",
        ephemeral: true
      });

      await channel.delete().catch(() => {});
    }
  } catch (error) {
    console.error("BUTTON ERROR:", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Something went wrong.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// MODALS
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isModalSubmit()) return;

    const channel = interaction.channel;

    if (!channel || !temporaryChannels.has(channel.id)) {
      return interaction.reply({
        content: "❌ This room is no longer active.",
        ephemeral: true
      });
    }

    const ownerId = channelOwners.get(channel.id);

    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: "❌ Only the room owner can do this.",
        ephemeral: true
      });
    }

    // RENAME
    if (interaction.customId === "rename_modal") {
      const newName = interaction.fields
        .getTextInputValue("room_name")
        .trim();

      await channel.setName(`🔥 ${newName}`);

      await interaction.reply({
        content: `✏️ Room renamed to **🔥 ${newName}**`,
        ephemeral: true
      });
    }

    // LIMIT
    if (interaction.customId === "limit_modal") {
      const value = Number(
        interaction.fields.getTextInputValue("user_limit")
      );

      if (!Number.isInteger(value) || value < 0 || value > 99) {
        return interaction.reply({
          content: "❌ Enter a number between 0 and 99.",
          ephemeral: true
        });
      }

      await channel.setUserLimit(value);

      await interaction.reply({
        content:
          value === 0
            ? "👥 User limit removed."
            : `👥 User limit set to **${value}**.`,
        ephemeral: true
      });
    }
  } catch (error) {
    console.error("MODAL ERROR:", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Something went wrong.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

client.login(process.env.TOKEN).catch(error => {
  console.error("DISCORD LOGIN ERROR:", error);
});
