import { FAULT_DEFINITIONS } from "./scenario";
import { targetPageShortLabel } from "./learningTarget";
import type {
  ActiveFault,
  DiagnosticResult,
  DiagnosticTool,
  FaultType,
  InterfaceConfig,
  LearningTarget,
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
  if (!isValidIpv4(input.address)) errors.push("PCのIPアドレスは、192.168.10.23のように0〜255の数を4つ、点で区切って入力します。");
  if (!Number.isInteger(input.prefix) || input.prefix < 1 || input.prefix > 30) {
    errors.push("同じネットワークの範囲を表す数は1〜30で入力します。この実習の推奨値は24です。");
  }
  if (!isValidIpv4(input.gateway)) errors.push("外部への出口は、192.168.10.1のようなIPアドレスの形で入力します。");
  if (!isValidIpv4(input.dns)) errors.push("DNSサーバは、1.1.1.1のようなIPアドレスの形で入力します。");
  if (
    isValidIpv4(input.address) &&
    isValidIpv4(input.gateway) &&
    Number.isInteger(input.prefix) &&
    !isSameSubnet(input.address, input.gateway, input.prefix)
  ) {
    errors.push(`PC（${input.address}/${input.prefix}）と出口（${input.gateway}）が同じネットワークにありません。PCは同じLAN内にある出口へ最初に渡すため、この実習では出口を192.168.10.1へ戻します。`);
  }
  return errors;
}

function hasFault(faults: ActiveFault[], type: FaultType): boolean {
  return faults.some((fault) => fault.type === type);
}

export interface DiagnosticEnvironment {
  links?: TopologyLink[];
  interfaceConfig?: InterfaceConfig;
  learningTarget?: LearningTarget;
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
  let inference = "確認用の通信は目的地まで届き、返事もPCへ戻りました。この結果から、途中の接続と経路は使えると判断できます。Webページ自体が正常かは、HTTPSの確認結果と分けて考えます。";

  const targetIsIp = isValidIpv4(target);
  const gatewayTarget = target === "192.168.10.1";
  const needsDns = tool === "NSLOOKUP" || !targetIsIp;
  const downLinks = new Set(environment.links?.filter((link) => !link.up).map((link) => link.id) ?? []);
  const localLinkDown = ["pc-ap", "ap-switch", "switch-router"].find((linkId) => downLinks.has(linkId));
  const externalLinkDown = downLinks.has("router-internet");
  const dnsLinkDown = downLinks.has("internet-dns");
  const webLinkDown = downLinks.has("internet-web");
  const config = environment.interfaceConfig;
  const learningTarget = environment.learningTarget;
  const targetAddress = learningTarget?.primaryIpv4 ?? "203.0.113.80";
  const targetHostname = learningTarget?.hostname ?? "www.mext.go.jp";
  const targetTtl = learningTarget?.dnsTtl ?? 300;
  const pageLabel = learningTarget ? targetPageShortLabel(learningTarget) : "学習指導要領ページ";

  if (localLinkDown) {
    success = false;
    output = [`link: ${localLinkDown} is down`, "reply: none"];
    inference = "PCから最初の出口であるルータへ届く前に、返事が途切れています。全体図の赤い接続線を探すと、どの2機器の間で止まったかを確認できます。接続を戻した後に同じコマンドを実行し、結果を比べます。";
  } else if (externalLinkDown && !gatewayTarget) {
    success = false;
    output = ["hop 1: 192.168.10.1 reachable", "hop 2: uplink is down"];
    inference = "出口のルータからは返事があるため、PCからルータまでは使えます。次の外部側接続で返事が途切れているため、原因の範囲をルータより先へ絞れます。";
  } else if (dnsLinkDown && needsDns) {
    success = false;
    output = [`query: ${target}`, "server: 1.1.1.1", "result: timed out"];
    inference = "DNSサーバへ向かう接続で返事が途切れています。次に、WebサーバのIPアドレスを直接指定して返事を比べます。";
  } else if (webLinkDown && tool !== "NSLOOKUP") {
    success = false;
    output = [`DNS: ${targetAddress}`, "last reachable hop: internet", "destination: timed out"];
    inference = "DNSからIPアドレスの答えは返っているため、名前の確認は完了しています。一方、Webサーバからは返事がないため、原因はDNSではなくWebサーバへ向かう最後の接続側にあります。";
  } else if (config && config.gateway !== "192.168.10.1" && !gatewayTarget) {
    success = false;
    output = [`local LAN: ${config.address}/${config.prefix}`, `gateway ${config.gateway}: no route to host`];
    inference = "PCの出口が実験用ルータと一致していません。ipconfigでデフォルトゲートウェイを確認します。";
  } else if (config && config.dns !== "1.1.1.1" && needsDns) {
    success = false;
    output = [`query: ${target}`, `server: ${config.dns}`, "result: server not found"];
    inference = "PCに設定されたDNSサーバが、この実験で使うDNSサーバと一致していません。次に、WebサーバのIPアドレスを直接指定した結果と比べます。";
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
    output = [`query: ${target}`, "server: 1.1.1.1", "result: timed out"];
    inference = `Webサイト名をIPアドレスへ変換できていません。次にWebサーバのIPアドレス${targetAddress}を直接指定し、通信経路とDNSの問題を分けて調べます。`;
  } else if (hasFault(faults, "ROUTE_MISSING") && !gatewayTarget) {
    success = false;
    output = ["hop 1: 192.168.10.1", "router: no matching route"];
    inference = "ルータまでは届いています。宛先ネットワークに一致する経路がありません。";
  } else if (hasFault(faults, "CERT_ERROR") && tool === "HTTPS") {
    success = false;
    output = [`TCP: connected to ${targetAddress}:443`, "TLS: certificate name mismatch"];
    inference = "Webサーバとの通信路（TCP）は作れましたが、暗号化を始める前の相手確認（TLS）で止まっています。証明書の名前・期限・発行元を確認します。";
  } else if (hasFault(faults, "WEB_DOWN") && tool === "HTTPS") {
    success = false;
    output = [`DNS: ${targetAddress}`, "network: reachable", "application: connection refused"];
    inference = `WebサーバのIPアドレスまでは届いていますが、${pageLabel}の応答が返りません。Webサーバ側でページを返す機能を確認します。`;
  } else if (tool === "PING") {
    const replyAddress = gatewayTarget ? "192.168.10.1" : targetIsIp ? target : targetAddress;
    output = [`PING ${target} (${replyAddress})`, `reply from ${replyAddress}: time=${gatewayTarget ? "1" : "18"}ms TTL=${gatewayTarget ? "64" : "61"}`, "1 packets transmitted, 1 received, 0% packet loss"];
    inference = gatewayTarget
      ? "PCからデフォルトゲートウェイまでのLAN内経路は正常です。次は外部IPへ範囲を広げます。"
      : "IP通信は目的地まで届いています。ただし、Webサービスや証明書が正常とはまだ判断できません。";
  } else if (tool === "NSLOOKUP") {
    if (target !== targetHostname) {
      success = false;
      output = ["server: 1.1.1.1", `name: ${target}`, "result: この部屋では未取得"];
      inference = `この部屋の作成時に実DNS問い合わせを行った名前は${targetHostname}です。nslookup ${targetHostname}を実行して、保存された実際の回答を確認します。`;
    } else {
      output = ["server: 1.1.1.1", `name: ${target}`, ...(learningTarget?.ipv4Addresses ?? [targetAddress]).map((address) => `address: ${address}`), `TTL: ${targetTtl} seconds`, `resolver: ${learningTarget?.resolver ?? "学習用DNS"}`, `resolved at: ${learningTarget?.resolvedAt ?? "部屋作成時"}`];
      inference = "部屋の作成時に公開DNSへ実際に問い合わせて得たIPv4アドレスを確認できました。DNSの回答は時間や接続場所によって変わることがあります。次は、得られたIPアドレスへ返事が届くかを確認します。";
    }
  } else if (tool === "TRACEROUTE") {
    output = ["1  192.168.10.1  1 ms", "2  198.18.0.1  8 ms", `3  ${targetAddress}  18 ms`];
    inference = "1番目、2番目、3番目の経由地点から順に返事があり、Webサーバまで届いています。各行は、途中で返事をしたルータを表します。";
  } else {
    output = ["TCP 443: connected", "TLS: certificate valid", "HTTP/2 200 OK"];
    inference = `WebサーバのIPアドレスまで届き、通信路の準備、証明書の確認、${pageLabel}の応答まで成功しました。ページを安全に取得できる状態です。`;
  }

  return { id, tool, target, success, output, inference, createdAt: now, actorId };
}

export function faultDetails(type: FaultType) {
  return FAULT_DEFINITIONS.find((fault) => fault.type === type) ?? FAULT_DEFINITIONS[0]!;
}
