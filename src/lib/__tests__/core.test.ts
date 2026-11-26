import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv, toCsv } from '../csv';
import { validateCsv, DEMAND_COLUMNS, SUPPLIER_COLUMNS } from '../records';
import { cosineSimilarity, keywordScore, splitTerms } from '../search';
import { postProcessAnalysis, HARD_CONFLICT_SCORE_CAP } from '../match';
import { precisionAtK } from '../metrics';
import type { DemandRecord, SupplierRecord } from '../records';

const SAMPLE = path.resolve(__dirname, '../../../sample-data');
const readSample = (name: string) => fs.readFileSync(path.join(SAMPLE, name), 'utf8');

describe('csv', () => {
  it('quoted fields with commas, quotes and newlines round-trip', () => {
    const rows = parseCsv('a,b\r\n"x,y","He said ""hi"""\r\n"line1\nline2",z\r\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x,y', 'He said "hi"'],
      ['line1\nline2', 'z'],
    ]);
  });

  it('strips BOM and blank lines', () => {
    expect(parseCsv('﻿a,b\n\n1,2\n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('toCsv escapes special characters and starts with BOM', () => {
    const out = toCsv(['k', 'v'], [{ k: '1', v: 'a,"b"' }]);
    expect(out.startsWith('﻿')).toBe(true);
    expect(parseCsv(out)).toEqual([['k', 'v'], ['1', 'a,"b"']]);
  });
});

describe('validateCsv (sample data)', () => {
  it('sample suppliers are all valid (10 fictional companies)', () => {
    const r = validateCsv('suppliers', readSample('suppliers_sample.csv'));
    expect(r.errors).toEqual([]);
    expect(r.valid).toHaveLength(10);
    expect(r.valid.every((s) => s.name.startsWith('【架空】'))).toBe(true);
  });

  it('sample demands are all valid (15 items) and cover all 4 demand types', () => {
    const r = validateCsv('demands', readSample('demands_sample.csv'));
    expect(r.errors).toEqual([]);
    expect(r.valid).toHaveLength(15);
    const types = new Set(r.valid.map((d) => d.demand_type));
    expect(types).toEqual(new Set(['order', 'tech_search', 'rnd_theme', 'hypothesis']));
  });
});

describe('validateCsv (error cases)', () => {
  const header = SUPPLIER_COLUMNS.join(',');
  // 全列を埋めた行を組み立てる（列数不一致を混ぜないため）
  const mk = (vals: Record<string, string>) => SUPPLIER_COLUMNS.map((c) => vals[c] ?? 'x').join(',');
  const good = mk({ supplier_id: 'S-1', name: '社名', location: '大阪府', industry: '業種', processes: '加工', source_url: 'https://example.com/x', license_status: 'fictional' });

  it('reports missing columns', () => {
    const r = validateCsv('suppliers', 'supplier_id,name\nS-1,x');
    expect(r.valid).toEqual([]);
    expect(r.errors[0].message).toContain('必要な列がありません');
  });

  it('flags empty required fields, bad URL, bad license, and duplicates in the file', () => {
    const text = [
      header,
      good,
      mk({ supplier_id: 'S-2', name: '', location: '大阪府', industry: '業種', processes: '加工', source_url: 'not-a-url', license_status: 'bogus' }),
      mk({ supplier_id: 'S-1', name: '別社', location: '大阪府', industry: '業種', processes: '加工', source_url: 'https://example.com/y', license_status: 'unverified' }),
      'S-3,short-row',
    ].join('\n');
    const r = validateCsv('suppliers', text);
    expect(r.duplicateIdsInFile).toEqual(['S-1']);
    expect(r.valid.map((v) => v.supplier_id)).toEqual(['S-1']);
    const fields = r.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'source_url', 'license_status', 'supplier_id', '-']));
  });

  it('rejects an invalid demand_type and non-ISO dates', () => {
    const dh = DEMAND_COLUMNS.join(',');
    const row = 'D-1,題,発信元,業界,課題,機能,技術,材料,条件,希望,数量,地域,2026/01/01,2027-01-01,fictional://x,fictional,guess';
    const r = validateCsv('demands', `${dh}\n${row}`);
    expect(r.valid).toEqual([]);
    const fields = r.errors.map((e) => e.field);
    expect(fields).toContain('demand_type');
    expect(fields).toContain('published_at');
  });

  it('accepts the valid row when fixed', () => {
    const r = validateCsv('suppliers', `${header}\n${good}`);
    expect(r.errors).toEqual([]);
    expect(r.valid).toHaveLength(1);
    expect(r.valid[0].supplier_id).toBe('S-1');
  });
});

describe('keyword search', () => {
  it('splitTerms separates Japanese list delimiters and drops 1-char tokens', () => {
    expect(splitTerms('ホブ切り、歯切り・歯面研削（社内）')).toEqual(['ホブ切り', '歯切り', '歯面研削', '社内']);
  });

  it('scores the fraction of query terms found verbatim', () => {
    const r = keywordScore(['SUS304', 'アルミ', '銅合金'], 'SUS304 とアルミ加工');
    expect(r.score).toBe(67);
    expect(r.matched).toEqual(['SUS304', 'アルミ']);
  });

  it('returns 0 for empty query', () => {
    expect(keywordScore([], 'anything')).toEqual({ score: 0, matched: [] });
  });
});

describe('cosine similarity', () => {
  it('identical vectors give 1, orthogonal give 0, zero vector gives 0', () => {
    expect(cosineSimilarity([1, 2], [1, 2])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe('precision@K', () => {
  it('counts relevant items in the top K', () => {
    const r = precisionAtK(['a', 'b', 'c', 'd'], new Set(['a', 'c']), 3);
    expect(r).toEqual({ k: 3, hits: 2, precision: 2 / 3 });
  });
});

describe('postProcessAnalysis', () => {
  const supplier = {
    supplier_id: 'S-1', name: 'A社', location: '大阪', industry: '機械', processes: '精密切削加工',
    materials: 'SUS304、アルミ', equipment: 'NC旋盤', precision: '±0.01mm', dimensions: 'φ2〜200mm',
    capacity: '1〜500個', products: '医療部品', strengths: '短納期', source_url: 'fictional://s', license_status: 'fictional',
  } as SupplierRecord;
  const demand = {
    demand_id: 'D-1', title: '試作', issuer: '発信元', industry: '医療機器', problem: '課題',
    required_functions: '', required_technologies: '精密切削加工', materials: 'SUS304', required_conditions: '±0.01mm',
    desired_conditions: '', quantity_delivery: '10個', region: '', published_at: '', deadline: '',
    source_url: 'fictional://d', license_status: 'fictional', demand_type: 'order',
  } as DemandRecord;

  it('drops evidence excerpts that do not appear verbatim in the source', () => {
    const raw = {
      match_score: 80,
      evidence: [
        { source_type: 'supplier', field: 'materials', excerpt: 'SUS304' }, // 実在
        { source_type: 'supplier', field: 'materials', excerpt: 'チタン' }, // 捏造
        { source_type: 'demand', field: 'nonexistent', excerpt: 'x' },       // 存在しない列
      ],
    };
    const r = postProcessAnalysis(raw, supplier, demand, 'test-model');
    expect(r.evidence).toEqual([{ source_type: 'supplier', field: 'materials', excerpt: 'SUS304' }]);
    expect(r.dropped_evidence).toBe(2);
    expect(r.match_status).toBe('candidate');
    expect(r.match_score).toBe(80);
  });

  it('caps score and excludes the candidate when a hard constraint conflicts', () => {
    const raw = {
      match_score: 95,
      hard_constraint_conflicts: ['チタン合金は取り扱いがない'],
    };
    const r = postProcessAnalysis(raw, supplier, demand, 'test-model');
    expect(r.match_status).toBe('excluded_hard_conflict');
    expect(r.match_score).toBe(HARD_CONFLICT_SCORE_CAP);
    expect(r.hard_constraint_conflicts).toHaveLength(1);
  });

  it('clamps out-of-range scores and tolerates malformed output', () => {
    expect(postProcessAnalysis({ match_score: 500 }, supplier, demand, 'm').match_score).toBe(100);
    const bad = postProcessAnalysis('not json object', supplier, demand, 'm');
    expect(bad.match_score).toBe(0);
    expect(bad.unknown_conditions).toEqual([]);
  });
});
