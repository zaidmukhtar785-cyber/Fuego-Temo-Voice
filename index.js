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
          "👀
