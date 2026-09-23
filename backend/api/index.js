import app from '../src/app.js';
import { initDataStore } from '../src/repositories/dataStore.js';

// Protect serverless instance from unhandled rejections crashing the container
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [Serverless] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ [Serverless] Uncaught Exception:', err.message);
});

let isInitialized = false;

export default async function handler(req, res) {
  if (!isInitialized) {
    try {
      await initDataStore();
      isInitialized = true;
    } catch (err) {
      console.warn('⚠️ [DataStore] Cold start initialization warning:', err.message);
    }
  }
  return app(req, res);
}

