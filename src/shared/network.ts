import { FAULT_DEFINITIONS } from "./scenario";
import type {
  ActiveFault,
  DiagnosticResult,
  DiagnosticTool,
  FaultType,
  InterfaceConfig,
  TopologyLink,
} from "./types";

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

export interface DiagnosticEnvironment {
  links?: TopologyLink[];
  interfaceConfig?: InterfaceConfig;
}

export function simulateDiagnostic(
  tool: DiagnosticTool,
  target: string,
  faults: ActiveFault[],
  actorId: string,
  now: string,
  id: string,
  environment: DiagnosticEnvironment = {},
): DiagnosticResult {
  let success = true;
  let output: string[] = [];
  let inference = "要求は最後まで到達しました。正常系の経路と各層の働きを説明できます。";

  const targetIsIp = isValidIpv4(target);
  const gatewayTarget = target === "192.168.10.1";
  const needsDns = tool === "NSLOOKUP" || !targetIsIp;
  const downLinks = new Set(environment.links?.filter((link) => !link.up).map((link) => link.id) ?? []);
  const localLinkDown = ["pc-ap", "ap-switch", "switch-router"].find((linkId) => downLinks.has(linkId));
  const externalLinkDown = downLinks.has("router-internet");
  const dnsLinkDown = downLinks.has("internet-dns");
  const webLinkDown = downLinks.has("internet-web");
  const config = environment.interfaceConfig;

  if (localLinkDown) {
    success = false;
    output = [`link: ${localLinkDown} is down`, "reply: none"];
    inference = "PCからルータまでの途中で接続が切れています。全体図で赤いリンクを探し、接続を戻して比較します。";
  } else if (externalLinkDown && !gatewayTarget) {
    success = false;
    output = ["hop 1: 192.168.10.1 reachable", "hop 2: uplink is down"];
    inference = "ルータまでは正常ですが、その先のWANリンクで止まっています。最後に成功した地点はルータです。";
  } else if (dnsLinkDown && needsDns) {
    success = false;
    output = [`query: ${target}`, "server: 198.51.100.53", "result: timed out"];
    inference = "DNSサーバへ向かうリンクで応答が途切れています。IP直指定のpingと比較します。";
  } else if (webLinkDown && tool !== "NSLOOKUP") {
    success = false;
    output = ["DNS: 203.0.113.80", "last reachable hop: internet", "destination: timed out"];
    inference = "名前解決はできていますが、Webサーバへ向かう最後のリンクで止まっています。";
  } else if (config && config.gateway !== "192.168.10.1" && !gatewayTarget) {
    success = false;
    output = [`local LAN: ${config.address}/${config.prefix}`, `gateway ${config.gateway}: no route to host`];
    inference = "PCの出口が実験用ルータと一致していません。ipconfigでデフォルトゲートウェイを確認します。";
  } else if (config && config.dns !== "198.51.100.53" && needsDns) {
    success = false;
    output = [`query: ${target}`, `server: ${config.dns}`, "result: server not found"];
    inference = "設定されているDNSサーバが実験環境と一致していません。IP直指定の結果と比較します。";
  } else if (hasFault(faults, "AP_DOWN")) {
    success = false;
    output = ["link: Wi-Fi association failed", "reply: none"];
    inference = "最初のリンクで失敗しています。無線APの状態を確認します。";
  } else if (hasFault(faults, "CABLE_CUT")) {
    success = false;
    output = ["hop 1: 192.168.10.1 reachable", "hop 2: request timed out"];
    inference = "LAN内は正常で、ルータ上流の共通リンクが最初の失敗地点です。";
  } else if (hasFault(faults, "BAD_GATEWAY") && !gatewayTarget) {
    success = false;
    output = ["local LAN: reachable", "configured gateway: no route to host"];
    inference = "ゲートウェイのIPへ直接pingし、その後ipconfigの出口設定と見比べます。";
  } else if (hasFault(faults, "DNS_DOWN") && needsDns) {
    success = false;
    output = [`query: ${target}`, "server: 198.51.100.53", "result: timed out"];
    inference = "名前解決が失敗しています。203.0.113.80へIP直指定でpingし、IP通信とDNSを分けて確認します。";
  } else if (hasFault(faults, "ROUTE_MISSING") && !gatewayTarget) {
    success = false;
    output = ["hop 1: 192.168.10.1", "router: no matching route"];
    inference = "ルータまでは届いています。宛先ネットワークに一致する経路がありません。";
  } else if (hasFault(faults, "CERT_ERROR") && tool === "HTTPS") {
    success = false;
    output = ["TCP: connected to 203.0.113.80:443", "TLS: certificate name mismatch"];
    inference = "TCP接続後のTLS認証で停止しています。証明書の名前・期限・信頼性を確認します。";
  } else if (hasFault(faults, "WEB_DOWN") && tool === "HTTPS") {
    success = false;
    output = ["DNS: 203.0.113.80", "network: reachable", "application: connection refused"];
    inference = "pingが成功するのにHTTPSだけ失敗するなら、ネットワークより上のWebサービスを確認します。";
  } else if (tool === "PING") {
    const replyAddress = gatewayTarget ? "192.168.10.1" : targetIsIp ? target : "203.0.113.80";
    output = [`PING ${target} (${replyAddress})`, `reply from ${replyAddress}: time=${gatewayTarget ? "1" : "18"}ms TTL=${gatewayTarget ? "64" : "61"}`, "1 packets transmitted, 1 received, 0% packet loss"];
    inference = gatewayTarget
      ? "PCからデフォルトゲートウェイまでのLAN内経路は正常です。次は外部IPへ範囲を広げます。"
      : "IP通信は目的地まで届いています。ただし、Webサービスや証明書が正常とはまだ判断できません。";
  } else if (tool === "NSLOOKUP") {
    output = ["server: 198.51.100.53", `name: ${target}`, "address: 203.0.113.80", "TTL: 300 seconds"];
    inference = "ドメイン名をIPアドレスへ変換できました。次は得られたIPへpingして、到達性を分けて確認します。";
  } else if (tool === "TRACEROUTE") {
    output = ["1  192.168.10.1  1 ms", "2  198.18.0.1  8 ms", "3  203.0.113.80  18 ms"];
    inference = "3つのホップを順番に通り、Webサーバまで到達しています。TTLを変えながら各中継点の応答を確認した結果です。";
  } else {
    output = ["TCP 443: connected", "TLS: certificate valid", "HTTP/2 200 OK"];
    inference = "IP到達性、TCP、証明書、HTTP応答まで正常です。Webページを安全に取得できました。";
  }

  return { id, tool, target, success, output, inference, createdAt: now, actorId };
}

export function faultDetails(type: FaultType) {
  return FAULT_DEFINITIONS.find((fault) => fault.type === type) ?? FAULT_DEFINITIONS[0]!;
}
