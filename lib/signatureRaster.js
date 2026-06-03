/** Shared stroke scaling for preview + PNG export. */

export const COMPACT_PADDING = 6;

/**
 * @param {Array<Array<{ x: number; y: number }>>} strokes
 * @param {number} width
 * @param {number} height
 * @param {number} [padding]
 * @param {number} [_strokeWidth]
 * @returns {Array<{ from: { x: number; y: number }; to: { x: number; y: number }; key: string }>}
 */
export function lineSegmentsScaledToFit(strokes, width, height, padding = COMPACT_PADDING) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const stroke of strokes) {
    for (const p of stroke) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }

  if (!Number.isFinite(minX)) return [];

  const boxW = Math.max(maxX - minX, 1);
  const boxH = Math.max(maxY - minY, 1);
  const availW = Math.max(width - padding * 2, 1);
  const availH = Math.max(height - padding * 2, 1);
  const scale = Math.min(availW / boxW, availH / boxH);
  const offsetX = padding + (availW - boxW * scale) / 2;
  const offsetY = padding + (availH - boxH * scale) / 2;

  const mapPoint = (/** @type {{ x: number; y: number }} */ p) => ({
    x: (p.x - minX) * scale + offsetX,
    y: (p.y - minY) * scale + offsetY,
  });

  const segments = [];
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.length; i += 1) {
      segments.push({
        from: mapPoint(stroke[i - 1]),
        to: mapPoint(stroke[i]),
        key: `${segments.length}`,
      });
    }
  }
  return segments;
}
