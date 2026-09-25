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
    // CREATE
