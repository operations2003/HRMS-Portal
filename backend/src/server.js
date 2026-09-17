import app from './app.js';
import { config } from './config/index.js';
import { initDataStore } from './repositories/dataStore.js';

const startServer = async () => {
  try {
    // Initialize test credentials and repository data store
    await initDataStore();

    app.listen(config.port, () => {
      console.log('====================================================');
      console.log(`🚀 HRMS Portal Backend Server Running`);
      console.log(`📡 Environment : ${config.nodeEnv}`);
      console.log(`🌐 URL         : http://localhost:${config.port}`);
      console.log(`🩺 Health Check: http://localhost:${config.port}/api/v1/health`);
      console.log('====================================================');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Protect server from unexpected remote connection dropouts
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ [Server] Uncaught Exception:', err.message);
});

startServer();
