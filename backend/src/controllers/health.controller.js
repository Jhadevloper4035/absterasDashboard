import { databaseHealth } from '../config/db.js';
import { env } from '../config/env.js';

export function getHealth(req, res) {
  const database = databaseHealth();

  res.status(database.state === 'connected' ? 200 : 503).json({
    status: database.state === 'connected' ? 'ok' : 'degraded',
    service: env.appName,
    environment: env.nodeEnv,
    uptimeSeconds: Math.floor(process.uptime()),
    database,
  });
}
