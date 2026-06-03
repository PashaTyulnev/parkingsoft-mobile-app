import {
  bytesToBase64,
  rasterizeSignatureStrokes,
  signatureStrokesToPngDataUrl,
} from "../signatureToPngDataUrl";

describe("bytesToBase64", () => {
  it("encodes bytes", () => {
    const encoded = bytesToBase64(new Uint8Array([72, 105]));
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);
  });
});

describe("rasterizeSignatureStrokes", () => {
  it("returns white RGBA buffer with ink pixels", () => {
    const rgba = rasterizeSignatureStrokes(
      [
        [
          { x: 10, y: 10 },
          { x: 50, y: 40 },
        ],
      ],
      100,
      60
    );
    expect(rgba.length).toBe(100 * 60 * 4);
    const hasDark = [...rgba].some((v, i) => i % 4 === 0 && v < 50);
    expect(hasDark).toBe(true);
  });
});

describe("signatureStrokesToPngDataUrl", () => {
  it("returns null for empty strokes", () => {
    expect(signatureStrokesToPngDataUrl([])).toBeNull();
  });

  it("returns data URL for strokes", () => {
    const url = signatureStrokesToPngDataUrl([
      [
        { x: 20, y: 20 },
        { x: 120, y: 80 },
        { x: 200, y: 30 },
      ],
    ]);
    expect(url).toMatch(/^data:image\/png;base64,/);
  });
});
