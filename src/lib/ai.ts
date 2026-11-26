/**
 * OpenAI API の薄いラッパ。APIキーはサーバー側（環境変数）でのみ使う。
 * このファイルは Client Component から import しないこと。
 */

export const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
export const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

/** 外部AIへ送信してよい利用許諾状態。それ以外（未確認・利用不可）は送信しない */
export const AI_TRANSMITTABLE_LICENSES = ['licensed', 'fictional'] as const;

export function aiEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '');
}

export function isTransmittable(licenseStatus: string): boolean {
  return (AI_TRANSMITTABLE_LICENSES as readonly string[]).includes(licenseStatus);
}

export class AiDisabledError extends Error {
  constructor() {
    super('OPENAI_API_KEY が未設定のため、AIマッチングは実行できません。キーワード検索は利用できます。');
    this.name = 'AiDisabledError';
  }
}

async function callOpenAI(path: string, body: unknown): Promise<any> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AiDisabledError();
  const res = await fetch(`https://api.openai.com/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`OpenAI API エラー (${res.status}): ${detail}`);
  }
  return res.json();
}

/** 意味検索用のベクトル化 */
export async function embedText(text: string): Promise<number[]> {
  const json = await callOpenAI('/embeddings', { model: EMBEDDING_MODEL, input: text.slice(0, 8000) });
  const vec = json?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) throw new Error('埋め込みベクトルの取得に失敗しました');
  return vec as number[];
}

/** JSONモードでチャット補完を呼ぶ */
export async function chatJson(system: string, user: string): Promise<unknown> {
  const json = await callOpenAI('/chat/completions', {
    model: CHAT_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('LLMの応答が空でした');
  return JSON.parse(content);
}

export const PROMPTS = {
  structureSupplier: `あなたは製造技術の構造化アナリストです。
入力された企業情報の「テキストに書かれている内容だけ」から以下を抽出し、JSONで返してください。
- 書かれていない能力を推測で追加してはいけません。不明な項目は空配列にし、unknown_items に記載してください。
キー: technology_names(string[]), processing_methods(string[]), target_materials(string[]), functions(string[]), constraints(string[]), strengths(string[]), unknown_items(string[])`,

  structureDemand: `あなたは技術ニーズの構造化アナリストです。
入力された需要情報の「テキストに書かれている内容だけ」から以下を抽出し、JSONで返してください。
キー: problem_summary(string), required_functions(string[]), required_materials(string[]), required_processes(string[]), mandatory_conditions(string[]), desired_conditions(string[]), unknown_conditions(string[])`,

  analyzePair: `あなたは製造業の技術適合性アナリストです。
与えられた「企業（供給側）」と「需要（ニーズ側）」の組み合わせを分析し、JSONで返してください。

厳守事項:
1. 入力にない技術能力を事実として断定してはいけません。推測は reason / potential_application に限定してください。
2. 必須条件（材料、寸法公差、設備能力、ロット、地域制限など）が「明確に不一致」の場合のみ hard_constraint_conflicts に記載してください。
3. 不明な条件は適合とせず unknown_conditions に記載してください（「適合」と書いてはいけません）。
4. match_score は「探索優先度」（0〜100）です。受注確率や技術適合率ではありません。
5. evidence の excerpt は、入力の原文から一字一句そのままコピーした部分文字列にしてください。
6. 異業種の応用可能性がある場合は potential_application に具体的に書いてください。

キー:
- match_score (number 0-100)
- reason (string)
- matching_capabilities (string[])
- potential_application (string)
- hard_constraint_conflicts (string[])
- unknown_conditions (string[])
- questions_to_verify (string[])
- evidence ({source_type: "supplier" | "demand", field: string, excerpt: string}[])`,
};
