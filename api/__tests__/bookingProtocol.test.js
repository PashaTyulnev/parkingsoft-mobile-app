import {
  PROTOCOL_TYPE_HANDOVER,
  PROTOCOL_TYPE_RETURN,
  buildBookingProtocolUrl,
  buildBookingProtocolPhotosUrl,
  buildBookingProtocolPhotoDeleteUrl,
  buildBookingProtocolFinalizeUrl,
  resolveProtocolPhotoUrl,
  normalizeProtocolPhoto,
  parseBookingProtocolResponse,
  bookingProtocolDtoToSection,
  buildProtocolFormData,
  fetchBookingProtocol,
  fetchFullHandoverProtocol,
  postBookingProtocol,
  postBookingProtocolPhotos,
  deleteBookingProtocolPhoto,
  finalizeBookingProtocol,
  apiHandoverProtocolHasContent,
  protocolSectionNeedsUpsert,
} from "../bookingProtocol";
import { AuthError } from "../errors";

jest.mock("../config", () => ({
  API_BASE_URL: "https://example.test",
  API_BOOKINGS_PROTOCOL_PATH_PREFIX: "/api/external/bookings",
}));

jest.mock("../../lib/signatureToPngDataUrl", () => ({
  signatureStrokesToPngDataUrl: jest.fn(() => "data:image/png;base64,AAAA"),
}));

describe("buildBookingProtocolUrl", () => {
  it("builds handover and return URLs", () => {
    expect(buildBookingProtocolUrl(42, PROTOCOL_TYPE_HANDOVER)).toBe(
      "https://example.test/api/external/bookings/42/protocol/handover"
    );
    expect(buildBookingProtocolPhotosUrl(42, PROTOCOL_TYPE_RETURN)).toBe(
      "https://example.test/api/external/bookings/42/protocol/return/photos"
    );
    expect(buildBookingProtocolPhotoDeleteUrl(42, PROTOCOL_TYPE_HANDOVER, 9)).toBe(
      "https://example.test/api/external/bookings/42/protocol/handover/photos/9"
    );
    expect(buildBookingProtocolFinalizeUrl(42, PROTOCOL_TYPE_RETURN)).toBe(
      "https://example.test/api/external/bookings/42/protocol/return/finalize"
    );
  });
});

describe("resolveProtocolPhotoUrl", () => {
  it("prefixes relative paths with API base", () => {
    expect(resolveProtocolPhotoUrl("/uploads/p.jpg")).toBe(
      "https://example.test/uploads/p.jpg"
    );
    expect(resolveProtocolPhotoUrl("https://cdn.test/x.png")).toBe(
      "https://cdn.test/x.png"
    );
  });
});

describe("parseBookingProtocolResponse", () => {
  it("maps API protocol JSON", () => {
    const dto = parseBookingProtocolResponse(
      {
        id: 1,
        type: "handover",
        notes: "Kratzer",
        odometer: 120000,
        fuelLevel: "3/4",
        signatureData: "data:image/png;base64,xx",
        finalized: true,
        finalizedAt: "2026-05-15T12:00:00+02:00",
        updatedAt: "2026-05-15T11:00:00+02:00",
        photos: [
          {
            id: 5,
            url: "/uploads/a.jpg",
            originalName: "a.jpg",
            uploadedAt: "2026-05-15T10:00:00+02:00",
          },
        ],
      },
      PROTOCOL_TYPE_HANDOVER
    );
    expect(dto?.notes).toBe("Kratzer");
    expect(dto?.odometer).toBe(120000);
    expect(dto?.finalized).toBe(true);
    expect(dto?.photos[0].url).toBe("https://example.test/uploads/a.jpg");
  });
});

describe("bookingProtocolDtoToSection", () => {
  it("converts dto to UI section", () => {
    const section = bookingProtocolDtoToSection({
      id: 2,
      type: PROTOCOL_TYPE_RETURN,
      notes: "OK",
      odometer: null,
      fuelLevel: null,
      signatureData: "data:image/png;base64,ab",
      finalized: false,
      finalizedAt: null,
      createdAt: null,
      updatedAt: "2026-05-15T10:00:00+02:00",
      photos: [],
    });
    expect(section.notes).toBe("OK");
    expect(section.protocolId).toBe(2);
    expect(section.customerSignature.signatureData).toBe("data:image/png;base64,ab");
  });
});

describe("buildProtocolFormData", () => {
  it("appends notes and signature", () => {
    const form = buildProtocolFormData({
      notes: "Test",
      signatureData: "data:image/png;base64,abc",
    });
    expect(form.get("notes")).toBe("Test");
    expect(form.get("signatureData")).toBe("data:image/png;base64,abc");
  });
});

describe("fetchBookingProtocol", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("returns null on 204", async () => {
    global.fetch.mockResolvedValue({ status: 204, ok: false, text: async () => "" });
    const result = await fetchBookingProtocol("tok", 1, PROTOCOL_TYPE_HANDOVER);
    expect(result).toBeNull();
  });

  it("parses 200 response", async () => {
    global.fetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () =>
        JSON.stringify({
          id: 3,
          notes: "n",
          photos: [],
          finalized: false,
        }),
    });
    const result = await fetchBookingProtocol("tok", 1, PROTOCOL_TYPE_HANDOVER);
    expect(result?.id).toBe(3);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.test/api/external/bookings/1/protocol/handover",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer tok" }),
      })
    );
  });

  it("throws AuthError on 401", async () => {
    global.fetch.mockResolvedValue({ status: 401, text: async () => "" });
    await expect(fetchBookingProtocol("tok", 1, PROTOCOL_TYPE_HANDOVER)).rejects.toBeInstanceOf(
      AuthError
    );
  });
});

describe("fetchFullHandoverProtocol", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("loads handover and return in parallel", async () => {
    global.fetch
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: async () =>
          JSON.stringify({ id: 1, notes: "A", photos: [], finalized: false }),
      })
      .mockResolvedValueOnce({ status: 204, ok: false, text: async () => "" });

    const full = await fetchFullHandoverProtocol("tok", 99);
    expect(full.bookingId).toBe("99");
    expect(full.handover.notes).toBe("A");
    expect(full.vehicleReturn.notes).toBe("");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("postBookingProtocol", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("POSTs multipart and returns dto", async () => {
    global.fetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () =>
        JSON.stringify({ id: 4, notes: "saved", photos: [], finalized: false }),
    });
    const form = buildProtocolFormData({ notes: "saved" });
    const dto = await postBookingProtocol("tok", 10, PROTOCOL_TYPE_HANDOVER, form);
    expect(dto.notes).toBe("saved");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/protocol/handover"),
      expect.objectContaining({ method: "POST", body: form })
    );
  });

  it("maps 409 to finalized error", async () => {
    global.fetch.mockResolvedValue({
      status: 409,
      ok: false,
      text: async () => JSON.stringify({ message: "finalized" }),
    });
    await expect(
      postBookingProtocol("tok", 10, PROTOCOL_TYPE_HANDOVER, new FormData())
    ).rejects.toThrow(/finalisiert/i);
  });
});

describe("postBookingProtocolPhotos", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("returns uploaded photos on 201", async () => {
    global.fetch.mockResolvedValue({
      status: 201,
      ok: true,
      text: async () =>
        JSON.stringify({
          photos: [
            {
              id: 7,
              url: "/uploads/n.jpg",
              originalName: "n.jpg",
              uploadedAt: "2026-05-15T10:00:00+02:00",
            },
          ],
        }),
    });
    const photos = await postBookingProtocolPhotos("tok", 1, PROTOCOL_TYPE_HANDOVER, [
      {
        id: "local-1",
        uri: "file:///photo.jpg",
        originalName: "n.jpg",
        addedAt: Date.now(),
        isLocal: true,
      },
    ]);
    expect(photos).toHaveLength(1);
    expect(photos[0].id).toBe(7);
  });
});

describe("deleteBookingProtocolPhoto", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("succeeds on 204", async () => {
    global.fetch.mockResolvedValue({ status: 204, ok: true, text: async () => "" });
    await expect(
      deleteBookingProtocolPhoto("tok", 1, PROTOCOL_TYPE_HANDOVER, 5)
    ).resolves.toBeUndefined();
  });
});

describe("finalizeBookingProtocol", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("POSTs finalize endpoint", async () => {
    global.fetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () =>
        JSON.stringify({
          id: 1,
          notes: "",
          photos: [],
          finalized: true,
          finalizedAt: "2026-05-15T12:00:00+02:00",
        }),
    });
    const dto = await finalizeBookingProtocol("tok", 1, PROTOCOL_TYPE_HANDOVER);
    expect(dto.finalized).toBe(true);
  });
});

describe("protocolSectionNeedsUpsert", () => {
  it("detects note changes", () => {
    const prev = bookingProtocolDtoToSection(null);
    const next = { ...prev, notes: "neu" };
    expect(protocolSectionNeedsUpsert(next, prev)).toBe(true);
  });
});

describe("apiHandoverProtocolHasContent", () => {
  it("is true when any section has protocol id", () => {
    const p = {
      bookingId: "1",
      handover: { ...bookingProtocolDtoToSection(null), protocolId: 5 },
      vehicleReturn: bookingProtocolDtoToSection(null),
    };
    expect(apiHandoverProtocolHasContent(p)).toBe(true);
  });
});
