import dns from "node:dns";
import net from "node:net";
import { fetch, Agent } from "undici";
import { UnrecoverableError } from "bullmq";

const MAX_REDIRECTS = 3;
const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 8000;

const blocked = new net.BlockList();
blocked.addSubnet("0.0.0.0", 8, "ipv4");
blocked.addSubnet("10.0.0.0", 8, "ipv4");
blocked.addSubnet("100.64.0.0", 10, "ipv4");
blocked.addSubnet("127.0.0.0", 8, "ipv4");
blocked.addSubnet("169.254.0.0", 16, "ipv4");
blocked.addSubnet("172.16.0.0", 12, "ipv4");
blocked.addSubnet("192.168.0.0", 16, "ipv4");
blocked.addAddress("::1", "ipv6");
blocked.addSubnet("fc00::", 7, "ipv6");
blocked.addSubnet("fe80::", 10, "ipv6");

function isBlockedIp(ip: string) {
  const lower = ip.toLowerCase();
  if (lower.startsWith("::ffff:") && net.isIPv4(lower.slice(7))) {
    return blocked.check(lower.slice(7), "ipv4");
  }
  return blocked.check(ip, net.isIPv6(ip) ? "ipv6" : "ipv4");
}

const agent = new Agent({
  connect: {
    lookup: (hostname: string, options: any, callback: any) => {
      dns.lookup(hostname, options, (err: any, address: any, family: any) => {
        if (err) return callback(err, address, family);
        const list = Array.isArray(address) ? address : [{ address, family }];
        if (list.some((a: { address: string }) => isBlockedIp(a.address))) {
          return callback(new Error(`Blocked address for ${hostname}`), address, family);
        }
        callback(null, address, family);
      });
    },
  },
});

function assertSafeUrl(u: URL) {
  if (!["http:", "https:"].includes(u.protocol)) {
    throw new UnrecoverableError("Unsupported protocol");
  }
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && isBlockedIp(host)) {
    throw new UnrecoverableError("Blocked address");
  }
}

async function readLimited(res: Awaited<ReturnType<typeof fetch>>) {
  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
    if (total >= MAX_BYTES) {
      await reader.cancel();
      break;
    }
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function safeFetchHtml(startUrl: string) {
  let url = new URL(startUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertSafeUrl(url);

    let res;
    try {
      res = await fetch(url, {
        dispatcher: agent,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "user-agent": "ReadLaterBot/1.0",
          accept: "text/html,application/xhtml+xml",
        },
      });
    } catch (err: any) {
      const msg = String(err?.cause?.message ?? err?.message ?? "");
      if (msg.includes("Blocked address")) throw new UnrecoverableError("Blocked address");
      throw err;
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel();
      if (!location) throw new UnrecoverableError("Redirect without location");
      url = new URL(location, url);
      continue;
    }

    if (res.status >= 400) {
      await res.body?.cancel();
      const retryable = res.status === 408 || res.status === 429 || res.status >= 500;
      if (retryable) throw new Error(`HTTP ${res.status}`);
      throw new UnrecoverableError(`HTTP ${res.status}`);
    }

    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("application/xhtml")) {
      await res.body?.cancel();
      return { html: null, finalUrl: url };
    }

    return { html: await readLimited(res), finalUrl: url };
  }

  throw new UnrecoverableError("Too many redirects");
}