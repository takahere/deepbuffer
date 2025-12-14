import { Message, Workspace, UserSettings, DailySummary, DEFAULT_ALERT_KEYWORDS } from './types';

export const MOCK_WORKSPACES: Workspace[] = [
  { id: 'ws-1', slackTeamId: 'T12345', name: '株式会社Acme', iconUrl: 'https://picsum.photos/id/1/200/200' },
  { id: 'ws-2', slackTeamId: 'T67890', name: 'サイドプロジェクト', iconUrl: 'https://picsum.photos/id/2/200/200' },
];

export const MOCK_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    workspaceId: 'ws-1',
    sourceType: 'slack',
    content: 'お疲れ様です。本番DBのレイテンシーが上がっているようです。至急確認お願いできますか？',
    authorName: '佐藤 エンジニア',
    authorAvatar: 'https://picsum.photos/id/101/50/50',
    slackChannelName: '#eng-critical',
    isUrgent: true,
    isProcessed: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
  },
  {
    id: 'msg-2',
    workspaceId: 'ws-1',
    sourceType: 'slack',
    content: '新しいタコス屋さんができたみたいなんだけど、今日のランチ誰か一緒に行かない？',
    authorName: '田中 デザイン',
    authorAvatar: 'https://picsum.photos/id/102/50/50',
    slackChannelName: '#random',
    isUrgent: false,
    isProcessed: true,
    summary: '田中さんが新しいタコス屋さんでのランチにチームを誘っています。',
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
  },
  {
    id: 'msg-3',
    workspaceId: 'ws-2',
    sourceType: 'slack',
    content: 'LPの新しいデザイン案が完成しました。レビューお願いします。リンク: figma.com/file/...',
    authorName: '鈴木 PM',
    authorAvatar: 'https://picsum.photos/id/103/50/50',
    slackChannelName: '#general',
    isUrgent: false,
    isProcessed: true,
    summary: 'LPのデザイン案がレビュー待ちです。',
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    id: 'msg-4',
    sourceType: 'web_clip',
    content: '2024年のAIトレンドトップ10 - TechCrunch記事',
    authorName: 'Web Clipper',
    permalink: 'https://techcrunch.com',
    isUrgent: false,
    isProcessed: true,
    summary: '生成AI、規制、ハードウェアのトレンドについて議論している記事。',
    tags: ['AI', 'Reading'],
    createdAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
  },
  {
    id: 'msg-5',
    workspaceId: 'ws-1',
    sourceType: 'slack',
    content: '【緊急】フライト遅延のため、クライアントミーティングを15時に変更してください。',
    authorName: '高橋 部長',
    authorAvatar: 'https://picsum.photos/id/104/50/50',
    slackChannelName: '#clients',
    isUrgent: true,
    isProcessed: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  }
];

// 直近の配信スケジュール（8:00, 13:00, 19:00）に合わせて日時を算出するヘルパー関数
const getLatestReportDate = (): string => {
  const now = new Date();
  const currentHour = now.getHours();
  
  // 今日の配信時間枠
  const today8 = new Date(now); today8.setHours(8, 0, 0, 0);
  const today13 = new Date(now); today13.setHours(13, 0, 0, 0);
  const today19 = new Date(now); today19.setHours(19, 0, 0, 0);
  
  // 昨日の最終配信枠
  const yesterday19 = new Date(now); 
  yesterday19.setDate(yesterday19.getDate() - 1); 
  yesterday19.setHours(19, 0, 0, 0);

  // 現在時刻に合わせて直近の過去の枠を返す
  if (currentHour >= 19) return today19.toISOString();
  if (currentHour >= 13) return today13.toISOString();
  if (currentHour >= 8) return today8.toISOString();
  return yesterday19.toISOString();
};

export const MOCK_SUMMARY: DailySummary = {
  id: 'sum-1',
  targetDate: getLatestReportDate(),
  deliveryWindow: 'lunch',
  messageCount: 42,
  summaryText: "今日は比較的静かです。主な議論は #general での新しいLPデザイン案に関するものです。田中さんがランチを提案しています。#dev チャンネルではAPIのレイテンシーに関する短い議論がありましたが、解決したようです。その他、クリティカルなブロックは報告されていません。後で読むための記事が3件保存されています。",
  keyTopics: ['LPデザイン', 'チームランチ', 'APIレイテンシー確認'],
};

export const DEFAULT_SETTINGS: UserSettings = {
  userId: 'user-1',
  alertKeywords: DEFAULT_ALERT_KEYWORDS,
  vipUserIds: ['高橋 部長', '佐藤 エンジニア'],
  reportCustomInstructions: "プロジェクトの進捗状況、決定事項、およびアクションアイテムを優先して抽出してください。雑談や挨拶は要約から除外してください。",
};