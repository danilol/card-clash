import express from 'express';
import cors from 'cors';

const CLIENT_ORIGIN = 'http://localhost:5173';

export const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: '10kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});
