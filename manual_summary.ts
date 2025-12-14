import { runBatchSummarization } from './api/services/cronService.js';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// Ensure Service Role Key is used
process.env.SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

console.log('Running manual summarization...');

runBatchSummarization()
  .then((result) => {
    console.log('Summarization complete:', JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error('Summarization failed:', err);
    process.exit(1);
  });
