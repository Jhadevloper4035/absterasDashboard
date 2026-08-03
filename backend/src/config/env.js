import dotenv from 'dotenv';

const envFile = process.env.NODE_ENV === 'production' ? '.env' : `.env.${process.env.NODE_ENV || 'development'}`;

dotenv.config({ path: `../${envFile}` });
dotenv.config({ path: envFile });

const required = ['AUTH_SECRET', 'MONGODB_URI'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  throw new Error(`Missing required env: ${missing.join(', ')}`);
}

const isProduction = process.env.NODE_ENV === 'production';
const weakSecretPattern = /^(replace-with|change-me|development)/i;

if (isProduction) {
  const weak = [];
  if (process.env.AUTH_SECRET.length < 32 || weakSecretPattern.test(process.env.AUTH_SECRET)) weak.push('AUTH_SECRET');
  if (!process.env.SETUP_TOKEN || process.env.SETUP_TOKEN.length < 24 || weakSecretPattern.test(process.env.SETUP_TOKEN)) weak.push('SETUP_TOKEN');
  if (weak.length) throw new Error(`Weak production env: ${weak.join(', ')}`);
}

export const env = {
  appName: process.env.APP_NAME || 'Absteras Company CRM API',
  authSecret: process.env.AUTH_SECRET,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  isProduction,
  mongoUri: process.env.MONGODB_URI,
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  setupToken: process.env.SETUP_TOKEN,
  smtp: {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    host: process.env.SMTP_HOST,
    pass: process.env.SMTP_PASS,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    timeoutMs: Number(process.env.SMTP_TIMEOUT_MS || 5000),
    user: process.env.SMTP_USER,
  },
  s3: {
    bucket: process.env.S3_BUCKET,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    region: process.env.AWS_REGION || 'us-east-1',
    uploadPrefix: process.env.S3_UPLOAD_PREFIX || 'uploads',
  },
};
