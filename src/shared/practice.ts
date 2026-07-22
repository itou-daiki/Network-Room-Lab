import type { DiagnosticTool, InterfaceConfig, ProtocolStep } from "./types";

export type PracticeMilestone = "IPCONFIG" | "ARP" | "PING_GATEWAY" | "NSLOOKUP" | "PING_WEB" | "TRACEROUTE" | "HTTPS";

export type ParsedPracticeCommand =
  | { kind: "CLEAR"; raw: string }
  | { kind: "LOCAL"; raw: string; command: "IPCONFIG" | "ARP"; milestone: PracticeMilestone }
  | { kind: "DIAGNOSTIC"; raw: string; tool: DiagnosticTool; target: string; milestone: PracticeMilestone }
  | { kind: "OUTPUT"; raw: string; success: boolean; lines: string[]; inference?: string };

export interface PracticeTask {
  id: PracticeMilestone;
  command: string;
  label: string;
  observation: string;
}

export const PRACTICE_TASKS: PracticeTask[] = [
  { id: "IPCONFIG", command: "ipconfig", label: "自分の設定を見る", observation: "IP・範囲・出口・DNSの4項目を確認します。" },
  { id: "ARP", command: "arp -a", label: "LAN内の宛先を調べる", observation: "ゲートウェイのIPとMACの対応を確認します。" },
  { id: "PING_GATEWAY", command: "ping 192.168.10.1", label: "最初の出口まで試す", observation: "失敗したら、PCからルータまでの区間を調べます。" },
  { id: "NSLOOKUP", command: "nslookup class.yamanashi.example", label: "名前解決だけを試す", observation: "名前がIPアドレスへ変換されるかを確認します。" },
  { id: "PING_WEB", command: "ping 203.0.113.80", label: "IP直指定で比較する", observation: "名前解決を使わず、Webサーバまでの到達性を比べます。" },
  { id: "TRACEROUTE", command: "traceroute 203.0.113.80", label: "失敗地点を絞る", observation: "最後に応答したホップと、その次を確認します。" },
  { id: "HTTPS", command: "curl https://class.yamanashi.example", label: "Webサービスまで試す", observation: "IP到達後のTLS・HTTPまで正常かを確認します。" },
];

export const QUICK_PRACTICE_COMMANDS = PRACTICE_TASKS.map(({ command, label }) => ({ command, label }));

const helpLines = [
  "使えるコマンド:",
  "  ipconfig                         PCのIP設定を表示",
  "  arp -a                           IPとMACの対応を表示",
  "  nslookup <ドメイン名>            名前をIPへ変換",
  "  ping <ドメイン名またはIP>        相手まで届くか確認",
  "  traceroute <ドメイン名またはIP>  通過するルータを確認",
  "  curl https://<ドメイン名>        HTTPSまで確認",
  "  clear / help                     画面消去 / ヘルプ",
];

function normalizeTarget(input: string): string {
  return input
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .trim();
}

function missingArgument(raw: string, command: string, example: string): ParsedPracticeCommand {
  return {
    kind: "OUTPUT",
    raw,
    success: false,
    lines: [`❌ ${command} の調査相手が入力されていません。`, `使い方: ${command} <相手>`, `例: ${example}`],
    inference: "コマンド名の後ろに、調べたいドメイン名またはIPアドレスを入力します。",
  };
}

export function parsePracticeCommand(value: string): ParsedPracticeCommand {
  const raw = value.trim();
  if (!raw) return { kind: "OUTPUT", raw, success: false, lines: ["コマンドを入力してください。"], inference: "help と入力すると、使えるコマンドを確認できます。" };

  const [commandInput = "", ...args] = raw.split(/\s+/);
  const command = commandInput.toLowerCase();

  if (command === "clear" || command === "cls") return { kind: "CLEAR", raw };
  if (command === "help" || command === "?") return { kind: "OUTPUT", raw, success: true, lines: helpLines };
  if (["ipconfig", "ifconfig"].includes(command)) return { kind: "LOCAL", raw, command: "IPCONFIG", milestone: "IPCONFIG" };
  if (command === "arp" && args[0]?.toLowerCase() === "-a") return { kind: "LOCAL", raw, command: "ARP", milestone: "ARP" };
  if (command === "arp") {
    return { kind: "OUTPUT", raw, success: false, lines: ["❌ arp のオプションが違います。", "使い方: arp -a"], inference: "-a は、現在覚えているIPアドレスとMACアドレスの一覧を表示する指定です。" };
  }

  if (["nslookup", "ping", "traceroute", "tracert"].includes(command)) {
    if (!args[0]) return missingArgument(raw, command === "tracert" ? "traceroute" : command, `${command === "nslookup" ? "nslookup class.yamanashi.example" : `${command} 203.0.113.80`}`);
    const originalTarget = args[0];
    const target = normalizeTarget(originalTarget);
    if (target !== originalTarget) {
      return {
        kind: "OUTPUT",
        raw,
        success: false,
        lines: [`❌ URL全体ではなく、名前またはIPだけを指定します: ${originalTarget}`, `修正例: ${command === "tracert" ? "traceroute" : command} ${target}`],
        inference: "https:// は通信方式、/以降はWebページ内の場所です。ネットワーク調査ではまず相手の名前だけを指定します。",
      };
    }
    const tool: DiagnosticTool = command === "nslookup" ? "NSLOOKUP" : command === "ping" ? "PING" : "TRACEROUTE";
    const milestone: PracticeMilestone = tool === "NSLOOKUP" ? "NSLOOKUP" : tool === "TRACEROUTE" ? "TRACEROUTE" : target === "192.168.10.1" ? "PING_GATEWAY" : "PING_WEB";
    return { kind: "DIAGNOSTIC", raw, tool, target, milestone };
  }

  if (command === "curl") {
    if (!args[0]) return missingArgument(raw, "curl", "curl https://class.yamanashi.example");
    if (!/^https:\/\//i.test(args[0])) {
      return { kind: "OUTPUT", raw, success: false, lines: ["❌ この実験ではHTTPSのURLを指定します。", `修正例: curl https://${normalizeTarget(args[0])}`], inference: "HTTPSまで調べると、IP到達性だけでなく証明書とWebサービスも確認できます。" };
    }
    return { kind: "DIAGNOSTIC", raw, tool: "HTTPS", target: normalizeTarget(args[0]), milestone: "HTTPS" };
  }

  return {
    kind: "OUTPUT",
    raw,
    success: false,
    lines: [`❌ '${commandInput}' はこの実験では使えません。`, "help と入力すると、使えるコマンドを確認できます。"],
    inference: "コマンド名のつづりと、半角スペースを確認します。失敗しても学習記録は壊れません。",
  };
}

export function localPracticeOutput(command: "IPCONFIG" | "ARP", config: InterfaceConfig): { lines: string[]; inference: string } {
  if (command === "ARP") {
    return {
      lines: [
        "Interface: 192.168.10.23",
        "Internet Address      Physical Address      Type",
        `${config.gateway.padEnd(21)}02-00-00-00-10-01     dynamic`,
      ],
      inference: "PCは、同じLAN内の出口となるルータについて、IPアドレスとMACアドレスの対応を覚えています。",
    };
  }

  const mask = config.prefix === 24 ? "255.255.255.0" : `/${config.prefix}`;
  return {
    lines: [
      "Windows IP Configuration (学習用)",
      `  IPv4 Address . . . . . : ${config.address}`,
      `  Subnet Mask  . . . . . : ${mask}`,
      `  Default Gateway  . . . : ${config.gateway}`,
      `  DNS Servers  . . . . . : ${config.dns}`,
    ],
    inference: "まず自分のIP設定を確認すると、通信を始める前の誤設定を切り分けられます。",
  };
}

const distractorPool = [
  "通信内容を確認せず、受け取ったデータをすべての方向へ複製する。",
  "送信元と宛先のIPアドレスを入れ替えて、新しい通信として送り直す。",
  "暗号化を解除し、アプリケーションの内容を書き換えてから転送する。",
  "宛先を確認せず、パケットをその場で破棄して最初からやり直す。",
  "別の機器の役割を代わりに実行し、現在の層の情報を削除する。",
];

export interface ProtocolDecisionChoice {
  id: string;
  label: string;
  correct: boolean;
}

export function protocolDecisionChoices(step: ProtocolStep): ProtocolDecisionChoice[] {
  const wrongA = distractorPool[step.index % distractorPool.length]!;
  const wrongB = distractorPool[(step.index + 2) % distractorPool.length]!;
  const options: ProtocolDecisionChoice[] = [
    { id: `${step.id}-correct`, label: step.description, correct: true },
    { id: `${step.id}-wrong-a`, label: wrongA, correct: false },
    { id: `${step.id}-wrong-b`, label: wrongB, correct: false },
  ];
  const offset = step.index % options.length;
  return [...options.slice(offset), ...options.slice(0, offset)];
}

export function protocolTermIds(step: ProtocolStep): string[] {
  const byProtocol: Record<ProtocolStep["protocol"], string[]> = {
    ARP: ["arp", "mac-address", "frame"],
    DNS: ["dns", "domain", "ttl"],
    TCP: ["tcp", "port", "route"],
    TLS: ["tls", "certificate", "https"],
    HTTPS: ["https", "packet", "port"],
  };
  return byProtocol[step.protocol];
}
