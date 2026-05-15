import {
  __clearHandoverProtocolStoreForTests,
  cloneHandoverProtocol,
  createEmptyHandoverProtocol,
  finalizeHandoverProtocolForSave,
  formatHandoverProtocolTimestamp,
  getHandoverProtocol,
  getOrCreateHandoverProtocol,
  handoverProtocolHasContent,
  handoverProtocolSectionHasContent,
  handoverProtocolSignatureHasContent,
  handoverProtocolsEqual,
  saveHandoverProtocol,
} from "../handoverProtocol";

describe("handoverProtocol", () => {
  beforeEach(() => {
    __clearHandoverProtocolStoreForTests();
  });

  it("creates empty protocol for booking id", () => {
    const p = createEmptyHandoverProtocol("42");
    expect(p.bookingId).toBe("42");
    expect(p.handover.notes).toBe("");
    expect(p.vehicleReturn.photos).toEqual([]);
    expect(handoverProtocolHasContent(p)).toBe(false);
  });

  it("detects section content", () => {
    const p = createEmptyHandoverProtocol("1");
    expect(handoverProtocolSectionHasContent(p.handover)).toBe(false);
    p.handover.notes = "  ";
    expect(handoverProtocolSectionHasContent(p.handover)).toBe(false);
    p.handover.notes = "Kratzer";
    expect(handoverProtocolSectionHasContent(p.handover)).toBe(true);
    expect(handoverProtocolHasContent(p)).toBe(true);
  });

  it("detects signature as section content", () => {
    const p = createEmptyHandoverProtocol("2");
    p.handover.customerSignature.strokes = [[{ x: 1, y: 2 }]];
    expect(handoverProtocolSignatureHasContent(p.handover.customerSignature)).toBe(true);
    expect(handoverProtocolSectionHasContent(p.handover)).toBe(true);
  });

  it("persists protocol in memory store", () => {
    const draft = getOrCreateHandoverProtocol("99");
    draft.handover.notes = "Annahme ok";
    saveHandoverProtocol(draft);
    expect(getHandoverProtocol("99")?.handover.notes).toBe("Annahme ok");
    expect(getHandoverProtocol("100")).toBeNull();
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
    expect(saved.vehicleReturn.updatedAt).toBeNull();
  });

  it("finalize stamps customer signature signedAt", () => {
    const draft = createEmptyHandoverProtocol("8");
    draft.handover.customerSignature.strokes = [
      [
        { x: 0, y: 0 },
        { x: 10, y: 5 },
      ],
    ];
    const saved = finalizeHandoverProtocolForSave(draft, null);
    expect(saved.handover.customerSignature.signedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("formatHandoverProtocolTimestamp returns de-DE style", () => {
    const label = formatHandoverProtocolTimestamp("2026-05-15T14:30:00.000Z");
    expect(label).toMatch(/15\.05\.2026/);
  });
});
