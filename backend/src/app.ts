import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import readRouter from './routes/read';
import fetchRouter from './routes/fetch';
import discoveryRouter from './routes/discovery';

dotenv.config();

const app = express();

// Safe multi-origin CORS configuration (support port 3002 and configured origin)
const allowedOrigins = new Set([
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  process.env.CORS_ORIGIN || 'http://localhost:5173',
]);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
  })
);
app.use(express.json());

// GET /health — operational health check (API_CONTRACT.md §1)
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// POST /api/read — webpage fetch + extraction (API_CONTRACT.md §2)
app.use('/api', readRouter);

// GET /api/fetch — safe proxy fetch for client-side RSS/Atom parsing & discovery
app.use('/api', fetchRouter);

// Discovery API endpoints (/api/discovery/query, /api/discovery/submit, /api/discovery/popular)
app.use('/api/discovery', discoveryRouter);

// Global fallback error handler to prevent stack traces or unexpected leakages
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Unexpected server-side failure.',
    },
  });
});

export default app;
