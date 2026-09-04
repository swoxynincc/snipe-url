import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits
} from "discord.js";

export function createClient(token) {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  client.once("ready", () => {
    console.log(`Connected as ${client.user.tag}`);
  });

  client.on("error", () => {
    // Don't log potentially sensitive error objects or request data.
    console.error("Discord client error.");
  });

  return {
    client,

    async login() {
      await client.login(token);
    }
  };
}

export async function verifyConfiguration(client, guildId, channelId) {
  const guild = await client.guilds.fetch(guildId);

  if (!guild) {
    throw new Error("Configured guild could not be fetched.");
  }

  const channel = await client.channels.fetch(channelId);

  if (!channel?.isTextBased()) {
    throw new Error("Notification channel is not a text-based channel.");
  }

  if (channel.guildId !== guildId) {
    throw new Error(
      "Notification channel must belong to the monitored guild."
    );
  }

  const me = guild.members.me;

  if (!me) {
    throw new Error("Bot member is not available in the guild.");
  }

  const permissions = channel.permissionsFor(me);

  if (!permissions?.has(PermissionFlagsBits.ViewChannel)) {
    throw new Error("Bot lacks View Channel permission.");
  }

  if (!permissions.has(PermissionFlagsBits.SendMessages)) {
    throw new Error("Bot lacks Send Messages permission.");
  }

  return { guild, channel };
}

/**
 * Documented Discord operation:
 * Get the vanity URL assigned to this guild.
 *
 * This deliberately does NOT accept an arbitrary candidate vanity code.
 */
export async function getCurrentVanity(guild) {
  const vanity = await guild.fetchVanityData();

  return vanity?.code ?? null;
}
