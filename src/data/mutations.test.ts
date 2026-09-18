import { beforeEach, describe, expect, test, vi } from "vitest";
import { updateCouple, updateMember } from "./mutations";

const client = vi.hoisted(() => {
  const eq = vi.fn();
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { eq, update, from };
});

vi.mock("@/lib/supabase", () => ({ supabase: { from: client.from } }));

const COUPLE_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  client.from.mockClear();
  client.update.mockClear();
  client.eq.mockClear();
  client.eq.mockResolvedValue({ error: null });
});

describe("updateCouple", () => {
  test("refuses an empty pup name without touching the database", async () => {
    await expect(updateCouple(COUPLE_ID, { pupName: "  " })).rejects.toThrow(
      "Your pup needs a name.",
    );
    expect(client.from).not.toHaveBeenCalled();
  });

  test("trims the pup name and passes the anniversary through", async () => {
    await updateCouple(COUPLE_ID, { pupName: " Mochi ", anniversary: null });
    expect(client.update).toHaveBeenCalledWith({ pup_name: "Mochi", anniversary: null });
    expect(client.eq).toHaveBeenCalledWith("id", COUPLE_ID);
  });

  test("an anniversary-only patch leaves the pup name alone", async () => {
    await updateCouple(COUPLE_ID, { anniversary: "2024-02-14" });
    expect(client.update).toHaveBeenCalledWith({ anniversary: "2024-02-14" });
  });
});

describe("updateMember", () => {
  test("refuses an empty display name without touching the database", async () => {
    await expect(updateMember(USER_ID, { displayName: "" })).rejects.toThrow(
      "Your name can't be empty.",
    );
    expect(client.from).not.toHaveBeenCalled();
  });

  test("trims the display name and keys off user_id", async () => {
    await updateMember(USER_ID, { displayName: " Ari " });
    expect(client.update).toHaveBeenCalledWith({ display_name: "Ari" });
    expect(client.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });

  test("shows the friendly copy when a check constraint still trips", async () => {
    client.eq.mockResolvedValue({
      error: { code: "23514", message: 'violates check constraint "members_display_name_check"' },
    });
    await expect(updateMember(USER_ID, { color: "teal" })).rejects.toThrow(
      "That didn't fit. Have another look and try again?",
    );
  });
});
