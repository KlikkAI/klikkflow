// IMPORTANT: Load environment variables from root .env FIRST before any other imports
import './config/env.js';
import { DatabaseConfig } from './config/database';

// Connect to databases
const dbConfig = DatabaseConfig.getInstance();
dbConfig
  .connect()
  .then(() => {})
  .catch((_error) => {
    process.exit(1);
  });

// Keep process alive
process.on('SIGTERM', () => {
  process.exit(0);
});

process.on('SIGINT', () => {
  process.exit(0);
});

// Heartbeat to keep container alive
setInterval(() => {}, 60000); // Log every minute
