import { FAULT_DEFINITIONS } from "./scenario";
import type { ActiveFault, DiagnosticResult, DiagnosticTool, FaultType } from "./types";

function parseIpv4(value: string): number[] | null {
  const parts = value.trim().split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return octets;
}

export function isValidIpv4(value: string): boolean {
  return parseIpv4(value) !== null;
}

export function isSameSubnet(left: string, right: string, prefix: number): boolean {
  const leftParts = parseIpv4(left);
  const rightParts = parseIpv4(right);
  if (!leftParts || !rightParts || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;

  let remaining = prefix;
  for (let index = 0; index < 4; index += 1) {
    const bits = Math.min(8, Math.max(remaining, 0));
    const mask = bits === 0 ? 0 : (0xff << (8 - bits)) & 0xff;
    if ((leftParts[index]! & mask) !== (rightParts[index]! & mask)) return false;
    remaining -= bits;
  }
  return true;
}

export function validateInterfaceConfig(input: {
  address: string;
  prefix: number;
  gateway: string;
  dns: string;
}): string[] {
  const errors: string[] = [];
  if (!isValidIpv4(input.address)) errors.push("IPアドレスの形式が正しくありません。");
  if (!Number.isInteger(input.prefix) || input.prefix < 1 || input.prefix > 30) {
    errors.push("プレフィックス長は1〜30で指定してください。");
  }
  if (!isValidIpv4(input.gateway)) errors.push("デフォルトゲートウェイの形式が正しくありません。");
  if (!isValidIpv4(input.dns)) errors.push("DNSサーバの形式が正しくありません。");
  if (
    isValidIpv4(input.address) &&
    isValidIpv4(input.gateway) &&
    Number.isInteger(input.prefix) &&
    !isSameSubnet(input.address, input.gateway, input.prefix)
  ) {
    errors.push("PCとデフォルトゲートウェイが同じサブネットにありません。");
  }
  return errors;
}

function hasFault(faults: ActiveFault[], type: FaultType): boolean {
  return faults.some((fault) => fault.type === type);
}

export function simulateDiagnostic(
  tool: DiagnosticTool,
  target: string,
  faults: ActiveFault[],
  actorId: string,
  now: string,
  id: string,
): DiagnosticResult {
  let success = true;
  let output: string[] = [];
  let inference = "要求は最後まで到達しました。正常系の経路と各層の働きを説明できます。";

  if (hasFault(faults, "AP_DOWN")) {
    success = false;
    output = ["link: Wi-Fi association failed", "reply: none"];
    inference = "最初のリンクで失敗しています。無線APの状態を確認します。";
  } else if (hasFault(faults, "CABLE_CUT")) {
    success = false;
    output = ["hop 1: 192.168.10.1 reachable", "hop 2: request timed out"];
    inference = "LAN内は正常で、ルータ上流の共通リンクが最初の失敗地点です。";
  } else if (hasFault(faults, "BAD_GATEWAY") && tool !== "NSLOOKUP") {
    success = false;
    output = ["local LAN: reachable", "gateway: no route to host"];
    inference = "同一LANには届くため、PCのサブネット判定かデフォルトGWを確認します。";
  } else if (hasFault(faults, "DNS_DOWN") && tool === "NSLOOKUP") {
    success = false;
    output = [`query: ${target}`, "server: 198.51.100.53", "result: timed out"];
    inference = "IP到達性とは別に、名前解決が失敗しています。DNSサーバを確認します。";
  } else if (hasFault(faults, "ROUTE_MISSING") && tool !== "NSLOOKUP") {
    success = false;
    output = ["hop 1: 192.168.10.1", "router: no matching route"];
    inference = "ルータまでは届いています。宛先ネットワークに一致する経路がありません。";
  } else if (hasFault(faults, "CERT_ERROR") && tool === "HTTPS") {
    success = false;
    output = ["TCP: connected to 203.0.113.80:443", "TLS: certificate name mismatch"];
    inference = "TCP接続後のTLS認証で停止しています。証明書の名前・期限・信頼性を確認します。";
  } else if (hasFault(faults, "WEB_DOWN") && (tool === "HTTPS" || tool === "PING")) {
    success = false;
    output = ["DNS: 203.0.113.80", "network: reachable", "application: connection refused"];
    inference = "ネットワーク層までは正常です。対象Webサービスが最初の失敗地点です。";
  } else if (tool === "PING") {
    output = [`PING ${target}`, "reply from 203.0.113.80: time=18ms TTL=61", "1 packets transmitted, 1 received"];
  } else if (tool === "NSLOOKUP") {
    output = [`name: ${target}`, "address: 203.0.113.80", "TTL: 300 seconds"];
  } else if (tool === "TRACEROUTE") {
    output = ["1  192.168.10.1  1 ms", "2  198.18.0.1  8 ms", "3  203.0.113.80  18 ms"];
  } else {
    output = ["TCP 443: connected", "TLS: certificate valid", "HTTP/2 200 OK"];
  }

  return { id, tool, target, success, output, inference, createdAt: now, actorId };
}

export function faultDetails(type: FaultType) {
  return FAULT_DEFINITIONS.find((fault) => fault.type === type) ?? FAULT_DEFINITIONS[0]!;
}
