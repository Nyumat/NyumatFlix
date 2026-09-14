import expandedTables from "./animekai-expanded-tables.json";

type ExpandedTables = {
  maxLen: number;
  expandedChars: string[];
  offsetMaps: Record<string, number[]>;
  coreCells: Record<string, number[]>;
  suffix: Record<string, number[]>;
};

const tables = expandedTables as ExpandedTables;

export function isExpandedCipherChar(
  ch: string,
  encByte: number | undefined,
  spaceByte: number | undefined,
): boolean {
  return (
    encByte !== undefined &&
    spaceByte !== undefined &&
    ch !== " " &&
    encByte === spaceByte
  );
}

export function getExpandedOffsets(plainLen: number, pos: number): number[] {
  return tables.offsetMaps[`${plainLen}:${pos}`] ?? [];
}

export function getExpandedCellBytes(
  plainLen: number,
  pos: number,
  ch: string,
): number[] {
  const core = tables.coreCells[`${pos}:${ch}`];
  if (!core) {
    throw new Error(`Missing expanded core cell for pos ${pos} char ${ch}`);
  }
  const suf = tables.suffix[`${plainLen}:${pos}`] ?? [];
  return [...core, ...suf];
}

export function expandedTablesMaxLen(): number {
  return tables.maxLen;
}

export function listExpandedChars(): string[] {
  return tables.expandedChars;
}

export function bytesMatch(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
