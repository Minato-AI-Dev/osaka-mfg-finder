import { NextResponse } from 'next/server';
import { aiEnabled, AiDisabledError } from '@/lib/ai';
import { keywordMatch, runAiMatch, type TargetType } from '@/lib/matching';

export const dynamic = 'force-dynamic';
// AI分析は候補数に応じて時間がかかるため、タイムアウトを延ばす
export const maxDuration = 300;

/**
 * POST /api/match
 * body: { target: "demand" | "supplier", id: string, mode: "keyword" | "ai", topK?: number }
 * - keyword: 名称一致のベースライン（外部送信なし。AIの結果として表示しない）
 * - ai: 意味検索＋LLM分析（APIキー未設定ならエラーを返す）
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { target?: string; id?: string; mode?: string; topK?: number }
    | null;
  const target = body?.target;
  if (target !== 'demand' && target !== 'supplier') {
    return NextResponse.json({ error: 'target は demand か supplier を指定してください' }, { status: 400 });
  }
  if (!body?.id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 });
  const topK = Math.min(10, Math.max(1, Number(body.topK) || 5));

  try {
    if (body.mode === 'keyword') {
      const hits = await keywordMatch(target as TargetType, body.id, topK);
      return NextResponse.json({ mode: 'keyword', hits });
    }
    if (body.mode === 'ai') {
      if (!aiEnabled()) {
        return NextResponse.json(
          { error: 'AIマッチングは無効です（OPENAI_API_KEY が未設定）。キーワード検索は利用できます。' },
          { status: 503 },
        );
      }
      const { results, skipped } = await runAiMatch(target as TargetType, body.id, topK);
      return NextResponse.json({ mode: 'ai', results, skipped });
    }
    return NextResponse.json({ error: 'mode は keyword か ai を指定してください' }, { status: 400 });
  } catch (e) {
    if (e instanceof AiDisabledError) return NextResponse.json({ error: e.message }, { status: 503 });
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
