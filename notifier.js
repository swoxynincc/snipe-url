export async function notify(channel, oldCode, newCode) {
  const oldValue = oldCode
    ? `https://discord.gg/${oldCode}`
    : "None";

  const newValue = newCode
    ? `https://discord.gg/${newCode}`
    : "None";

  await channel.send({
    content:
      `🔔 **Vanity URL changed**\n\n` +
      `Previous: ${oldValue}\n` +
      `Current: ${newValue}`,

    allowedMentions: {
      parse: []
    }
  });
}
