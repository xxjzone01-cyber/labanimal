import { describe, it, expect } from 'vitest';
import {
  mapRow,
  mapRows,
  mapDate,
  mapBoolean,
  mapEnum,
  mapInt,
  mapFloat,
  mapString,
  ANIMAL_STATUS,
  SEX,
  CAGE_STATUS,
} from '../src/mappers/field-mapper.js';
import type { FieldMapping } from '../src/mappers/field-mapper.js';

describe('mapDate', () => {
  it('null 返回 null', () => {
    expect(mapDate(null)).toBeNull();
  });

  it('undefined 返回 null', () => {
    expect(mapDate(undefined)).toBeNull();
  });

  it('空字符串返回 null', () => {
    expect(mapDate('')).toBeNull();
  });

  it('ISO 8601 字符串转 Date', () => {
    const result = mapDate('2024-01-15T10:30:00Z');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2024);
  });

  it('YYYY-MM-DD 字符串转 Date', () => {
    const result = mapDate('2024-06-01');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getMonth()).toBe(5); // 6月 = 5
  });

  it('Unix timestamp（秒）转 Date', () => {
    const ts = 1700000000; // 2023-11-14
    const result = mapDate(ts);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2023);
  });

  it('Unix timestamp（毫秒）转 Date', () => {
    const ts = 1700000000000;
    const result = mapDate(ts);
    expect(result).toBeInstanceOf(Date);
  });

  it('Date 对象直接返回', () => {
    const d = new Date('2024-01-01');
    expect(mapDate(d)).toBe(d);
  });

  it('无效字符串返回 null', () => {
    expect(mapDate('not-a-date')).toBeNull();
  });
});

describe('mapBoolean', () => {
  it('true 返回 true', () => {
    expect(mapBoolean(true)).toBe(true);
  });

  it('false 返回 false', () => {
    expect(mapBoolean(false)).toBe(false);
  });

  it('1 返回 true', () => {
    expect(mapBoolean(1)).toBe(true);
  });

  it('0 返回 false', () => {
    expect(mapBoolean(0)).toBe(false);
  });

  it('"true" 返回 true', () => {
    expect(mapBoolean('true')).toBe(true);
  });

  it('"1" 返回 true', () => {
    expect(mapBoolean('1')).toBe(true);
  });

  it('"yes" 返回 true', () => {
    expect(mapBoolean('yes')).toBe(true);
  });

  it('"false" 返回 false', () => {
    expect(mapBoolean('false')).toBe(false);
  });

  it('null 返回 false', () => {
    expect(mapBoolean(null)).toBe(false);
  });

  it('undefined 返回 false', () => {
    expect(mapBoolean(undefined)).toBe(false);
  });
});

describe('mapEnum', () => {
  it('有效枚举值直接返回', () => {
    expect(mapEnum('active', ANIMAL_STATUS, 'active')).toBe('active');
  });

  it('大写转小写', () => {
    expect(mapEnum('ACTIVE', ANIMAL_STATUS, 'active')).toBe('active');
  });

  it('空格转下划线', () => {
    expect(mapEnum('experimental endpoint', ['experimental_endpoint'], 'natural')).toBe('experimental_endpoint');
  });

  it('连字符转下划线', () => {
    expect(mapEnum('experimental-endpoint', ['experimental_endpoint'], 'natural')).toBe('experimental_endpoint');
  });

  it('无效值返回 fallback', () => {
    expect(mapEnum('invalid', ANIMAL_STATUS, 'active')).toBe('active');
  });

  it('null 返回 fallback', () => {
    expect(mapEnum(null, ANIMAL_STATUS, 'active')).toBe('active');
  });

  it('空字符串返回 fallback', () => {
    expect(mapEnum('', ANIMAL_STATUS, 'active')).toBe('active');
  });
});

describe('mapInt', () => {
  it('整数返回整数', () => {
    expect(mapInt(42)).toBe(42);
  });

  it('浮点数取整', () => {
    expect(mapInt(3.7)).toBe(3);
  });

  it('字符串数字转整数', () => {
    expect(mapInt('100')).toBe(100);
  });

  it('null 返回 null', () => {
    expect(mapInt(null)).toBeNull();
  });

  it('空字符串返回 null', () => {
    expect(mapInt('')).toBeNull();
  });

  it('非数字返回 null', () => {
    expect(mapInt('abc')).toBeNull();
  });
});

describe('mapFloat', () => {
  it('浮点数返回浮点数', () => {
    expect(mapFloat(3.14)).toBe(3.14);
  });

  it('字符串数字转浮点数', () => {
    expect(mapFloat('2.5')).toBe(2.5);
  });

  it('null 返回 null', () => {
    expect(mapFloat(null)).toBeNull();
  });

  it('非数字返回 null', () => {
    expect(mapFloat('abc')).toBeNull();
  });
});

describe('mapString', () => {
  it('字符串返回 trim 后的字符串', () => {
    expect(mapString('  hello  ')).toBe('hello');
  });

  it('null 返回 null', () => {
    expect(mapString(null)).toBeNull();
  });

  it('空字符串返回 null', () => {
    expect(mapString('')).toBeNull();
  });

  it('数字转字符串', () => {
    expect(mapString(42)).toBe('42');
  });
});

describe('mapRow', () => {
  const mappings: FieldMapping[] = [
    { source: 'id', target: 'id' },
    { source: 'name', target: 'name', transform: mapString },
    { source: 'is_active', target: 'isActive', transform: mapBoolean },
    { source: 'created_at', target: 'createdAt', transform: mapDate },
  ];

  it('按映射规则转换行数据', () => {
    const row = {
      id: '123',
      name: '  Test  ',
      is_active: 1,
      created_at: '2024-01-01',
    };

    const result = mapRow(row, mappings);
    expect(result.id).toBe('123');
    expect(result.name).toBe('Test');
    expect(result.isActive).toBe(true);
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('缺失字段返回 undefined', () => {
    const row = { id: '123' };
    const result = mapRow(row, mappings);
    expect(result.id).toBe('123');
    expect(result.name).toBeNull(); // mapString(null) = null
    expect(result.isActive).toBe(false); // mapBoolean(undefined) = false
  });

  it('支持 snake_case 和 camelCase 源字段', () => {
    const dualMappings: FieldMapping[] = [
      { source: 'internal_id', target: 'internalId' },
      { source: 'internalId', target: 'internalId' },
    ];

    const snakeRow = { internal_id: 'A001' };
    const camelRow = { internalId: 'A001' };

    expect(mapRow(snakeRow, dualMappings).internalId).toBe('A001');
    expect(mapRow(camelRow, dualMappings).internalId).toBe('A001');
  });
});

describe('mapRows', () => {
  it('批量映射多行数据', () => {
    const mappings: FieldMapping[] = [
      { source: 'name', target: 'name', transform: mapString },
    ];

    const rows = [
      { name: 'Alice' },
      { name: 'Bob' },
    ];

    const result = mapRows(rows, mappings);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Alice');
    expect(result[1].name).toBe('Bob');
  });

  it('空数组返回空数组', () => {
    expect(mapRows([], [])).toEqual([]);
  });
});
