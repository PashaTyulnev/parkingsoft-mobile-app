import { Platform } from "react-native";
import UPNG from "upng-js";
import { lineSegmentsScaledToFit } from "./signatureRaster";

const EXPORT_WIDTH = 600;
const EXPORT_HEIGHT = 280;
const STROKE_WIDTH = 3;

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToBase64(bytes) {
  if (typeof globalThis.btoa === "function") {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      const slice = bytes.subarray(i, i + chunk);
      binary += String.fromCharCode.apply(null, /** @type {number[]} */ (slice));
    }
    return globalThis.btoa(binary);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  throw new Error("Base64 encoding not available");
}

/**
 * @param {Array<Array<{ x: number; y: number }>>} strokes
 * @param {number} width
 * @param {number} height
 * @returns {Uint8ClampedArray}
 */
export function rasterizeSignatureStrokes(strokes, width, height) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 255;
    rgba[i + 1] = 255;
    rgba[i + 2] = 255;
    rgba[i + 3] = 255;
  }

  const segments = lineSegmentsScaledToFit(strokes, width, height, 12, STROKE_WIDTH);
  for (const seg of segments) {
    paintThickLine(rgba, width, height, seg.from.x, seg.from.y, seg.to.x, seg.to.y, STROKE_WIDTH);
  }
  return rgba;
}

/**
 * @param {Uint8ClampedArray} rgba
 * @param {number} width
 * @param {number} height
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {number} thickness
 */
function paintThickLine(rgba, width, height, x0, y0, x1, y1, thickness) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist * 2));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    paintDot(rgba, width, height, x, y, thickness);
  }
}

/**
 * @param {Uint8ClampedArray} rgba
 * @param {number} width
 * @param {number} height
 * @param {number} cx
 * @param {number} cy
 * @param {number} thickness
 */
function paintDot(rgba, width, height, cx, cy, thickness) {
  const r = Math.max(1, thickness / 2);
  const minX = Math.max(0, Math.floor(cx - r));
  const maxX = Math.min(width - 1, Math.ceil(cx + r));
  const minY = Math.max(0, Math.floor(cy - r));
  const maxY = Math.min(height - 1, Math.ceil(cy + r));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (Math.hypot(x - cx, y - cy) <= r) {
        const idx = (y * width + x) * 4;
        rgba[idx] = 17;
        rgba[idx + 1] = 17;
        rgba[idx + 2] = 17;
        rgba[idx + 3] = 255;
      }
    }
  }
}

/**
 * @param {Array<Array<{ x: number; y: number }>>} strokes
 * @returns {string | null} `data:image/png;base64,...` or null when empty
 */
export function signatureStrokesToPngDataUrl(strokes) {
  if (!Array.isArray(strokes) || !strokes.some((s) => Array.isArray(s) && s.length > 0)) {
    return null;
  }

  if (Platform.OS === "web" && typeof document !== "undefined") {
    const url = signatureStrokesToPngDataUrlWebCanvas(strokes, EXPORT_WIDTH, EXPORT_HEIGHT);
    if (url) return url;
  }

  const rgba = rasterizeSignatureStrokes(strokes, EXPORT_WIDTH, EXPORT_HEIGHT);
  const pngBuffer = UPNG.encode([rgba.buffer], EXPORT_WIDTH, EXPORT_HEIGHT, 0);
  const bytes = new Uint8Array(/** @type {ArrayBuffer} */ (pngBuffer));
  return `data:image/png;base64,${bytesToBase64(bytes)}`;
}

/**
 * @param {Array<Array<{ x: number; y: number }>>} strokes
 * @param {number} width
 * @param {number} height
 * @returns {string | null}
 */
export function signatureStrokesToPngDataUrlWebCanvas(strokes, width, height) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = STROKE_WIDTH;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const segments = lineSegmentsScaledToFit(strokes, width, height, 12, STROKE_WIDTH);
  for (const seg of segments) {
    ctx.beginPath();
    ctx.moveTo(seg.from.x, seg.from.y);
    ctx.lineTo(seg.to.x, seg.to.y);
    ctx.stroke();
  }

  return canvas.toDataURL("image/png");
}
