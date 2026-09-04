"use strict";
const fs = require("fs");
const WS = require("ws");
const axios = require("axios");

const cfg = JSON.parse(fs.readFileSync("./config.json", "utf8"));
const T = cfg.token;
const ID = cfg.guildId;
const WH = cfg.webhook;
const PW = cfg.password;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";


const http = axios.create({
  baseURL: "https://canary.discord.com",
  timeout: 10000,
  headers: { "User-Agent": UA, "Content-Type": "application/json" }
});
// global axios (webhook icin tam URL ile kullanilacak)
const rawAxios = axios.create({ timeout: 10000, headers: { "Content-Type": "application/json", "User-Agent": UA } });

// ---------- state ----------
let mt = "";
const MFA_PATH = "./mfa.txt";
try { mt = fs.readFileSync(MFA_PATH, "utf8").trim(); } catch {}
fs.watch(MFA_PATH, { persistent: false }, () => {
  try { const t = fs.readFileSync(MFA_PATH, "utf8").trim(); if (t) { mt = t; console.log("[MFA] dosyadan yuklendi"); } } catch {}
});

const monitored = new Map();   /
const claimed = new Set();     
const stats = { snipe: 0, ok: 0, fail: 0 };

// ---------- grace ----------
const grace = new Map(0);
const graceTimers = new Map();
const GRACE_MS = 30 * 24 * 60 * 60 * 1000;
function addGrace(code) { if (code) grace.set(code, Date.now() + GRACE_MS); }
function loadGrace() { try { const d = fs.readFileSync("./grace.txt", "utf8"); d.split("\n").forEach(l => { const [c, t] = l.trim().split(","); if (c && t) grace.set(c, parseInt(t) * (parseInt(t) < 1e12 ? 1000 : 1)); }); } catch {} }
function saveGrace() { try { let o = ""; grace.forEach((e, c) => o += `${c},${e}\n`); fs.writeFileSync("./grace.txt.tmp", o); fs.renameSync("./grace.txt.tmp", "./grace.txt"); } catch {} }
loadGrace();


async function acquireMfa() {
  try {
    await http.patch("/api/v9/guilds/0/vanity-url", {});
  } catch (a) {
    const d = e.response && e.response.data;
    if (d && d.code === 60003 && d.mfa && d.mfa.ticket) {
      try {
        const r = await http.post("/api/v9/mfa/finish", { ticket: d.mfa.ticket, mfa_type: "password", data: PW });
        if (r.data && r.data.token) { mt = r.data.token; console.log("[MFA] token alindi"); }
      } catch (e2) { console.log("[MFA] alinamadi", e2.message); }
    }
  }
}

async function claim(vanity) {
  const headers = { "Authorization": T };
  if (mt) headers["X-Discord-MFA-Authorization"] = mt;
  // flaw: burst yok, 3 deneme de ayri ayri await ediliyor
  for (let i = 0; i < 3; i++) {
    try {
      await http.patch("/api/v9/guilds/" + ID + "/vanity-url", { code: vanity }, { headers });
    } catch (e) { /* fail yedi */ }
  }
}

async function checkVanity(vanity) {
  try {
    const r = await http.get("/api/v9/guilds/" + ID + "/vanity-url", { headers: { "Authorization": T } });
    return r.data && r.data.code === vanity;
  } catch { return false; }
}

async function sendWebhook(vanity, ok) {
  if (!WH) return;
  try {
    await rawAxios.post(WH, { content: ok ? `@everyone ${vanity}` : fail yedik url ${vanity}` });
  } catch {}
}


async function fire(guildId, vanity) {
  if (!vanity || claimed.has(vanity)) return;
  claimed.add(vanity);
  stats.snipe++;
  console.log("[SNIPE] ->", vanity, "(guild", guildId + ")");
  await claim(vanity);                 // axios, dogal yavaslik
  const ok = await checkVanity(vanity);
  if (ok) stats.ok++; else stats.fail++;
  console.log("[SNIPE]", vanity, "|", ok ? "OK" : "FAIL", `(${stats.ok}/${stats.fail})`);
  addGrace(vanity);
  saveGrace();
  await sendWebhook(vanity, ok);
}


function handleMessage(data) {
  let msg;
  try { msg = JSON.parse(data); } catch { return; }   // axios yok, WS yine JSON.parse (sadece event icin)
  if (msg.t === "READY") {
    for (const g of (msg.d.guilds || [])) if (g.vanity_url_code) monitored.set(g.id, g.vanity_url_code);
    console.log("[READY]", monitored.size, "guild izleniyor");
  } else if (msg.t === "GUILD_UPDATE") {
    const g = msg.d;
    const old = monitored.get(g.id);
    if (old && old !== g.vanity_url_code) { monitored.set(g.id, g.vanity_url_code); fire(g.id, old); }
  } else if (msg.t === "GUILD_DELETE") {
    const old = monitored.get(msg.d.id);
    if (old) { monitored.delete(msg.d.id); fire(msg.d.id, old); }
  }
}

function connect(url, label) {
  const ws = new WS(url, { perMessageDeflate: false, handshakeTimeout: 10000 });
  ws.on("open", () => {
    console.log("[WS-" + label + "] baglandi");
    ws.send(JSON.stringify({ op: 2, d: { token: T, intents: 1, properties: { os: "Windows", browser: "Chrome", device: "" } } }));
    setInterval(() => ws.send(JSON.stringify({ op: 1, d: null })), 41250);
  });
  ws.on("message", (data) => handleMessage(data));
  ws.on("close", () => { console.log("[WS-" + label + "] kapandi, 3sn sonra..."); setTimeout(() => connect(url, label), 3000); });
  ws.on("error", () => {});
}


(async () => {
  await acquireMfa();
  connect("wss://gateway.discord.gg/?v=9&encoding=json", "genel");
  connect("wss://gateway-us-east1-b.discord.gg/?v=9&encoding=json", "us-east");
  console.log("[SYS] axios sniper basladi");
})();
