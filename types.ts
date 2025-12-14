export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface Workspace {
  id: string;
  slackTeamId: string;
  name: string;
  iconUrl: string;
}

export type SourceType = 'slack' | 'web_clip';

export interface Message {
  id: string;
  workspaceId?: string;
  sourceType: SourceType;
  content: string;
  authorId?: string; // Slack User ID
  authorName: string;
  authorAvatar?: string;
  slackChannelId?: string;
  slackChannelName?: string;
  slackTs?: string;
  permalink?: string;
  isUrgent: boolean;
  isProcessed: boolean;
  createdAt: string; // ISO date string
  summary?: string;
  tags?: string[];
  // OGP Data
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogSiteName?: string;
  alertKeywords?: string[];
}

export interface DailySummary {
  id: string;
  summaryText: string;
  targetDate: string;
  deliveryWindow: 'lunch' | 'evening';
  messageCount: number;
  keyTopics: string[];
}

export interface UserSettings {
  userId: string;
  alertKeywords: string[];
  vipUserIds: string[];
  reportCustomInstructions?: string; // AIへの要約指示
}

export const DEFAULT_ALERT_KEYWORDS = ['緊急', '至急', '落ちた', '本番', '障害'];

// UI State Types
export type ViewState = 'focus' | 'review' | 'pocket' | 'settings' | 'summary';

export interface ReplyDraft {
  messageId: string;
  draft: string;
  tone: 'approve' | 'decline' | 'question' | 'neutral';
}