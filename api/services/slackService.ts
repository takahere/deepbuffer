import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const userToken = process.env.SLACK_USER_TOKEN;

// Initialize Supabase (Use Service Role Key to bypass RLS for background tasks)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

interface SlackMessage {
  type: string;
  user: string;
  text: string;
  ts: string;
  subtype?: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getUserInfo = async (userId: string) => {
  if (!userToken) return null;
  try {
    const res = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
        headers: { Authorization: `Bearer ${userToken}` }
    });
    const data = await res.json();
    if (data.ok && data.user) {
        return {
            name: data.user.profile.real_name || data.user.name,
            avatar: data.user.profile.image_48
        };
    }
    return null;
  } catch (error) {
    console.error('Error fetching user info:', error);
    return null;
  }
};

// Fetch all users from all connected workspaces
export const fetchAllWorkspaceUsers = async () => {
  if (!supabase) return [];

  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('team_id, team_name, access_token');

  if (error || !workspaces) {
    console.error('Error fetching workspaces:', error);
    return [];
  }

  const allUsers: any[] = [];

  for (const ws of workspaces) {
    try {
      const res = await fetch('https://slack.com/api/users.list', {
        headers: { Authorization: `Bearer ${ws.access_token}` }
      });
      const data = await res.json();
      
      if (data.ok && data.members) {
        const users = data.members
          .filter((u: any) => !u.is_bot && !u.deleted && u.id !== 'USLACKBOT')
          .map((u: any) => ({
            id: u.id,
            name: u.profile.real_name || u.name,
            avatar: u.profile.image_48,
            teamId: ws.team_id,
            teamName: ws.team_name
          }));
        allUsers.push(...users);
      }
    } catch (e) {
      console.error(`Error fetching users for team ${ws.team_id}:`, e);
    }
  }

  return allUsers;
};

export const fetchSlackMessages = async () => {
  if (!supabase) {
    console.error('Supabase client missing');
    return;
  }

  try {
    // 1. Fetch all connected workspaces with user_id
    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select('team_id, access_token, user_id');

    if (wsError || !workspaces || workspaces.length === 0) {
      console.warn('No workspaces found or DB error:', wsError);
      return;
    }

    console.log(`Polling ${workspaces.length} workspaces...`);

    let totalSaved = 0;

    // 2. Iterate each workspace
    for (const ws of workspaces) {
      const token = ws.access_token;
      const teamId = ws.team_id;
      const userId = ws.user_id;
      
      if (!token) continue;

      try {
        console.log(`Fetching for team ${teamId}...`);
        
        // --- Fetch Users ---
        const usersRes = await fetch('https://slack.com/api/users.list', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const usersData = await usersRes.json();
        const userMap = new Map();
        
        if (usersData.ok && usersData.members) {
          usersData.members.forEach((u: any) => {
            userMap.set(u.id, {
              name: u.profile.real_name || u.name,
              avatar: u.profile.image_48,
              is_bot: u.is_bot // Store bot status
            });
          });
        }

        // --- Fetch Channels with Pagination ---
        const allChannels: any[] = [];
        let cursor = '';
        
        while (true) {
          try {
            const channelsRes = await fetch(
              `https://slack.com/api/conversations.list?types=public_channel,private_channel,im,mpim&limit=200${cursor ? `&cursor=${cursor}` : ''}`, 
              { headers: { Authorization: `Bearer ${token}` } }
            );
            
            // Check for rate limit
            if (channelsRes.status === 429) {
              const retryAfter = channelsRes.headers.get('Retry-After');
              const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 2000;
              console.warn(`Rate limited. Waiting ${waitTime}ms...`);
              await sleep(waitTime);
              continue; // Retry same request? No, simpler to just skip or loop. For now, we will break or continue.
              // Actually, retrying properly in a loop is complex. Let's just wait and break for this cycle to avoid spamming.
            }

            const channelsData = await channelsRes.json();
            
            if (!channelsData.ok) {
              console.error(`Failed to fetch channels for ${teamId}:`, channelsData.error);
              break;
            }

            if (channelsData.channels) {
              allChannels.push(...channelsData.channels);
            }

            cursor = channelsData.response_metadata?.next_cursor;
            if (!cursor) break;

            await sleep(100); // Small delay to be polite
          } catch (fetchErr) {
             console.error('Fetch channels error:', fetchErr);
             break;
          }
        }

        console.log(`Found ${allChannels.length} channels for team ${teamId}.`);
        const fourHoursAgo = (Date.now() / 1000) - (4 * 60 * 60);

        // --- Fetch History per Channel ---
        for (const channel of allChannels) {
          if (channel.is_archived) continue;

          // Add sleep to avoid rate limits
          await sleep(50); // 20 requests per second limit typically for Tier 3, history is Tier 3.

          const historyRes = await fetch(`https://slack.com/api/conversations.history?channel=${channel.id}&oldest=${fourHoursAgo}&limit=50`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (historyRes.status === 429) {
             console.warn('Rate limited on history fetch. Sleeping 2s...');
             await sleep(2000);
             continue; 
          }

          const historyData = await historyRes.json();

          if (!historyData.ok) continue;

          const messages = historyData.messages as SlackMessage[];
          if (!messages || messages.length === 0) continue;

          for (const msg of messages) {
            // Filter out bot messages and subtype events (join/leave etc)
            if (msg.subtype || !msg.user || (msg as any).bot_id) continue;

            const userInfo = userMap.get(msg.user);
            // Double check if user is a bot (from user list info)
            if (userInfo && userInfo.is_bot) continue;

            const userName = userInfo ? userInfo.name : msg.user;
            const userAvatar = userInfo ? userInfo.avatar : '';

            // Check duplication
            const { data: existing } = await supabase
              .from('items')
              .select('id')
              .eq('meta_data->>ts', msg.ts)
              .eq('meta_data->>channel', channel.id)
              .single();
            
            if (!existing) {
              await supabase.from('items').insert({
                source_type: 'slack',
                content: msg.text,
                meta_data: {
                  user: msg.user,
                  user_name: userName,
                  user_avatar: userAvatar,
                  channel: channel.id,
                  channel_name: channel.name || 'DM',
                  ts: msg.ts,
                  team: teamId
                },
                status: 'pending',
                user_id: userId
              });
              totalSaved++;
            }
          }
        }
      } catch (wsErr) {
        console.error(`Error polling workspace ${teamId}:`, wsErr);
      }
    }

    console.log(`Fetched and saved ${totalSaved} new messages from all workspaces.`);

  } catch (error) {
    console.error('Polling Error:', error);
  }
};

export const sendSlackMessage = async (channelId: string, text: string, threadTs?: string, teamId?: string) => {
  if (!supabase) return false;

  let token = userToken; // Fallback to env var if teamId not provided (backward compat)

  if (teamId) {
    const { data: ws } = await supabase
      .from('workspaces')
      .select('access_token')
      .eq('team_id', teamId)
      .single();
    
    if (ws && ws.access_token) {
      token = ws.access_token;
    } else {
      console.warn(`No token found for team ${teamId}, trying default env token.`);
    }
  }

  if (!token) {
    console.error('SLACK_USER_TOKEN or Team Token is missing');
    return false;
  }

  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        channel: channelId,
        text: text,
        thread_ts: threadTs // Optional: reply in thread
      })
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('Slack Send Error:', data.error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Slack Send Exception:', error);
    return false;
  }
};
