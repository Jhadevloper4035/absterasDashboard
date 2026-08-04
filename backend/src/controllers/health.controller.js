import { databaseHealth } from '../config/db.js';
import { env } from '../config/env.js';
import { emailHealth, sendNotificationEmail } from '../services/email.service.js';

export async function getHealth(req, res) {
  const database = databaseHealth();
  const email = await emailHealth();

  res.status(database.state === 'connected' ? 200 : 503).json({
    status: database.state === 'connected' ? 'ok' : 'degraded',
    service: env.appName,
    environment: env.nodeEnv,
    uptimeSeconds: Math.floor(process.uptime()),
    database,
    email,
  });
}

export async function getHealthStatus(req, res) {
  const database = databaseHealth();
  const email = await emailHealth({ verify: true });
  const services = {
    api: { status: 'ok', uptimeSeconds: Math.floor(process.uptime()) },
    database,
    email,
    logs: {
      status: 'unavailable',
      message: 'Runtime logs are not stored in the CRM yet. Use Docker logs or a log collector for production error/warning history.',
    },
  };
  const status = database.state === 'connected' && email.status === 'ok' ? 'ok' : 'degraded';

  res.status(status === 'ok' ? 200 : 503).json({
    status,
    service: env.appName,
    environment: env.nodeEnv,
    checkedAt: new Date().toISOString(),
    services,
  });
}

export async function sendHealthTestEmail(req, res) {
  const to = req.user?.email;
  if (!to) return res.status(400).json({ error: { message: 'Current user email is missing' } });

  const result = await sendNotificationEmail({
    to,
    title: 'CRM email test',
    body: `Email delivery test from ${env.appName} at ${new Date().toISOString()}`,
    metadata: { type: 'default' },
  });

  if (result?.skipped) return res.status(503).json({ error: { message: 'Email is not configured' } });
  return res.json({ data: { ok: true, to } });
}
