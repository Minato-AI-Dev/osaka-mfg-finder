/**
 * DB操作（CRUD・インポート・検索）。API Route から呼ばれる。
 */
import type { Prisma } from '@prisma/client';
import { db } from './db';
import type { DemandRecord, SupplierRecord } from './records';
import { demandToDb, supplierToDb, toDemandRecord, toSupplierRecord } from './mappers';

export interface SupplierFilter {
  q?: string;
  industry?: string;
  process?: string;
  license?: string;
}

export interface DemandFilter {
  q?: string;
  industry?: string;
  demandType?: string;
  license?: string;
}

function contains(value: string | undefined) {
  return value && value.trim() ? { contains: value.trim() } : undefined;
}

export async function listSuppliers(f: SupplierFilter = {}): Promise<SupplierRecord[]> {
  const q = f.q?.trim();
  const rows = await db.supplier.findMany({
    where: {
      industry: contains(f.industry),
      processes: contains(f.process),
      licenseStatus: f.license || undefined,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { processes: { contains: q } },
              { materials: { contains: q } },
              { products: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { id: 'asc' },
  });
  return rows.map(toSupplierRecord);
}

export async function listDemands(f: DemandFilter = {}): Promise<DemandRecord[]> {
  const q = f.q?.trim();
  const rows = await db.demand.findMany({
    where: {
      industry: contains(f.industry),
      demandType: f.demandType || undefined,
      licenseStatus: f.license || undefined,
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { problem: { contains: q } },
              { requiredTechnologies: { contains: q } },
              { materials: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { id: 'asc' },
  });
  return rows.map(toDemandRecord);
}

export async function getSupplier(id: string) {
  const row = await db.supplier.findUnique({ where: { id } });
  return row ? toSupplierRecord(row) : null;
}

export async function getDemand(id: string) {
  const row = await db.demand.findUnique({ where: { id } });
  return row ? toDemandRecord(row) : null;
}

/** 既存IDの一覧（インポート時の重複確認用） */
export async function existingIds(kind: 'suppliers' | 'demands', ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows =
    kind === 'suppliers'
      ? await db.supplier.findMany({ where: { id: { in: ids } }, select: { id: true } })
      : await db.demand.findMany({ where: { id: { in: ids } }, select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

/** 検証済みレコードを登録する。同じIDは更新（上書き）する。埋め込み・構造化キャッシュは内容変更時にリセットする。 */
export async function importRecords(kind: 'suppliers', records: SupplierRecord[]): Promise<{ created: number; updated: number }>;
export async function importRecords(kind: 'demands', records: DemandRecord[]): Promise<{ created: number; updated: number }>;
export async function importRecords(kind: 'suppliers' | 'demands', records: SupplierRecord[] | DemandRecord[]) {
  let created = 0;
  let updated = 0;
  if (kind === 'suppliers') {
    const list = records as SupplierRecord[];
    const existing = await existingIds('suppliers', list.map((r) => r.supplier_id));
    for (const s of list) {
      const { id, ...rest } = supplierToDb(s);
      const data = { ...rest, structured: null, embedding: null };
      await db.supplier.upsert({
        where: { id },
        create: { id, ...data } as Prisma.SupplierUncheckedCreateInput,
        update: data as Prisma.SupplierUncheckedUpdateInput,
      });
      if (existing.has(s.supplier_id)) updated++;
      else created++;
    }
  } else {
    const list = records as DemandRecord[];
    const existing = await existingIds('demands', list.map((r) => r.demand_id));
    for (const d of list) {
      const { id, ...rest } = demandToDb(d);
      const data = { ...rest, structured: null, embedding: null };
      await db.demand.upsert({
        where: { id },
        create: { id, ...data } as Prisma.DemandUncheckedCreateInput,
        update: data as Prisma.DemandUncheckedUpdateInput,
      });
      if (existing.has(d.demand_id)) updated++;
      else created++;
    }
  }
  return { created, updated };
}

/** 企業の編集。構造化・埋め込みキャッシュは無効化する */
export async function updateSupplier(id: string, r: SupplierRecord) {
  const { id: _omit, ...rest } = supplierToDb({ ...r, supplier_id: id });
  await db.supplier.update({
    where: { id },
    data: { ...rest, structured: null, embedding: null } as Prisma.SupplierUncheckedUpdateInput,
  });
  await db.analysis.deleteMany({ where: { supplierId: id } });
}

export async function updateDemand(id: string, r: DemandRecord) {
  const { id: _omit, ...rest } = demandToDb({ ...r, demand_id: id });
  await db.demand.update({
    where: { id },
    data: { ...rest, structured: null, embedding: null } as Prisma.DemandUncheckedUpdateInput,
  });
  await db.analysis.deleteMany({ where: { demandId: id } });
}

/** 企業を削除し、関連する評価・分析・正解データも消す */
export async function deleteSupplier(id: string) {
  await db.$transaction([
    db.evaluation.deleteMany({ where: { supplierId: id } }),
    db.analysis.deleteMany({ where: { supplierId: id } }),
    db.groundTruth.deleteMany({ where: { supplierId: id } }),
    db.supplier.delete({ where: { id } }),
  ]);
}

export async function deleteDemand(id: string) {
  await db.$transaction([
    db.evaluation.deleteMany({ where: { demandId: id } }),
    db.analysis.deleteMany({ where: { demandId: id } }),
    db.groundTruth.deleteMany({ where: { demandId: id } }),
    db.demand.delete({ where: { id } }),
  ]);
}
