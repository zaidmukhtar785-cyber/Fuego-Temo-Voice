const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const CREATE_CHANNEL_ID = process.env.CREATE_CHANNEL_ID;

const temporaryChannels = new Set();

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log("Fuegos Temporary Voice Bot is ONLINE");
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  try {
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

      temporaryChannels.add(room.id);

      await member.voice.setChannel(room);

      console.log(`Created: ${room.name}`);
    }

    if (
      oldState.channelId &&
      temporaryChannels.has(oldState.channelId) &&
      oldState.channel.members.size === 0
    ) {
      const channel = oldState.channel;

      temporaryChannels.delete(channel.id);

      await channel.delete().catch(() => {});

      console.log(`Deleted: ${channel.name}`);
    }
  } catch (error) {
    console.error("VOICE ERROR:", error);
  }
});

client.login(process.env.TOKEN).catch(error => {
  console.error("DISCORD LOGIN ERROR:", error);
});
