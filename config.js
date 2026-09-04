import "dotenv/config";

function required(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function snowflake(name) {
  const value = required(name);

  if (!/^\d{17,20}$/.test(value)) {
    throw new Error(`${name} must be a Discord snowflake.`);
  }

  return value;
}

function positiveInteger(name, fallback) {
  const raw = process.env[name];

  if (raw === undefined || raw === "") {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

const config = {
  token: required("DISCORD_TOKEN"),
  guildId: snowflake("GUILD_ID"),
  notificationChannelId: snowflake("NOTIFICATION_CHANNEL_ID"),

  pollIntervalMs: Math.max(
    positiveInteger("POLL_INTERVAL_MS", 300_000),
    60_000
  ),

  maxBackoffMs: Math.max(
    positiveInteger("MAX_BACKOFF_MS", 3_600_000),
    60_000
  )
};

export default config;
