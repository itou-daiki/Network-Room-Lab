import type { LearningTarget } from "../shared/types";

interface DnsJsonAnswer {
  name?: unknown;
  type?: unknown;
  TTL?: unknown;
  data?: unknown;
}

interface DnsJsonResponse {
  Status?: unknown;
  Answer?: unknown;
  Comment?: unknown;
}

const DNS_RESOLVER = "Cloudflare 1.1.1.1（DNS over HTTPS）";

function parseIpv4(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const numbers = parts.map(Number);
  if (numbers.some((part, index) => !Number.isInteger(part) || part < 0 || part > 255 || String(part) !== parts[index])) return null;
  return numbers;
}

function isPublicIpv4(value: string): boolean {
  const parts = parseIpv4(value);
  if (!parts) return false;
  const a = parts[0]!;
  const b = parts[1]!;
  const c = parts[2]!;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

export function normalizeLearningUrl(input: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    throw new Error("BAD_REQUEST: 学習対象URLは https:// から始まる完全なURLで入力してください。");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("BAD_REQUEST: この実習では、安全なWeb通信を学ぶため https:// で始まるURLを指定してください。");
  }
  if (parsed.username || parsed.password) {
    throw new Error("BAD_REQUEST: ユーザー名やパスワードを含むURLは指定できません。");
  }
  if (parsed.port && parsed.port !== "443") {
    throw new Error("BAD_REQUEST: この実習ではHTTPSの標準窓口443番を使うURLを指定してください。");
  }
  if (!parsed.hostname.includes(".") || parseIpv4(parsed.hostname)) {
    throw new Error("BAD_REQUEST: DNSの学習を行うため、IPアドレスではなく公開Webサイトのドメイン名を含むURLを指定してください。");
  }
  return parsed;
}

export async function resolveLearningTarget(input: string): Promise<LearningTarget> {
  const targetUrl = normalizeLearningUrl(input);
  const query = new URL("https://cloudflare-dns.com/dns-query");
  query.searchParams.set("name", targetUrl.hostname);
  query.searchParams.set("type", "A");

  let response: Response;
  try {
    response = await fetch(query, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new Error("BAD_REQUEST: DNS問い合わせが時間内に完了しませんでした。URLを確認して、もう一度お試しください。");
  }
  if (!response.ok) {
    throw new Error(`BAD_REQUEST: DNSサーバから回答を取得できませんでした（HTTP ${response.status}）。`);
  }

  const body: DnsJsonResponse = await response.json();
  if (body.Status !== 0) {
    throw new Error(`BAD_REQUEST: ${targetUrl.hostname} のDNS問い合わせに成功しませんでした（DNS status ${String(body.Status)}）。`);
  }

  const answers = Array.isArray(body.Answer) ? body.Answer as DnsJsonAnswer[] : [];
  const aRecords = answers.filter((answer) => answer.type === 1 && typeof answer.data === "string" && isPublicIpv4(answer.data));
  const ipv4Addresses = [...new Set(aRecords.map((answer) => answer.data as string))];
  if (ipv4Addresses.length === 0) {
    throw new Error(`BAD_REQUEST: ${targetUrl.hostname} から公開IPv4アドレス（Aレコード）が返りませんでした。IPv4で公開されている別のWebページを指定してください。`);
  }
  const ttlValues = aRecords
    .map((answer) => answer.TTL)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0);

  return {
    url: targetUrl.toString(),
    hostname: targetUrl.hostname,
    requestTarget: `${targetUrl.pathname}${targetUrl.search}` || "/",
    ipv4Addresses,
    primaryIpv4: ipv4Addresses[0]!,
    dnsTtl: ttlValues.length > 0 ? Math.min(...ttlValues) : 0,
    resolvedAt: new Date().toISOString(),
    resolver: DNS_RESOLVER,
  };
}
