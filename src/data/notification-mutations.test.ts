import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  removePushSubscription,
  savePushSubscription,
  syncTimezone,
  updateNotificationPrefs,
} from "./notification-mutations";

const client = vi.hoisted(() => {
  const eq = vi.fn();
  const update = vi.fn(() => ({ eq }));
  const del = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update, delete: del }));
  const rpc = vi.fn();
  return { eq, update, del, from, rpc };
});

vi.mock("@/lib/supabase", () => ({ supabase: { from: client.from, rpc: client.rpc } }));

const USER_ID = "22222222-2222-2222-2222-222222222222";
const SUB = { endpoint: "https://web.push.apple.com/abc", p256dh: "p", auth: "a" };

beforeEach(() => {
  vi.clearAllMocks();
  client.eq.mockResolvedValue({ error: null });
  client.rpc.mockResolvedValue({ error: null });
});

describe("savePushSubscription", () => {
  test("hands the device and time zone to the RPC", async () => {
    await savePushSubscription(SUB, "iPhone", "Australia/Sydney");
    expect(client.rpc).toHaveBeenCalledWith("save_push_subscription", {
      p_endpoint: SUB.endpoint,
      p_p256dh: "p",
      p_auth: "a",
      p_user_agent: "iPhone",
      p_timezone: "Australia/Sydney",
    });
  });

  test("refuses a subscription with no keys without calling the database", async () => {
    await expect(savePushSubscription({ ...SUB, auth: "" }, "x", "UTC")).rejects.toThrow(
      "This phone didn't give us anywhere to send notifications. Try again?",
    );
    expect(client.rpc).not.toHaveBeenCalled();
  });

  test("shows the RPC's own words on failure", async () => {
    client.rpc.mockResolvedValue({ error: { message: "Sign in first." } });
    await expect(savePushSubscription(SUB, "x", "UTC")).rejects.toThrow("Sign in first.");
  });
});

describe("removePushSubscription", () => {
  test("deletes by endpoint", async () => {
    await removePushSubscription(SUB.endpoint);
    expect(client.from).toHaveBeenCalledWith("push_subscriptions");
    expect(client.eq).toHaveBeenCalledWith("endpoint", SUB.endpoint);
  });
});

describe("updateNotificationPrefs", () => {
  test("writes muted and remind_at, keyed by user", async () => {
    await updateNotificationPrefs(USER_ID, { muted: ["heart"], remindAt: "21:15" });
    expect(client.update).toHaveBeenCalledWith({ muted: ["heart"], remind_at: "21:15" });
    expect(client.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });

  test("refuses a time that isn't HH:MM", async () => {
    await expect(updateNotificationPrefs(USER_ID, { remindAt: "9pm" })).rejects.toThrow(
      "Pick a time for your reminder.",
    );
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe("syncTimezone", () => {
  test("updates only the time zone", async () => {
    await syncTimezone(USER_ID, "Europe/London");
    expect(client.update).toHaveBeenCalledWith({ timezone: "Europe/London" });
    expect(client.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});
