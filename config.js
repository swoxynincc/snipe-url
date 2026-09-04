import "dotenv/config";

const TOKEN = process.env.Token;

if (!TOKEN) {
  throw new Error(
    "Missing environment variable 'Token'. Configure your bot token as an environment variable."
  );
}

const config = {
  token: TOKEN,

  guildId: "1545503087370829847",

  notificationChannelId: "1545503088159232152",

  // 5 minutes between checks.
  pollIntervalMs: 300000,

  // Maximum retry delay after errors.
  maxBackoffMs: 3600000
};

export default config;
