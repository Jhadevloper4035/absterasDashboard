import dotenv from 'dotenv';

dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

const required = ['AUTH_SECRET', 'MONGODB_URI'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  throw new Error(`Missing required env: ${missing.join(', ')}`);
}

export const env = {
  appName: process.env.APP_NAME || 'Absteras Facade Company CRM API',
  authSecret: process.env.AUTH_SECRET,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  isProduction: process.env.NODE_ENV === 'production',
  mongoUri: process.env.MONGODB_URI,
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  s3: {
    bucket: process.env.S3_BUCKET,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    region: process.env.AWS_REGION || 'us-east-1',
    uploadPrefix: process.env.S3_UPLOAD_PREFIX || 'uploads',
  },
};
