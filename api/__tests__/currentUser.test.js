import { normalizeCurrentUser, fetchCurrentUser } from "../currentUser";
import { AuthError } from "../errors";

jest.mock("../config", () => ({
  API_BASE_URL: "https://example.test",
  API_AUTH_PATH: "/api/external/auth",
  API_CURRENT_USER_PATH: "/api/external/current",
}));

describe("normalizeCurrentUser", () => {
  it("builds displayName and initials", () => {
    const u = normalizeCurrentUser({
      id: 1,
      username: "ptyulnev",
      firstName: "Pavel",
      lastName: "Tyulnev",
    });
    expect(u?.displayName).toBe("Pavel Tyulnev");
    expect(u?.initials).toBe("PT");
    expect(u?.username).toBe("ptyulnev");
    expect(u?.id).toBe(1);
  });

  it("falls back to username for display", () => {
    const u = normalizeCurrentUser({ id: 2, username: "ab" });
    expect(u?.displayName).toBe("ab");
    expect(u?.initials).toBe("AB");
  });
});

describe("fetchCurrentUser", () => {
  it("GETs with Bearer and returns normalized user", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 1,
        username: "u1",
        firstName: "A",
        lastName: "B",
      }),
    });
    global.fetch = fetchFn;

    const u = await fetchCurrentUser("tok");
    expect(u.username).toBe("u1");
    expect(fetchFn).toHaveBeenCalledWith("https://example.test/api/external/current", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer tok",
      },
    });
  });

  it("throws AuthError on 401", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    await expect(fetchCurrentUser("x")).rejects.toBeInstanceOf(AuthError);
  });
});
