const mediasoup = require('mediasoup');

let worker;
let routers = new Map(); // session_id -> router

async function startMediasoup() {
  worker = await mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
  });

  worker.on('died', () => {
    console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
    setTimeout(() => process.exit(1), 2000);
  });
  console.log('Mediasoup worker started');
}

async function getOrCreateRouter(sessionId) {
  if (routers.has(sessionId)) {
    return routers.get(sessionId);
  }

  const router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000
        }
      }
    ]
  });

  routers.set(sessionId, router);
  return router;
}

module.exports = { startMediasoup, getOrCreateRouter };
