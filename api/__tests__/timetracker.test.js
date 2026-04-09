import {
  parseValueToClockTime,
  pickClockTimeFromTimetrackerJson,
  parsePhpDateTimeObjectToHHmm,
  parsePhpDateTimeObjectToParts,
  normalizeTimeTrackerStatusPayload,
  normalizeTimeTrackerOverviewItem,
  parseTimeTrackerOverviewResponse,
  fetchTimeTrackerCheckIn,
  fetchTimeTrackerStatus,
  fetchTimeTrackerOverviewAll,
  postTimeTrackerUserTotals,
  filterRawOverviewForCurrentUser,
  normalizeUserTotalsResponse,
  formatPhpDateTimeStringDE,
  TIMETRACKER_OVERVIEW_QUERY_YEAR,
  TIMETRACKER_OVERVIEW_QUERY_MONTH,
  TIMETRACKER_OVERVIEW_QUERY_USER_ID,
  lastUserInformationFilterCategory,
  normalizeLastUserInformationItem,
  parseLastUserInformationResponse,
  fetchTimetrackerLastUserInformation,
  LAST_USER_FILTER_CHECKIN,
  LAST_USER_FILTER_CHECKOUT,
  LAST_USER_FILTER_PAUSE,
} from "../timetracker";
import { AuthError } from "../errors";

jest.mock("../config", () => ({
  API_BASE_URL: "https://example.test",
  API_TIMETRACKER_CHECKIN_PATH: "/api/external/timetracker/checkin",
  API_TIMETRACKER_CHECKOUT_PATH: "/api/external/timetracker/checkout",
  API_TIMETRACKER_STATUS_PATH: "/api/external/timetracker/status",
  API_TIMETRACKER_OVERVIEW_ALL_PATH: "/api/external/timetracker/overview_all",
  API_TIMETRACKER_USER_TOTALS_PATH: "/api/external/timetracker/user_totals",
  API_TIMETRACKER_LAST_USER_INFORMATION_PATH:
    "/api/external/timetracker/last_user_information",
}));

describe("parseValueToClockTime", () => {
  it("parses HH:mm", () => {
    expect(parseValueToClockTime("9:05")).toBe("09:05");
    expect(parseValueToClockTime("14:30:00")).toBe("14:30");
  });
});

describe("parsePhpDateTimeObjectToHHmm", () => {
  it("reads HH:mm from PHP DateTime JSON date string", () => {
    expect(
      parsePhpDateTimeObjectToHHmm({
        date: "2026-03-06 12:10:14.000000",
        timezone_type: 3,
        timezone: "Europe/Berlin",
      })
    ).toBe("12:10");
  });
});

describe("parsePhpDateTimeObjectToParts", () => {
  it("parses date and time with fractional seconds", () => {
    const p = parsePhpDateTimeObjectToParts({
      date: "2026-03-01 06:28:48.000000",
      timezone_type: 3,
      timezone: "Europe/Berlin",
    });
    expect(p?.dateDE).toBe("01.03.2026");
    expect(p?.timeHM).toBe("06:28");
    expect(typeof p?.sortValue).toBe("number");
  });
});

describe("lastUserInformationFilterCategory", () => {
  it("maps checkin checkout pause", () => {
    expect(lastUserInformationFilterCategory("checkin")).toBe(LAST_USER_FILTER_CHECKIN);
    expect(lastUserInformationFilterCategory("checkout")).toBe(LAST_USER_FILTER_CHECKOUT);
    expect(lastUserInformationFilterCategory("pause_start")).toBe(LAST_USER_FILTER_PAUSE);
  });
});

describe("normalizeLastUserInformationItem", () => {
  it("maps API row", () => {
    const row = normalizeLastUserInformationItem({
      timeTrackerId: 6124,
      username: "ptyulnev",
      lastActionTimeStamp: {
        date: "2026-03-04 08:27:02.000000",
        timezone_type: 3,
        timezone: "UTC",
      },
      type: "checkin",
      parent: 6122,
      userId: 1,
    });
    expect(row?.username).toBe("ptyulnev");
    expect(row?.filterCategory).toBe(LAST_USER_FILTER_CHECKIN);
    expect(row?.userId).toBe(1);
    expect(row?.lastActionDisplay).not.toBe("—");
  });
});

describe("parseLastUserInformationResponse", () => {
  it("sorts by last action descending", () => {
    const rows = parseLastUserInformationResponse([
      {
        timeTrackerId: 1,
        username: "a",
        lastActionTimeStamp: { date: "2025-01-01 10:00:00.000000", timezone: "UTC" },
        type: "checkout",
        userId: 1,
      },
      {
        timeTrackerId: 2,
        username: "b",
        lastActionTimeStamp: { date: "2026-01-01 10:00:00.000000", timezone: "UTC" },
        type: "checkin",
        userId: 2,
      },
    ]);
    expect(rows[0].username).toBe("b");
  });
});

describe("fetchTimetrackerLastUserInformation", () => {
  it("GETs with Bearer", async () => {
    const body = [];
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    });
    global.fetch = fetchFn;

    const data = await fetchTimetrackerLastUserInformation("tok");
    expect(data).toEqual(body);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://example.test/api/external/timetracker/last_user_information",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer tok" }),
      })
    );
  });
});

describe("normalizeTimeTrackerOverviewItem", () => {
  it("maps open shift (no shiftEnd)", () => {
    const row = normalizeTimeTrackerOverviewItem({
      timeTrackerId: 7022,
      username: "Roezcan",
      shiftStart: { date: "2026-03-06 05:54:07.000000", timezone_type: 3, timezone: "Europe/Berlin" },
      shiftEnd: null,
      shiftDuration: null,
      pauseDuration: "00:00",
      pausePeriods: [],
      totalWorkingTime: null,
    });
    expect(row?.isOpenShift).toBe(true);
    expect(row?.endTime).toBeNull();
    expect(row?.username).toBe("Roezcan");
  });
});

describe("filterRawOverviewForCurrentUser", () => {
  it("keeps only rows with matching username", () => {
    const raw = [
      { timeTrackerId: 1, username: "a" },
      { timeTrackerId: 2, username: "B" },
    ];
    const f = filterRawOverviewForCurrentUser(raw, { id: 1, username: "b" });
    expect(f).toHaveLength(1);
    expect(/** @type {{ timeTrackerId: number }} */ (f[0]).timeTrackerId).toBe(2);
  });
});

describe("formatPhpDateTimeStringDE", () => {
  it("formats API datetime string for display", () => {
    expect(formatPhpDateTimeStringDE("2026-03-01 04:00:00.000000")).toBe("01.03.2026 04:00");
  });
});

describe("normalizeUserTotalsResponse", () => {
  it("maps user_totals fields", () => {
    const n = normalizeUserTotalsResponse({
      totalWorkingTime: "158:39",
      dateFrom: "2026-03-01 04:00:00.000000",
      dateTo: "2026-03-06 12:10:13.000000",
      totalPause: "12:23",
      totalShiftDuration: "171:02",
      username: "Alle User",
      totalNightShiftPause: "00:00",
      totalNightShiftWorkingTime: "13:35",
      totalNightShiftWithoutPause: "13:35",
    });
    expect(n?.totalWorkingTime).toBe("158:39");
    expect(n?.username).toBe("Alle User");
    expect(n?.dateFromLabel).toContain("03.2026");
  });
});

describe("parseTimeTrackerOverviewResponse", () => {
  it("filters rows by current username", () => {
    const raw = [
      {
        timeTrackerId: 1,
        username: "Erdal",
        shiftStart: { date: "2026-03-01 06:00:00.000000", timezone_type: 3, timezone: "Europe/Berlin" },
        shiftEnd: { date: "2026-03-01 12:00:00.000000", timezone_type: 3, timezone: "Europe/Berlin" },
        shiftDuration: "06:00",
        pauseDuration: "00:00",
        pausePeriods: [],
        totalWorkingTime: "06:00",
      },
      {
        timeTrackerId: 2,
        username: "ptyulnev",
        shiftStart: { date: "2026-03-01 07:00:00.000000", timezone_type: 3, timezone: "Europe/Berlin" },
        shiftEnd: { date: "2026-03-01 08:00:00.000000", timezone_type: 3, timezone: "Europe/Berlin" },
        shiftDuration: "01:00",
        pauseDuration: "00:00",
        pausePeriods: [],
        totalWorkingTime: "01:00",
      },
    ];
    const rows = parseTimeTrackerOverviewResponse(raw, { id: 9, username: "ptyulnev" });
    expect(rows).toHaveLength(1);
    expect(rows[0].timeTrackerId).toBe(2);
  });
});

describe("normalizeTimeTrackerStatusPayload", () => {
  it("maps checkout type to mainCheckin + timestamp", () => {
    const raw = {
      type: "checkout",
      timestamp: { date: "2026-03-06 12:10:14.000000", timezone_type: 3, timezone: "Europe/Berlin" },
      mainCheckin: { date: "2026-03-06 08:00:13.000000", timezone_type: 3, timezone: "Europe/Berlin" },
    };
    expect(normalizeTimeTrackerStatusPayload(raw)).toEqual({
      kind: "checkout",
      checkIn: "08:00",
      checkOut: "12:10",
    });
  });
  it("maps checkin type and clears checkout slot", () => {
    const raw = {
      type: "checkin",
      timestamp: { date: "2026-03-06 09:15:00.000000", timezone_type: 3, timezone: "Europe/Berlin" },
      mainCheckin: { date: "2026-03-06 09:15:00.000000", timezone_type: 3, timezone: "Europe/Berlin" },
    };
    expect(normalizeTimeTrackerStatusPayload(raw)).toEqual({
      kind: "checkin",
      checkIn: "09:15",
      checkOut: "",
    });
  });
});

describe("pickClockTimeFromTimetrackerJson", () => {
  it("reads checkIn-style keys", () => {
    expect(pickClockTimeFromTimetrackerJson({ checkIn: "08:15" }, "checkin")).toBe(
      "08:15"
    );
  });
  it("reads checkOut-style keys", () => {
    expect(pickClockTimeFromTimetrackerJson({ checkOut: "17:00" }, "checkout")).toBe(
      "17:00"
    );
  });
});

describe("fetchTimeTrackerCheckIn", () => {
  it("GETs with Bearer", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ time: "10:00" }),
    });
    global.fetch = fetchFn;

    const data = await fetchTimeTrackerCheckIn("tok");
    expect(data).toEqual({ time: "10:00" });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://example.test/api/external/timetracker/checkin",
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
    await expect(fetchTimeTrackerCheckIn("x")).rejects.toBeInstanceOf(AuthError);
  });
});

describe("postTimeTrackerUserTotals", () => {
  it("POSTs JSON array with Bearer", async () => {
    const body = { totalWorkingTime: "1:00" };
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    });
    global.fetch = fetchFn;

    const payload = [{ timeTrackerId: 1, username: "u" }];
    const data = await postTimeTrackerUserTotals("tok", payload);
    expect(data).toEqual(body);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://example.test/api/external/timetracker/user_totals",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer tok",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(payload),
      })
    );
  });
});

describe("fetchTimeTrackerOverviewAll", () => {
  it("GETs with year, month, userId when set", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    global.fetch = fetchFn;

    await fetchTimeTrackerOverviewAll("tok", { year: 2026, month: 3, userId: 42 });
    expect(fetchFn).toHaveBeenCalledWith(
      `https://example.test/api/external/timetracker/overview_all?${TIMETRACKER_OVERVIEW_QUERY_YEAR}=2026&${TIMETRACKER_OVERVIEW_QUERY_MONTH}=3&${TIMETRACKER_OVERVIEW_QUERY_USER_ID}=42`,
      expect.any(Object)
    );
  });

  it("omits userId when null", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    global.fetch = fetchFn;

    await fetchTimeTrackerOverviewAll("tok", { year: 2026, month: 3, userId: null });
    expect(fetchFn).toHaveBeenCalledWith(
      `https://example.test/api/external/timetracker/overview_all?${TIMETRACKER_OVERVIEW_QUERY_YEAR}=2026&${TIMETRACKER_OVERVIEW_QUERY_MONTH}=3`,
      expect.any(Object)
    );
  });
});

describe("fetchTimeTrackerStatus", () => {
  it("GETs status with Bearer", async () => {
    const body = { type: "checkout", timestamp: {}, mainCheckin: {} };
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    });
    global.fetch = fetchFn;

    const data = await fetchTimeTrackerStatus("tok");
    expect(data).toEqual(body);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://example.test/api/external/timetracker/status",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer tok" }),
      })
    );
  });
});
