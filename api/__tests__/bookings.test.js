import {
  localDateYyyyMmDd,
  buildBookingsFilterUrl,
  buildBookingsSearchUrl,
  buildBookingsAllUrl,
  BOOKINGS_FILTER_LIMIT,
  BOOKINGS_FILTER_PAGE,
  extractBookingsList,
  normalizeBooking,
  bookingPaymentStatusDisplayMeta,
  BOOKING_PAYMENT_STATUS_FB,
  BOOKING_PAYMENT_STATUS_FO,
  stripHtml,
  mapBootstrapBtnClassToColor,
  buildDetailStatusBlock,
  normalizeDetailLegStatus,
  isDetailLegFinishedSuccess,
  isDetailLegChanged,
  isDetailLegMissing,
  isBookingProductValet,
  isBookingProductShuttle,
  bookingProductDisplayMeta,
  BOOKING_PRODUCT_VALET,
  BOOKING_PRODUCT_SHUTTLE,
  BOOKING_FILTER_LABEL_EXPECTED,
  numericBookingIdFromListItem,
} from "../bookings";

jest.mock("../config", () => ({
  API_BASE_URL: "https://example.test",
  API_AUTH_PATH: "/api/external/auth",
  API_BOOKINGS_FILTER_PATH: "/api/external/bookings/filter",
  API_BOOKINGS_SEARCH_PATH: "/api/external/bookings/search",
  API_BOOKINGS_ALL_PATH: "/api/external/bookings/all",
}));

describe("localDateYyyyMmDd", () => {
  it("formats local calendar date", () => {
    const d = new Date(2026, 2, 22, 15, 30, 0);
    expect(localDateYyyyMmDd(d)).toBe("2026-03-22");
  });
});

describe("buildBookingsFilterUrl", () => {
  it("builds filter URL with arrival and fixed paging", () => {
    const d = new Date(2026, 2, 22);
    const url = buildBookingsFilterUrl("arrival", d);
    expect(url).toMatch(/^https:\/\/example\.test\/api\/external\/bookings\/filter\?/);
    const u = new URL(url);
    expect(u.searchParams.get("dateFrom")).toBe("2026-03-22");
    expect(u.searchParams.get("dateTo")).toBe("2026-03-22");
    expect(u.searchParams.get("type")).toBe("arrival");
    expect(u.searchParams.get("limit")).toBe(String(BOOKINGS_FILTER_LIMIT));
    expect(u.searchParams.get("page")).toBe(String(BOOKINGS_FILTER_PAGE));
  });

  it("supports departure type", () => {
    const d = new Date(2026, 2, 22);
    const url = buildBookingsFilterUrl("departure", d);
    expect(new URL(url).searchParams.get("type")).toBe("departure");
  });
});

describe("buildBookingsSearchUrl", () => {
  it("builds search URL with required params", () => {
    const url = buildBookingsSearchUrl({
      searchString: "mustermann",
      type: "arrival",
      page: 1,
      limit: 10,
      dateFrom: "2026-05-01",
      dateTo: "2026-05-31",
    });
    expect(url).toMatch(/^https:\/\/example\.test\/api\/external\/bookings\/search\?/);
    const u = new URL(url);
    expect(u.searchParams.get("searchString")).toBe("mustermann");
    expect(u.searchParams.get("type")).toBe("arrival");
    expect(u.searchParams.get("page")).toBe("1");
    expect(u.searchParams.get("limit")).toBe("10");
    expect(u.searchParams.get("dateFrom")).toBe("2026-05-01");
    expect(u.searchParams.get("dateTo")).toBe("2026-05-31");
  });

  it("omits dateFrom/dateTo when not provided", () => {
    const url = buildBookingsSearchUrl({
      searchString: "HX-123",
      type: "changed",
      page: 2,
      limit: 20,
    });
    const u = new URL(url);
    expect(u.searchParams.get("dateFrom")).toBeNull();
    expect(u.searchParams.get("dateTo")).toBeNull();
  });
});

describe("buildBookingsAllUrl", () => {
  it("builds all URL with paging", () => {
    const url = buildBookingsAllUrl({ page: 3, limit: 50 });
    expect(url).toMatch(/^https:\/\/example\.test\/api\/external\/bookings\/all\?/);
    const u = new URL(url);
    expect(u.searchParams.get("page")).toBe("3");
    expect(u.searchParams.get("limit")).toBe("50");
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

describe("extractBookingsList", () => {
  it("reads bookings array from filter response", () => {
    const list = extractBookingsList({
      bookings: [{ id: 1 }],
      amount: 1,
    });
    expect(list).toEqual([{ id: 1 }]);
  });
});

describe("stripHtml", () => {
  it("removes tags", () => {
    expect(stripHtml('<div>Hello <b>world</b></div>')).toBe("Hello world");
  });
});

describe("isDetailLegMissing", () => {
  it("is true when leg is null/undefined", () => {
    expect(isDetailLegMissing(null)).toBe(true);
    expect(isDetailLegMissing(undefined)).toBe(true);
  });
  it("is false when leg is normalized object", () => {
    expect(isDetailLegMissing({ nameInternal: "arrival_finished", label: "x", color: "#fff" })).toBe(
      false
    );
  });
});

describe("BOOKING_FILTER_LABEL_EXPECTED", () => {
  it("is stable chip label", () => {
    expect(BOOKING_FILTER_LABEL_EXPECTED).toBe("Erwartet");
  });
});

describe("numericBookingIdFromListItem", () => {
  it("reads numeric id", () => {
    expect(numericBookingIdFromListItem({ id: 10000 })).toBe(10000);
    expect(numericBookingIdFromListItem({ id: "10000" })).toBe(10000);
  });
  it("returns null for reference-style id", () => {
    expect(numericBookingIdFromListItem({ id: "R0612578024" })).toBeNull();
  });
});

describe("isDetailLegChanged", () => {
  it("is true for *_changed internals", () => {
    expect(isDetailLegChanged({ nameInternal: "arrival_changed" })).toBe(true);
    expect(isDetailLegChanged({ nameInternal: "departure_changed" })).toBe(true);
  });
  it("is false for finished, noshow, or missing leg", () => {
    expect(isDetailLegChanged({ nameInternal: "arrival_finished" })).toBe(false);
    expect(isDetailLegChanged({ nameInternal: "noshow" })).toBe(false);
    expect(isDetailLegChanged(null)).toBe(false);
  });
});

describe("isBookingProductValet", () => {
  it("matches product V (case-insensitive)", () => {
    expect(isBookingProductValet({ product: "V" })).toBe(true);
    expect(isBookingProductValet({ product: "v" })).toBe(true);
    expect(isBookingProductValet({ product: "S" })).toBe(false);
    expect(isBookingProductValet({})).toBe(false);
    expect(BOOKING_PRODUCT_VALET).toBe("V");
  });
});

describe("isBookingProductShuttle", () => {
  it("matches product S (case-insensitive)", () => {
    expect(isBookingProductShuttle({ product: "S" })).toBe(true);
    expect(isBookingProductShuttle({ product: "s" })).toBe(true);
    expect(isBookingProductShuttle({ product: "V" })).toBe(false);
    expect(isBookingProductShuttle({})).toBe(false);
    expect(BOOKING_PRODUCT_SHUTTLE).toBe("S");
  });
});

describe("bookingProductDisplayMeta", () => {
  it("returns labels for V and S", () => {
    expect(bookingProductDisplayMeta("V")).toEqual({ key: "valet", label: "Valet" });
    expect(bookingProductDisplayMeta("v")).toEqual({ key: "valet", label: "Valet" });
    expect(bookingProductDisplayMeta("S")).toEqual({ key: "shuttle", label: "Shuttle" });
    expect(bookingProductDisplayMeta("s")).toEqual({ key: "shuttle", label: "Shuttle" });
  });
  it("returns null for unknown or empty", () => {
    expect(bookingProductDisplayMeta("")).toBeNull();
    expect(bookingProductDisplayMeta(null)).toBeNull();
    expect(bookingProductDisplayMeta("X")).toBeNull();
  });
});

describe("isDetailLegFinishedSuccess", () => {
  it("is true for *_finished internals", () => {
    expect(isDetailLegFinishedSuccess({ nameInternal: "arrival_finished" })).toBe(true);
    expect(isDetailLegFinishedSuccess({ nameInternal: "departure_finished" })).toBe(true);
  });
  it("is false for noshow, changed, or missing leg", () => {
    expect(isDetailLegFinishedSuccess({ nameInternal: "noshow" })).toBe(false);
    expect(isDetailLegFinishedSuccess({ nameInternal: "arrival_changed" })).toBe(false);
    expect(isDetailLegFinishedSuccess(null)).toBe(false);
    expect(isDetailLegFinishedSuccess(undefined)).toBe(false);
  });
});

describe("mapBootstrapBtnClassToColor", () => {
  it("maps btn-success to green", () => {
    expect(mapBootstrapBtnClassToColor("btn-success", THEME)).toBe(THEME.green);
  });
  it("maps btn-warning to yellow", () => {
    expect(mapBootstrapBtnClassToColor("btn-warning", THEME)).toBe(THEME.yellow);
  });
  it("maps btn-danger to red (e.g. No-Show)", () => {
    expect(mapBootstrapBtnClassToColor("btn-danger", THEME)).toBe(THEME.red);
  });
});

describe("buildDetailStatusBlock", () => {
  it("parses arrival and departure legs", () => {
    const block = buildDetailStatusBlock(
      {
        detailStatus: {
          note: "Gate 2",
          arrivalStatus: {
            name: "Ankunft",
            color: "btn-success",
            nameInternal: "arrival_finished",
          },
          departureStatus: {
            name: "Änderung",
            color: "btn-warning",
            nameInternal: "departure_changed",
          },
        },
      },
      THEME
    );
    expect(block.arrival?.label).toBe("Erfolgreich");
    expect(block.arrival?.color).toBe(THEME.green);
    expect(block.departure?.label).toBe("Änderung!");
    expect(block.departure?.color).toBe(THEME.yellow);
    expect(block.note).toBe("Gate 2");
    expect(block.rowId).toBeNull();
  });

  it("parses detailStatus row id", () => {
    const block = buildDetailStatusBlock(
      {
        detailStatus: {
          id: 22241,
          note: "",
          arrivalStatus: {
            name: "Ankunft",
            color: "btn-success",
            nameInternal: "arrival_finished",
          },
        },
      },
      THEME
    );
    expect(block.rowId).toBe(22241);
  });

  it("maps noshow to German label and danger color", () => {
    const leg = normalizeDetailLegStatus(
      {
        name: "noshow",
        nameInternal: "noshow",
        color: "btn-danger",
      },
      THEME
    );
    expect(leg?.label).toBe("Nicht erschienen (No-Show)");
    expect(leg?.color).toBe(THEME.red);
  });
});

describe("bookingPaymentStatusDisplayMeta", () => {
  it("returns FB and FO", () => {
    expect(bookingPaymentStatusDisplayMeta("fb")).toEqual({
      key: "fb",
      label: "FB",
    });
    expect(bookingPaymentStatusDisplayMeta("FO")).toEqual({
      key: "fo",
      label: "FO",
    });
    expect(BOOKING_PAYMENT_STATUS_FB).toBe("FB");
    expect(BOOKING_PAYMENT_STATUS_FO).toBe("FO");
  });
  it("returns other code as label and null when empty", () => {
    expect(bookingPaymentStatusDisplayMeta("XX")?.label).toBe("XX");
    expect(bookingPaymentStatusDisplayMeta("")).toBeNull();
    expect(bookingPaymentStatusDisplayMeta(null)).toBeNull();
  });
});

describe("normalizeBooking (Parkingsoft shape)", () => {
  const row = {
    id: 36599,
    reference: "HB4GD974",
    firstName: "Berit",
    lastName: "Hartmann",
    duration: 26,
    arrivalDate: "22.03.2026",
    arrivalTime: "10:00",
    departureDate: "16.04.2026",
    departureTime: "23:00",
    passengers: 2,
    flightNumberArrival: null,
    flightNumberDeparture: "IB0765",
    licensePlate: "DWSI 101",
    model: "BMW X5",
    price: 153,
    status: "confirmed",
    notice:
      '<div><font color="#ff0000"><span style="font-size:18px;">Landung um</span></font></div>',
    product: "S",
    paymentStatus: "FB",
    isNative: false,
    detailStatus: {
      id: 22241,
      note: "",
      arrivalStatus: {
        name: "Ankunft",
        nameInternal: "arrival_finished",
        color: "btn-success",
      },
      departureStatus: {
        name: "Rückreise",
        nameInternal: "departure_finished",
        color: "btn-success",
      },
    },
  };

  it("maps names, dates, flight, price, badge, detailStatus", () => {
    const b = normalizeBooking(row, 0, THEME);
    expect(b.id).toBe("36599");
    expect(b.reference).toBe("HB4GD974");
    expect(b.name).toBe("Berit Hartmann");
    expect(b.arrival).toBe("22.03.2026 10:00");
    expect(b.departure).toBe("16.04.2026 23:00");
    expect(b.days).toBe(26);
    expect(b.pax).toBe(2);
    expect(b.flight).toBe("IB0765");
    expect(b.plate).toBe("DWSI 101");
    expect(b.brand).toBe("BMW X5");
    expect(b.product).toBe("S");
    expect(b.paymentStatus).toBe("FB");
    expect(b.isNative).toBe(false);
    expect(b.price).toBe("153,00 €");
    expect(b.badge).toBe("Reingefahren");
    expect(b.remark).toBe("Landung um");
    expect(b.remarkColor).toBe(THEME.red);
    expect(b.detailStatus?.arrival?.label).toBe("Erfolgreich");
    expect(b.detailStatus?.arrival?.color).toBe(THEME.green);
    expect(b.detailStatus?.departure?.label).toBe("Erfolgreich");
    expect(b.detailStatus?.departure?.color).toBe(THEME.green);
    expect(b.detailStatus?.rowId).toBe(22241);
  });

  it("maps isNative true from API", () => {
    const b = normalizeBooking({ ...row, isNative: true }, 0, THEME);
    expect(b.isNative).toBe(true);
  });
});
