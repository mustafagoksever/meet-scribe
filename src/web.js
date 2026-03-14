import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import EventEmitter from 'events';
import open from 'open';
import { listTemplates } from './templates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let wss = null;
export const webEvents = new EventEmitter();

export function startWebServer(port, config) {
  const app = express();
  const server = http.createServer(app);
  wss = new WebSocketServer({ server });

  const publicDir = path.join(__dirname, '..', 'public');
  const outputDir = path.resolve(config?.output || './meet-scribe-output');

  app.use(express.static(publicDir));
  app.use(express.json());

  app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  // ── REST API ─────────────────────────────

  /**
   * GET /api/meetings — List all meetings
   */
  app.get('/api/meetings', (req, res) => {
    try {
      if (!fs.existsSync(outputDir)) {
        return res.json([]);
      }

      const files = fs.readdirSync(outputDir)
        .filter(f => f.startsWith('meeting_') && f.endsWith('.md'))
        .sort()
        .reverse();

      const meetings = files.map(file => {
        const filePath = path.join(outputDir, file);
        const stat = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf-8');

        const dateMatch = content.match(/\*\*Date:\*\*\s*(.+)/);
        const durMatch = content.match(/\*\*Duration:\*\*\s*(.+)/);
        const toneMatch = content.match(/\*\*Tone:\*\*\s*(.+)/);
        const summaryMatch = content.match(/## 📌 Summary\s*\n\s*\n(.+)/);

        return {
          id: file.replace('.md', ''),
          filename: file,
          date: dateMatch ? dateMatch[1].trim() : stat.mtime.toISOString(),
          duration: durMatch ? durMatch[1].trim() : '?',
          tone: toneMatch ? toneMatch[1].trim() : 'neutral',
          summary: summaryMatch ? summaryMatch[1].trim().slice(0, 200) : '',
          size: stat.size,
        };
      });

      res.json(meetings);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/meetings/:id — Get single meeting content
   */
  app.get('/api/meetings/:id', (req, res) => {
    try {
      const filename = req.params.id.endsWith('.md') ? req.params.id : `${req.params.id}.md`;
      const filePath = path.join(outputDir, filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Meeting not found' });
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      res.json({ id: req.params.id, filename, content });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/search?q=query — Search across meetings
   */
  app.get('/api/search', (req, res) => {
    try {
      const query = req.query.q;
      if (!query) return res.json([]);

      if (!fs.existsSync(outputDir)) {
        return res.json([]);
      }

      const files = fs.readdirSync(outputDir)
        .filter(f => f.startsWith('meeting_') && f.endsWith('.md'))
        .sort()
        .reverse();

      const queryLower = query.toLowerCase();
      const results = [];

      for (const file of files) {
        const filePath = path.join(outputDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        if (content.toLowerCase().includes(queryLower)) {
          const lines = content.split('\n');
          const matches = [];

          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(queryLower)) {
              matches.push({ lineNum: i + 1, text: lines[i].trim() });
            }
          }

          const dateMatch = content.match(/\*\*Date:\*\*\s*(.+)/);

          results.push({
            id: file.replace('.md', ''),
            filename: file,
            date: dateMatch ? dateMatch[1].trim() : '',
            matchCount: matches.length,
            matches: matches.slice(0, 5),
          });
        }
      }

      res.json(results);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/templates — List available templates
   */
  app.get('/api/templates', (req, res) => {
    const lang = req.query.lang || 'tr';
    const templates = listTemplates(lang);
    res.json(templates);
  });

  // ── WebSocket ─────────────────────────────

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'status', payload: 'Connected to MeetScribe Web Dashboard' }));

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'action') {
          if (data.payload === 'start') {
            webEvents.emit('start', { 
              template: data.template || 'default',
              lang: data.lang || 'tr'
            });
          } else {
            webEvents.emit(data.payload); // 'pause', 'resume', 'stop'
          }
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
