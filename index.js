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
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const CREATE_CHANNEL_ID = process.env.CREATE_CHANNEL_ID;

const TEMP_PREFIX = "FUEGOS_TEMP_OWNER:";

const temporaryChannels = new Set();

/* =========================
   ROOM HELPERS
========================= */

function isTempRoom(channel) {
  return (
    channel &&
    channel.type === ChannelType.GuildVoice &&
    channel.topic &&
    channel.topic.startsWith(TEMP_PREFIX)
  );
}

function getOwnerId(channel) {
  if (!isTempRoom(channel)) return null;

  return channel.topic.replace(TEMP_PREFIX, "");
}

async function setOwner(channel, userId) {
  await channel.setTopic(`${TEMP_PREFIX}${userId}`);

  await channel.permissionOverwrites.edit(userId, {
    ViewChannel: true,
    Connect: true,
    Speak: true,
    SendMessages: true,
    ManageChannels: true
  });
}

/* =========================
   PREMIUM PANEL
========================= */

function panelEmbed(ownerId, channel) {
  return new EmbedBuilder()
    .setTitle("TEMPORARY VOICE")
    .setDescription(
      "### Room Control Center\n" +
      "Manage your temporary voice room using the controls below.\n\n" +
      `**Owner:** <@${ownerId}>\n` +
      `**Room:** ${channel.name}\n\n` +
      "Only the current room owner can use owner controls."
    )
    .addFields(
      {
        name: "ROOM MANAGEMENT",
        value:
          "✏️ Rename your room\n" +
          "👥 Set the maximum users\n" +
          "🔗 Create an invite",
        inline: true
      },
      {
        name: "PRIVACY",
        value:
          "🔒 Lock the room\n" +
          "🔓 Unlock the room\n" +
          "👁️ Hide the room\n" +
          "👀 Show the room",
        inline: true
      }
    )
    .setFooter({
      text: "Fuegos • Temporary Voice System"
    })
    .setTimestamp();
}

function panelButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("rename")
      .setLabel("Rename")
      .setEmoji("✏️")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("limit")
      .setLabel("User Limit")
      .setEmoji("👥")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("invite")
      .setLabel("Invite")
      .setEmoji("🔗")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("claim")
      .setLabel("Claim")
      .setEmoji("👑")
      .setStyle(ButtonStyle.Success)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("lock")
      .setLabel("Lock")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("unlock")
      .setLabel("Unlock")
      .setEmoji("🔓")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("hide")
      .setLabel("Hide")
      .setEmoji("👁️")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("unhide")
      .setLabel("Show")
      .setEmoji("👀")
      .setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("delete")
      .setLabel("Delete Room")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger)
  );

  return [row1, row2, row3];
}

/* =========================
   BOT READY
========================= */

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    for (const channel of guild.channels.cache.values()) {
      if (isTempRoom(channel)) {
        temporaryChannels.add(channel.id);
      }
    }
  }

  console.log(
    `Recovered ${temporaryChannels.size} temporary room(s).`
  );

  console.log("Fuegos Temporary Voice Bot is ONLINE");
});

/* =========================
   VOICE STATE
========================= */

client.on("voiceStateUpdate", async (oldState, newState) => {
  try {
    /* CREATE ROOM */

    if (
      newState.channelId === CREATE_CHANNEL_ID &&
      oldState.channelId !== CREATE_CHANNEL_ID
    ) {
      const guild = newState.guild;
      const member = newState.member;

      const room = await guild.channels.create({
        name: `${member.user.username}'s Room`,
        type: ChannelType.GuildVoice,
        parent: newState.channel.parentId,

        topic: `${TEMP_PREFIX}${member.id}`,

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

      await member.voice.setChannel(room);

      await room.send({
        embeds: [panelEmbed(member.id, room)],
        components: panelButtons()
      });

      console.log(`Created room: ${room.name}`);
    }

    /* DELETE EMPTY ROOM */

    if (
      oldState.channelId &&
      oldState.channel &&
      isTempRoom(oldState.channel) &&
      oldState.channel.members.size === 0
    ) {
      const room = oldState.channel;

      temporaryChannels.delete(room.id);

      await room.delete().catch(() => {});

      console.log(`Deleted room: ${room.name}`);
    }
  } catch (error) {
    console.error("VOICE ERROR:", error);
  }
});

/* =========================
   BUTTONS
========================= */

client.on("interactionCreate", async interaction => {
  try {
    if (!interaction.isButton()) return;

    const channel = interaction.channel;

    if (!isTempRoom(channel)) {
      return interaction.reply({
        content: "This room is no longer active.",
        ephemeral: true
      });
    }

    const ownerId = getOwnerId(channel);

    /* =====================
       CLAIM
    ===================== */

    if (interaction.customId === "claim") {
      const owner = channel.guild.members.cache.get(ownerId);

      if (owner && owner.voice.channelId === channel.id) {
        return interaction.reply({
          content: "The current owner is still in this room.",
          ephemeral: true
        });
      }

      if (channel.members.size === 0) {
        return interaction.reply({
          content: "You cannot claim an empty room.",
          ephemeral: true
        });
      }

      await setOwner(channel, interaction.user.id);

      await interaction.reply({
        content: "👑 You are now the owner of this room.",
        ephemeral: true
      });

      return;
    }

    /* =====================
       OWNER CHECK
    ===================== */

    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: "Only the current room owner can use this control.",
        ephemeral: true
      });
    }

    /* RENAME */

    if (interaction.customId === "rename") {
      const modal = new ModalBuilder()
        .setCustomId("rename_modal")
        .setTitle("Rename Your Room");

      const input = new TextInputBuilder()
        .setCustomId("room_name")
        .setLabel("Room name")
        .setPlaceholder("Enter your new room name")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(50)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(input)
      );

      return interaction.showModal(modal);
    }

    /* USER LIMIT */

    if (interaction.customId === "limit") {
      const modal = new ModalBuilder()
        .setCustomId("limit_modal")
        .setTitle("Set User Limit");

      const input = new TextInputBuilder()
        .setCustomId("user_limit")
        .setLabel("Maximum users")
        .setPlaceholder("0 = unlimited | 1-99")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(2)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(input)
      );

      return interaction.showModal(modal);
    }

    /* INVITE */

    if (interaction.customId === "invite") {
      const invite = await channel.createInvite({
        maxAge: 3600,
        maxUses: 0,
        unique: true
      });

      return interaction.reply({
        content:
          `🔗 **Room Invite Created**\n\n${invite.url}\n\n` +
          `Expires in **1 hour**.`,
        ephemeral: true
      });
    }

    /* LOCK */

    if (interaction.customId === "lock") {
      await channel.permissionOverwrites.edit(
        channel.guild.roles.everyone,
        {
          Connect: false
        }
      );

      return interaction.reply({
        content: "🔒 Room locked.",
        ephemeral: true
      });
    }

    /* UNLOCK */

    if (interaction.customId === "unlock") {
      await channel.permissionOverwrites.edit(
        channel.guild.roles.everyone,
        {
          Connect: true
        }
      );

      return interaction.reply({
        content: "🔓 Room unlocked.",
        ephemeral: true
      });
    }

    /* HIDE */

    if (interaction.customId === "hide") {
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
          SendMessages: true,
          ManageChannels: true
        }
      );

      return interaction.reply({
        content: "👁️ Room hidden.",
        ephemeral: true
      });
    }

    /* UNHIDE */

    if (interaction.customId === "unhide") {
      await channel.permissionOverwrites.edit(
        channel.guild.roles.everyone,
        {
          ViewChannel: true
        }
      );

      return interaction.reply({
        content: "👀 Room visible again.",
        ephemeral: true
      });
    }

    /* DELETE */

    if (interaction.customId === "delete") {
      temporaryChannels.delete(channel.id);

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
        content: "Something went wrong.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

/* =========================
   MODALS
========================= */

client.on("interactionCreate", async interaction => {
  try {
    if (!interaction.isModalSubmit()) return;

    const channel = interaction.channel;

    if (!isTempRoom(channel)) {
      return interaction.reply({
        content: "This room is no longer active.",
        ephemeral: true
      });
    }

    const ownerId = getOwnerId(channel);

    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: "Only the room owner can use this.",
        ephemeral: true
      });
    }

    /* RENAME */

    if (interaction.customId === "rename_modal") {
      const name = interaction.fields
        .getTextInputValue("room_name")
        .trim();

      if (!name) {
        return interaction.reply({
          content: "Enter a valid room name.",
          ephemeral: true
        });
      }

      await channel.setName(`${name}'s Room`);

      return interaction.reply({
        content: `✏️ Room renamed to **${name}'s Room**.`,
        ephemeral: true
      });
    }

    /* USER LIMIT */

    if (interaction.customId === "limit_modal") {
      const value = Number(
        interaction.fields.getTextInputValue("user_limit")
      );

      if (!Number.isInteger(value) || value < 0 || value > 99) {
        return interaction.reply({
          content: "Enter a number from 0 to 99.",
          ephemeral: true
        });
      }

      await channel.setUserLimit(value);

      return interaction.reply({
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
        content: "Something went wrong.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

/* =========================
   LOGIN
========================= */

client.login(process.env.TOKEN).catch(error => {
  console.error("DISCORD LOGIN ERROR:", error);
});
