import {
  mapMyShiftStatusLabel,
  mapMyShiftDisplayName,
  extractTimeHMFromIso,
  normalizeMyShiftItem,
  parseMyShiftsResponse,
  fetchMyShifts,
  MY_SHIFT_STATUS_PENDING,
  MY_SHIFT_NAME_DISPLAY_ASSIGNED,
} from "../myShifts";
import { AuthError } from "../errors";

jest.mock("../config", () => ({
  API_BASE_URL: "https://example.test",
  API_MY_SHIFTS_PATH: "/api/external/my-shifts",
}));

describe("mapMyShiftStatusLabel", () => {
  it("maps pending", () => {
    expect(mapMyShiftStatusLabel(MY_SHIFT_STATUS_PENDING)).toBe("Ausstehend");
  });
});

describe("mapMyShiftDisplayName", () => {
  it("replaces manual shift API name with assigned label", () => {
    expect(mapMyShiftDisplayName("Manuelle Schicht")).toBe(MY_SHIFT_NAME_DISPLAY_ASSIGNED);
    expect(mapMyShiftDisplayName("manuelle schicht")).toBe(MY_SHIFT_NAME_DISPLAY_ASSIGNED);
  });
  it("keeps other names", () => {
    expect(mapMyShiftDisplayName("Frühschicht")).toBe("Frühschicht");
  });
});

describe("extractTimeHMFromIso", () => {
  it("reads time from ISO", () => {
    expect(extractTimeHMFromIso("1970-01-01T08:00:00+01:00")).not.toBe("—");
    expect(extractTimeHMFromIso("")).toBe("—");
  });
});

describe("normalizeMyShiftItem", () => {
  it("maps API row", () => {
    const row = normalizeMyShiftItem({
      id: 12,
      user: [],
      note: null,
      demandShift: null,
      date: "2026-03-23T00:00:00+01:00",
      timeFrom: "1970-01-01T08:00:00+01:00",
      timeTo: "1970-01-01T16:00:00+01:00",
      name: "Manuelle Schicht",
      color: "#3b82f6",
      status: "pending",
      shiftBegin: null,
      shiftEnd: null,
    });
    expect(row?.id).toBe("12");
    expect(row?.name).toBe(MY_SHIFT_NAME_DISPLAY_ASSIGNED);
    expect(row?.color).toBe("#3b82f6");
    expect(row?.statusLabel).toBe("Ausstehend");
    expect(row?.timeRange).toContain("–");
  });
});

describe("parseMyShiftsResponse", () => {
  it("sorts by date ascending", () => {
    const rows = parseMyShiftsResponse([
      { id: 2, date: "2026-03-24T00:00:00+01:00", timeFrom: "1970-01-01T10:00:00+01:00", timeTo: "1970-01-01T12:00:00+01:00", name: "B", status: "pending" },
      { id: 1, date: "2026-03-23T00:00:00+01:00", timeFrom: "1970-01-01T10:00:00+01:00", timeTo: "1970-01-01T12:00:00+01:00", name: "A", status: "pending" },
    ]);
    expect(rows.map((r) => r.name)).toEqual(["A", "B"]);
  });
});

describe("fetchMyShifts", () => {
  it("GETs with Bearer", async () => {
    const body = [{ id: 1, date: "2026-01-01T00:00:00+01:00", name: "X", status: "pending" }];
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    });
    global.fetch = fetchFn;

    const data = await fetchMyShifts("tok");
    expect(data).toEqual(body);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://example.test/api/external/my-shifts",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer tok" }),
      })
    );
  });

  it("throws AuthError on 401", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    });
    await expect(fetchMyShifts("x")).rejects.toBeInstanceOf(AuthError);
  });
});
