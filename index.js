/* =====================================================
   HELPERS (UPDATED WITH CATEGORY FALLBACK)
===================================================== */

function isTempRoom(channel) {
  if (!channel || channel.type !== ChannelType.GuildVoice || channel.id === CREATE_CHANNEL_ID) {
    return false;
  }

  // 1. Check in-memory map
  if (tempRooms.has(channel.id)) return true;

  // 2. Check for hidden zero-width marker
  if (channel.name.includes(MARKER)) return true;

  // 3. Fallback: Check if channel is in the same category as the "Create Channel"
  const createChan = channel.guild.channels.cache.get(CREATE_CHANNEL_ID);
  if (createChan && createChan.parentId && channel.parentId === createChan.parentId) {
    return true;
  }

  return false;
}

function getDisplayName(channel) {
  return channel.name.replace(MARKER, '');
}

function getOwnerId(channel) {
  if (!isTempRoom(channel)) return null;

  if (tempRooms.has(channel.id)) {
    return tempRooms.get(channel.id);
  }

  const overwrite = channel.permissionOverwrites.cache.find(
    o => o.type === 1 && o.allow.has(PermissionsBitField.Flags.ManageChannels)
  );

  return overwrite ? overwrite.id : null;
}

/* =====================================================
   VOICE STATE UPDATE (GUARANTEED DELETION)
===================================================== */

client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    /* --- CREATE TEMP VC --- */
    if (newState.channelId === CREATE_CHANNEL_ID && oldState.channelId !== CREATE_CHANNEL_ID) {
      const createChannel = newState.channel;
      const guild = newState.guild;
      const member = newState.member;

      if (!createChannel || !member) return;

      const room = await guild.channels.create({
        name: `${member.user.username}'s Room${MARKER}`,
        type: ChannelType.GuildVoice,
        parent: createChannel.parentId || undefined,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect]
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

      // Move member into created room
      await member.voice.setChannel(room).catch(err => {
        console.error('Failed to move user into room:', err.message);
      });

      // Check if user left during creation
      if (room.members.size === 0) {
        tempRooms.delete(room.id);
        await room.delete().catch(() => {});
        return;
      }

      await room.send(buildPanel(room)).catch(() => {});
    }

    /* --- AUTO-DELETE ON LEAVE OR MOVE --- */
    if (
      oldState.channel &&
      oldState.channel.id !== CREATE_CHANNEL_ID &&
      isTempRoom(oldState.channel)
    ) {
      const leftChannel = oldState.channel;

      setTimeout(async () => {
        try {
          // Fetch fresh state from Discord
          const fetchedChannel = await leftChannel.guild.channels.fetch(leftChannel.id).catch(() => null);

          if (fetchedChannel && fetchedChannel.members.size === 0) {
            tempRooms.delete(fetchedChannel.id);
            
            await fetchedChannel.delete().catch(err => {
              console.error(`[PERMISSION ERROR] Could not delete channel ${fetchedChannel.id}:`, err.message);
            });
            
            console.log(`DELETED EMPTY TEMP VC: ${getDisplayName(fetchedChannel)}`);
          }
        } catch (err) {
          // Channel already deleted
        }
      }, 300);
    }
  } catch (error) {
    console.error('VOICE STATE ERROR:', error);
  }
});
