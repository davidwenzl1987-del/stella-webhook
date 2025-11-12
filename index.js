// ---- LiveKit WebRTC adapter for Node (Windows-friendly) ----
import dotenv from 'dotenv';
dotenv.config();

let adapterReady = false;
try {
  const rtc = await import('@livekit/rtc-node');   // ESM dynamic import
  if (typeof rtc.registerGlobals === 'function') {
    rtc.registerGlobals();
    adapterReady = true;
    console.log('LiveKit rtc-node: registerGlobals() applied');
  } else if (typeof rtc.register === 'function') {
    rtc.register();
    adapterReady = true;
    console.log('LiveKit rtc-node: register() applied');
  } else if (typeof rtc.install === 'function') {
    rtc.install();
    adapterReady = true;
    console.log('LiveKit rtc-node: install() applied');
  }
} catch (e) {
  // ignore; we check adapterReady next
}

if (!adapterReady) {
  console.error(
    '❌ Could not initialize @livekit/rtc-node. ' +
    'Make sure it installed correctly: `npm i @livekit/rtc-node@latest`'
  );
  process.exit(1);
}

// ---- LiveKit bot scaffold ----
import { Room, RoomEvent } from 'livekit-client';
import { AccessToken } from 'livekit-server-sdk';

const LIVEKIT_URL     = process.env.LIVEKIT_URL;        // wss://<your>.livekit.cloud
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_SECRET  = process.env.LIVEKIT_API_SECRET;
const ROOM_NAME       = process.env.ROOM_NAME || 'stella';
const BOT_IDENTITY    = process.env.PARTICIPANT_NAME || 'stella-bot';

['LIVEKIT_URL','LIVEKIT_API_KEY','LIVEKIT_API_SECRET'].forEach(k=>{
  if (!process.env[k]) { console.error(`❌ Missing ${k} in .env`); process.exit(1); }
});

async function token() {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_SECRET, { identity: BOT_IDENTITY, ttl: 600 });
  at.addGrant({ roomJoin: true, room: ROOM_NAME });
  return at.toJwt();
}

async function main() {
  console.log('🔌 Connecting to LiveKit…');
  const room = new Room();
  await room.connect(LIVEKIT_URL, await token());
  console.log(`✅ Joined room "${room.name}" as "${BOT_IDENTITY}"`);

  room
    .on(RoomEvent.ParticipantConnected, (p) => console.log(`👥 Participant connected: ${p.identity}`))
    .on(RoomEvent.ParticipantDisconnected, (p) => console.log(`👋 Participant disconnected: ${p.identity}`))
    .on(RoomEvent.ActiveSpeakersChanged, (s) => {
      const names = s.map(x=>x.identity).join(', ') || '(none)';
      console.log(`🎙️  Active speakers: ${names}`);
    })
    .on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
      console.log(`🔊 Track subscribed: kind=${track.kind} from ${participant.identity}`);
      if (track.kind === 'audio') {
        console.log('🟢 Audio stream is live. (SIP audio reached the room)');
        // Next: wire this audio to OpenAI Realtime STT + TTS
      }
    })
    .on(RoomEvent.TrackUnsubscribed, (_t, _p, participant) =>
      console.log(`🔇 Track unsubscribed from ${participant.identity}`)
    )
    .on(RoomEvent.Disconnected, () => console.log('🔌 Disconnected from LiveKit.'));

  process.on('SIGINT', () => { console.log('\n⏹️  Shutting down…'); room.disconnect(); process.exit(0); });
}

main().catch((e)=>{ console.error('💥 Failed to connect:', e); process.exit(1); });
