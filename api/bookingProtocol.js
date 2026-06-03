import { API_BASE_URL, API_BOOKINGS_PROTOCOL_PATH_PREFIX } from "./config";
import { AuthError } from "./errors";
import { signatureStrokesToPngDataUrl } from "../lib/signatureToPngDataUrl";
import {
  cloneHandoverProtocol,
  createEmptyHandoverProtocol,
  createEmptyHandoverProtocolSection,
  handoverProtocolSignatureHasContent,
  handoverProtocolsEqual,
} from "../lib/handoverProtocol";

export const PROTOCOL_TYPE_HANDOVER = "handover";
export const PROTOCOL_TYPE_RETURN = "return";

/** @typedef {"handover" | "return"} ProtocolType */

/**
 * @typedef {object} BookingProtocolPhoto
 * @property {number} id
 * @property {string} url absolute or site-relative
 * @property {string} originalName
 * @property {string | null} uploadedAt
 */

/**
 * @typedef {object} BookingProtocolDto
 * @property {number} id
 * @property {ProtocolType} type
 * @property {string} notes
 * @property {number | null} odometer
 * @property {string | null} fuelLevel
 * @property {string | null} signatureData
 * @property {boolean} finalized
 * @property {string | null} finalizedAt
 * @property {string | null} createdAt
 * @property {string | null} updatedAt
 * @property {BookingProtocolPhoto[]} photos
 */

/**
 * @param {string | number} bookingId
 * @param {ProtocolType} type
 */
export function buildBookingProtocolUrl(bookingId, type) {
  return `${API_BASE_URL}${API_BOOKINGS_PROTOCOL_PATH_PREFIX}/${bookingId}/protocol/${type}`;
}

/**
 * @param {string | number} bookingId
 * @param {ProtocolType} type
 */
export function buildBookingProtocolPhotosUrl(bookingId, type) {
  return `${buildBookingProtocolUrl(bookingId, type)}/photos`;
}

/**
 * @param {string | number} bookingId
 * @param {ProtocolType} type
 * @param {string | number} photoId
 */
export function buildBookingProtocolPhotoDeleteUrl(bookingId, type, photoId) {
  return `${buildBookingProtocolUrl(bookingId, type)}/photos/${photoId}`;
}

/**
 * @param {string | number} bookingId
 * @param {ProtocolType} type
 */
export function buildBookingProtocolFinalizeUrl(bookingId, type) {
  return `${buildBookingProtocolUrl(bookingId, type)}/finalize`;
}

/**
 * @param {unknown} path
 * @returns {string}
 */
export function resolveProtocolPhotoUrl(path) {
  const p = String(path ?? "").trim();
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  return `${API_BASE_URL}${p.startsWith("/") ? p : `/${p}`}`;
}

/**
 * @param {unknown} raw
 * @returns {BookingProtocolPhoto | null}
 */
export function normalizeProtocolPhoto(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const idRaw = o.id;
  const id =
    typeof idRaw === "number" && Number.isFinite(idRaw)
      ? idRaw
      : typeof idRaw === "string" && /^\d+$/.test(idRaw.trim())
        ? parseInt(idRaw.trim(), 10)
        : NaN;
  if (!Number.isFinite(id)) return null;
  const url = resolveProtocolPhotoUrl(o.url);
  if (!url) return null;
  return {
    id,
    url,
    originalName: String(o.originalName ?? "").trim() || "photo.jpg",
    uploadedAt: o.uploadedAt == null ? null : String(o.uploadedAt),
  };
}

/**
 * @param {unknown} json
 * @param {ProtocolType} type
 * @returns {BookingProtocolDto | null}
 */
export function parseBookingProtocolResponse(json, type) {
  if (!json || typeof json !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (json);
  const idRaw = o.id;
  const id =
    typeof idRaw === "number" && Number.isFinite(idRaw)
      ? idRaw
      : typeof idRaw === "string" && /^\d+$/.test(idRaw.trim())
        ? parseInt(idRaw.trim(), 10)
        : NaN;
  if (!Number.isFinite(id)) return null;

  const rawPhotos = Array.isArray(o.photos) ? o.photos : [];
  const photos = /** @type {BookingProtocolPhoto[]} */ (
    rawPhotos.map((row) => normalizeProtocolPhoto(row)).filter(Boolean)
  );

  const odometerRaw = o.odometer;
  const odometer =
    odometerRaw == null || odometerRaw === ""
      ? null
      : typeof odometerRaw === "number" && Number.isFinite(odometerRaw)
        ? odometerRaw
        : typeof odometerRaw === "string" && /^\d+$/.test(odometerRaw.trim())
          ? parseInt(odometerRaw.trim(), 10)
          : null;

  return {
    id,
    type,
    notes: String(o.notes ?? ""),
    odometer,
    fuelLevel: o.fuelLevel == null ? null : String(o.fuelLevel),
    signatureData: o.signatureData == null ? null : String(o.signatureData),
    finalized: o.finalized === true,
    finalizedAt: o.finalizedAt == null ? null : String(o.finalizedAt),
    createdAt: o.createdAt == null ? null : String(o.createdAt),
    updatedAt: o.updatedAt == null ? null : String(o.updatedAt),
    photos,
  };
}

/**
 * @param {import("../lib/handoverProtocol").HandoverProtocolPhoto} photo
 * @returns {boolean}
 */
export function isLocalProtocolPhoto(photo) {
  return photo.isLocal === true || String(photo.uri ?? "").startsWith("file:");
}

/**
 * @param {BookingProtocolDto | null} dto
 * @returns {import("../lib/handoverProtocol").HandoverProtocolSection}
 */
export function bookingProtocolDtoToSection(dto) {
  if (!dto) return createEmptyHandoverProtocolSection();
  return {
    notes: dto.notes ?? "",
    photos: dto.photos.map((p) => ({
      id: `server-${p.id}`,
      serverId: p.id,
      uri: p.url,
      originalName: p.originalName,
      addedAt: p.uploadedAt ? Date.parse(p.uploadedAt) || Date.now() : Date.now(),
      isLocal: false,
    })),
    customerSignature: {
      strokes: [],
      signedAt: dto.finalizedAt ?? dto.updatedAt,
      signatureData: dto.signatureData,
    },
    updatedAt: dto.updatedAt,
    finalized: dto.finalized,
    protocolId: dto.id,
    odometer: dto.odometer,
    fuelLevel: dto.fuelLevel,
  };
}

/**
 * @param {string} token
 * @param {number} bookingId
 * @param {ProtocolType} type
 * @returns {Promise<BookingProtocolDto | null>}
 */
export async function fetchBookingProtocol(token, bookingId, type) {
  const url = buildBookingProtocolUrl(bookingId, type);
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new AuthError("Session expired or unauthorized");
  }

  if (res.status === 204) {
    return null;
  }

  const text = await res.text();
  let data = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw protocolErrorFromBody(data, text, res.status);
  }

  return parseBookingProtocolResponse(data, type);
}

/**
 * @param {string} token
 * @param {number} bookingId
 * @returns {Promise<import("../lib/handoverProtocol").HandoverProtocol>}
 */
export async function fetchFullHandoverProtocol(token, bookingId) {
  const [handoverDto, returnDto] = await Promise.all([
    fetchBookingProtocol(token, bookingId, PROTOCOL_TYPE_HANDOVER),
    fetchBookingProtocol(token, bookingId, PROTOCOL_TYPE_RETURN),
  ]);

  return {
    bookingId: String(bookingId),
    handover: bookingProtocolDtoToSection(handoverDto),
    vehicleReturn: bookingProtocolDtoToSection(returnDto),
  };
}

/**
 * @param {{
 *   notes?: string;
 *   odometer?: number | null;
 *   fuelLevel?: string | null;
 *   signatureData?: string | null;
 *   localPhotos?: import("../lib/handoverProtocol").HandoverProtocolPhoto[];
 * }} fields
 * @returns {FormData}
 */
export function buildProtocolFormData(fields) {
  const form = new FormData();
  if (fields.notes !== undefined) {
    form.append("notes", String(fields.notes ?? ""));
  }
  if (fields.odometer !== undefined && fields.odometer != null) {
    form.append("odometer", String(fields.odometer));
  }
  if (fields.fuelLevel !== undefined && fields.fuelLevel != null) {
    form.append("fuelLevel", String(fields.fuelLevel));
  }
  if (fields.signatureData) {
    form.append("signatureData", fields.signatureData);
  }
  for (const photo of fields.localPhotos ?? []) {
    const uri = String(photo.uri ?? "").trim();
    if (!uri || uri.startsWith("mock://")) continue;
    const name = photo.originalName ?? `photo-${photo.id}.jpg`;
    const lower = name.toLowerCase();
    const type = lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    form.append("photos[]", /** @type {unknown} */ ({
      uri,
      name,
      type,
    }));
  }
  return form;
}

/**
 * @param {string} token
 * @param {number} bookingId
 * @param {ProtocolType} type
 * @param {FormData} formData
 * @returns {Promise<BookingProtocolDto>}
 */
export async function postBookingProtocol(token, bookingId, type, formData) {
  const url = buildBookingProtocolUrl(bookingId, type);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (res.status === 401 || res.status === 403) {
    throw new AuthError("Session expired or unauthorized");
  }

  const text = await res.text();
  let data = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  if (res.status === 409) {
    throw new Error("Protokoll ist bereits finalisiert.");
  }

  if (!res.ok) {
    throw protocolErrorFromBody(data, text, res.status);
  }

  const parsed = parseBookingProtocolResponse(data, type);
  if (!parsed) {
    throw new Error("Ungültige Protokoll-Antwort vom Server");
  }
  return parsed;
}

/**
 * @param {string} token
 * @param {number} bookingId
 * @param {ProtocolType} type
 * @param {readonly import("../lib/handoverProtocol").HandoverProtocolPhoto[]} localPhotos
 */
export async function postBookingProtocolPhotos(token, bookingId, type, localPhotos) {
  const form = new FormData();
  let appended = 0;
  for (const photo of localPhotos) {
    const uri = String(photo.uri ?? "").trim();
    if (!uri || uri.startsWith("mock://")) continue;
    const name = photo.originalName ?? `photo-${photo.id}.jpg`;
    form.append("photos[]", /** @type {unknown} */ ({
      uri,
      name,
      type: name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
    }));
    appended += 1;
  }
  if (appended === 0) {
    return [];
  }

  const url = buildBookingProtocolPhotosUrl(bookingId, type);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (res.status === 401 || res.status === 403) {
    throw new AuthError("Session expired or unauthorized");
  }

  const text = await res.text();
  let data = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  if (res.status === 409) {
    throw new Error("Protokoll ist bereits finalisiert.");
  }

  if (!res.ok) {
    throw protocolErrorFromBody(data, text, res.status);
  }

  const o = /** @type {Record<string, unknown>} */ (data);
  const rawList = Array.isArray(o.photos) ? o.photos : [];
  return /** @type {BookingProtocolPhoto[]} */ (
    rawList.map((row) => normalizeProtocolPhoto(row)).filter(Boolean)
  );
}

/**
 * @param {string} token
 * @param {number} bookingId
 * @param {ProtocolType} type
 * @param {number} photoId
 */
export async function deleteBookingProtocolPhoto(token, bookingId, type, photoId) {
  const url = buildBookingProtocolPhotoDeleteUrl(bookingId, type, photoId);
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new AuthError("Session expired or unauthorized");
  }

  if (res.status === 204 || res.status === 200) {
    return;
  }

  const text = await res.text();
  let data = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  if (res.status === 409) {
    throw new Error("Protokoll ist bereits finalisiert.");
  }

  if (!res.ok) {
    throw protocolErrorFromBody(data, text, res.status);
  }
}

/**
 * @param {string} token
 * @param {number} bookingId
 * @param {ProtocolType} type
 * @returns {Promise<BookingProtocolDto>}
 */
export async function finalizeBookingProtocol(token, bookingId, type) {
  const url = buildBookingProtocolFinalizeUrl(bookingId, type);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new AuthError("Session expired or unauthorized");
  }

  const text = await res.text();
  let data = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  if (res.status === 409) {
    throw new Error("Protokoll ist bereits finalisiert.");
  }

  if (!res.ok) {
    throw protocolErrorFromBody(data, text, res.status);
  }

  const parsed = parseBookingProtocolResponse(data, type);
  if (!parsed) {
    throw new Error("Ungültige Finalize-Antwort vom Server");
  }
  return parsed;
}

/**
 * @param {import("../lib/handoverProtocol").HandoverProtocolSection} section
 * @param {import("../lib/handoverProtocol").HandoverProtocolSection} previous
 * @returns {boolean}
 */
export function protocolSectionNeedsUpsert(section, previous) {
  if (section.notes !== previous.notes) return true;
  if (section.odometer !== previous.odometer) return true;
  if (section.fuelLevel !== previous.fuelLevel) return true;
  const sig = section.customerSignature;
  const prevSig = previous.customerSignature;
  if (handoverProtocolSignatureHasContent(sig) && sig.signatureData !== prevSig.signatureData) {
    return true;
  }
  if (
    handoverProtocolSignatureHasContent(sig) &&
    JSON.stringify(sig.strokes) !== JSON.stringify(prevSig.strokes ?? [])
  ) {
    return true;
  }
  const newLocal = section.photos.filter(isLocalProtocolPhoto);
  if (newLocal.length > 0) return true;
  const removedServer = previous.photos.filter(
    (p) => p.serverId != null && !section.photos.some((x) => x.serverId === p.serverId)
  );
  if (removedServer.length > 0) return true;
  return false;
}

/**
 * @param {string} token
 * @param {number} bookingId
 * @param {ProtocolType} type
 * @param {import("../lib/handoverProtocol").HandoverProtocolSection} section
 * @param {import("../lib/handoverProtocol").HandoverProtocolSection} previous
 * @returns {Promise<import("../lib/handoverProtocol").HandoverProtocolSection>}
 */
export async function saveProtocolSectionToApi(token, bookingId, type, section, previous) {
  if (section.finalized) {
    return section;
  }

  let working = { ...section, photos: [...section.photos] };

  const removed = previous.photos.filter(
    (p) =>
      p.serverId != null &&
      !working.photos.some((x) => x.serverId === p.serverId)
  );
  for (const photo of removed) {
    if (photo.serverId != null) {
      await deleteBookingProtocolPhoto(token, bookingId, type, photo.serverId);
    }
  }

  const needsUpsert = protocolSectionNeedsUpsert(working, previous);
  let dto = null;

  if (needsUpsert) {
    const fields = /** @type {Parameters<typeof buildProtocolFormData>[0]} */ ({
      notes: working.notes,
    });
    if (working.odometer !== undefined) fields.odometer = working.odometer ?? null;
    if (working.fuelLevel !== undefined) fields.fuelLevel = working.fuelLevel ?? null;

    const strokes = working.customerSignature?.strokes ?? [];
    const prevStrokes = previous.customerSignature?.strokes ?? [];
    const strokesChanged =
      JSON.stringify(strokes) !== JSON.stringify(prevStrokes);
    if (strokesChanged && handoverProtocolSignatureHasContent(working.customerSignature)) {
      fields.signatureData = signatureStrokesToPngDataUrl(strokes);
    } else if (
      working.customerSignature?.signatureData &&
      working.customerSignature.signatureData !== previous.customerSignature?.signatureData
    ) {
      fields.signatureData = working.customerSignature.signatureData;
    }

    fields.localPhotos = working.photos.filter(isLocalProtocolPhoto);

    dto = await postBookingProtocol(
      token,
      bookingId,
      type,
      buildProtocolFormData(fields)
    );
    working = bookingProtocolDtoToSection(dto);

    const stillLocal = section.photos.filter(
      (p) =>
        isLocalProtocolPhoto(p) &&
        !working.photos.some((s) => s.uri === p.uri || s.originalName === p.originalName)
    );
    if (stillLocal.length > 0) {
      const added = await postBookingProtocolPhotos(token, bookingId, type, stillLocal);
      working = {
        ...working,
        photos: [
          ...working.photos,
          ...added.map((p) => ({
            id: `server-${p.id}`,
            serverId: p.id,
            uri: p.url,
            originalName: p.originalName,
            addedAt: p.uploadedAt ? Date.parse(p.uploadedAt) || Date.now() : Date.now(),
            isLocal: false,
          })),
        ],
      };
    }
  }

  const shouldFinalize =
    !working.finalized &&
    (handoverProtocolSignatureHasContent(working.customerSignature) ||
      Boolean(working.customerSignature?.signatureData));

  if (shouldFinalize) {
    dto = await finalizeBookingProtocol(token, bookingId, type);
    working = bookingProtocolDtoToSection(dto);
  }

  return working;
}

/**
 * @param {string} token
 * @param {import("../lib/handoverProtocol").HandoverProtocol} draft
 * @param {import("../lib/handoverProtocol").HandoverProtocol} savedSnapshot
 * @returns {Promise<import("../lib/handoverProtocol").HandoverProtocol>}
 */
export async function saveFullHandoverProtocolToApi(token, draft, savedSnapshot) {
  const bookingId = parseInt(String(draft.bookingId), 10);
  if (!Number.isFinite(bookingId)) {
    throw new Error("Ungültige Buchungs-ID für Protokoll");
  }

  const handover = await saveProtocolSectionToApi(
    token,
    bookingId,
    PROTOCOL_TYPE_HANDOVER,
    draft.handover,
    savedSnapshot.handover
  );
  const vehicleReturn = await saveProtocolSectionToApi(
    token,
    bookingId,
    PROTOCOL_TYPE_RETURN,
    draft.vehicleReturn,
    savedSnapshot.vehicleReturn
  );

  return {
    bookingId: String(bookingId),
    handover,
    vehicleReturn,
  };
}

/**
 * @param {unknown} data
 * @param {string} text
 * @param {number} status
 */
function protocolErrorFromBody(data, text, status) {
  const o = data && typeof data === "object" ? /** @type {Record<string, unknown>} */ (data) : {};
  const msg =
    o.message ||
    o.detail ||
    o.error ||
    (typeof text === "string" && text.trim() ? text.trim() : null) ||
    `Protokoll-Anfrage fehlgeschlagen (${status})`;
  return new Error(typeof msg === "string" ? msg : "Protokoll-Anfrage fehlgeschlagen");
}

/**
 * @param {import("../lib/handoverProtocol").HandoverProtocol | null | undefined} protocol
 * @returns {boolean}
 */
export function apiHandoverProtocolHasContent(protocol) {
  if (!protocol) return false;
  const has = (/** @type {import("../lib/handoverProtocol").HandoverProtocolSection} */ s) =>
    Boolean(s.protocolId) ||
    String(s.notes ?? "").trim().length > 0 ||
    (Array.isArray(s.photos) && s.photos.length > 0) ||
    handoverProtocolSignatureHasContent(s.customerSignature) ||
    Boolean(s.customerSignature?.signatureData);
  return has(protocol.handover) || has(protocol.vehicleReturn);
}
