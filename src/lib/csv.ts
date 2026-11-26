/**
 * 外部ライブラリを使わない最小限のCSV処理。
 * ダブルクォート・改行を含むフィールドに対応する（RFC 4180 相当）。
 */

/** CSV文字列を行配列に変換する。先頭BOMと空行は除去する。 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r') {
      // CRLF の CR は無視する
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

/** レコード配列をCSV文字列にする。Excelで文字化けしないようBOMを付ける。 */
export function toCsv(headers: readonly string[], records: Record<string, string>[]): string {
  const escape = (value: string) =>
    /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const lines = [
    headers.map(escape).join(','),
    ...records.map((r) => headers.map((h) => escape(r[h] ?? '')).join(',')),
  ];
  return '﻿' + lines.join('\r\n') + '\r\n';
}
