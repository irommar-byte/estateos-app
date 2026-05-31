/** Układ galerii oferty — duże zdjęcie główne + mniejsze kafle (styl premium / Apple). */

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
};

/** Maks. 5 zdjęć w siatce głównej — reszta w poziomej taśmie poniżej. */
export const OFFER_GALLERY_GRID_MAX = 5;

export function offerPhotoMosaicCells(count: number): MosaicCell[] {
  const n = Math.max(0, Math.min(count, OFFER_GALLERY_GRID_MAX));
  if (n === 0) return [];
  return LAYOUTS[n] ?? LAYOUTS[5];
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
