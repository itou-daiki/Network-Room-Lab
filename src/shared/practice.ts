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
  purpose: string;
  observation: string;
}

export const PRACTICE_TASKS: PracticeTask[] = [
  { id: "IPCONFIG", command: "ipconfig", label: "PCのネットワーク設定を表示する", purpose: "教材ページへデータを送る前に、PCの住所・同じネットワークの範囲・外部への出口・Webサイト名を調べるDNSサーバが正しいか確かめます。", observation: "このPCの住所（IPv4 Address）、範囲（Subnet Mask）、出口（Default Gateway）、DNSサーバ（DNS Servers）の4行を上から確認します。" },
  { id: "ARP", command: "arp -a", label: "PCが覚えた出口の機器番号を表示する", purpose: "PCが最初の渡し先となるルータのMACアドレスを知っているか調べます。", observation: "ルータのIPアドレスとMACアドレスが同じ行に表示されるか確認します。" },
  { id: "PING_GATEWAY", command: "ping 192.168.10.1", label: "PCから最初の出口まで届くか確かめる", purpose: "教材ページへ向かう道の最初の区間がつながっているか調べます。", observation: "返事があればPCからルータまで、返事がなければその途中に原因があると考えます。" },
  { id: "NSLOOKUP", command: "nslookup class.yamanashi.example", label: "Webサイト名からIPアドレスを調べる", purpose: "PCが教材サイトの通信先住所をDNSサーバから受け取れるか調べます。", observation: "class.yamanashi.exampleに対して203.0.113.80が返るか確認します。" },
  { id: "PING_WEB", command: "ping 203.0.113.80", label: "WebサーバのIPアドレスまで届くか確かめる", purpose: "Webサイト名の変換を使わず、Webサーバまでの通信経路だけを調べます。", observation: "IPアドレスでは返事があるかを見て、DNSの問題と通信経路の問題を分けます。" },
  { id: "TRACEROUTE", command: "traceroute 203.0.113.80", label: "通った道から失敗地点を絞る", purpose: "PCからWebサーバまで、どのルータまではデータが届いたかを調べます。", observation: "最後に返事があった経由地点と、その次に返事がない地点を確認します。" },
  { id: "HTTPS", command: "curl https://class.yamanashi.example", label: "教材サイトからWebの応答が返るか確かめる", purpose: "IPアドレスまで届いた後、暗号化とWebページの応答まで正常か調べます。", observation: "証明書の確認後に、Webサーバから200 OKが返るか確認します。" },
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
      return { kind: "OUTPUT", raw, success: false, lines: ["❌ この実験ではhttps://で始まるWebサイトのURLを指定します。", `修正例: curl https://${normalizeTarget(args[0])}`], inference: "curlでHTTPSを調べると、WebサーバのIPアドレスまで届くことに加え、証明書の確認と教材ページの応答まで確かめられます。" };
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
  "届け先を確認せず、すべての差込口へ同じデータを送る。",
  "送るPCと受け取るWebサーバのIPアドレスを入れ替える。",
  "暗号化を勝手に解除し、Webページの内容を書き換えて送る。",
  "届け先を確認せず、受け取ったデータを削除する。",
  "今の機器では確認できない情報を使い、別の機器の仕事を行う。",
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
