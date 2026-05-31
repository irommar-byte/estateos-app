/** Układ miniatur na siatce 4×2 — wypełnia prostokąt bez pustych przerw. */

export type MosaicCell = { colSpan: number; rowSpan: number };

const LAYOUTS: Record<number, MosaicCell[]> = {
  1: [{ colSpan: 4, rowSpan: 2 }],
  2: [
    { colSpan: 2, rowSpan: 2 },
    { colSpan: 2, rowSpan: 2 },
  ],
  3: [
    { colSpan: 2, rowSpan: 2 },
    { colSpan: 2, rowSpan: 1 },
    { colSpan: 2, rowSpan: 1 },
  ],
  4: [
    { colSpan: 2, rowSpan: 2 },
    { colSpan: 1, rowSpan: 1 },
    { colSpan: 1, rowSpan: 1 },
    { colSpan: 2, rowSpan: 1 },
  ],
  5: [
    { colSpan: 2, rowSpan: 2 },
    { colSpan: 1, rowSpan: 1 },
    { colSpan: 1, rowSpan: 1 },
    { colSpan: 1, rowSpan: 1 },
    { colSpan: 1, rowSpan: 1 },
  ],
  6: [
    { colSpan: 2, rowSpan: 1 },
    { colSpan: 2, rowSpan: 1 },
    { colSpan: 2, rowSpan: 1 },
    { colSpan: 2, rowSpan: 1 },
    { colSpan: 2, rowSpan: 1 },
    { colSpan: 2, rowSpan: 1 },
  ],
};

export function offerPhotoMosaicCells(count: number): MosaicCell[] {
  const n = Math.max(0, Math.min(count, 6));
  if (n === 0) return [];
  if (LAYOUTS[n]) return LAYOUTS[n];
  return LAYOUTS[6];
}

export function mosaicCellClass(cell: MosaicCell): string {
  const colMap: Record<number, string> = {
    1: "col-span-1",
    2: "col-span-2",
    3: "col-span-3",
    4: "col-span-4",
  };
  const rowMap: Record<number, string> = {
    1: "row-span-1",
    2: "row-span-2",
  };
  return `${colMap[cell.colSpan] ?? "col-span-1"} ${rowMap[cell.rowSpan] ?? "row-span-1"}`;
}
