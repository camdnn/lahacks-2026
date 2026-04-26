import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import sessionsRouter from './routes/sessions.js';
import eventsRouter   from './routes/events.js';
import stateRouter    from './routes/state.js';
import downloadRouter from './routes/download.js';

const app = express();

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'app://.',              // Electron renderer
];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (e.g. curl, Electron main process, Python)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/sessions',  sessionsRouter);
app.use('/events',    eventsRouter);
app.use(stateRouter);    // /state  /state/push  /cv/push
app.use(downloadRouter); // /download/overlay

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', ts: new Date().toISOString() })
);

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () =>
  console.log(`[Bloom] Express backend → http://localhost:${PORT}`)
);
