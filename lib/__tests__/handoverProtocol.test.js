import {
  cloneHandoverProtocol,
  createEmptyHandoverProtocol,
  finalizeHandoverProtocolForSave,
  formatHandoverProtocolTimestamp,
  handoverProtocolHasContent,
  handoverProtocolSectionHasContent,
  handoverProtocolSignatureHasContent,
  handoverProtocolsEqual,
} from "../handoverProtocol";

describe("handoverProtocol", () => {
  it("creates empty protocol for booking id", () => {
    const p = createEmptyHandoverProtocol("42");
    expect(p.bookingId).toBe("42");
    expect(p.handover.notes).toBe("");
    expect(p.vehicleReturn.photos).toEqual([]);
    expect(handoverProtocolHasContent(p)).toBe(false);
  });

  it("detects section content", () => {
    const p = createEmptyHandoverProtocol("1");
    p.handover.notes = "Kratzer";
    expect(handoverProtocolSectionHasContent(p.handover)).toBe(true);
    expect(handoverProtocolHasContent(p)).toBe(true);
  });

  it("detects signatureData as content", () => {
    const p = createEmptyHandoverProtocol("2");
    p.handover.customerSignature.signatureData = "data:image/png;base64,xx";
    expect(handoverProtocolSignatureHasContent(p.handover.customerSignature)).toBe(true);
  });

  it("clone and equality helpers", () => {
    const a = createEmptyHandoverProtocol("5");
    const b = cloneHandoverProtocol(a);
    expect(handoverProtocolsEqual(a, b)).toBe(true);
    b.handover.notes = "x";
    expect(handoverProtocolsEqual(a, b)).toBe(false);
  });

  it("finalize sets updatedAt on changed section with content", () => {
    const draft = createEmptyHandoverProtocol("7");
    draft.handover.notes = "Check";
    const saved = finalizeHandoverProtocolForSave(draft, null);
    expect(saved.handover.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("formatHandoverProtocolTimestamp returns de-DE style", () => {
    const label = formatHandoverProtocolTimestamp("2026-05-15T14:30:00.000Z");
    expect(label).toMatch(/15\.05\.2026/);
  });
});
