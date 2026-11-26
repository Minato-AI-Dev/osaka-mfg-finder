/**
 * 企業・需要レコードの定義とCSVバリデーション。
 * DBに書き込む前の検証のみを担当する（DB操作は含まない）。
 */
import { parseCsv, toCsv } from './csv';

export const SUPPLIER_COLUMNS = [
  'supplier_id', 'name', 'location', 'industry', 'processes', 'materials', 'equipment',
  'precision', 'dimensions', 'capacity', 'products', 'strengths', 'source_url', 'license_status',
] as const;

export const DEMAND_COLUMNS = [
  'demand_id', 'title', 'issuer', 'industry', 'problem', 'required_functions',
  'required_technologies', 'materials', 'required_conditions', 'desired_conditions',
  'quantity_delivery', 'region', 'published_at', 'deadline', 'source_url', 'license_status',
  'demand_type',
] as const;

/** 必須列（空欄不可） */
export const SUPPLIER_REQUIRED = ['supplier_id', 'name', 'location', 'industry', 'processes', 'source_url', 'license_status'] as const;
export const DEMAND_REQUIRED = ['demand_id', 'title', 'issuer', 'industry', 'problem', 'source_url', 'license_status', 'demand_type'] as const;

export const LICENSE_STATUSES = ['licensed', 'fictional', 'unverified', 'restricted'] as const;
export const LICENSE_LABELS: Record<string, string> = {
  licensed: '利用許諾確認済',
  fictional: '架空データ',
  unverified: '許諾未確認',
  restricted: '利用不可',
};

export const DEMAND_TYPES = ['order', 'tech_search', 'rnd_theme', 'hypothesis'] as const;
/** 需要の種類。研究開発テーマや仮説を「確定発注」として扱わないためにUIでも必ずこのラベルを出す */
export const DEMAND_TYPE_LABELS: Record<string, string> = {
  order: '実際の発注・調達案件',
  tech_search: '企業が公開した技術探索ニーズ',
  rnd_theme: '研究開発テーマ',
  hypothesis: '将来の用途仮説',
};

export type SupplierRecord = Record<(typeof SUPPLIER_COLUMNS)[number], string>;
export type DemandRecord = Record<(typeof DEMAND_COLUMNS)[number], string>;
export type RecordKind = 'suppliers' | 'demands';

export interface ValidationIssue {
  line: number;
  field: string;
  message: string;
}

export interface ValidationResult<T> {
  valid: T[];
  errors: ValidationIssue[];
  /** ファイル内で重複しているID（2件目以降はエラーとして扱う） */
  duplicateIdsInFile: string[];
  rowCount: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidSourceUrl(value: string): boolean {
  if (value.startsWith('fictional://')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function checkCommon(
  row: Record<string, string>,
  line: number,
  required: readonly string[],
  issues: ValidationIssue[],
) {
  for (const field of required) {
    if (!row[field]) issues.push({ line, field, message: '必須項目が空欄です' });
  }
  if (row.source_url && !isValidSourceUrl(row.source_url)) {
    issues.push({ line, field: 'source_url', message: 'URLは http(s):// で始めてください（架空データは fictional:// 可）' });
  }
  if (row.license_status && !(LICENSE_STATUSES as readonly string[]).includes(row.license_status)) {
    issues.push({ line, field: 'license_status', message: `許可された値: ${LICENSE_STATUSES.join(' / ')}` });
  }
}

/** CSVテキストを検証する。列構成・必須項目・値域・重複をチェックし、正常な行だけを返す。 */
export function validateCsv(kind: 'suppliers', text: string): ValidationResult<SupplierRecord>;
export function validateCsv(kind: 'demands', text: string): ValidationResult<DemandRecord>;
export function validateCsv(kind: RecordKind, text: string): ValidationResult<SupplierRecord | DemandRecord>;
export function validateCsv(kind: RecordKind, text: string): ValidationResult<SupplierRecord | DemandRecord> {
  const rows = parseCsv(text);
  const errors: ValidationIssue[] = [];
  const valid: (SupplierRecord | DemandRecord)[] = [];
  const duplicateIdsInFile: string[] = [];

  if (rows.length === 0) {
    return { valid, errors: [{ line: 1, field: '-', message: 'ファイルが空です' }], duplicateIdsInFile, rowCount: 0 };
  }

  const columns = kind === 'suppliers' ? SUPPLIER_COLUMNS : DEMAND_COLUMNS;
  const required = kind === 'suppliers' ? SUPPLIER_REQUIRED : DEMAND_REQUIRED;
  const idField = kind === 'suppliers' ? 'supplier_id' : 'demand_id';

  const header = rows[0].map((h) => h.trim());
  const missing = columns.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    errors.push({ line: 1, field: missing.join(','), message: `必要な列がありません: ${missing.join(', ')}` });
    return { valid, errors, duplicateIdsInFile, rowCount: rows.length - 1 };
  }

  const seen = new Set<string>();
  const dataRows = rows.slice(1);
  dataRows.forEach((cells, index) => {
    const line = index + 2;
    if (cells.length !== header.length) {
      errors.push({ line, field: '-', message: `列数が一致しません（期待 ${header.length}、実際 ${cells.length}）` });
      return;
    }
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cells[i].trim()));

    const rowIssues: ValidationIssue[] = [];
    checkCommon(row, line, required, rowIssues);

    if (kind === 'demands') {
      if (row.demand_type && !(DEMAND_TYPES as readonly string[]).includes(row.demand_type)) {
        rowIssues.push({ line, field: 'demand_type', message: `許可された値: ${DEMAND_TYPES.join(' / ')}` });
      }
      for (const f of ['published_at', 'deadline']) {
        if (row[f] && !DATE_RE.test(row[f])) {
          rowIssues.push({ line, field: f, message: '日付は YYYY-MM-DD 形式で入力してください' });
        }
      }
    }

    const id = row[idField];
    if (id && seen.has(id)) {
      duplicateIdsInFile.push(id);
      rowIssues.push({ line, field: idField, message: 'ファイル内でIDが重複しています' });
    }
    if (id) seen.add(id);

    if (rowIssues.length > 0) {
      errors.push(...rowIssues);
      return;
    }
    const normalized: Record<string, string> = {};
    for (const c of columns) normalized[c] = row[c] ?? '';
    valid.push(normalized as SupplierRecord | DemandRecord);
  });

  return { valid, errors, duplicateIdsInFile, rowCount: dataRows.length };
}

/** テンプレートCSVの先頭行（列名）を返す */
export function templateHeaders(kind: RecordKind): readonly string[] {
  return kind === 'suppliers' ? SUPPLIER_COLUMNS : DEMAND_COLUMNS;
}

/** 1件のレコード（画面からの編集内容）を検証する。CSV検証と同じルールを使う */
export function validateRecordObject(kind: RecordKind, record: Record<string, string>): ValidationIssue[] {
  const csv = toCsv(templateHeaders(kind), [record]);
  return validateCsv(kind, csv).errors;
}
