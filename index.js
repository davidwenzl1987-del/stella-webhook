import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json());

// quick health check
app.get('/', (req, res) => res.send('Stella webhook running'));

// main webhook endpoint Wildix will call
app.post('/webhook', async (req, res) => {
  try {
    console.log('Incoming webhook payload:', JSON.stringify(req.body));
    // for now just echo back something so you see it works
    const text = req.body?.text || req.body?.transcription || 'no text';
    return res.json({ ok: true, received: text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webhook listening on :${PORT}`));
