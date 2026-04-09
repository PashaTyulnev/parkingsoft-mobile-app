import {
  plainNoteToEditNoticeHtml,
  bookingEditInternalIdFromItem,
  buildBookingEditMultipartBody,
  postBookingEdit,
  BOOKING_EDIT_INTERNAL_ID_STRING_NULL,
} from "../bookingEdit";
import { AuthError } from "../errors";

jest.mock("../config", () => ({
  API_BASE_URL: "https://example.test",
  API_BOOKINGS_EDIT_PATH: "/api/external/bookings/edit",
}));

describe("plainNoteToEditNoticeHtml", () => {
  it("wraps text and escapes HTML", () => {
    expect(plainNoteToEditNoticeHtml("a & b")).toBe("<div>a &amp; b</div>");
    expect(plainNoteToEditNoticeHtml("x\ny")).toBe("<div>x<br/>y</div>");
  });
});

describe("bookingEditInternalIdFromItem", () => {
  it("uses null string when not native", () => {
    expect(bookingEditInternalIdFromItem({ isNative: false })).toBe(
      BOOKING_EDIT_INTERNAL_ID_STRING_NULL
    );
    expect(bookingEditInternalIdFromItem({})).toBe(
      BOOKING_EDIT_INTERNAL_ID_STRING_NULL
    );
  });
  it("uses rowId when native", () => {
    expect(
      bookingEditInternalIdFromItem({
        isNative: true,
        detailStatus: { rowId: 22241 },
      })
    ).toBe("22241");
  });
});

describe("buildBookingEditMultipartBody", () => {
  it("includes form field names and values", () => {
    const { body, contentType } = buildBookingEditMultipartBody({
      note: "<div>a</div>",
      bookingId: 37717,
      reference: "B9BH287",
      internalId: "null",
    });
    expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(body).toContain('name="note"');
    expect(body).toContain("<div>a</div>");
    expect(body).toContain('name="bookingId"');
    expect(body).toContain("37717");
    expect(body).toContain('name="reference"');
    expect(body).toContain("B9BH287");
    expect(body).toContain('name="internalId"');
  });
});

describe("postBookingEdit", () => {
  const fields = {
    note: "<div>x</div>",
    bookingId: 37717,
    reference: "B9BH287",
    internalId: BOOKING_EDIT_INTERNAL_ID_STRING_NULL,
  };

  it("POSTs multipart with Bearer (native: FormData body)", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "{}",
    });
    global.fetch = fetchFn;

    await postBookingEdit("tok", fields);

    expect(fetchFn).toHaveBeenCalledWith(
      "https://example.test/api/external/bookings/edit",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer tok",
        }),
        body: expect.any(FormData),
      })
    );
  });

  it("throws AuthError on 401", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "",
    });
    await expect(
      postBookingEdit("x", {
        note: "n",
        bookingId: 1,
        reference: "R",
        internalId: "null",
      })
    ).rejects.toBeInstanceOf(AuthError);
  });
});
