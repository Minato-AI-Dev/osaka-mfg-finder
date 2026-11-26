/**
 * 評価指標。既知の正解データ（ground truth）がある需要に対してのみ使う。
 */

/** 上位K件のうち正解（relevant）の割合。K件に満たない場合も分母はKで固定する。 */
export function precisionAtK(rankedIds: string[], relevantIds: Set<string>, k: number): { k: number; hits: number; precision: number } {
  const top = rankedIds.slice(0, k);
  const hits = top.filter((id) => relevantIds.has(id)).length;
  return { k, hits, precision: k > 0 ? hits / k : 0 };
}
