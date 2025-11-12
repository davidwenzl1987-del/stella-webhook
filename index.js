// index.js
import express from "express";
import cors from "cors";
import { AccessToken } from "livekit-server-sdk";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

/**
 * Mint a LiveKit access token.
 * POST /token { "room": "stella-test", "identity": "stella-bot" }
 * Returns: { token, url }
 */
app.post("/token", async (req, res) => {
  try {
    const { room, identity } = req.body;

    if (!room || !identity) {
      return res.status(400).json({
        error: "Missing room or identity field.",
      });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({
        error: "LiveKit API keys not configured on server.",
      });
    }

    const livekitUrl = process.env.LIVEKIT_URL;

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
    });

    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishSources: ["microphone"],
    });

    const token = await at.toJwt();

    return res.json({
      token,
      url: livekitUrl,
    });
  } catch (err) {
    console.error("Token error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/", (req, res) => {
  res.send("Stella webhook running");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Stella webhook running on port ${port}`);
});
