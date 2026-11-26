/** 画面表示用の日本語ラベル（クライアント・サーバー両方から使えるようDBに依存しない） */
export const SUPPLIER_LABELS: Record<string, string> = {
  supplier_id: '企業ID',
  name: '企業名',
  location: '所在地',
  industry: '業種',
  processes: '保有加工技術',
  materials: '対応材料',
  equipment: '主要設備',
  precision: '加工精度',
  dimensions: '対応寸法',
  capacity: 'ロット・生産能力',
  products: '製品・加工実績',
  strengths: '技術的な強み',
  source_url: '情報取得元URL',
  license_status: '利用許諾状態',
};

export const DEMAND_LABELS: Record<string, string> = {
  demand_id: 'ニーズID',
  title: 'タイトル',
  issuer: '発信元組織',
  industry: '業界',
  problem: '解決したい課題',
  required_functions: '求める機能',
  required_technologies: '必要とされる技術',
  materials: '材料条件',
  required_conditions: '必須条件（寸法・精度など）',
  desired_conditions: '希望条件',
  quantity_delivery: '数量・納期',
  region: '地域制限',
  published_at: '公開日',
  deadline: '募集期限',
  source_url: '情報取得元URL',
  license_status: '利用許諾状態',
  demand_type: 'ニーズの種類',
};

/** 複数行入力にする項目 */
export const LONG_FIELDS = new Set([
  'processes', 'equipment', 'products', 'strengths', 'problem', 'required_functions',
  'required_technologies', 'required_conditions', 'desired_conditions',
]);

export const VERDICT_LABELS: Record<string, string> = {
  promising: '有望',
  mismatch: '不適合',
  needs_check: '要確認',
};

export const MATCH_STATUS_LABELS: Record<string, string> = {
  candidate: '候補',
  excluded_hard_conflict: 'ハード条件不一致（高評価にしない）',
  keyword_baseline: 'キーワード一致（AI分析ではない）',
};
