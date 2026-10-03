import { afterEach, describe, expect, test, vi } from "vitest";
import { currentSubscription, type PushEnv, pushSupport, urlBase64ToUint8Array } from "./push";

const capable: PushEnv = {
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  permission: "default",
  standalone: true,
  ios: true,
};

describe("pushSupport", () => {
  test("an iPhone tab must be installed first, whatever it reports", () => {
    expect(pushSupport({ ...capable, standalone: false, hasPushManager: false })).toBe(
      "needs-install",
    );
  });

  test("installed on iPhone, not yet asked", () => {
    expect(pushSupport(capable)).toBe("default");
  });

  test("granted and denied pass through", () => {
    expect(pushSupport({ ...capable, permission: "granted" })).toBe("granted");
    expect(pushSupport({ ...capable, permission: "denied" })).toBe("denied");
  });

  test("a desktop browser tab can subscribe without installing", () => {
    expect(pushSupport({ ...capable, ios: false, standalone: false })).toBe("default");
  });

  test("missing any API is unsupported", () => {
    expect(pushSupport({ ...capable, ios: false, hasPushManager: false })).toBe("unsupported");
    expect(pushSupport({ ...capable, hasServiceWorker: false })).toBe("unsupported");
    expect(pushSupport({ ...capable, hasNotification: false, permission: null })).toBe(
      "unsupported",
    );
  });
});

describe("currentSubscription", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("no service worker API at all: resolves to null", async () => {
    vi.stubGlobal("navigator", {});
    await expect(currentSubscription()).resolves.toBeNull();
  });

  test("no registration yet: resolves to null instead of hanging on `.ready`", async () => {
    const getRegistration = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { serviceWorker: { getRegistration } });
    await expect(currentSubscription()).resolves.toBeNull();
    expect(getRegistration).toHaveBeenCalled();
  });
});

describe("urlBase64ToUint8Array", () => {
  test("decodes URL-safe base64 without padding", () => {
    expect([...urlBase64ToUint8Array("AQID_-8")]).toEqual([1, 2, 3, 255, 239]);
  });

  test("a real VAPID public key is 65 bytes starting with 0x04", () => {
    const key =
      "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
    const bytes = urlBase64ToUint8Array(key);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(4);
  });
});
