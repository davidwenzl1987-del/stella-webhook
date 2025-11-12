import 'dotenv/config';
import express from "express";
import bodyParser from "body-parser";
import crypto from "crypto";
import { OpenAI } from "openai";

const app = express();
// Keep raw body for signature verification
app.use(bodyParser.json({ type: "*/*", verify: (req, res, buf) => { req.rawBody = buf } }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SECRET = process.env.WILDIX_SHARED_SECRET;

// Per-call memory (very light state)
const calls = new Map(); // callId -> { lastLang: "en"|"es" }

function verifySignature(req) {
  const sig = req.header("x-signature");
  if (!sig) return false;
  const hmac = crypto.createHmac("sha256", SECRET).update(req.rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(hmac));
}

// Simple language detection
function detectLang(text) {
  // very fast heuristic first
  const hasTilde = /[ñáéíóúü¡¿]/i.test(text);
  const likelyEs = hasTilde || /\b(yo|usted|hola|buen[oa]s|gracias|por favor|señor[ae]?|niñ[oa]|dolor|cabeza|estómago|hijo|hija)\b/i.test(text);
  return likelyEs ? "es" : "en";
}

// Normalize frequent Spanish ASR errors (quick wins)
function normalizeSpanish(s) {
  return s
    .replace(/\bmio\b|\bmi o\b|\bmiyo\b/gi, "mi hijo")
    .replace(/\bmia\b|\bmi a\b|\bmija\b/gi, "mi hija")
    .replace(/\bmami\b|\bmamy\b/gi, "mamá")
    .replace(/\bpapi\b|\bpapy\b/gi, "papá")
    .replace(/\btienne\b|\btienee\b/gi, "tiene")
    .replace(/\bhedga\b/gi, "cabeza");
}

// Ask OpenAI to translate with strict rules
async function translateOpposite(text, inputLang) {
  const target = inputLang === "es" ? "English" : "Spanish";
  const sys = `
You are Stella, a clinical phone interpreter.
Translate the user's message into ${target} ONLY.
- Be concise, neutral, and accurate.
- Do not add commentary or greetings.
- Output one clean sentence or short paragraphs as needed, no quotes.
`;
  const user = inputLang === "es" ? normalizeSpanish(text) : text;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini-2024-07-18",
    temperature: 0.2,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user }
    ]
  });

  return resp.choices[0].message.content.trim();
}

app.post("/wildix/webhook", async (req, res) => {
  try {
    if (!verifySignature(req)) return res.status(401).json({ error: "bad signature" });

    const evt = req.body;
    // Expect fields like: {type, data:{ callId, text, status, speaker, ... }}
    const type = evt?.type;

    if (type === "call:start") {
      const callId = evt.data?.callId;
      if (callId) calls.set(callId, { lastLang: "en" });
      // Acknowledge fast
      return res.json({ ok: true });
    }

    if (type === "call:end") {
      const callId = evt.data?.callId;
      if (callId) calls.delete(callId);
      return res.json({ ok: true });
    }

    if (type === "call:update") {
      const callId = evt.data?.callId;
      const text = (evt.data?.stt?.text || evt.data?.text || "").trim();

      // If no new text, ack
      if (!text) return res.json({ ok: true });

      // Detect input language and translate to the opposite
      const lang = detectLang(text); // "es" or "en"
      if (callId && calls.has(callId)) calls.get(callId).lastLang = lang;

      const translated = await translateOpposite(text, lang);

      // Respond in Wildix expected format (text reply)
      return res.json({
        reply: { type: "text", text: translated }
      });
    }

    // Unknown or unhandled → ack
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    // Fail closed but don't drop the call
    return res.status(200).json({ reply: { type: "text", text: "One moment please." } });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Stella webhook on :${port}`));
