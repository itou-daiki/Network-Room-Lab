import type {
  DeviceDefinition,
  FaultType,
  PhaseDefinition,
  ProtocolStep,
  RoleDefinition,
  RoleId,
  RoomPhase,
  TopologyLink,
} from "./types";

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    id: "CLIENT_PC",
    label: "クライアントPC",
    shortLabel: "PC",
    description: "通信を始め、URLからWebページが届くまでを組み立てます。",
    observes: ["IP設定", "ARPキャッシュ", "ポート", "アプリデータ"],
    accent: "#3aa6ff",
  },
  {
    id: "ACCESS_POINT",
    label: "無線アクセスポイント",
    shortLabel: "無線AP",
    description: "Wi-FiとEthernetのフレームを橋渡しします。",
    observes: ["SSID", "接続端末", "Wi-Fiフレーム", "Ethernetフレーム"],
    accent: "#41d5b0",
  },
  {
    id: "L2_SWITCH",
    label: "L2スイッチ",
    shortLabel: "L2",
    description: "MACアドレスを学習し、適切なポートへフレームを送ります。",
    observes: ["送信元MAC", "宛先MAC", "MACアドレス表", "ポート"],
    accent: "#8f9cff",
  },
  {
    id: "ROUTER",
    label: "ルータ",
    shortLabel: "Router",
    description: "IP経路表を参照し、TTLを更新して次のネットワークへ送ります。",
    observes: ["宛先IP", "TTL", "経路表", "次ホップ"],
    accent: "#ffbf5f",
  },
  {
    id: "DNS_SERVER",
    label: "DNSサーバ",
    shortLabel: "DNS",
    description: "ドメイン名をIPアドレスへ変換します。",
    observes: ["問い合わせ名", "レコード", "TTL", "応答コード"],
    accent: "#72d7ed",
  },
  {
    id: "WEB_SERVER",
    label: "Webサーバ",
    shortLabel: "Web",
    description: "TCP・TLS・HTTPの要求を受け取り、教材ページを返します。",
    observes: ["TCP状態", "証明書", "HTTPメソッド", "パス"],
    accent: "#ff7e8c",
  },
  {
    id: "OBSERVER",
    label: "観察者",
    shortLabel: "Observer",
    description: "チーム全体の経路と判断を観察し、説明を支援します。",
    observes: ["通信経路", "イベント", "判断理由", "振り返り"],
    accent: "#a6b2bd",
  },
];

export const PHASE_DEFINITIONS: PhaseDefinition[] = [
  {
    id: "LOBBY",
    index: 0,
    label: "入室",
    shortLabel: "入室",
    instruction: "部屋コードで参加し、チームがそろうのを待ちます。",
  },
  {
    id: "ROLES",
    index: 1,
    label: "役割確認",
    shortLabel: "役割",
    instruction: "自分の機器が見られる情報と、判断する内容を確認します。",
  },
  {
    id: "TOPOLOGY",
    index: 2,
    label: "機器構成",
    shortLabel: "構成",
    instruction: "ポートと媒体を確認し、通信経路を構成します。",
  },
  {
    id: "ADDRESSING",
    index: 3,
    label: "IP設定",
    shortLabel: "IP",
    instruction: "IPアドレス、プレフィックス、GW、DNSを設定します。",
  },
  {
    id: "PROTOCOL",
    index: 4,
    label: "通信実験",
    shortLabel: "通信",
    instruction: "ARPからHTTPSまで、担当機器ごとに判断して転送します。",
  },
  {
    id: "DIAGNOSIS",
    index: 5,
    label: "障害診断",
    shortLabel: "診断",
    instruction: "症状から仮説を立て、安全な診断ツールで失敗地点を絞ります。",
  },
  {
    id: "REFLECTION",
    index: 6,
    label: "振り返り",
    shortLabel: "説明",
    instruction: "通信を説明し、高校生へ伝える問いと授業アイデアに変換します。",
  },
];

export const DEVICES: DeviceDefinition[] = [
  { id: "pc", type: "pc", label: "PC", role: "CLIENT_PC", address: "192.168.10.23" },
  { id: "ap", type: "access-point", label: "無線AP", role: "ACCESS_POINT" },
  { id: "switch", type: "switch", label: "L2スイッチ", role: "L2_SWITCH" },
  { id: "router", type: "router", label: "ルータ", role: "ROUTER", address: "192.168.10.1" },
  { id: "internet", type: "internet", label: "インターネット", role: null },
  { id: "dns", type: "dns", label: "DNSサーバ", role: "DNS_SERVER", address: "198.51.100.53" },
  { id: "web", type: "web", label: "Webサーバ", role: "WEB_SERVER", address: "203.0.113.80" },
];

export const DEFAULT_LINKS: TopologyLink[] = [
  { id: "pc-ap", from: "pc", to: "ap", medium: "Wi-Fi", up: true },
  { id: "ap-switch", from: "ap", to: "switch", medium: "Ethernet", up: true },
  { id: "switch-router", from: "switch", to: "router", medium: "Ethernet", up: true },
  { id: "router-internet", from: "router", to: "internet", medium: "仮想WAN", up: true },
  { id: "internet-dns", from: "internet", to: "dns", medium: "仮想WAN", up: true },
  { id: "internet-web", from: "internet", to: "web", medium: "仮想WAN", up: true },
];

const allLayers = (protocol: ProtocolStep["protocol"], ttl: number): ProtocolStep["layers"] => {
  const application =
    protocol === "ARP"
      ? "ARP: who has 192.168.10.1?"
      : protocol === "DNS"
        ? "DNS: class.yamanashi.example"
        : protocol === "HTTPS"
          ? "HTTP GET /lesson over TLS"
          : "教材Webアクセス";

  return [
    {
      id: "application",
      label: "Application",
      value: application,
      visibleTo: ["CLIENT_PC", "DNS_SERVER", "WEB_SERVER", "OBSERVER"],
    },
    {
      id: "security",
      label: "Security",
      value: protocol === "TLS" || protocol === "HTTPS" ? "TLS 1.3 / certificate" : "まだ暗号化されていません",
      visibleTo: ["CLIENT_PC", "WEB_SERVER", "OBSERVER"],
    },
    {
      id: "transport",
      label: "Transport",
      value: protocol === "DNS" ? "UDP 53144 → 53" : "TCP 53144 → 443",
      visibleTo: ["CLIENT_PC", "WEB_SERVER", "DNS_SERVER", "OBSERVER"],
    },
    {
      id: "network",
      label: "Internet",
      value: `IPv4 192.168.10.23 → ${protocol === "DNS" ? "198.51.100.53" : "203.0.113.80"} / TTL ${ttl}`,
      visibleTo: ["CLIENT_PC", "ROUTER", "OBSERVER"],
    },
    {
      id: "link",
      label: "Link",
      value: "Ethernet / Wi-Fi frame",
      visibleTo: ["CLIENT_PC", "ACCESS_POINT", "L2_SWITCH", "OBSERVER"],
    },
  ];
};

const step = (
  index: number,
  protocol: ProtocolStep["protocol"],
  title: string,
  description: string,
  actorRole: RoleId,
  nodeId: string,
  eventType: ProtocolStep["eventType"],
  ttl: number,
): ProtocolStep => ({
  id: `step-${index}`,
  index,
  protocol,
  title,
  description,
  actorRole,
  nodeId,
  eventType,
  layers: allLayers(protocol, ttl),
  ttl,
});

export const PROTOCOL_STEPS: ProtocolStep[] = [
  step(0, "ARP", "ゲートウェイのMACを問い合わせる", "外部ネットワークへ送る前に、デフォルトゲートウェイのMACアドレスを確認します。", "CLIENT_PC", "pc", "CREATE_PACKET", 64),
  step(1, "ARP", "Wi-Fiフレームを有線へ橋渡し", "上位層を変更せず、無線からEthernetへフレームを渡します。", "ACCESS_POINT", "ap", "FORWARD_PACKET", 64),
  step(2, "ARP", "宛先MACから出力ポートを選ぶ", "MACアドレス表を参照し、ルータ側ポートへ転送します。", "L2_SWITCH", "switch", "FORWARD_PACKET", 64),
  step(3, "DNS", "DNS問い合わせを外部へ中継", "宛先ネットワークを経路表で照合し、TTLを1減らします。", "ROUTER", "router", "FORWARD_PACKET", 63),
  step(4, "DNS", "ドメイン名を解決", "Aレコードを参照し、WebサーバのIPアドレスを応答します。", "DNS_SERVER", "dns", "CREATE_PACKET", 63),
  step(5, "DNS", "DNS応答をLANへ戻す", "復路の経路を選び、リンク層ヘッダを付け替えます。", "ROUTER", "router", "FORWARD_PACKET", 62),
  step(6, "DNS", "DNS応答をPCへ届ける", "学習済みMACアドレスを使い、PC側ポートへ転送します。", "L2_SWITCH", "switch", "FORWARD_PACKET", 62),
  step(7, "TCP", "TCP接続を開始", "Webサーバの443番ポートへSYNを送信します。", "CLIENT_PC", "pc", "CHANGE_PROTOCOL", 64),
  step(8, "TCP", "Webサーバへの経路を選ぶ", "最長一致する経路を使い、TTLを1減らします。", "ROUTER", "router", "FORWARD_PACKET", 63),
  step(9, "TCP", "TCP接続を確立", "SYNを受け取り、SYN/ACKを返します。", "WEB_SERVER", "web", "CREATE_PACKET", 63),
  step(10, "TLS", "証明書を提示", "サーバ証明書と暗号化条件をクライアントへ送ります。", "WEB_SERVER", "web", "CHANGE_PROTOCOL", 63),
  step(11, "TLS", "証明書を検証", "名前・有効期限・信頼の連鎖を確認し、安全な通信を開始します。", "CLIENT_PC", "pc", "CHANGE_PROTOCOL", 64),
  step(12, "HTTPS", "暗号化されたGET要求を送る", "TLSの内側で教材ページを要求します。", "CLIENT_PC", "pc", "CREATE_PACKET", 64),
  step(13, "HTTPS", "HTTP要求を処理", "GET /lesson を受け取り、200 OKとHTMLを返します。", "WEB_SERVER", "web", "CREATE_PACKET", 63),
  step(14, "HTTPS", "応答をLANへ転送", "宛先IPを見て戻りの経路を選び、TTLを更新します。", "ROUTER", "router", "FORWARD_PACKET", 62),
  step(15, "HTTPS", "フレームをPC側へ転送", "宛先MACに対応するポートを選びます。", "L2_SWITCH", "switch", "FORWARD_PACKET", 62),
  step(16, "HTTPS", "教材ページを再構成", "受信したデータを復号・再構成し、ブラウザへ表示します。", "CLIENT_PC", "pc", "FORWARD_PACKET", 62),
];

export const FAULT_DEFINITIONS: Array<{
  type: FaultType;
  label: string;
  target: string;
  symptom: string;
  hint: string;
}> = [
  { type: "AP_DOWN", label: "無線AP停止", target: "ap", symptom: "接続直後から通信できません。", hint: "リンク状態と接続端末を確認します。" },
  { type: "CABLE_CUT", label: "上位ケーブル断", target: "switch-router", symptom: "教室内から外部へ到達できません。", hint: "共通する最後の正常地点を探します。" },
  { type: "BAD_GATEWAY", label: "GW誤設定", target: "pc", symptom: "同じLANには届きますが外部IPへ届きません。", hint: "サブネット判定とデフォルトGWを確認します。" },
  { type: "DNS_DOWN", label: "DNS停止", target: "dns", symptom: "IP直指定なら開きますがURLでは開きません。", hint: "名前解決とIP到達性を分けて試します。" },
  { type: "ROUTE_MISSING", label: "経路表欠落", target: "router", symptom: "校内LANは正常ですが外部へ出られません。", hint: "宛先ネットワークに一致する経路を探します。" },
  { type: "CERT_ERROR", label: "証明書エラー", target: "web", symptom: "接続はできますが安全な通信を開始できません。", hint: "証明書の名前と有効期限を確認します。" },
  { type: "WEB_DOWN", label: "Web停止", target: "web", symptom: "DNSと他の到達性は正常ですが対象だけ開きません。", hint: "アプリケーション層まで切り分けます。" },
];

export const REFLECTION_PROMPTS = [
  { id: "explain-flow", label: "URLを入力してから表示されるまでを、機器とプロトコルの順に説明してください。" },
  { id: "diagnosis", label: "障害診断で、最初の正常地点と最初の失敗地点をどう特定しましたか。" },
  { id: "lesson-design", label: "高校生へ教えるなら、どの問い・活動・比喩を使いますか。" },
];

export const PHASE_INDEX = Object.fromEntries(
  PHASE_DEFINITIONS.map((phase) => [phase.id, phase.index]),
) as Record<RoomPhase, number>;

export function roleDefinition(role: RoleId): RoleDefinition {
  return ROLE_DEFINITIONS.find((item) => item.id === role) ?? ROLE_DEFINITIONS[6]!;
}

export function phaseDefinition(phase: RoomPhase): PhaseDefinition {
  return PHASE_DEFINITIONS.find((item) => item.id === phase) ?? PHASE_DEFINITIONS[0]!;
}
