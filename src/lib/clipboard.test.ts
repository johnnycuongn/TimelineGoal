import { beforeEach, describe, expect, test, vi } from "vitest";
import { copyWithToast } from "./clipboard";

const toasts: string[] = [];
const errors: string[] = [];

vi.mock("sonner", () => ({
  toast: Object.assign((message: string) => toasts.push(message), {
    error: (message: string) => errors.push(message),
  }),
}));

function withClipboard(writeText: (text: string) => Promise<void>): void {
  vi.stubGlobal("navigator", { clipboard: { writeText } });
}

describe("copyWithToast", () => {
  beforeEach(() => {
    toasts.length = 0;
    errors.length = 0;
  });

  test("copies the text and confirms once the write settles", async () => {
    const written: string[] = [];
    withClipboard(async (text) => {
      written.push(text);
    });
    await expect(copyWithToast("ABC234", "Code copied")).resolves.toBe(true);
    expect(written).toEqual(["ABC234"]);
    expect(toasts).toEqual(["Code copied"]);
    expect(errors).toEqual([]);
  });

  test("never claims success for a write the browser refused", async () => {
    withClipboard(() => Promise.reject(new Error("NotAllowedError")));
    await expect(copyWithToast("ABC234", "Code copied")).resolves.toBe(false);
    expect(toasts).toEqual([]);
    expect(errors).toEqual(["We couldn't copy it. Select the code and copy it yourself?"]);
  });
});
