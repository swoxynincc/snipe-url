import config from "./config.js";

import {
  createClient,
  getCurrentVanity,
  verifyConfiguration
} from "./discord.js";

import { notify } from "./notifier.js";

const { client, login } = createClient(config.token);

let stopping = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffDelay(attempt) {
  const exponential = Math.min(
    config.pollIntervalMs * 2 ** attempt,
    config.maxBackoffMs
  );

  // Random jitter prevents synchronized retries.
  return Math.floor(
    exponential * (0.8 + Math.random() * 0.4)
  );
}

function normalizeWantedUrl(input) {
  let value = input.trim();

  value = value.replace(
    /^https?:\/\/(www\.)?discord\.gg\//i,
    ""
  );

  value = value.replace(
    /^discord\.gg\//i,
    ""
  );

  /*
   * Vanity codes are restricted here to a conservative,
   * URL-safe format.
   */
  if (!/^[a-zA-Z0-9-]{2,32}$/.test(value)) {
    return null;
  }

  return value.toLowerCase();
}

async function handleCommand(message, guild) {
  if (message.author.bot) {
    return;
  }

  if (!message.guild) {
    return;
  }

  if (message.guild.id !== guild.id) {
    return;
  }

  const parts = message.content.trim().split(/\s+/);

  const command = parts[0]?.toLowerCase();

  if (command !== "!url") {
    return;
  }

  const wanted = normalizeWantedUrl(parts[1] ?? "");

  if (!wanted) {
    await message.reply(
      "Usage: `!url <wanted_url>`\n" +
      "Example: `!url my-server`\n\n" +
      "This command can compare the requested value with " +
      "this server's current vanity URL. It cannot perform " +
      "an arbitrary availability check."
    );

    return;
  }

  try {
    const current = await getCurrentVanity(guild);

    if (current?.toLowerCase() === wanted) {
      await message.reply(
        `✅ \`${wanted}\` is currently assigned to this server.`
      );

      return;
    }

    await message.reply(
      `ℹ️ This server currently uses ` +
      `\`${current ?? "no vanity URL"}\`.\n\n` +
      `I cannot confirm whether \`${wanted}\` is available ` +
      `because Discord does not provide a documented arbitrary ` +
      `vanity-availability endpoint.`
    );
  } catch {
    await message.reply(
      "❌ I couldn't retrieve the current vanity URL right now."
    );
  }
}

async function monitor(guild, channel) {
  let previous = undefined;
  let failureCount = 0;

  while (!stopping) {
    try {
      const current = await getCurrentVanity(guild);

      failureCount = 0;

      /*
       * First check establishes the baseline.
       * It does not send a notification.
       */
      if (previous === undefined) {
        previous = current;

        console.log(
          `Initial vanity: ${current ?? "none"}`
        );
      }

      /*
       * Subsequent checks detect legitimate changes.
       */
      else if (current !== previous) {
        console.log("Vanity URL state changed.");

        await notify(
          channel,
          previous,
          current
        );

        previous = current;
      }

      await sleep(config.pollIntervalMs);
    } catch {
      failureCount += 1;

      const delay = getBackoffDelay(failureCount);

      console.error(
        `Temporary monitoring error. ` +
        `Retrying in ${Math.round(delay / 1000)} seconds.`
      );

      await sleep(delay);
    }
  }
}

async function shutdown(signal) {
  if (stopping) {
    return;
  }

  stopping = true;

  console.log(`Received ${signal}. Shutting down...`);

  client.destroy();
}

async function main() {
  await login();

  const {
    guild,
    channel
  } = await verifyConfiguration(
    client,
    config.guildId,
    config.notificationChannelId
  );

  console.log(
    `Monitoring guild: ${guild.name}`
  );

  console.log(
    `Notification channel: ${channel.id}`
  );

  console.log(
    "Command enabled: !url <wanted_url>"
  );

  /*
   * Prefix command listener.
   */
  client.on("messageCreate", async (message) => {
    try {
      await handleCommand(message, guild);
    } catch {
      console.error("Command handling failed.");
    }
  });

  /*
   * Start monitoring.
   */
  await monitor(guild, channel);
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("unhandledRejection", () => {
  console.error("Unhandled promise rejection.");
});

process.on("uncaughtException", () => {
  console.error("Uncaught exception.");
  void shutdown("uncaughtException");
});

main().catch(() => {
  console.error(
    "Startup failed. Check the environment variable and bot configuration."
  );

  client.destroy();
  process.exit(1);
});
