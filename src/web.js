import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import EventEmitter from 'events';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let wss = null;
export const webEvents = new EventEmitter();

export function startWebServer(port) {
  const app = express();
  const server = http.createServer(app);
  wss = new WebSocketServer({ server });

  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));

  app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'status', payload: 'Connected to MeetScribe Web Dashboard' }));

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'action') {
          webEvents.emit(data.payload); // 'pause', 'resume', 'stop'
        }
      } catch (err) {
        // ignore
      }
    });
  });

  // Handle server errors silently if port is in use
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(chalk.yellow(`\n⚠ Port ${port} is in use. Web Dashboard failed to start.`));
    } else {
      console.error(chalk.red(`\n⚠ Web Dashboard error: ${err.message}`));
    }
  });

  server.listen(port, '0.0.0.0', () => {
    import('os').then(os => {
      const interfaces = os.networkInterfaces();
      const addresses = [];
      for (const k in interfaces) {
        for (const k2 in interfaces[k]) {
          const address = interfaces[k][k2];
          if (address.family === 'IPv4' && !address.internal) {
            addresses.push(address.address);
          }
        }
      }
      console.log(chalk.cyan(`\n🌐 Web Dashboard running at:`));
      console.log(chalk.cyan(`   Local:   http://localhost:${port}`));
      if (addresses.length > 0) {
        console.log(chalk.cyan(`   Network: http://${addresses[0]}:${port}`));
      }

      // Auto-open browser
      open(`http://localhost:${port}`).catch(() => {});
    });
  });

  return server;
}

/**
 * Broadcast message to all connected WebSocket clients
 * @param {string} type 'transcript', 'summary', 'status', 'pause', 'resume'
 * @param {any} payload Data to send
 */
export function broadcastMessage(type, payload) {
  if (!wss) return;
  const msg = JSON.stringify({ type, payload });
  for (const client of wss.clients) {
    if (client.readyState === 1) { // OPEN
      client.send(msg);
    }
  }
}
