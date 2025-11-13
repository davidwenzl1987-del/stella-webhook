// src/index.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { AccessToken } from 'livekit-server-sdk';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// LiveKit config
const LIVEKIT_HOST = process.env.LIVEKIT_HOST || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

if (!LIVEKIT_HOST || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.warn(
    '[WARN] LIVEKIT_HOST, LIVEKIT_API_KEY, or LIVEKIT_API_SECRET is not set. ' +
    '/token will return an error until these are configured.'
  );
}

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Stella webhook running');
});

/**
 * Mint a LiveKit access token.
 * POST /token { "room": "stella-test", "identity": "stella-bot" }
 * Returns: { token, url }
 */
app.post('/token', async (req, res) => {
  try {
    const { room, identity } = req.body || {};

    if (!room || !identity) {
      return res.status(400).json({
        error: 'Missing room or identity',
        detail: 'POST body must be { "room": "...", "identity": "..." }'
      });
    }

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(500).json({
        error: 'LiveKit API credentials not configured on server',
        detail: 'Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET in Render env vars'
      });
    }

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity
    });

    at.addGrant({
      roomJoin: true,
      room
    });

    const token = await at.toJwt();

    return res.json({
      token,
      url: LIVEKIT_HOST
    });
  } catch (err) {
    console.error('Error in /token handler:', err);
    return res.status(500).json({
      error: 'Token generation failed',
      detail: err.message || 'Unknown error'
    });
  }
});

app.listen(port, () => {
  console.log(`Stella webhook listening on port ${port}`);
  console.log(`Primary URL: ${process.env.RENDER_EXTERNAL_URL || 'local'}`);
});
