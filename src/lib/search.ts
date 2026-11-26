/**
 * キーワード検索（ベースライン）と、ベクトル類似度の計算。
 * ここは外部API・LLMを使わない純粋関数のみ。
 */

/** 「、」「,」「/」「（）」などで区切られた語を取り出す。1文字語は除外する。 */
export function splitTerms(text: string): string[] {
  const parts = text
    .split(/[、,，/／・;；\s（）()\[\]「」]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  return Array.from(new Set(parts));
}

export interface KeywordScore {
  /** 0〜100。検索語のうち対象テキストに含まれる割合 */
  score: number;
  matched: string[];
}

/**
 * 検索語（技術名・材料名）のうち、対象テキストに文字列として含まれるものの割合を返す。
 * 「名称が一致するか」だけを見るため、言い換えや異業種の応用は拾えない（仮説検証のためのベースライン）。
 */
export function keywordScore(queryTerms: string[], haystack: string): KeywordScore {
  if (queryTerms.length === 0) return { score: 0, matched: [] };
  const hay = haystack.toLowerCase();
  const matched = queryTerms.filter((t) => hay.includes(t.toLowerCase()));
  return {
    score: Math.round((matched.length / queryTerms.length) * 100),
    matched,
  };
}

/** コサイン類似度（-1〜1）。長さが違う、または零ベクトルの場合は 0 を返す */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
