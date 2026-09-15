import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback_secret_for_development_hrms',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
};
