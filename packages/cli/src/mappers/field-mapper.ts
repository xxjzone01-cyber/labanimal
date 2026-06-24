/**
 * 字段映射器
 *
 * SQLite → Prisma 字段转换：
 * - 日期字符串 → Date 对象
 * - 0/1 → boolean
 * - 枚举值标准化（小写、空格→下划线）
 * - 缺失字段 → 默认值
 */

/** 字段映射定义 */
export interface FieldMapping {
  /** 源列名（SQLite） */
  source: string;
  /** 目标字段名（Prisma） */
  target: string;
  /** 可选的值转换函数 */
  transform?: (value: unknown) => unknown;
}

/**
 * 根据映射规则转换一行数据
 *
 * @param row 源数据行
 * @param mappings 字段映射规则
 * @returns 转换后的数据行
 */
export function mapRow(
  row: Record<string, unknown>,
  mappings: FieldMapping[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const mapping of mappings) {
    const value = row[mapping.source];
    // 只有源字段存在时才更新目标（支持 snake_case / camelCase 双重映射）
    if (value !== undefined) {
      result[mapping.target] = mapping.transform
        ? mapping.transform(value)
        : value;
    } else if (!(mapping.target in result)) {
      // 首次遇到该目标字段且源不存在，设为 undefined
      result[mapping.target] = mapping.transform
        ? mapping.transform(value)
        : undefined;
    }
  }

  return result;
}

/**
 * 批量映射多行数据
 */
export function mapRows(
  rows: Record<string, unknown>[],
  mappings: FieldMapping[]
): Record<string, unknown>[] {
  return rows.map((row) => mapRow(row, mappings));
}

/**
 * 日期字符串 → Date 对象
 * 支持 ISO 8601、YYYY-MM-DD、Unix timestamp（秒/毫秒）
 */
export function mapDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) return value;

  if (typeof value === 'number') {
    // Unix timestamp: 如果 < 1e12 认为是秒，否则毫秒
    return new Date(value < 1e12 ? value * 1000 : value);
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

/**
 * SQLite 0/1 → boolean
 */
export function mapBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return lower === 'true' || lower === '1' || lower === 'yes';
  }
  return false;
}

/**
 * 枚举值标准化：小写 + 空格/连字符→下划线
 *
 * @param value 原始值
 * @param allowed 允许的枚举值列表
 * @param fallback 无匹配时的默认值
 */
export function mapEnum(
  value: unknown,
  allowed: readonly string[],
  fallback: string
): string {
  if (value === null || value === undefined || value === '') return fallback;

  const normalized = String(value)
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');

  if (allowed.includes(normalized)) return normalized;
  return fallback;
}

/**
 * 数值转换：null 安全
 */
export function mapInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return isNaN(n) ? null : Math.floor(n);
}

/**
 * 浮点数转换：null 安全
 */
export function mapFloat(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

/**
 * 字符串转换：null 安全，trim
 */
export function mapString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

// ===== 枚举常量 =====

export const ANIMAL_STATUS = ['active', 'allocated', 'used', 'deceased', 'transferred', 'retired'] as const;
export const QUARANTINE_STATUS = ['none', 'pending', 'quarantined', 'released'] as const;
export const SEX = ['male', 'female', 'unknown'] as const;
export const CAGE_STATUS = ['empty', 'occupied', 'cleaning', 'maintenance'] as const;
export const PROTOCOL_STATUS = ['draft', 'submitted', 'approved', 'rejected', 'expired'] as const;
export const PAIN_CATEGORY = ['B', 'C', 'D', 'E'] as const;
export const RECORD_TYPE = ['check', 'abnormal', 'treatment', 'euthanasia'] as const;
export const DEATH_CAUSE = ['euthanasia', 'natural', 'experimental_endpoint', 'found_dead'] as const;
export const MED_ROUTE = ['oral', 'ip', 'iv', 'sc', 'im', 'topical', 'other'] as const;
export const IDENTIFIER_TYPE = ['ear_tag', 'microchip', 'toe_clip', 'tail_tattoo', 'other'] as const;
export const ENRICHMENT_TYPE = [
  'nesting_material', 'hut', 'tunnel', 'running_wheel',
  'chew_block', 'foraging_device', 'other',
] as const;
export const TRAINING_TYPE = [
  'aalas_lat', 'aalas_latg', 'iacuc_orientation',
  'species_specific', 'surgery', 'euthanasia', 'other',
] as const;
export const TRAINING_STATUS = ['active', 'expired', 'pending_renewal'] as const;
export const USER_ROLE = ['pi', 'caretaker', 'researcher', 'admin', 'veterinarian'] as const;
export const SIGNATURE_MEANING = ['approved', 'reviewed', 'witnessed', 'authored'] as const;
export const ENTITY_TYPE = ['protocol', 'health_record', 'euthanasia', 'audit_entry'] as const;
export const BATCH_MATERIAL_TYPE = ['feed', 'bedding', 'drug', 'reagent', 'other'] as const;
