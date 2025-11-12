// src/index.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { AccessToken, VideoGrant } = require('livekit-server-sdk');

const app = express();
const PORT = process.env.PORT || 3000;

// === LiveKit config from env ===
// LIVEKIT_HOST  → e.g. wss://your-project-id.livekit.cloud
// LIVEKIT_API_KEY
// LIVEKIT_API_SECRET
const LIVEKIT_HOST = process.env.LIVEKIT_HOST;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

if (!LIVEKIT_HOST || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.warn(
    '[WARN] LIVEKIT_HOST, LIVEKIT_API_KEY, or LIVEKIT_API_SECRET is not set. ' +
      '/token will fail until these are configured.'
  );
}

app.use(cors());
app.use(express.json());

// Simple health check
app.get('/', (req, res) => {
  res.send('Stella webhook running');
});

/**
 * Mint a LiveKit access token.
 *
 * POST /token
 * {
 *   "room": "stella-test",
 *   "identity": "stella-bot"
 * }
 *
 * Response:
 * {
 *   "token": "<jwt>",
 *   "url": "wss://your-project.livekit.cloud"
 * }
 */
app.post('/token', (req, res) => {
  try {
    const { room, identity, metadata } = req.body || {};

    if (!room || !identity) {
      return res.status(400).json({
        error: 'Both "room" and "identity" are required in the JSON body.',
      });
    }

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_HOST) {
      return res.status(500).json({
        error:
          'Server missing LIVEKIT_HOST / LIVEKIT_API_KEY / LIVEKIT_API_SECRET env vars.',
      });
    }

    // Create an access token
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });

    // Grant: allow this identity to join the given room
    const grant = new VideoGrant({
      room,
      roomJoin: true,
    });

    at.addGrant(grant);

    const token = at.toJwt();

    res.json({
      token,
      url: LIVEKIT_HOST,
    });
  } catch (err) {
    console.error('[ERROR] /token failed:', err);
    res.status(500).json({ error: 'Failed to create LiveKit token.' });
  }
});

app.listen(PORT, () => {
  console.log(`Stella webhook listening on port ${PORT}`);
});
