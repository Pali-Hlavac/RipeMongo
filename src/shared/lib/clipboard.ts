/** Clipboard helper with user feedback. */
import { toast } from "sonner";

/** Copies `text` and confirms with a toast; reports failures (e.g. denied permission). */
export async function copyText(text: string, what = "Text"): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied to the clipboard`);
  } catch {
    toast.error(`Could not copy ${what.toLowerCase()} to the clipboard`);
  }
}
