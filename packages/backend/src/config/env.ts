/**
 * Environment Configuration Loader
 * Must be imported first before any other modules
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from workspace root
// This MUST happen before any other imports that use process.env
dotenv.config({ path: resolve(__dirname, '../../../../.env') });

// Export for convenience
export const env = process.env;
