// index.js
import express from "express";
import dotenv from "dotenv";
import { AccessToken } from "livekit-server-sdk";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Basic sanity check for env
const requireEnv = (name, optional = false) => {
  const v = process.env[name];
  if (!v && !optional) {
    console.warn(`[env] Missing ${name}`);
  }
  return v;
};

const LIVEKIT_URL = requireEnv("LIVEKIT_URL", true);     // e.g., wss://<project>.livekit.cloud
const LIVEKIT_API_KEY = requireEnv("LIVEKIT_API_KEY", true);
const LIVEKIT_API_SECRET = requireEnv("LIVEKIT_API_SECRET", true);

app.use(express.json());

/**
 * Health check
 */
app.get("/", (_req, res) => {
  res.type("text/plain").send("Stella webhook running");
});

/**
 * Simple webhook to see payloads arriving from Wildix (or anything)
 * POST /webhook  { ... }
 */
app.post("/webhook", (req, res) => {
  try {
    console.log("[/webhook] payload:", JSON.stringify(req.body));
    // Echo back something useful for testing
    const text = req.body?.text || req.body?.transcription || null;
    res.status(200).json({ ok: true, received: text, raw: req.body });
  } catch (err) {
    console.error("[/webhook] error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Mint a LiveKit access token.
 * POST /token { "room": "stella-test", "identity": "stella-bot" }
 * Returns: { token, url }
 */
app.post("/token", async (req, res) => {
  try {
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      return res.status(500).json({
        error:
          "LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be set in environment.",
      });
    }

    const { room, identity } = req.body || {};
    if (!room || !identity) {
      return res
        .status(400)
        .json({ error: "room and identity are required in JSON body." });
    }

    // TTL examples: '1h', '30m', '900s'
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      ttl: "1h",
    });

    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    res.json({ token, url: LIVEKIT_URL });
  } catch (err) {
    console.error("[/token] error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Stella webhook listening on :${PORT}`);
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    console.log(
      "ℹ️  LiveKit env not fully set (LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET). /token will error until you add them."
    );
  }
});
