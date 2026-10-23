/* Runs the slow Argon2id step off the page's main thread, as the spec asks. */
import { addressGlyphs, type Namespace } from "./glyphs.ts";

self.onmessage = (e: MessageEvent<{ id: number; namespace: Namespace; address: string }>) => {
  const { id, namespace, address } = e.data;
  try {
    self.postMessage({ id, glyphs: addressGlyphs(namespace, address) });
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};
