import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { generateSummary, generateReplyDraft, askAboutSummary } from './services/aiService.js';
import { fetchSlackMessages, getUserInfo, sendSlackMessage, fetchAllWorkspaceUsers } from './services/slackService.js';
import { runBatchSummarization, initScheduler, runRetentionPolicy } from './services/cronService.js';

dotenv.config();

console.log('[API] Hono initializing (Web Standard Mode)...');

const app = new Hono().basePath('/api');

export default app;

// Initialize Scheduler
if (process.env.VERCEL !== '1') {
  console.log('[API] Initializing scheduler (local mode)...');
  initScheduler();
} else {
  console.log('[API] Scheduler skipped (Vercel mode).');
}

// Middleware
app.use('/*', cors());

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY; // Use Service Role Key if available
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// Auth Middleware
app.use('*', async (c, next) => {
  // Skip auth for public endpoints
  if (c.req.path.includes('/health') || 
      c.req.path.includes('/webhook/slack') || 
      c.req.path.includes('/auth/callback') ||
      c.req.path.includes('/cron/')) { // Cron has its own auth
    return next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    console.warn(`[Auth] Missing header for ${c.req.path}`);
    return c.json({ error: 'Missing Authorization header' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');
  if (!supabase) return c.json({ error: 'DB not configured' }, 500);

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    console.warn(`[Auth] Invalid token for ${c.req.path}: ${error?.message}`);
    return c.json({ error: 'Invalid token' }, 401);
  }

  c.set('user', user);
  await next();
});

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
app.get('/health', (c) => {
  console.log('[API] Health check called');
  return c.json({ status: 'ok', service: 'deepbuffer-backend' });
});

// Get Connected Workspaces
app.get('/workspaces', async (c) => {
  if (!supabase) return c.json({ error: 'DB not configured' }, 500);
  const user = c.get('user');
  
  const { data, error } = await supabase
    .from('workspaces')
    .select('team_id, team_name, icon_url')
    .eq('user_id', user.id);
    
  if (error) return c.json({ error: error.message }, 500);
  
  const workspaces = data.map(ws => ({
    id: ws.team_id, 
    slackTeamId: ws.team_id,
    name: ws.team_name || 'Unknown Workspace',
    iconUrl: ws.icon_url || '',
  }));

  return c.json({ workspaces });
});

// OAuth Callback
app.get('/auth/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state'); // Expect user_id in state
  if (!code) return c.text('No code provided', 400);

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;

  if (!clientId || !clientSecret) return c.text('Server config error', 500);

  try {
    const params = new URLSearchParams();
    params.append('code', code);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    const baseUrl = process.env.APP_BASE_URL || 'https://deepbuffer.vercel.app'; 
    params.append('redirect_uri', `${baseUrl}/api/auth/callback`);

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    const data = await response.json();
    console.log('Slack OAuth Response:', JSON.stringify(data, null, 2));

    if (!data.ok) return c.text(`OAuth Error: ${data.error}`, 400);

    const accessToken = data.access_token || data.authed_user?.access_token;

    if (!accessToken) {
      console.error('Missing access_token in response:', data);
      return c.text('OAuth Error: No access token received', 500);
    }

    if (supabase) {
      // If state is present, use it as user_id. 
      // NOTE: For full security, state should be a random token stored in cookie/session, verified here, then mapped to user.
      // For MVP, assuming state=user_id directly or handle simpler flow.
      // If no state, we can't link to a user easily in this callback flow without session.
      // We'll update frontend to pass user_id as state.
      const userId = state;

      if (!userId) {
         return c.text('Error: State (User ID) missing in callback', 400);
      }
      
      const { error: wsError } = await supabase.from('workspaces').upsert({
        team_id: data.team.id,
        access_token: accessToken,
        team_name: data.team.name, 
        icon_url: '' ,
        user_id: userId
      }, { onConflict: 'team_id' });

      if (wsError) {
        console.error('DB Workspace Error:', wsError);
        return c.text('Database Error (Workspace)', 500);
      }
    }

    // Redirect to frontend app instead of showing text
    return c.redirect('/?connected=true');
  } catch (e) {
    console.error(e);
    return c.text('Internal Server Error', 500);
  }
});

app.post('/webhook/slack', async (c) => {
  try {
    const rawBody = await c.req.text();
    
    // Fast-path for verification
    if (rawBody.includes('"type":"url_verification"') && rawBody.includes('"challenge"')) {
       const match = rawBody.match(/"challenge":"(.*?)"/);
       if (match && match[1]) {
         return c.json({ challenge: match[1] });
       }
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error('[Webhook] JSON Parse Error:', parseErr);
      return c.text('Invalid JSON', 400);
    }

    if (body.type === 'url_verification') {
      return c.json({ challenge: body.challenge });
    }
    
    // Verify Signature
    const isValid = await verifySlackSignature(c.req.raw, rawBody);
    if (!isValid) {
      console.warn('[Webhook] Invalid signature');
      return c.text('Invalid signature', 401);
    }

    // Event Handling
    if (body.event) {
      const { type, text, user, bot_id, ts, channel } = body.event;

      if (bot_id || (body.event.subtype === 'bot_message')) {
        return c.json({ ok: true });
      }

      if (type === 'message' && !body.event.subtype) {
        let userName = user;
        let userAvatar = '';
        
        try {
            const userInfo = await getUserInfo(user);
            if (userInfo) {
                userName = userInfo.name;
                userAvatar = userInfo.avatar;
            }
        } catch (e) {
            console.error('Failed to fetch user info for webhook:', e);
        }

        if (supabase) {
          // Find which user owns this workspace/team
          const { data: workspace } = await supabase
            .from('workspaces')
            .select('user_id')
            .eq('team_id', body.team_id)
            .single();

          if (workspace) {
            // Use waitUntil if possible, or just await
            const { error } = await supabase.from('items').insert({
                source_type: 'slack',
                content: text,
                meta_data: {
                  user,
                  user_name: userName, 
                  user_avatar: userAvatar, 
                  channel,
                  ts,
                  team: body.team_id
                },
                status: 'pending',
                user_id: workspace.user_id
            });
            if (error) console.error('[Webhook] DB Insert Error:', error);
          }
        }
      }
    }

    return c.json({ ok: true });
  } catch (e) {
    console.error('[Webhook] Error processing request:', e);
    return c.text('Internal Server Error', 500);
  }
});

// Get Latest Summary
app.get('/summaries/latest', async (c) => {
  if (!supabase) return c.json({ error: 'DB not configured' }, 500);
  const user = c.get('user');

  const { data, error } = await supabase
    .from('summaries')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    return c.json({ error: error.message }, 500);
  }

  return c.json(data || null);
});

// Get Pending Items Count
app.get('/items/pending/count', async (c) => {
  if (!supabase) return c.json({ error: 'DB not configured' }, 500);
  const user = c.get('user');

  const { count, error } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('user_id', user.id);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ count });
});

// Get Items
app.get('/items', async (c) => {
  if (!supabase) return c.json({ error: 'DB not configured' }, 500);
  const user = c.get('user');

  const status = c.req.query('status');
  let query = supabase
    .from('items')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (status) {
    query = query.eq('status', status);
  } else {
    query = query.neq('status', 'archived');
  }

  const { data, error } = await query.limit(50);

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// Archive All
app.post('/items/archive-all', async (c) => {
  if (!supabase) return c.json({ error: 'DB not configured' }, 500);
  const user = c.get('user');

  const body = await c.req.json().catch(() => ({}));
  const { workspaceId } = body;

  let query = supabase
    .from('items')
    .update({ status: 'archived' })
    .eq('user_id', user.id)
    .neq('status', 'archived')
    .neq('source_type', 'web'); // Keep Link Pocket (web) items

  if (workspaceId && workspaceId !== 'all') {
    query = query.eq('meta_data->>team', workspaceId);
  }

  const { error, count } = await query.select('id', { count: 'exact' });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true, count });
});

import * as cheerio from 'cheerio';

// Items: Create (Link Pocket)
app.post('/items/create', async (c) => {
  if (!supabase) return c.json({ error: 'DB not configured' }, 500);
  const user = c.get('user');

  const body = await c.req.json();
  const { content, sourceType } = body;

  if (!content) {
    return c.json({ error: 'Missing content' }, 400);
  }

  let metaData = {
    created_via: 'api',
    og_title: '',
    og_description: '',
    og_image: '',
    og_site_name: ''
  };

  if (sourceType === 'web_clip' || !sourceType) {
    try {
      const url = new URL(content); 
      
      if (url.hostname.includes('twitter.com') || url.hostname.includes('x.com')) {
        const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(content)}&omit_script=true`;
        const twRes = await fetch(oembedUrl);
        if (twRes.ok) {
          const twData = await twRes.json();
          const htmlContent = twData.html;
          const textMatch = htmlContent.match(/<p[^>]*>(.*?)<\/p>/);
          const tweetText = textMatch ? textMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '') : '';

          metaData.og_title = `Tweet by ${twData.author_name}`;
          metaData.og_description = tweetText;
          metaData.og_site_name = 'X (Twitter)';
        }
      } else {
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
    }
  }

  const { data, error } = await supabase
    .from('items')
    .insert({
      source_type: sourceType === 'web_clip' ? 'web' : (sourceType || 'web'),
      content: content,
      status: 'pending',
      meta_data: metaData,
      user_id: user.id
    })
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true, item: data });
});

// Items: Delete
app.delete('/items/:id', async (c) => {
  if (!supabase) return c.json({ error: 'DB not configured' }, 500);
  const user = c.get('user');

  const id = c.req.param('id');
  if (!id) return c.json({ error: 'Missing ID' }, 400);

  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true });
});

// Cron: Batch Summarization
app.get('/cron/summarize', async (c) => {
  // Allow manual run for debugging or authenticated cron
  const authHeader = c.req.header('Authorization');
  // Check if it's a manual run by a logged-in user or a system cron
  let isSystemCron = false;
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    isSystemCron = true;
  } 
  
  // If not system cron, check for user auth (for manual trigger)
  // But wait, our middleware already checks auth for non-public routes.
  // We skipped /cron/ in middleware. So we must check here.
  
  if (!isSystemCron) {
     // If not cron secret, maybe it's a user token? 
     // For now, let's keep it restricted to CRON_SECRET for safety as it processes ALL users.
     return c.json({ error: 'Unauthorized' }, 401);
  }

  const result = await runBatchSummarization();
  
  if (!result) {
    return c.json({ error: 'Summarization failed' }, 500);
  }

  return c.json(result);
});

// Cron: Retention
app.get('/cron/retention', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const result = await runRetentionPolicy();
  
  return c.json({ success: true, count: result });
});

// AI: Reply Draft
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

// AI: Ask
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
  const user = c.get('user');
  const body = await c.req.json();
  const { channelId, text, threadTs, teamId } = body;

  if (!channelId || !text) {
    return c.json({ error: 'Missing channelId or text' }, 400);
  }

  // Verify ownership of team if needed, but fetchSlackMessage handles token retrieval
  const success = await sendSlackMessage(channelId, text, threadTs, teamId);
  if (!success) {
    return c.json({ error: 'Failed to send message to Slack' }, 500);
  }

  return c.json({ success: true });
});

// Get Settings
app.get('/settings', async (c) => {
  if (!supabase) return c.json({ error: 'DB not configured' }, 500);
  const user = c.get('user');

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ 
    settings: data ? {
      userId: data.user_id,
      alertKeywords: data.alert_keywords || [],
      vipUserIds: data.vip_user_ids || [],
      reportCustomInstructions: data.report_custom_instructions
    } : null 
  });
});

// Update Settings
app.post('/settings', async (c) => {
  if (!supabase) return c.json({ error: 'DB not configured' }, 500);
  const user = c.get('user');

  const body = await c.req.json();
  const { alertKeywords, vipUserIds, reportCustomInstructions } = body;

  const { data, error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: user.id,
      alert_keywords: alertKeywords,
      vip_user_ids: vipUserIds,
      report_custom_instructions: reportCustomInstructions,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true, settings: data });
});

// Manual Sync
app.post('/messages/sync', async (c) => {
  try {
    console.log('Manual sync triggered...');
    await fetchSlackMessages();
    return c.json({ success: true });
  } catch (error) {
    console.error('Sync Error:', error);
    return c.json({ error: 'Failed to sync messages' }, 500);
  }
});

// Get Slack Users
app.get('/slack/users', async (c) => {
  const users = await fetchAllWorkspaceUsers();
  return c.json({ users });
});

const handler = (req: Request, ...args: any[]) => app.fetch(req, ...args);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
export const OPTIONS = handler;