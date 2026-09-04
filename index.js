import config from "./config.js";
import { createClient, getCurrentVanity, verifyConfiguration } from "./discord.js";
import { notify } from "./notifier.js";

const { client, login } = createClient(config.token);

let stopping = false;
let timer = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt) {
  const exponential = Math.min(
    config.pollIntervalMs * (2 ** attempt),
    config.maxBackoffMs
  );

  // Small jitter prevents synchronized retries.
  return Math.floor(exponential * (0.8 + Math.random() * 0.4));
}

async function monitor(guild, channel) {
  let previous = undefined;
  let failureCount = 0;

  while (!stopping) {
    try {
      const current = await getCurrentVanity(guild);

      failureCount = 0;

      // First observation establishes the baseline without generating
      // a notification.
      if (previous === undefined) {
        previous = current;
        console.log(
          `Initial vanity state: ${current ?? "none"}`
        );
      } else if (current !== previous) {
        console.log("Vanity state changed.");

        await notify(channel, previous, current);
        previous = current;
      }

      await sleep(config.pollIntervalMs);
    } catch {
      failureCount += 1;

      const delay = backoffDelay(failureCount);

      console.error(
        `Monitoring temporarily failed; retrying in ${Math.round(
          delay / 1000
        )} seconds.`
      );

      await sleep(delay);
    }
  }
}

async function shutdown(signal) {
  if (stopping) return;

  stopping = true;

  console.log(`Received ${signal}; shutting down.`);

  if (timer) {
    clearTimeout(timer);
  }

  await client.destroy();
  process.exit(0);
}

async function main() {
  await login();

  const { guild, channel } = await verifyConfiguration(
    client,
    config.guildId,
    config.notificationChannelId
  );

  console.log(`Monitoring authorized guild: ${guild.name}`);

  await monitor(guild, channel);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

process.on("unhandledRejection", () => {
  console.error("Unhandled promise rejection.");
});

process.on("uncaughtException", () => {
  console.error("Uncaught exception.");
  void shutdown("uncaughtException");
});

main().catch(() => {
  console.error("Startup failed. Check configuration and bot permissions.");
  void client.destroy();
  process.exit(1);
});
