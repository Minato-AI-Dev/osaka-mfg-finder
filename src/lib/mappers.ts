/**
 * CSV（snake_case）⇔ DB（camelCase）の相互変換。
 * 命名規則: 画面・API・CSVは snake_case、DBの列は camelCase で保持する。
 */
import type { DemandRecord, SupplierRecord } from './records';

export const SUPPLIER_FIELD_MAP: Record<keyof SupplierRecord, string> = {
  supplier_id: 'id',
  name: 'name',
  location: 'location',
  industry: 'industry',
  processes: 'processes',
  materials: 'materials',
  equipment: 'equipment',
  precision: 'precision',
  dimensions: 'dimensions',
  capacity: 'capacity',
  products: 'products',
  strengths: 'strengths',
  source_url: 'sourceUrl',
  license_status: 'licenseStatus',
};

export const DEMAND_FIELD_MAP: Record<keyof DemandRecord, string> = {
  demand_id: 'id',
  title: 'title',
  issuer: 'issuer',
  industry: 'industry',
  problem: 'problem',
  required_functions: 'requiredFunctions',
  required_technologies: 'requiredTechnologies',
  materials: 'materials',
  required_conditions: 'requiredConditions',
  desired_conditions: 'desiredConditions',
  quantity_delivery: 'quantityDelivery',
  region: 'region',
  published_at: 'publishedAt',
  deadline: 'deadline',
  source_url: 'sourceUrl',
  license_status: 'licenseStatus',
  demand_type: 'demandType',
};

type AnyRow = Record<string, unknown>;

function rowToRecord<T extends Record<string, string>>(row: AnyRow, map: Record<string, string>): T {
  const out: Record<string, string> = {};
  for (const [snake, camel] of Object.entries(map)) {
    const v = row[camel];
    out[snake] = typeof v === 'string' ? v : '';
  }
  return out as T;
}

export function toSupplierRecord(row: AnyRow): SupplierRecord {
  return rowToRecord<SupplierRecord>(row, SUPPLIER_FIELD_MAP);
}

export function toDemandRecord(row: AnyRow): DemandRecord {
  return rowToRecord<DemandRecord>(row, DEMAND_FIELD_MAP);
}

/** Prisma の create/update に渡せる形へ変換する（id を含む） */
export function supplierToDb(r: SupplierRecord): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [snake, camel] of Object.entries(SUPPLIER_FIELD_MAP)) out[camel] = r[snake as keyof SupplierRecord];
  return out;
}

export function demandToDb(r: DemandRecord): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [snake, camel] of Object.entries(DEMAND_FIELD_MAP)) out[camel] = r[snake as keyof DemandRecord];
  return out;
}
