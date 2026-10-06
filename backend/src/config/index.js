
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
  console.warn('⚠️ [SECURITY WARNING] JWT_SECRET environment variable is not defined in production. Using fallback secret. Please configure JWT_SECRET in your Vercel project environment variables.');
}

export const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
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
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  appsumo: {
    apiKey: process.env.APPSUMO_API_KEY || '',
    clientId: process.env.APPSUMO_CLIENT_ID || '',
    clientSecret: process.env.APPSUMO_CLIENT_SECRET || '',
    apiBaseUrl: (process.env.APPSUMO_API_BASE_URL || 'https://api.licensing.appsumo.com/v2/').replace(/\/+$/, '') + '/',
    authBaseUrl: (process.env.APPSUMO_AUTH_BASE_URL || 'https://appsumo.com').replace(/\/+$/, ''),
    redirectUri: process.env.APPSUMO_REDIRECT_URI || '',
  },
};
