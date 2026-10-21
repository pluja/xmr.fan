/* Fetches hashes.txt from getmonero.org and accepts it only if binaryFate's key signed it. */
import { readCleartextMessage, readKey, verify } from "openpgp";
import BINARYFATE_KEY from "../../data/keys/binaryfate.ts";
import { parseHashes, versionOf, type HashList } from "../hashes.ts";

export const HASHES_URL = "https://www.getmonero.org/downloads/hashes.txt";
export const BINARYFATE_FINGERPRINT = "81ac591fe9c4b65c5806afc3f0af4d462a0bdf92";

/** The signed text, or throws if the signature isn't binaryFate's. */
export async function verifiedText(signed: string, armoredKey: string): Promise<string> {
  const key = await readKey({ armoredKey });
  if (key.getFingerprint() !== BINARYFATE_FINGERPRINT) throw new Error("unexpected key");
  const message = await readCleartextMessage({ cleartextMessage: signed });
  const { signatures, data } = await verify({ message, verificationKeys: key });
  await signatures[0].verified;
  return data;
}

export async function loadHashList(): Promise<HashList> {
  const res = await fetch(HASHES_URL, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`hashes.txt: ${res.status}`);
  const files = parseHashes(await verifiedText(await res.text(), BINARYFATE_KEY));
  return { version: versionOf(files), files, signer: "binaryFate", fingerprint: BINARYFATE_FINGERPRINT.toUpperCase(), checkedAt: Date.now() };
}

