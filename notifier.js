export async function notify(channel, oldCode, newCode) {
  const oldValue = oldCode ? `discord.gg/${oldCode}` : "none";
  const newValue = newCode ? `discord.gg/${newCode}` : "none";

  const message =
    `Vanity URL state changed.\n` +
    `Previous: ${oldValue}\n` +
    `Current: ${newValue}`;

  await channel.send({
    content: message,
    allowedMentions: { parse: [] }
  });
}
