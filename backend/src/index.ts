import app from './app';
import { getDatabasePool } from './db/pool';

const PORT = parseInt(process.env.PORT || '3001', 10);

if (process.env.USE_DEMO_DISCOVERY !== 'true') {
  try {
    getDatabasePool();
  } catch (err) {
    console.warn(
      '[startup] Database is unavailable; discovery endpoints will return an explicit error. Demo mode is disabled.',
      err instanceof Error ? err.message : err,
    );
  }
}

app.listen(PORT, () => {
  console.log(`SmallWebReader backend listening on port ${PORT}`);
});
