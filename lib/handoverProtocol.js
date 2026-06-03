/**
 * Handover / return protocol UI model (synced with Booking Protocol API).
 */

/**
 * @typedef {object} HandoverProtocolPhoto
 * @property {string} id
 * @property {string} uri local file or absolute URL
 * @property {number} addedAt epoch ms
 * @property {number} [serverId] API photo id
 * @property {string} [originalName]
 * @property {boolean} [isLocal] pending upload
 */

/**
 * @typedef {object} HandoverProtocolSignature
 * @property {Array<Array<{ x: number; y: number }>>} strokes
 * @property {string | null} signedAt ISO-8601 when signature was last saved
 * @property {string | null} [signatureData] API `data:image/png;base64,...`
 */

/**
 * @typedef {object} HandoverProtocolSection
 * @property {string} notes
 * @property {HandoverProtocolPhoto[]} photos
 * @property {HandoverProtocolSignature} customerSignature
 * @property {string | null} updatedAt ISO-8601 when section was last saved with content
 * @property {boolean} [finalized]
 * @property {number} [protocolId]
 * @property {number | null} [odometer]
 * @property {string | null} [fuelLevel]
 */

/**
 * @typedef {object} HandoverProtocol
 * @property {string} bookingId
 * @property {HandoverProtocolSection} handover Vehicle acceptance
 * @property {HandoverProtocolSection} vehicleReturn Vehicle return (`return` in API docs)
 */

/**
 * @returns {HandoverProtocolSignature}
 */
export function createEmptyHandoverProtocolSignature() {
  return {
    strokes: [],
    signedAt: null,
    signatureData: null,
  };
}

/**
 * @returns {HandoverProtocolSection}
 */
export function createEmptyHandoverProtocolSection() {
  return {
    notes: "",
    photos: [],
    customerSignature: createEmptyHandoverProtocolSignature(),
    updatedAt: null,
    finalized: false,
    protocolId: undefined,
    odometer: null,
    fuelLevel: null,
  };
}

/**
 * @param {HandoverProtocolSignature | null | undefined} signature
 * @returns {boolean}
 */
export function handoverProtocolSignatureHasContent(signature) {
  if (!signature) return false;
  if (signature.signatureData && String(signature.signatureData).trim().length > 0) {
    return true;
  }
  if (!Array.isArray(signature.strokes)) return false;
  return signature.strokes.some((stroke) => Array.isArray(stroke) && stroke.length > 0);
}

/**
 * @param {string} bookingId
 * @returns {HandoverProtocol}
 */
export function createEmptyHandoverProtocol(bookingId) {
  return {
    bookingId: String(bookingId),
    handover: createEmptyHandoverProtocolSection(),
    vehicleReturn: createEmptyHandoverProtocolSection(),
  };
}

/**
 * @param {HandoverProtocol} protocol
 * @returns {HandoverProtocol}
 */
export function cloneHandoverProtocol(protocol) {
  return {
    bookingId: protocol.bookingId,
    handover: cloneHandoverProtocolSection(protocol.handover),
    vehicleReturn: cloneHandoverProtocolSection(protocol.vehicleReturn),
  };
}

/**
 * @param {HandoverProtocolSection} section
 * @returns {HandoverProtocolSection}
 */
export function cloneHandoverProtocolSection(section) {
  const sig = section.customerSignature ?? createEmptyHandoverProtocolSignature();
  return {
    notes: section.notes,
    photos: section.photos.map((p) => ({ ...p })),
    customerSignature: {
      strokes: sig.strokes.map((stroke) =>
        Array.isArray(stroke) ? stroke.map((p) => ({ x: p.x, y: p.y })) : []
      ),
      signedAt: sig.signedAt,
      signatureData: sig.signatureData ?? null,
    },
    updatedAt: section.updatedAt,
    finalized: section.finalized === true,
    protocolId: section.protocolId,
    odometer: section.odometer ?? null,
    fuelLevel: section.fuelLevel ?? null,
  };
}

/**
 * @param {HandoverProtocolSignature} a
 * @param {HandoverProtocolSignature} b
 * @returns {boolean}
 */
export function handoverProtocolSignaturesEqual(a, b) {
  return JSON.stringify(a?.strokes ?? []) === JSON.stringify(b?.strokes ?? []);
}

export function handoverProtocolSectionHasContent(section) {
  if (!section) return false;
  if (String(section.notes ?? "").trim().length > 0) return true;
  if (Array.isArray(section.photos) && section.photos.length > 0) return true;
  return handoverProtocolSignatureHasContent(section.customerSignature);
}

/**
 * @param {HandoverProtocol | null | undefined} protocol
 * @returns {boolean}
 */
export function handoverProtocolHasContent(protocol) {
  if (!protocol) return false;
  return (
    handoverProtocolSectionHasContent(protocol.handover) ||
    handoverProtocolSectionHasContent(protocol.vehicleReturn)
  );
}

/**
 * @param {string | null | undefined} iso
 * @returns {string | null}
 */
export function formatHandoverProtocolTimestamp(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const y = d.getFullYear();
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${y} ${h}:${min}`;
}

/**
 * @param {HandoverProtocol} before
 * @param {HandoverProtocol} after
 * @returns {boolean}
 */
export function handoverProtocolsEqual(before, after) {
  return JSON.stringify(before) === JSON.stringify(after);
}

/**
 * Applies `updatedAt` on sections that changed since `previousSaved`.
 * @param {HandoverProtocol} draft
 * @param {HandoverProtocol | null} previousSaved
 * @returns {HandoverProtocol}
 */
export function finalizeHandoverProtocolForSave(draft, previousSaved) {
  const now = new Date().toISOString();
  const next = cloneHandoverProtocol(draft);

  const sectionChanged = (/** @type {"handover" | "vehicleReturn"} */ key) => {
    if (!previousSaved) {
      return handoverProtocolSectionHasContent(next[key]);
    }
    const a = previousSaved[key];
    const b = next[key];
    return (
      a.notes !== b.notes ||
      a.photos.length !== b.photos.length ||
      a.photos.some((p, i) => p.id !== b.photos[i]?.id) ||
      !handoverProtocolSignaturesEqual(
        a.customerSignature ?? createEmptyHandoverProtocolSignature(),
        b.customerSignature ?? createEmptyHandoverProtocolSignature()
      )
    );
  };

  const stampSignature = (/** @type {"handover" | "vehicleReturn"} */ key) => {
    if (!handoverProtocolSignatureHasContent(next[key].customerSignature)) return;
    next[key].customerSignature = {
      ...next[key].customerSignature,
      signedAt: now,
    };
  };

  if (sectionChanged("handover") && handoverProtocolSectionHasContent(next.handover)) {
    next.handover.updatedAt = now;
    stampSignature("handover");
  }
  if (sectionChanged("vehicleReturn") && handoverProtocolSectionHasContent(next.vehicleReturn)) {
    next.vehicleReturn.updatedAt = now;
    stampSignature("vehicleReturn");
  }

  return next;
}

