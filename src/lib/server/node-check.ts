/* Checks a Monero node from the server, for /api/node. User-supplied URLs must not reach
   internal networks: every connection resolves the host and refuses private addresses. */
import { BlockList, isIP } from "node:net";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { Agent, fetch } from "undici";
import { PUBLIC_NODES, type NodeCheck, type NodeInfo } from "../nodes.ts";

const TIMEOUT_MS = 8_000;
const SYNC_TOLERANCE = 3;

const blocked = new BlockList();
for (const [net, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3]] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [["::", 127], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["2001:db8::", 32]] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

// BlockList matches IPv4 rules against IPv4-mapped IPv6 (::ffff:a.b.c.d) too, so those need no rule of their own.
export function isPublicIp(ip: string): boolean {
  const family = isIP(ip);
  if (!family) return false;
  return !blocked.check(ip, family === 6 ? "ipv6" : "ipv4");
}

class PrivateAddressError extends Error {}

const agent = new Agent({
  connect: {
    timeout: TIMEOUT_MS,
    lookup(hostname, options, callback) {
      dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err, "", 4);
        const list = addresses as LookupAddress[];
        const safe = list.filter((a) => isPublicIp(a.address));
        if (!safe.length) return callback(new PrivateAddressError(hostname), "", 4);
        if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, safe);
        callback(null, safe[0].address, safe[0].family);
      });
    },
  },
});

async function getInfo(url: string, origin?: string) {
  const started = performance.now();
  const res = await fetch(`${url}/json_rpc`, {
    method: "POST",
    body: JSON.stringify({ jsonrpc: "2.0", id: "0", method: "get_info" }),
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    redirect: "manual",
    dispatcher: agent,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const ms = Math.round(performance.now() - started);
  const body = (await res.json().catch(() => null)) as { result?: NodeInfo } | null;
  if (!res.ok || !body?.result || typeof body.result.height !== "number") throw new TypeError("not_monero");
  return { info: body.result, ms, cors: !!res.headers.get("access-control-allow-origin") };
}

let reference: { height: number; at: number } | undefined;
/** The tallest chain among a few public nodes, cached for a minute. */
async function referenceHeight(): Promise<number | undefined> {
  if (reference && Date.now() - reference.at < 60_000) return reference.height;
  const heights = await Promise.all(PUBLIC_NODES.slice(0, 3).map((n) => getInfo(n).then((r) => r.info.height, () => 0)));
  const height = Math.max(...heights);
  if (height > 0) reference = { height, at: Date.now() };
  return height || undefined;
}

export async function checkNode(url: string, origin = "https://xmr.fan"): Promise<NodeCheck> {
  const checkedAt = Date.now();
  const host = new URL(url).hostname;
  if (host.endsWith(".onion") || host.endsWith(".i2p")) return { url, ok: false, error: "onion", checkedAt };
  if (isIP(host.replace(/^\[|\]$/g, "")) && !isPublicIp(host.replace(/^\[|\]$/g, ""))) return { url, ok: false, error: "private", checkedAt };
  try {
    const [{ info, ms, cors }, ref] = await Promise.all([getInfo(url, origin), referenceHeight()]);
    const height = info.height;
    return {
      url, ok: true, ms, height, reference: ref, cors,
      synced: info.synchronized !== false && (ref === undefined || height >= ref - SYNC_TOLERANCE),
      network: (info as NodeInfo & { nettype?: string }).nettype ?? "mainnet",
      restricted: info.restricted,
      https: url.startsWith("https:"),
      updateAvailable: (info as NodeInfo & { update_available?: boolean }).update_available,
      checkedAt,
    };
  } catch (e) {
    const cause = (e as { cause?: unknown }).cause;
    const error = e instanceof TypeError && e.message === "not_monero" ? "not_monero"
      : cause instanceof PrivateAddressError || e instanceof PrivateAddressError ? "private"
      : (e as Error).name === "TimeoutError" ? "timeout"
      : "unreachable";
    return { url, ok: false, error, checkedAt };
  }
}
