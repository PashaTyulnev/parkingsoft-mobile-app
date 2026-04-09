import {
  normalizeDepositPurpose,
  parseDefaultCost,
  filterDepositPurposesForBookingsPage,
  parseDepositRegisterData,
  normalizeBookingDeposit,
  modalEntriesFromBookingDeposits,
  buildDepositRegisterDataUrl,
  fetchDepositRegisterData,
  germanDateDdMmYyyyToIso,
  depositKindToDepositType,
  buildAddDepositFormData,
  postAddDeposit,
  extractDepositIdFromAddResponse,
  buildDeleteDepositUrl,
  fetchDeleteDeposit,
  DEPOSIT_TYPE_POSITIVE,
  DEPOSIT_TYPE_NEGATIVE,
} from "../depositRegister";
import { AuthError } from "../errors";

jest.mock("../config", () => ({
  API_BASE_URL: "https://example.test",
  API_BOOKING_DEPOSIT_REGISTER_DATA_PATH:
    "/api/external/booking/deposit-register-data",
  API_DEPOSIT_REGISTER_ADD_PATH: "/api/external/deposit-register/addDeposit",
  API_DEPOSIT_REGISTER_DELETE_PATH:
    "/api/external/deposit-register/deleteDeposit",
}));

describe("parseDefaultCost", () => {
  it("accepts number and numeric strings", () => {
    expect(parseDefaultCost(2.5)).toBe(2.5);
    expect(parseDefaultCost("20")).toBe(20);
    expect(parseDefaultCost("2,5")).toBe(2.5);
    expect(parseDefaultCost("  15.75  ")).toBe(15.75);
  });
  it("returns null for empty or invalid", () => {
    expect(parseDefaultCost(null)).toBeNull();
    expect(parseDefaultCost("")).toBeNull();
    expect(parseDefaultCost("x")).toBeNull();
  });
});

describe("normalizeDepositPurpose", () => {
  it("maps API shape", () => {
    const p = normalizeDepositPurpose({
      id: 2,
      name: "Parkticket",
      defaultCost: 2.5,
      displayOnBookingsPage: true,
      isReceivingPurpose: false,
    });
    expect(p).toEqual({
      id: 2,
      name: "Parkticket",
      defaultCost: 2.5,
      displayOnBookingsPage: true,
      isReceivingPurpose: false,
    });
  });

  it("allows null defaultCost", () => {
    const p = normalizeDepositPurpose({
      id: 25,
      name: "Sonstiges",
      defaultCost: null,
      displayOnBookingsPage: true,
    });
    expect(p?.defaultCost).toBeNull();
  });

  it("parses string defaultCost", () => {
    const p = normalizeDepositPurpose({
      id: 3,
      name: "Nachtzuschlag",
      defaultCost: "20",
      displayOnBookingsPage: true,
    });
    expect(p?.defaultCost).toBe(20);
  });

  it("returns null for invalid rows", () => {
    expect(normalizeDepositPurpose(null)).toBeNull();
    expect(normalizeDepositPurpose({})).toBeNull();
  });
});

describe("filterDepositPurposesForBookingsPage", () => {
  it("keeps only displayOnBookingsPage true", () => {
    const list = [
      { id: 1, name: "A", displayOnBookingsPage: true },
      { id: 2, name: "B", displayOnBookingsPage: false },
    ];
    expect(filterDepositPurposesForBookingsPage(list)).toEqual([list[0]]);
  });
});

describe("parseDepositRegisterData", () => {
  it("parses sample response and filters purposes", () => {
    const parsed = parseDepositRegisterData({
      booking: { id: 10000, reference: "R0612578024" },
      bookingIsPayed: true,
      bookingFeePayedTo: null,
      depositPurposes: [
        {
          id: 26,
          name: "Hidden",
          defaultCost: 20,
          displayOnBookingsPage: false,
        },
        {
          id: 2,
          name: "Parkticket",
          defaultCost: 2.5,
          displayOnBookingsPage: true,
        },
      ],
    });
    expect(parsed.booking?.reference).toBe("R0612578024");
    expect(parsed.bookingIsPayed).toBe(true);
    expect(parsed.depositPurposes).toHaveLength(1);
    expect(parsed.depositPurposes[0].name).toBe("Parkticket");
    expect(parsed.bookingDeposits).toEqual([]);
  });

  it("parses bookingDeposits and modal order is newest first", () => {
    const parsed = parseDepositRegisterData({
      booking: { id: 37717 },
      bookingDeposits: [
        {
          id: 11637,
          deposit: 29,
          createdAt: "2026-03-24T15:53:31+01:00",
          description: "A",
          paymentType: "Bar",
          isMainBookingFee: false,
          isValid: false,
          status: [],
        },
        {
          id: 11639,
          deposit: 22,
          createdAt: "2026-03-24T15:59:25+01:00",
          description: "B",
          paymentType: "Bar",
          isMainBookingFee: false,
          isValid: false,
          status: [],
        },
      ],
      depositPurposes: [],
    });
    expect(parsed.bookingDeposits).toHaveLength(2);
    const modal = modalEntriesFromBookingDeposits(parsed.bookingDeposits);
    expect(modal[0].depositServerId).toBe(11639);
    expect(modal[0].description).toBe("B");
    expect(modal[1].depositServerId).toBe(11637);
  });

  it("throws on non-object", () => {
    expect(() => parseDepositRegisterData(null)).toThrow(
      "Invalid deposit register response"
    );
  });
});

describe("normalizeBookingDeposit", () => {
  it("maps API row", () => {
    const d = normalizeBookingDeposit({
      id: 11637,
      deposit: 29,
      createdAt: "2026-03-24T15:53:31+01:00",
      description: "Verspätung",
      paymentType: "Bar",
      isMainBookingFee: false,
      isValid: false,
      status: [],
    });
    expect(d?.serverId).toBe(11637);
    expect(d?.amount).toBe(29);
    expect(d?.kind).toBe("income");
    expect(d?.paymentLabel).toBe("Bar");
  });

  it("uses depositType negative for expense", () => {
    const d = normalizeBookingDeposit({
      id: 1,
      deposit: 10,
      depositType: "negative",
      createdAt: "2026-01-01T00:00:00+01:00",
      description: "x",
      paymentType: "Bar",
    });
    expect(d?.kind).toBe("expense");
    expect(d?.amount).toBe(10);
  });
});

describe("buildDepositRegisterDataUrl", () => {
  it("appends bookingId query", () => {
    expect(buildDepositRegisterDataUrl(10000)).toBe(
      "https://example.test/api/external/booking/deposit-register-data?bookingId=10000"
    );
  });
});

describe("fetchDepositRegisterData", () => {
  it("GETs with Bearer and returns parsed payload", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        booking: { id: 1 },
        bookingIsPayed: false,
        depositPurposes: [
          {
            id: 1,
            name: "X",
            defaultCost: null,
            displayOnBookingsPage: true,
          },
        ],
      }),
    });
    global.fetch = fetchFn;

    const out = await fetchDepositRegisterData("tok", 1);
    expect(out.depositPurposes).toHaveLength(1);
    expect(out.bookingDeposits).toEqual([]);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://example.test/api/external/booking/deposit-register-data?bookingId=1",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer tok",
        }),
      })
    );
  });

  it("throws AuthError on 401", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    });
    await expect(fetchDepositRegisterData("x", 1)).rejects.toBeInstanceOf(
      AuthError
    );
  });
});

describe("germanDateDdMmYyyyToIso", () => {
  it("converts to YYYY-MM-DD", () => {
    expect(germanDateDdMmYyyyToIso("24.03.2026")).toBe("2026-03-24");
    expect(germanDateDdMmYyyyToIso("1.1.2020")).toBe("2020-01-01");
  });
  it("returns null for invalid input", () => {
    expect(germanDateDdMmYyyyToIso("")).toBeNull();
    expect(germanDateDdMmYyyyToIso("2026-03-24")).toBeNull();
    expect(germanDateDdMmYyyyToIso("32.01.2026")).toBeNull();
  });
});

describe("depositKindToDepositType", () => {
  it("maps income and expense", () => {
    expect(depositKindToDepositType("income")).toBe(DEPOSIT_TYPE_POSITIVE);
    expect(depositKindToDepositType("expense")).toBe(DEPOSIT_TYPE_NEGATIVE);
  });
});

describe("postAddDeposit", () => {
  it("POSTs multipart with Bearer", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "{}",
    });
    global.fetch = fetchFn;

    const form = buildAddDepositFormData({
      bookingId: 37717,
      isMainFee: false,
      depositType: DEPOSIT_TYPE_POSITIVE,
      depositDate: "2026-03-24",
      paymentType: "Bar",
      depositPurpose: 17,
      description: "Einkaufsservice",
      deposit: 12,
    });

    await postAddDeposit("tok", form);

    expect(fetchFn).toHaveBeenCalledWith(
      "https://example.test/api/external/deposit-register/addDeposit",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer tok",
          Accept: "application/json",
        }),
        body: form,
      })
    );
  });

  it("throws AuthError on 403", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "",
    });
    const form = buildAddDepositFormData({
      bookingId: 1,
      isMainFee: false,
      depositType: DEPOSIT_TYPE_POSITIVE,
      depositDate: "2026-01-01",
      paymentType: "Bar",
      depositPurpose: 1,
      description: "x",
      deposit: 1,
    });
    await expect(postAddDeposit("t", form)).rejects.toBeInstanceOf(AuthError);
  });
});

describe("extractDepositIdFromAddResponse", () => {
  it("reads id and depositId", () => {
    expect(extractDepositIdFromAddResponse({ id: 10316 })).toBe(10316);
    expect(extractDepositIdFromAddResponse({ depositId: 42 })).toBe(42);
    expect(
      extractDepositIdFromAddResponse({ data: { id: "7" } })
    ).toBe(7);
  });
  it("returns null when missing", () => {
    expect(extractDepositIdFromAddResponse({})).toBeNull();
    expect(extractDepositIdFromAddResponse(null)).toBeNull();
  });
});

describe("buildDeleteDepositUrl", () => {
  it("sets depositId query", () => {
    expect(buildDeleteDepositUrl(10316)).toBe(
      "https://example.test/api/external/deposit-register/deleteDeposit?depositId=10316"
    );
  });
});

describe("fetchDeleteDeposit", () => {
  it("GETs with Bearer and manual redirect; 302 is success", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      status: 302,
      text: async () => "",
    });
    global.fetch = fetchFn;

    await fetchDeleteDeposit("tok", 10316);

    expect(fetchFn).toHaveBeenCalledWith(
      "https://example.test/api/external/deposit-register/deleteDeposit?depositId=10316",
      expect.objectContaining({
        method: "GET",
        redirect: "manual",
        headers: expect.objectContaining({
          Authorization: "Bearer tok",
        }),
      })
    );
  });

  it("throws on 400", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 400,
      text: async () => JSON.stringify({ message: "bad" }),
    });
    await expect(fetchDeleteDeposit("t", 1)).rejects.toThrow("bad");
  });
});
