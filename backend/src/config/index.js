import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from cwd first, fallback to backend/.env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret && nodeEnv === 'production') {
  throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is required and cannot be empty in production.');
}

export const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv,
  jwt: {
    secret: jwtSecret || 'dev_hrms_secure_instance_key_98472910481239847',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  db: {
    databaseUrl: process.env.DATABASE_URL || '',
    directUrl: process.env.DIRECT_URL || '',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'oroewjgz',
    apiKey: process.env.CLOUDINARY_API_KEY || '851245953754347',
    apiSecret: process.env.CLOUDINARY_API_SECRET || 'WQ8Hd7P0Uk-3NLDxUJ-Ut2r5Ysw',
  },
};
