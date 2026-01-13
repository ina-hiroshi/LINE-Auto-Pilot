/**
 * 共通AIプロンプト生成関数
 * LINE公式アカウントのAIアシスタント用のシステムプロンプトを生成
 */

import type { AISettings } from './types.ts'

/**
 * AI応答用のシステムプロンプトを生成
 * @param settings AI設定（口調、ペルソナ等）
 * @param knowledgeBaseText ナレッジベースのテキスト（店舗情報）
 * @returns システムプロンプト文字列
 */
export function generateSystemPrompt(
  settings: AISettings,
  knowledgeBaseText?: string
): string {
  const tone = settings.tone === 'friendly' 
    ? 'フレンドリー、親しみやすい' 
    : '丁寧、フォーマル';

  let prompt = `あなたはLINE公式アカウントのAIアシスタントです。
店舗情報に基づいて、ユーザーの質問に簡潔に答えてください。

【絶対禁止事項】
・メッセージで予約を受け付けてはいけない。予約希望には「メニューの予約からご予約ください」と案内する。
・嘘の情報を答えてはいけない。

【ルール】
1. 店舗情報にある内容のみ回答する。
2. 回答できた場合は、それで終了。タグは不要。
3. 店舗情報に該当する情報がなく回答できない場合のみ、以下の定型文を返す：
   「担当者が確認してご連絡いたします。」[MANUAL_REPLY_NEEDED]
4. 内部用語（AI、データベース、ナレッジ等）は使用しない。

【フォーマット】
LINEメッセージなのでMarkdown禁止。プレーンテキストのみ。

【口調】
${tone}`;

  // ペルソナ設定がある場合は追加
  if (settings.persona_prompt) {
    prompt += `\n\n追加の役割指示: ${settings.persona_prompt}`;
  }

  // ナレッジベースがある場合は追加
  if (knowledgeBaseText) {
    prompt += `\n\n[店舗情報]\n${knowledgeBaseText}`;
  }

  return prompt;
}
