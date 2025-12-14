import { Message, DailySummary, Workspace, UserSettings } from '../types';
import { supabase } from '../contexts/AuthContext';

const API_BASE = '/api';

const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { 'Authorization': `Bearer ${session.access_token}` };
  }
  return {};
};

export const api = {
  async getWorkspaces(): Promise<Workspace[]> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/workspaces`, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      return data.workspaces || [];
    } catch (e) {
      console.error('Fetch Workspaces Error:', e);
      return [];
    }
  },

  async getLatestSummary(): Promise<DailySummary | null> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/summaries/latest`, { headers });
    if (!res.ok) throw new Error('Failed to fetch summary');
    const data = await res.json();
    if (!data) return null;

    // Transform DB format to Frontend types if needed
    // DB: summary_text, created_at
    // Frontend: summaryText, targetDate
    return {
      id: data.id,
      targetDate: data.created_at,
      summaryText: data.summary_text,
      keyTopics: data.target_items || [], 
    } as any; 
  },

  async getPendingCount(): Promise<number> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/items/pending/count`, { headers });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count || 0;
  },

  async getMessages(status?: string, teamId?: string): Promise<Message[]> {
    let url = `${API_BASE}/items?status=${status || ''}`;
    
    const headers = await getAuthHeaders();
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    
    // Map DB items to Frontend Message type
    let messages = data.map((item: any) => ({
      id: item.id,
      sourceType: item.source_type === 'slack' ? 'slack' : 'web_clip',
      workspaceId: item.meta_data?.team, // Map team ID
      content: item.content,
      authorId: item.meta_data?.user,
      authorName: item.meta_data?.user_name || item.meta_data?.user || 'あなた',
      authorAvatar: item.meta_data?.user_avatar,
      permalink: item.meta_data?.channel || item.content, // Use content as permalink for web clips
      slackChannelId: item.meta_data?.channel,
      slackTs: item.meta_data?.ts,
      slackChannelName: item.meta_data?.channel_name,
      isUrgent: false, // Priority logic to be implemented
      isProcessed: item.status !== 'pending',
      createdAt: item.created_at,
      summary: '',
      tags: [],
      // OGP Data
      ogTitle: item.meta_data?.og_title,
      ogDescription: item.meta_data?.og_description,
      ogImage: item.meta_data?.og_image,
      ogSiteName: item.meta_data?.og_site_name,
      alertKeywords: [], // Populated by client for now
    }));

    if (teamId && teamId !== 'all') {
      messages = messages.filter((m: Message) => m.workspaceId === teamId);
    }

    return messages;
  },

  async sendSlackReply(channelId: string, text: string, threadTs?: string, teamId?: string): Promise<boolean> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/slack/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ channelId, text, threadTs, teamId }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data.success === true;
    } catch (e) {
      console.error('Send Reply Error:', e);
      return false;
    }
  },

  async syncMessages(): Promise<boolean> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/messages/sync`, { method: 'POST', headers });
      return res.ok;
    } catch (e) {
      console.error('Sync Messages Error:', e);
      return false;
    }
  },

  async archiveAllMessages(workspaceId?: string): Promise<boolean> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/items/archive-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ workspaceId }),
      });
      return res.ok;
    } catch (e) {
      console.error('Archive All Error:', e);
      return false;
    }
  },

  async addLink(url: string): Promise<Message | null> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/items/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ content: url, sourceType: 'web_clip' }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      
      // Convert to Message format
      const item = data.item;
      return {
        id: item.id,
        sourceType: item.source_type === 'web' ? 'web_clip' : 'slack', // Map DB 'web' back to frontend 'web_clip'
        content: item.content,
        authorName: 'あなた',
        permalink: item.content,
        isUrgent: false,
        isProcessed: true,
        createdAt: item.created_at,
        summary: '',
        tags: [],
        ogTitle: item.meta_data?.og_title,
        ogDescription: item.meta_data?.og_description,
        ogImage: item.meta_data?.og_image,
        ogSiteName: item.meta_data?.og_site_name
      };
    } catch (e) {
      console.error('Add Link Error:', e);
      return null;
    }
  },

  async deleteLink(id: string): Promise<boolean> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/items/${id}`, {
        method: 'DELETE',
        headers
      });
      return res.ok;
    } catch (e) {
      console.error('Delete Link Error:', e);
      return false;
    }
  },

  async getSettings(): Promise<UserSettings | null> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/settings`, { headers });
      if (!res.ok) return null;
      const data = await res.json();
      return data.settings || null;
    } catch (e) {
      console.error('Get Settings Error:', e);
      return null;
    }
  },

  async updateSettings(settings: UserSettings): Promise<boolean> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(settings),
      });
      return res.ok;
    } catch (e) {
      console.error('Update Settings Error:', e);
      return false;
    }
  },

  async getSlackUsers(): Promise<any[]> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/slack/users`, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      return data.users || [];
    } catch (e) {
      console.error('Fetch Slack Users Error:', e);
      return [];
    }
  }
};
