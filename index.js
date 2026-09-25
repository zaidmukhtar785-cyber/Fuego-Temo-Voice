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

const TEMP_CATEGORY_NAME = "Fuegos • Temporary Rooms";
const TEMP_MARKER = "ᐧ";

const tempRooms = new Map();

function isTempRoom(channel) {
  return Boolean(
    channel &&
    channel.type === ChannelType.GuildVoice &&
    channel.name.startsWith(TEMP_MARKER + " ")
  );
}

function getOwnerId(channel) {
  if (!isTempRoom(channel)) return null;

  const overwrite = channel.permissionOverwrites.cache.find(
    x =>
      x.type === 1 &&
      x.allow.has(PermissionsBitField.Flags.ManageChannels)
  );

  return overwrite?.id || null;
}

function panel(ownerId, channel) {
  const embed = new EmbedBuilder()
    .setTitle("FUEGOS • ROOM CONTROL")
    .setDescription(
      `Manage **${channel.name.replace(TEMP_MARKER + " ", "")}**\n\n` +
      `**Owner:** <@${ownerId}>\n` +
      `**Members:** ${channel.members.size}\n\n` +
      "Use the controls below to manage your temporary room."
    )
    .addFields(
      {
        name: "ROOM",
        value:
          "✏️ Rename\n" +
          "👥 User Limit\n" +
          "🔗 Invite",
        inline: true
      },
      {
        name: "PRIVACY",
        value:
          "🔒 Lock / Unlock\n" +
          "👁️ Hide / Show\n" +
          "👑 Claim",
        inline: true
      }
    )
    .setFooter({
      text: "Fuegos • Temporary Voice System"
    })
    .setTimestamp();

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
      .setCustomId("show")
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

  return {
    embeds: [embed],
    components: [row1, row2, row3]
  };
}

async function getOrCreateCategory(guild, parentId) {
  if (parentId) {
    const parent = guild.channels.cache.get(parentId);

    if (parent?.type === ChannelType.GuildCategory) {
      return parent;
    }
  }

  let category = guild.channels.cache.find(
    c =>
      c.type === ChannelType.GuildCategory &&
      c.name === TEMP_CATEGORY_NAME
  );

  if (!category) {
    category = await guild.channels.create({
      name: TEMP_CATEGORY_NAME,
      type: ChannelType.GuildCategory
    });
  }

  return category;
}

async function deleteIfEmpty(channel) {
  if (!isTempRoom(channel)) return;

  if (channel.members.size === 0) {
    tempRooms.delete(channel.id);

    await channel.delete().catch(() => {});

    console.log(`Deleted empty room: ${channel.name}`);
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    for (const channel of guild.channels.cache.values()) {
      if (isTempRoom(channel)) {
        const ownerId = getOwnerId(channel);

        if (ownerId) {
          tempRooms.set(channel.id, ownerId);
        }

        await deleteIfEmpty(channel);
      }
    }
  }

  console.log(
    `Recovered ${tempRooms.size} temporary room(s).`
  );

  console.log("Fuegos Temporary Voice Bot is ONLINE");
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  try {
    /* CREATE ROOM */

    if (
      newState.channelId === CREATE_CHANNEL_ID &&
      oldState.channelId !== CREATE_CHANNEL_ID
    ) {
      const guild = newState.guild;
      const member = newState.member;

      const category = await getOrCreateCategory(
        guild,
        newState.channel.parentId
      );

      const room = await guild.channels.create({
        name: `${TEMP_MARKER} ${member.user.username}'s Room`,
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

      tempRooms.set(room.id, member.id);

      await member.voice.setChannel(room);

      await room.send(
        panel(member.id, room)
      );

      console.log(`Created room: ${room.name}`);
    }

    /* DELETE WHEN EMPTY */

    if (oldState.channelId && oldState.channel) {
      await deleteIfEmpty(oldState.channel);
    }

  } catch (error) {
   
