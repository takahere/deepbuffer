import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

async function checkItems() {
  console.log('Checking recent items...');
  const { data, error } = await supabase
    .from('items')
    .select('id, content, source_type, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Recent items:', data);
  }
}

checkItems();



