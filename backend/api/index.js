import app from '../src/app.js';
import { initDataStore } from '../src/repositories/dataStore.js';

// Initialize data store on cold start
await initDataStore();

export default app;
