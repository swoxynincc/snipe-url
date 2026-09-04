import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits
} from "discord.js";

export function createClient(token) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
  });

  client.on("error", () => {
    console.error("Discord client error.");
  });

  return {
    client,

    async login() {
      await client.login(token);
    }
  };
}

export async function verifyConfiguration(
  client,
  guildId,
  channelId
) {
  const guild = await client.guilds.fetch(guildId);

  if (!guild) {
    throw new Error("Guild could not be found.");
  }

  const channel = await client.channels.fetch(channelId);

  if (!channel || !channel.isTextBased()) {
    throw new Error(
      "Notification channel is not a text-based Discord channel."
    );
  }

  if (channel.guildId !== guildId) {
    throw new Error(
      "Notification channel does not belong to the configured guild."
    );
  }

  const member = guild.members.me;

  if (!member) {
    throw new Error(
      "The bot's guild member could not be found."
    );
  }

  const permissions = channel.permissionsFor(member);

  if (!permissions?.has(PermissionFlagsBits.ViewChannel)) {
    throw new Error("Bot cannot view the notification channel.");
  }

  if (!permissions.has(PermissionFlagsBits.SendMessages)) {
    throw new Error("Bot cannot send messages to the notification channel.");
  }

  return {
    guild,
    channel
  };
}

/*
 * Gets the vanity URL currently assigned to this guild.
 *
 * This does NOT check arbitrary vanity codes.
 */
export async function getCurrentVanity(guild) {
  const vanityData = await guild.fetchVanityData();

  return vanityData?.code ?? null;
}
