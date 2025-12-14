import { ReplyDraft } from "../types";

const API_BASE = 'http://localhost:3001/api';

export const generateDraftReply = async (
  originalMessage: string,
  tone: ReplyDraft['tone']
): Promise<string> => {
  try {
    const res = await fetch(`${API_BASE}/ai/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalMessage, tone }),
    });

    if (!res.ok) {
      throw new Error('Failed to fetch reply draft');
    }

    const data = await res.json();
    return data.draft || "ドラフトを作成できませんでした。";
  } catch (error) {
    console.error("AI API Error:", error);
    return "ドラフト生成エラー。接続を確認してください。";
  }
};

export const askAboutSummary = async (summaryContext: string, question: string): Promise<string> => {
  try {
    const res = await fetch(`${API_BASE}/ai/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summaryContext, question }),
    });

    if (!res.ok) {
      throw new Error('Failed to fetch answer');
    }

    const data = await res.json();
    return data.answer || "回答を作成できませんでした。";
  } catch (error) {
    console.error("AI API Error:", error);
    return "回答生成エラー。";
  }
};

// Keeping this for compatibility if referenced elsewhere, but marked as deprecated or mock
export const generateBatchSummary = async (messages: string[], customInstructions?: string): Promise<string> => {
    // This functionality is currently handled by the backend cron job or not exposed directly to frontend yet.
    // Returning a placeholder or implementing a call to a new endpoint if needed.
    return "現在、フロントエンドからの直接バッチ要約はサポートされていません。";
};
