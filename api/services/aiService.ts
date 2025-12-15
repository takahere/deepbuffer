import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

export interface SummaryResult {
  summaryText: string;
  keyTopics: string[];
}

export const generateSummary = async (messages: string[], customInstructions?: string): Promise<SummaryResult | null> => {
  if (!openai) {
    console.error("OpenAI API Key is missing.");
    return null;
  }

  try {
    const contentList = messages.map(m => `- ${m}`).join('\n');
    const prompt = `
      あなたは多忙な経営者の優秀なエグゼクティブ・アシスタントです。
      以下の未読メッセージリスト（SlackやWebクリップ）を解析し、以下のルールで処理してください。

      【ルール】
      1. 「雑談」「挨拶」「システム通知」などのノイズは無視する。
      2. 「緊急の依頼」「決定事項」「有益な情報の共有」のみを抽出する。
      3. 全体を「全体概況」と「個別トピック」に分けて構造化する。
      4. 特に重要なトピックを3つ以内で抽出し、キーワードとして列挙する。
      5. SlackのユーザーID（例: U12345）やメッセージIDは出力に含めないでください。代わりに表示名を使用するか、IDを削除してください。
      ${customInstructions ? `6. 【ユーザーからの追加指示】: ${customInstructions}` : ''}

      【入力メッセージ】
      ${contentList}

      【出力フォーマット】
      以下のJSON形式のみを出力してください（Markdownコードブロックは含めないでください）。
      {
        "summaryText": "### 全体概況\n（ここに全体の傾向や最重要事項を3行程度で記述）\n\n### 個別トピック\n- **[カテゴリ/人名]**: 内容を簡潔に。\n- **[カテゴリ/人名]**: 内容を簡潔に。",
        "keyTopics": ["トピック1", "トピック2"]
      }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant that outputs JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    const text = response.choices[0].message.content;
    if (!text) return null;

    return JSON.parse(text) as SummaryResult;
  } catch (error) {
    console.error("OpenAI API Error:", error);
    return null;
  }
};

export const generateReplyDraft = async (originalMessage: string, tone: string): Promise<string | null> => {
  if (!openai) {
    console.error("OpenAI API Key is missing.");
    return null;
  }

  try {
    const prompt = `
      あなたは優秀なエグゼクティブ・アシスタントです。
      以下のメッセージに対する短いSlack返信の下書きを作成してください: "${originalMessage}"
      トーンは「${tone}」でお願いします。
      件名や署名は含めず、プロフェッショナルかつ簡潔でフレンドリーな文章にしてください。
      言語は日本語でお願いします。
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt }
      ]
    });

    return response.choices[0].message.content || null;
  } catch (error) {
    console.error("OpenAI API Error:", error);
    return null;
  }
};

export const askAboutSummary = async (summaryContext: string, question: string): Promise<string | null> => {
  if (!openai) {
    console.error("OpenAI API Key is missing.");
    return null;
  }

  try {
    const prompt = `
      以下の要約レポートの内容に基づいて、ユーザーの質問に日本語で答えてください。
      要約に記載されていない情報については、「要約には情報が含まれていません」と正直に伝えてください。

      【要約レポート】
      ${summaryContext}

      【ユーザーの質問】
      ${question}
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt }
      ]
    });

    return response.choices[0].message.content || null;
  } catch (error) {
    console.error("OpenAI API Error:", error);
    return null;
  }
};
