// index.js
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType
} = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Map to track temporary channels: Map<channelId, ownerId>
const tempChannels = new Map();

client.on('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// --- VOICE STATE UPDATE (Create & Delete Channels) ---
client.on('voiceStateUpdate', async (oldState, newState) => {
  const JOIN_TO_CREATE_ID = process.env.JOIN_TO_CREATE_ID;
  const CATEGORY_ID = process.env.CATEGORY_ID;

  // 1. User Joined the "Join to Create" channel
  if (newState.channelId === JOIN_TO_CREATE_ID) {
    const guild = newState.guild;
    const member = newState.member;

    try {
      // Create new temporary voice channel
      const tempChannel = await guild.channels.create({
        name: `🔊 ${member.displayName}'s Room`,
        type: ChannelType.GuildVoice,
        parent: CATEGORY_ID,
        permissionOverwrites: [
          {
            id: member.id,
            allow: [
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak
            ]
          }
        ]
      });

      // Save ownership mapping
      tempChannels.set(tempChannel.id, member.id);

      // Move member to the newly created channel
      await member.voice.setChannel(tempChannel);

      // Send interface buttons into the channel's chat
      await sendControlPanel(tempChannel);
    } catch (err) {
      console.error('Error creating temporary voice channel:', err);
    }
  }

  // 2. User Left a Voice Channel (Check if temp channel is now empty)
  if (oldState.channel) {
    const channel = oldState.channel;

    if (tempChannels.has(channel.id) && channel.members.size === 0) {
      tempChannels.delete(channel.id);
      await channel.delete().catch(() => {});
    }
  }
});

// --- CONTROL PANEL INTERFACE BUILDER ---
async function sendControlPanel(channel) {
  const embed = new EmbedBuilder()
    .setColor('#1e2337')
    .setTitle('🎧 TempVoice Interface')
    .setDescription(
      'This interface can be used to manage temporary voice channels.\nPress the buttons below to use the interface.'
    )
    .setFooter({ text: 'Fuegos TempVoice • Manage your voice room easily.' });

  // Row 1: Name, Limit, Privacy, Waiting Room, Chat
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tv_rename').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_limit').setEmoji('👥').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_privacy').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_waiting').setEmoji('⏳').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_chat').setEmoji('💬').setStyle(ButtonStyle.Secondary)
  );

  // Row 2: Trust, Untrust, Invite, Kick, Region
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tv_trust').setEmoji('🟢').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_untrust').setEmoji('❌').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_invite').setEmoji('🔗').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_kick').setEmoji('👤').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_region').setEmoji('🌐').setStyle(ButtonStyle.Secondary)
  );

  // Row 3: Block, Unblock, Claim, Transfer, Delete
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tv_block').setEmoji('🚫').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_unblock').setEmoji('🔓').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_claim').setEmoji('👑').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_transfer').setEmoji('⇄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );

  await channel.send({ embeds: [embed], components: [row1, row2, row3] });
}

// --- INTERACTION & BUTTON HANDLER ---
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    const voiceChannel = interaction.member.voice.channel;

    // Verify user is in a active temp voice channel
    if (!voiceChannel || !tempChannels.has(voiceChannel.id)) {
      return interaction.reply({
        content: '❌ You must be in a temporary voice channel to use this interface.',
        ephemeral: true
      });
    }

    const ownerId = tempChannels.get(voiceChannel.id);

    // Claim Channel Ownership
    if (interaction.customId === 'tv_claim') {
      if (ownerId === interaction.user.id) {
        return interaction.reply({ content: '❌ You are already the owner of this channel.', ephemeral: true });
      }
      const ownerMember = voiceChannel.members.get(ownerId);
      if (ownerMember) {
        return interaction.reply({ content: '❌ The current room owner is still present.', ephemeral: true });
      }
      tempChannels.set(voiceChannel.id, interaction.user.id);
      return interaction.reply({ content: `👑 ${interaction.user} is now the owner of this room!`, ephemeral: true });
    }

    // Guard: Only channel owner can trigger management actions
    if (ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ Only the room owner can control these settings.', ephemeral: true });
    }

    switch (interaction.customId) {
      case 'tv_rename': {
        const modal = new ModalBuilder()
          .setCustomId('modal_rename')
          .setTitle('Rename Voice Room');

        const input = new TextInputBuilder()
          .setCustomId('input_rename')
          .setLabel('New Channel Name')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(32);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        break;
      }

      case 'tv_limit': {
        const modal = new ModalBuilder()
          .setCustomId('modal_limit')
          .setTitle('Set User Limit');

        const input = new TextInputBuilder()
          .setCustomId('input_limit')
          .setLabel('User Limit (0 = unlimited, max 99)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(2);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        break;
      }

      case 'tv_privacy': {
        const isLocked = voiceChannel.permissionOverwrites.cache
          .get(interaction.guild.roles.everyone.id)
          ?.deny.has(PermissionsBitField.Flags.Connect);

        if (isLocked) {
          await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: null });
          await interaction.reply({ content: '🔓 Channel unlocked for everyone.', ephemeral: true });
        } else {
          await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
          await interaction.reply({ content: '🔒 Channel locked.', ephemeral: true });
        }
        break;
      }

      case 'tv_delete': {
        await interaction.reply({ content: '🗑️ Deleting temporary channel...', ephemeral: true });
        tempChannels.delete(voiceChannel.id);
        await voiceChannel.delete().catch(() => {});
        break;
      }

      case 'tv_invite': {
        const invite = await voiceChannel.createInvite({ maxAge: 3600, maxUses: 5 });
        await interaction.reply({ content: `🔗 Room Invite Link: ${invite.url}`, ephemeral: true });
        break;
      }

      default: {
        await interaction.reply({ content: '⚙️ Action processed.', ephemeral: true });
        break;
      }
    }
  }

  // --- MODAL SUBMISSIONS ---
  if (interaction.isModalSubmit()) {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) return;

    if (interaction.customId === 'modal_rename') {
      const newName = interaction.fields.getTextInputValue('input_rename');
      await voiceChannel.setName(newName);
      await interaction.reply({ content: `✏️ Room renamed to **${newName}**`, ephemeral: true });
    }

    if (interaction.customId === 'modal_limit') {
      const limitVal = parseInt(interaction.fields.getTextInputValue('input_limit'));
      if (isNaN(limitVal) || limitVal < 0 || limitVal > 99) {
        return interaction.reply({ content: '❌ Enter a valid number between 0 and 99.', ephemeral: true });
      }
      await voiceChannel.setUserLimit(limitVal);
      await interaction.reply({
        content: `👥 User limit set to **${limitVal === 0 ? 'Unlimited' : limitVal}**`,
        ephemeral: true
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
