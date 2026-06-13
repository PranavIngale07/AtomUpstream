const express = require('express');
const http = require('http');
const os = require('os');

function getLocalIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}
const LOCAL_IP = getLocalIp();

const { Server } = require('socket.io');
const cors = require('cors');
const { createClient } = require('redis');
const { startMediasoup, getOrCreateRouter } = require('./mediasoup');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const redisClient = createClient({ url: 'redis://localhost:6379/0' });

// State
let rooms = {}; // sessionId -> { peers: { socketId: { transport, producers, consumers } } }

io.on('connection', async (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', async ({ sessionId, participantId }, callback) => {
    // Validate session in Redis
    const isActive = await redisClient.get(`session:${sessionId}:active`);
    if (!isActive) {
      return callback({ error: 'Session is not active' });
    }

    socket.join(sessionId);
    socket.sessionId = sessionId;
    socket.participantId = participantId;

    if (!rooms[sessionId]) {
      rooms[sessionId] = { peers: {} };
    }
    rooms[sessionId].peers[socket.id] = { producers: {}, consumers: {} };

    const router = await getOrCreateRouter(sessionId);
    callback({ rtpCapabilities: router.rtpCapabilities });
  });

  socket.on('getProducers', (callback) => {
    const producers = [];
    if (socket.sessionId && rooms[socket.sessionId]) {
      for (const peerId in rooms[socket.sessionId].peers) {
        if (peerId === socket.id) continue;
        const peerProducers = rooms[socket.sessionId].peers[peerId].producers;
        for (const producerId in peerProducers) {
          producers.push(producerId);
        }
      }
    }
    callback(producers);
  });

  socket.on('createWebRtcTransport', async ({ direction }, callback) => {
    try {
      const router = await getOrCreateRouter(socket.sessionId);
      const transport = await router.createWebRtcTransport({
        listenIps: [{ ip: '0.0.0.0', announcedIp: LOCAL_IP }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });

      transport.on('dtlsstatechange', dtlsState => {
        if (dtlsState === 'closed') transport.close();
      });

      rooms[socket.sessionId].peers[socket.id][direction] = transport;

      callback({
        params: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        }
      });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  socket.on('connectWebRtcTransport', async ({ transportId, dtlsParameters, direction }, callback) => {
    try {
      const transport = rooms[socket.sessionId].peers[socket.id][direction];
      await transport.connect({ dtlsParameters });
      callback({ success: true });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  socket.on('produce', async ({ kind, rtpParameters, appData }, callback) => {
    try {
      const transport = rooms[socket.sessionId].peers[socket.id].send;
      const producer = await transport.produce({ kind, rtpParameters });

      rooms[socket.sessionId].peers[socket.id].producers[producer.id] = producer;

      // Notify others
      socket.to(socket.sessionId).emit('newProducer', {
        producerId: producer.id,
        producerSocketId: socket.id,
        kind: producer.kind
      });

      callback({ id: producer.id });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  socket.on('consume', async ({ producerId, rtpCapabilities }, callback) => {
    try {
      const router = await getOrCreateRouter(socket.sessionId);
      if (!router.canConsume({ producerId, rtpCapabilities })) {
        return callback({ error: 'Cannot consume' });
      }

      const transport = rooms[socket.sessionId].peers[socket.id].recv;
      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true,
      });

      rooms[socket.sessionId].peers[socket.id].consumers[consumer.id] = consumer;

      consumer.on('transportclose', () => {
        consumer.close();
      });
      consumer.on('producerclose', () => {
        socket.emit('producerClosed', { producerId });
        consumer.close();
      });

      callback({
        params: {
          id: consumer.id,
          producerId: producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        }
      });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  socket.on('resume', async ({ consumerId }, callback) => {
    try {
      const consumer = rooms[socket.sessionId].peers[socket.id].consumers[consumerId];
      await consumer.resume();
      callback({ success: true });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (socket.sessionId && rooms[socket.sessionId]) {
      const peer = rooms[socket.sessionId].peers[socket.id];
      if (peer) {
        if (peer.send) peer.send.close();
        if (peer.recv) peer.recv.close();
        delete rooms[socket.sessionId].peers[socket.id];
      }
    }
  });
});

async function main() {
  await redisClient.connect();
  await startMediasoup();
  server.listen(4000, () => {
    console.log('Media server running on port 4000');
  });
}

main();
