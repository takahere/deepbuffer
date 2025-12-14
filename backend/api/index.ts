import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { generateSummary, generateReplyDraft, askAboutSummary } from '../../services/aiService';
import { fetchSlackMessages, getUserInfo, sendSlackMessage } from '../../services/slackService';
import { runBatchSummarization, initScheduler, runRetentionPolicy } from '../../services/cronService';

dotenv.config();

const app = new Hono().basePath('/api');

// Initialize Scheduler (Only in local dev or long-running process, not in Vercel Serverless)
// Vercel Serverless spins up/down, so node-cron won't persist reliable schedules.
// We use Vercel Cron to hit API endpoints instead.
if (process.env.VERCEL !== '1') {
  initScheduler();
}

// Middleware
app.use('/*', cors());

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// Helper: Slack Signature Verification
const verifySlackSignature = async (req: Request, body: string) => {
  const signature = req.headers.get('x-slack-signature');
  const timestamp = req.headers.get('x-slack-request-timestamp');
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!signature || !timestamp || !signingSecret) return false;

  // Prevent replay attacks (5 mins)
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp) < fiveMinutesAgo) return false;

  const sigBasestring = 'v0:' + timestamp + ':' + body;
  const mySignature = 'v0=' + crypto.createHmac('sha256', signingSecret)
    .update(sigBasestring, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(mySignature, 'utf8'),
    Buffer.from(signature, 'utf8')
  );
};

// Health Check
app.get('/health', async (c) => {
  return c.json({ status: 'ok', service: 'deepbuffer-backend' });
});

// Get Connected Workspaces
app.get('/workspaces', async (c) => {
  if (!supabase) return c.json({ error: 'DB not configured' }, 500);
  
  const { data, error } = await supabase
    .from('workspaces')
    .select('team_id, team_name, icon_url'); // Don't expose access_token
    
  if (error) return c.json({ error: error.message }, 500);
  
  // Map to frontend Workspace type
  const workspaces = data.map(ws => ({
    id: ws.team_id, // internal ID used in frontend
    slackTeamId: ws.team_id,
    name: ws.team_name || 'Unknown Workspace',
    iconUrl: ws.icon_url || '', // Could use default icon if empty
  }));

  return c.json({ workspaces });
});

// OAuth Callback
app.get('/auth/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) return c.text('No code provided', 400);

  // Exchange code for token
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;

  if (!clientId || !clientSecret) return c.text('Server config error', 500);

  try {
    const params = new URLSearchParams();
    params.append('code', code);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    // Add redirect_uri to match frontend request
    // Uses APP_BASE_URL env var (e.g. https://myapp.vercel.app) or defaults for dev
    const baseUrl = process.env.APP_BASE_URL || 'https://82485ac4722f.ngrok-free.app'; 
    params.append('redirect_uri', `${baseUrl}/api/auth/callback`);

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    const data = await response.json();
    console.log('Slack OAuth Response:', JSON.stringify(data, null, 2)); // Debug logging

    if (!data.ok) return c.text(`OAuth Error: ${data.error}`, 400);

    // Determine access token (User Token flow vs Bot Token flow)
    // For User Token flow with 'v2/oauth', the token is usually in 'authed_user.access_token' 
    // BUT for pure user apps, sometimes it is top level if acting as user.
    // Let's check both.
    const accessToken = data.access_token || data.authed_user?.access_token;

    if (!accessToken) {
      console.error('Missing access_token in response:', data);
      return c.text('OAuth Error: No access token received', 500);
    }

    // Save to Supabase
    if (supabase) {
      // 1. Upsert Workspace (using team_id as key)
      const { error: wsError } = await supabase.from('workspaces').upsert({
        team_id: data.team.id,
        access_token: accessToken, // Use the resolved token
        team_name: data.team.name, // Save team name
        icon_url: data.team.id // No direct icon in basic auth response, need extra call or just save ID
        // To get icon, we might need 'team.info' API call, but let's stick to basic for now.
        // Or store a placeholder.
      }, { onConflict: 'team_id' });

      if (wsError) {
        console.error('DB Workspace Error:', wsError);
        return c.text('Database Error (Workspace)', 500);
      }

      // 2. Fetch Team Info to get Icon (Optional enhancement)
      // try {
      //   const teamRes = await fetch(`https://slack.com/api/team.info?team=${data.team.id}`, {
      //      headers: { Authorization: `Bearer ${data.access_token}` } 
      //   });
      //   const teamData = await teamRes.json();
      //   if (teamData.ok && teamData.team.icon) {
      //      await supabase.from('workspaces').update({ 
      //        icon_url: teamData.team.icon.image_132 
      //      }).eq('team_id', data.team.id);
      //   }
      // } catch (e) { console.error('Team Info fetch failed', e); }
    }

    return c.text('Success! Workspace connected.');
  } catch (e) {
    console.error(e);
    return c.text('Internal Server Error', 500);
  }
});

// Webhook Endpoint
app.post('/webhook/slack', async (c) => {
  const rawBody = await c.req.text();
  
  const body = JSON.parse(rawBody);

  // Debug: basic event info
  console.log('[Webhook] Incoming event', {
    type: body.type,
    eventType: body?.event?.type,
    channel: body?.event?.channel,
    ts: body?.event?.ts,
  });

  // URL Verification (Handshake)
  if (body.type === 'url_verification') {
    return c.text(body.challenge);
  }

  // Verify Signature for other events
  const isValid = await verifySlackSignature(c.req.raw, rawBody);
  if (!isValid) {
    console.warn('[Webhook] Invalid signature');
    return c.text('Invalid signature', 401);
  }

  // Event Handling
  if (body.event) {
    const { type, text, user, bot_id, ts, channel } = body.event;

    // Ignore bot messages
    if (bot_id || (body.event.subtype === 'bot_message')) {
      console.log('[Webhook] Skipping bot message');
      return c.json({ ok: true });
    }

    if (type === 'message' && !body.event.subtype) {
      console.log('[Webhook] Handling message', { channel, ts, user });

      // User Info Fetching (New)
      let userName = user;
      let userAvatar = '';
      
      try {
          // Slack API call to get user info (or use cache if implemented)
          // For now, simple fetch
          const userInfo = await getUserInfo(user);
          if (userInfo) {
              userName = userInfo.name;
              userAvatar = userInfo.avatar;
          }
      } catch (e) {
          console.error('Failed to fetch user info for webhook:', e);
      }

      // Save to Items
      if (supabase) {
        // Use waitUntil to not block response
        console.log('Saving to DB...');
        try {
          const { error } = await supabase.from('items').insert({
              source_type: 'slack',
              content: text,
              meta_data: {
                user,
                user_name: userName, // Added
                user_avatar: userAvatar, // Added
                channel,
                ts,
                team: body.team_id
              },
              status: 'pending'
          });
          if (error) {
            console.error('[Webhook] DB Insert Error:', error);
          } else {
            console.log('[Webhook] Saved to DB successfully');
          }
        } catch (dbErr) {
          console.error('[Webhook] DB Insert Exception:', dbErr);
        }
      }
    }
  }

  return c.json({ ok: true });
});

// --- Frontend Endpoints ---

// Get Latest Summary
app.get('/summaries/latest', async (c) => {
  if (!supabase) return c.json({ error: 'DB not configured' }, 500);

  const { data, error } = await supabase
    .from('summaries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found" which is fine (null)
    return c.json({ error: error.message }, 500);
  }

  // Parse keyTopics if stored as JSON/Array text, or use directly if array
  return c.json(data || null);
});

// Get Pending Items Count (for Focus Mode)
app.get('/items/pending/count', async (c) => {
  if (!supabase) return c.json({ error: 'DB not configured' }, 500);

  const { count, error } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ count });
});

// Get Items (with optional status filter)
app.get('/items', async (c) => {
  if (!supabase) return c.json({ error: 'DB not configured' }, 500);

  const status = c.req.query('status');
  let query = supabase
    .from('items')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (status) {
    query = query.eq('status', status);
  } else {
    // Default: show processed items (review mode) + pending (if any)
    // Actually for review mode, we might want everything not archived
    query = query.neq('status', 'archived');
  }

  const { data, error } = await query.limit(50);

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// Items: Archive All (New)
app.post('/items/archive-all', async (c) => {
  if (!supabase) return c.json({ error: 'DB not configured' }, 500);

  const body = await c.req.json().catch(() => ({}));
  const { workspaceId } = body;

  let query = supabase
    .from('items')
    .update({ status: 'archived' })
    .neq('status', 'archived'); // Only update non-archived items

  if (workspaceId && workspaceId !== 'all') {
    // Assuming team_id is stored in meta_data->>team
    // Postgres JSONB query syntax via Supabase
    // Note: Supabase .eq() on json column might need arrow syntax or .filter
    // For jsonb column 'meta_data', we can use .contains or filter
    // But easiest is filter 'meta_data->>team', 'eq', workspaceId
    // Supabase JS client syntax:
    query = query.eq('meta_data->>team', workspaceId);
  }

  const { error, count } = await query.select('id', { count: 'exact' });

  if (error) {
    console.error('Archive All Error:', error);
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true, count });
});

import * as cheerio from 'cheerio';

// Items: Create (New - for Link Pocket)
app.post('/items/create', async (c) => {
  if (!supabase) return c.json({ error: 'DB not configured' }, 500);

  const body = await c.req.json();
  const { content, sourceType } = body;

  if (!content) {
    return c.json({ error: 'Missing content' }, 400);
  }

  // Fetch OGP Data if it's a web link
  let metaData = {
    created_via: 'api',
    og_title: '',
    og_description: '',
    og_image: '',
    og_site_name: ''
  };

  if (sourceType === 'web_clip' || !sourceType) {
    try {
      // Basic URL validation
      const url = new URL(content); 
      
      // Twitter / X oEmbed Handler
      if (url.hostname.includes('twitter.com') || url.hostname.includes('x.com')) {
        const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(content)}&omit_script=true`;
        const twRes = await fetch(oembedUrl);
        if (twRes.ok) {
          const twData = await twRes.json();
          // Extract text from HTML block (simple regex for <p> content)
          const htmlContent = twData.html;
          const textMatch = htmlContent.match(/<p[^>]*>(.*?)<\/p>/);
          const tweetText = textMatch ? textMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '') : '';

          metaData.og_title = `Tweet by ${twData.author_name}`;
          metaData.og_description = tweetText;
          metaData.og_site_name = 'X (Twitter)';
          // Note: oEmbed doesn't return image URL directly usually, but author_url is there.
        }
      } else {
        // Standard OGP Fetch
        const response = await fetch(content, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; DeepBuffer/1.0; +http://localhost:3000)'
          }
        });
        
        if (response.ok) {
          const html = await response.text();
          const $ = cheerio.load(html);
          
          metaData.og_title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
          metaData.og_description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
          metaData.og_image = $('meta[property="og:image"]').attr('content') || '';
          metaData.og_site_name = $('meta[property="og:site_name"]').attr('content') || '';
        }
      }
    } catch (e) {
      console.warn('Failed to fetch OGP/oEmbed:', e);
      // Continue without OGP
    }
  }

  const { data, error } = await supabase
    .from('items')
    .insert({
      source_type: sourceType === 'web_clip' ? 'web' : (sourceType || 'web'), // Map web_clip to web for DB constraint
      content: content,
      status: 'pending', // or 'saved'
      meta_data: metaData
    })
    .select()
    .single();

  if (error) {
    console.error('Create Item Error:', error);
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true, item: data });
});

// Items: Delete
app.delete('/items/:id', async (c) => {
  if (!supabase) return c.json({ error: 'DB not configured' }, 500);

  const id = c.req.param('id');
  if (!id) return c.json({ error: 'Missing ID' }, 400);

  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Delete Item Error:', error);
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true });
});



// Cron: Batch Summarization
app.get('/cron/summarize', async (c) => {
  // Security Check (CRON_SECRET)
  // Vercel Cron sends this header if CRON_SECRET env var is set
  const authHeader = c.req.header('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const result = await runBatchSummarization();
  
  if (!result) {
    return c.json({ error: 'Summarization failed' }, 500);
  }

  return c.json(result);
});

// Cron: Data Retention Policy (Cleanup)
app.get('/cron/retention', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const result = await runRetentionPolicy();
  
  return c.json({ success: true, count: result });
});

// AI: Generate Reply Draft
app.post('/ai/reply', async (c) => {
  const body = await c.req.json();
  const { originalMessage, tone } = body;

  if (!originalMessage || !tone) {
    return c.json({ error: 'Missing originalMessage or tone' }, 400);
  }

  const draft = await generateReplyDraft(originalMessage, tone);
  if (!draft) {
    return c.json({ error: 'Failed to generate draft' }, 500);
  }

  return c.json({ draft });
});

// AI: Ask About Summary
app.post('/ai/ask', async (c) => {
  const body = await c.req.json();
  const { summaryContext, question } = body;

  if (!summaryContext || !question) {
    return c.json({ error: 'Missing summaryContext or question' }, 400);
  }

  const answer = await askAboutSummary(summaryContext, question);
  if (!answer) {
    return c.json({ error: 'Failed to generate answer' }, 500);
  }

  return c.json({ answer });
});

// Slack: Send Reply
app.post('/slack/reply', async (c) => {
  const body = await c.req.json();
  const { channelId, text, threadTs, teamId } = body;

  if (!channelId || !text) {
    return c.json({ error: 'Missing channelId or text' }, 400);
  }

  const success = await sendSlackMessage(channelId, text, threadTs, teamId);
  if (!success) {
    return c.json({ error: 'Failed to send message to Slack' }, 500);
  }

  return c.json({ success: true });
});

// Messages: Manual Sync (Refresh)
app.post('/messages/sync', async (c) => {
  // Trigger fetch manually from frontend
  // Security: In production, consider adding auth check or rate limit
  try {
    console.log('Manual sync triggered...');
    await fetchSlackMessages();
    return c.json({ success: true });
  } catch (error) {
    console.error('Sync Error:', error);
    return c.json({ error: 'Failed to sync messages' }, 500);
  }
});

if (process.env.NODE_ENV === 'development') {
  // Fix local routing issue by re-mounting app on root for serve() if needed,
  // or simply be aware that basePath is handled by Hono internally.
  // When using basePath('/api'), request to http://localhost:3000/api/cron/summarize should work.
  // The issue might be Vercel adapter vs Node adapter differences.
  
  serve({
    fetch: app.fetch,
    port: 3001
  }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  });
}

export default handle(app);
