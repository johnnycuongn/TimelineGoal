import { toast } from "sonner";

const FAILED = "We couldn't copy it. Select the code and copy it yourself?";

/**
 * Copies `text` and says what happened. The write is awaited: Safari refuses
 * `navigator.clipboard` outside a user gesture and a denied permission rejects,
 * so a toast that fires before the promise settles claims a copy that never
 * happened.
 */
export async function copyWithToast(text: string, done: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
    return true;
  } catch {
    toast.error(FAILED);
    return false;
  }
}
