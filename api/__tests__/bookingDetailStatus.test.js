import {
  bootstrapBtnClassToChipTone,
  catalogStatusButtonLabel,
  normalizeDetailStatusCatalogItem,
  filterDetailStatusesForDayMode,
  buildDetailStatusSetBody,
  parseDetailStatusPostResponse,
  patchBookingDetailStatusFromPostResponse,
  DETAIL_STATUS_INTERNAL_ID_STRING_NULL,
} from "../bookingDetailStatus";

jest.mock("../config", () => ({
  API_BASE_URL: "https://example.test",
  API_AUTH_PATH: "/api/external/auth",
  API_BOOKINGS_FILTER_PATH: "/api/external/bookings/filter",
  API_BOOKINGS_DETAIL_STATUS_ALL_PATH: "/api/external/bookings/detail/status/all",
  API_BOOKINGS_DETAIL_STATUS_PATH: "/api/external/bookings/detail/status",
}));

describe("bootstrapBtnClassToChipTone", () => {
  it("maps bootstrap classes", () => {
    expect(bootstrapBtnClassToChipTone("btn-success")).toBe("green");
    expect(bootstrapBtnClassToChipTone("btn-warning")).toBe("yellow");
    expect(bootstrapBtnClassToChipTone("btn-danger")).toBe("red");
  });
});

describe("catalogStatusButtonLabel", () => {
  it("maps noshow", () => {
    expect(catalogStatusButtonLabel("noshow", "noshow")).toBe("Nicht erschienen (No-Show)");
  });
});

const THEME = {
  teal: "#40CBE0",
  red: "#FF453A",
  green: "#30D158",
  yellow: "#FFD60A",
  blue: "#0A84FF",
  text2: "rgba(255,255,255,0.55)",
};

describe("normalizeDetailStatusCatalogItem", () => {
  it("parses API row", () => {
    const n = normalizeDetailStatusCatalogItem({
      id: 1,
      name: "Ankunft",
      nameInternal: "arrival_finished",
      color: "btn-success",
      position: 1,
    });
    expect(n?.id).toBe(1);
    expect(n?.nameInternal).toBe("arrival_finished");
    expect(n?.chipTone).toBe("green");
    expect(n?.colorBootstrap).toBe("btn-success");
  });
});

describe("parseDetailStatusPostResponse", () => {
  it("parses 200 body", () => {
    const p = parseDetailStatusPostResponse({
      newStatus: "arrival_finished",
      statusType: "arrival",
      note: "",
    });
    expect(p?.newStatus).toBe("arrival_finished");
    expect(p?.statusType).toBe("arrival");
  });
});

describe("patchBookingDetailStatusFromPostResponse", () => {
  it("updates arrival leg", () => {
    const catalog = [
      {
        id: 1,
        name: "Ankunft",
        nameInternal: "arrival_finished",
        chipTone: "green",
        position: 1,
        colorBootstrap: "btn-success",
      },
    ];
    const booking = {
      id: "1",
      reference: "X",
      detailStatus: { arrival: null, departure: null, note: "", rowId: null },
    };
    const next = patchBookingDetailStatusFromPostResponse(
      booking,
      { newStatus: "arrival_finished", statusType: "arrival", note: "" },
      catalog,
      THEME
    );
    expect(next.detailStatus?.arrival?.label).toBe("Erfolgreich");
    expect(next.detailStatus?.arrival?.nameInternal).toBe("arrival_finished");
  });
});

describe("filterDetailStatusesForDayMode", () => {
  const rows = [
    { id: 1, nameInternal: "arrival_finished", position: 1 },
    { id: 3, nameInternal: "departure_finished", position: 3 },
    { id: 5, nameInternal: "noshow", position: 5 },
  ];
  it("keeps arrival + noshow for arrival mode", () => {
    const f = filterDetailStatusesForDayMode(rows, "arrival");
    expect(f.map((r) => r.id)).toEqual([1, 5]);
  });
  it("keeps departure + noshow for departure mode", () => {
    const f = filterDetailStatusesForDayMode(rows, "departure");
    expect(f.map((r) => r.id)).toEqual([3, 5]);
  });
});

describe("buildDetailStatusSetBody", () => {
  it("sends string null internalId when isNative is false", () => {
    expect(buildDetailStatusSetBody("REF", 22241, 1, "hi", false)).toEqual({
      reference: "REF",
      internalId: DETAIL_STATUS_INTERNAL_ID_STRING_NULL,
      statusId: "1",
      note: "hi",
    });
  });
  it("sends string null when isNative omitted (non-native)", () => {
    expect(buildDetailStatusSetBody("REF", null, 1, "")).toEqual({
      reference: "REF",
      internalId: DETAIL_STATUS_INTERNAL_ID_STRING_NULL,
      statusId: "1",
      note: "",
    });
  });
  it("native booking uses row id when present", () => {
    expect(buildDetailStatusSetBody("REF", 22241, "2", "", true)).toEqual({
      reference: "REF",
      internalId: "22241",
      statusId: "2",
      note: "",
    });
  });
  it("native without row id sends string null", () => {
    expect(buildDetailStatusSetBody("REF", null, "1", "", true)).toEqual({
      reference: "REF",
      internalId: DETAIL_STATUS_INTERNAL_ID_STRING_NULL,
      statusId: "1",
      note: "",
    });
  });
});
