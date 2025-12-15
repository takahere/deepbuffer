import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import { generateSummary } from './aiService.js';
import { fetchSlackMessages } from './slackService.js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// Reusable Batch Summarization Logic
export const runBatchSummarization = async () => {
  if (!supabase) {
    console.error('DB not configured for summarization');
    return null;
  }

  // 0. Poll Slack Messages (Polling is stateless, fetches for all workspaces)
  console.log('[Scheduler] Starting Slack Polling...');
  await fetchSlackMessages();

  // 1. Get all users who have pending items
  // We want to process each user individually to respect their custom instructions and separate summaries
  const { data: usersWithPendingItems, error: userError } = await supabase
    .from('items')
    .select('user_id')
    .eq('status', 'pending')
    .order('user_id');

  if (userError) {
    console.error('[Scheduler] Fetch Users Error:', userError);
    return null;
  }

  if (!usersWithPendingItems || usersWithPendingItems.length === 0) {
    console.log('[Scheduler] No pending items to summarize for any user');
    return { count: 0 };
  }

  // Unique users
  const userIds = [...new Set(usersWithPendingItems.map(u => u.user_id))];
  console.log(`[Scheduler] Found ${userIds.length} users with pending items.`);

  const summaryResults = [];

  for (const userId of userIds) {
    console.log(`[Scheduler] Processing summary for user ${userId}...`);
    
    // 1. Fetch pending items for this user
    const { data: items, error: fetchError } = await supabase
        .from('items')
        .select('id, content, created_at')
        .eq('status', 'pending')
        .eq('user_id', userId)
        .limit(50); // Limit per user per batch

    if (fetchError || !items || items.length === 0) {
        console.warn(`[Scheduler] No items or error for user ${userId}:`, fetchError);
        continue;
    }

    const messages = items.map(item => item.content);

    // 1.5 Fetch user settings for custom instructions
    const { data: settings } = await supabase
        .from('user_settings')
        .select('report_custom_instructions')
        .eq('user_id', userId)
        .single();

    const customInstructions = settings?.report_custom_instructions || undefined;

    // 2. Generate Summary
    const result = await generateSummary(messages, customInstructions);
    
    if (!result) {
        console.error(`[Scheduler] AI Summarization failed for user ${userId}`);
        continue;
    }

    // 3. Save Summary
    const itemIds = items.map(i => i.id);
    const { error: saveError } = await supabase
        .from('summaries')
        .insert({
        summary_text: result.summaryText,
        target_items: itemIds, 
        user_id: userId
        });

    if (saveError) {
        console.error(`[Scheduler] Save Summary Error for user ${userId}:`, saveError);
        continue;
    }

    // 4. Update Items Status
    const { error: updateError } = await supabase
        .from('items')
        .update({ status: 'summarized' })
        .in('id', itemIds);

    if (updateError) {
        console.error(`[Scheduler] Update Status Error for user ${userId}:`, updateError);
    }

    summaryResults.push({
        userId,
        processed: items.length,
        summary: result.summaryText
    });
  }

  return { 
    success: true, 
    totalUsersProcessed: summaryResults.length,
    details: summaryResults
  };
};

// Retention Policy: Delete items older than 7 days
export const runRetentionPolicy = async () => {
  if (!supabase) return;
  
  console.log('[Scheduler] Running retention policy...');
  
  // 7 days ago
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - 7);
  
  try {
    const { count, error } = await supabase
      .from('items')
      .delete({ count: 'exact' })
      .lt('created_at', dateThreshold.toISOString())
      .in('status', ['archived', 'done', 'summarized'])
      .neq('source_type', 'web'); // Keep Link Pocket items
    
    if (error) {
      console.error('[Scheduler] Retention Error:', error);
    } else {
      console.log(`[Scheduler] Deleted ${count} old items.`);
    }
  } catch (e) {
    console.error('[Scheduler] Retention Exception:', e);
  }
};

// Initialize Cron Jobs
export const initScheduler = () => {
  console.log('Initializing Scheduler...');

  // Schedule: 8:00, 13:00, 19:00
  const scheduleTimes = ['0 8 * * *', '0 13 * * *', '0 19 * * *'];

  scheduleTimes.forEach(time => {
    cron.schedule(time, async () => {
      console.log(`[Cron] Running scheduled summarization at ${new Date().toISOString()}`);
      await runBatchSummarization();
    });
  });

  // Schedule: Cleanup at 04:00 AM daily
  cron.schedule('0 4 * * *', async () => {
    await runRetentionPolicy();
  });
  
  console.log('Scheduler initialized with times:', scheduleTimes.join(', '), 'and daily cleanup at 04:00');
};
