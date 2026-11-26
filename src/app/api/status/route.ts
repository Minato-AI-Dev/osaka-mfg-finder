import { NextResponse } from 'next/server';
import { aiEnabled, CHAT_MODEL, EMBEDDING_MODEL } from '@/lib/ai';

export const dynamic = 'force-dynamic';

/** 画面表示用の設定状態（APIキーの値は返さない） */
export async function GET() {
  return NextResponse.json({ aiEnabled: aiEnabled(), chatModel: CHAT_MODEL, embeddingModel: EMBEDDING_MODEL });
}
