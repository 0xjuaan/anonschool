import crypto from "crypto";

// Lazy import to avoid bundling server-only deps in client
async function authenticateMail(message: string | Buffer) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { authenticate } = require("mailauth") as {
    authenticate: (msg: string | Buffer) => Promise<any>;
  };
  return authenticate(message);
}

export type ParsedHeaders = Record<string, string>;

export function parseHeaders(eml: string | Buffer): ParsedHeaders {
  const text = Buffer.isBuffer(eml) ? eml.toString("utf8") : eml;
  const headerPart = text.split(/\r?\n\r?\n/)[0] || "";
  const lines = headerPart.split(/\r?\n/);
  const headers: ParsedHeaders = {};
  let currentKey = "";
  for (const line of lines) {
    if (/^[ \t]/.test(line) && currentKey) {
      headers[currentKey] += line.trim();
      continue;
    }
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    currentKey = line.slice(0, idx).trim().toLowerCase();
    headers[currentKey] = (line.slice(idx + 1).trim() || "");
  }
  return headers;
}

export function getHeader(headers: ParsedHeaders, name: string): string | undefined {
  return headers[name.toLowerCase()];
}

export function extractDomainFromAddress(address?: string): string | undefined {
  if (!address) return undefined;
  const match = address.match(/[<\s]([A-Z0-9._%+-]+)@([A-Z0-9.-]+)\b/i);
  if (!match) return undefined;
  return match[2].toLowerCase();
}

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function verifyDkimAndSubject(
  eml: string | Buffer,
  opts: { expectedDomain: string; expectedSubject: string }
) {
  const { expectedDomain, expectedSubject } = opts;

  const headers = parseHeaders(eml);
  const subject = getHeader(headers, "subject") || "";
  const messageId = getHeader(headers, "message-id") || "";
  const from = getHeader(headers, "from") || "";
  const fromDomain = extractDomainFromAddress(from) || "";

  if (subject.trim() !== expectedSubject) {
    return { ok: false, reason: "invalid_subject", details: { subject } } as const;
  }

  const auth = await authenticateMail(eml);
  const dkim = auth?.dkim as any;
  const results = dkim?.results || [];
  const passed = results.find((r: any) => r?.status?.result === "pass");

  if (!passed) {
    return { ok: false, reason: "dkim_fail", details: { results } } as const;
  }

  const signingDomain: string = (passed.signingDomain || "").toLowerCase();
  const iHeader: string = (passed.status?.header?.i || "").toLowerCase();
  const identityDomain = iHeader.startsWith("@") ? iHeader.slice(1) : iHeader;

  const matchDomain = (d: string) => d === expectedDomain || d.endsWith(`.${expectedDomain}`);
  const domainAligned = matchDomain(signingDomain) || matchDomain(identityDomain) || matchDomain(fromDomain);

  if (!domainAligned) {
    return {
      ok: false,
      reason: "domain_mismatch",
      details: { signingDomain, identityDomain, fromDomain },
    } as const;
  }

  return {
    ok: true,
    subject,
    messageId,
    from,
    dkim,
    summary: {
      signingDomain,
      selector: passed.selector,
      result: passed.status?.result,
      info: passed.info,
    },
  } as const;
}
