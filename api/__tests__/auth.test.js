import {
  loginWithFetch,
  toLoginNetworkError,
  getLoginUrl,
} from "../auth";

jest.mock("../config", () => ({
  API_BASE_URL: "http://test-api.local:8000",
  API_AUTH_PATH: "/api/external/auth",
  API_BOOKINGS_FILTER_PATH: "/api/external/bookings/filter",
}));

describe("toLoginNetworkError", () => {
  it("maps TypeError to German network hint", () => {
    const e = toLoginNetworkError(new TypeError("Failed"), "http://x");
    expect(e.message).toContain("Netzwerkfehler");
    expect(e.message).toContain("http://x");
    expect(e.message).toContain("10.0.2.2");
  });

  it("maps RN network message", () => {
    const e = toLoginNetworkError(
      new Error("Network request failed"),
      "http://127.0.0.1:8000/api/external/auth"
    );
    expect(e.message).toContain("Netzwerkfehler");
  });

  it("rethrows unknown as Error", () => {
    const e = toLoginNetworkError("weird", "http://x");
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe("weird");
  });
});

describe("loginWithFetch", () => {
  const endpoints = {
    baseUrl: "http://test-api.local:8000",
    authPath: "/api/external/auth",
  };

  it("POSTs JSON and returns token on 200", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: "secret-token" }),
    });

    const token = await loginWithFetch(fetchFn, endpoints, "user1", "pass1");

    expect(token).toBe("secret-token");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("http://test-api.local:8000/api/external/auth");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({
      username: "user1",
      password: "pass1",
    });
  });

  it("throws on HTTP error with message from body", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Invalid credentials" }),
    });

    await expect(
      loginWithFetch(fetchFn, endpoints, "u", "p")
    ).rejects.toThrow("Invalid credentials");
  });

  it("throws when token missing on 200", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await expect(loginWithFetch(fetchFn, endpoints, "u", "p")).rejects.toThrow(
      "Kein Token"
    );
  });

  it("throws network-style error when fetch rejects", async () => {
    const fetchFn = jest
      .fn()
      .mockRejectedValue(new TypeError("Network request failed"));

    await expect(loginWithFetch(fetchFn, endpoints, "u", "p")).rejects.toThrow(
      /Netzwerkfehler/
    );
  });
});

describe("getLoginUrl (mocked config)", () => {
  it("joins base URL and auth path", () => {
    expect(getLoginUrl()).toBe(
      "http://test-api.local:8000/api/external/auth"
    );
  });
});
