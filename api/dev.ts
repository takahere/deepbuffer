import { serve } from '@hono/node-server';
import app from './index.js';

console.log('Starting local API server on port 3001...');

serve({
  fetch: app.fetch,
  port: 3001
}, (info) => {
  console.log(`Local API server listening on http://localhost:${info.port}`);
});


