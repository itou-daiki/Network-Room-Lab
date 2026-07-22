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

export const LEARNING_SCENARIO_GOAL = {
  title: "文部科学省の学習指導要領ページを見る",
  url: "https://www.mext.go.jp/a_menu/shotou/new-cs/1384661.htm",
  detail: "誰でも閲覧できる文部科学省の「平成29・30・31年改訂学習指導要領（本文、解説）」ページを題材に、PCのブラウザへURLを入力してからページが表示されるまで、6つの機器が何を確認し、どんな操作をするかを順番に体験します。このアプリは学習用の通信モデルであり、実際の文部科学省サイトへは接続しません。",
} as const;

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    id: "CLIENT_PC",
    label: "クライアントPC",
    shortLabel: "PC",
    description: "URLを読み、DNSへIPアドレスを質問します。その答えを使ってWebサーバへページを要求し、返ってきたデータをブラウザに表示します。",
    observes: ["PCの住所と範囲", "外部への出口", "出口の機器番号", "Webページの内容"],
    accent: "#3aa6ff",
  },
  {
    id: "ACCESS_POINT",
    label: "無線アクセスポイント",
    shortLabel: "無線AP",
    description: "PCからWi-Fiで届いた質問や要求を、有線LANで次のL2スイッチへ渡します。返ってくる答えやページのデータは、反対向きにPCへ渡します。",
    observes: ["Wi-Fiの名前", "接続中のPC", "PCから届いた質問や要求", "次の有線接続"],
    accent: "#41d5b0",
  },
  {
    id: "L2_SWITCH",
    label: "L2スイッチ",
    shortLabel: "L2",
    description: "MACアドレスと差込口の対応表を見て、質問・要求・返事を次の機器へ渡すケーブルを選びます。",
    observes: ["入ってきた差込口", "送った機器番号", "届け先の機器番号", "番号と差込口の表"],
    accent: "#8f9cff",
  },
  {
    id: "ROUTER",
    label: "ルータ",
    shortLabel: "ルータ",
    description: "質問や要求に付いた宛先IPアドレスと経路表を比べ、目的のサーバへ近づく次のネットワークを選びます。返事ではPCへ戻る道を選びます。",
    observes: ["最終目的地の住所", "通過できる残り回数", "道案内の表", "次の渡し先"],
    accent: "#ffbf5f",
  },
  {
    id: "DNS_SERVER",
    label: "DNSサーバ",
    shortLabel: "DNS",
    description: "PCからWebサイト名を質問されると、対応するWebサーバのIPアドレスを答えます。Webページ本体は返しません。",
    observes: ["質問された名前", "質問の種類", "登録された答え", "答えの保存時間"],
    accent: "#72d7ed",
  },
  {
    id: "WEB_SERVER",
    label: "Webサーバ",
    shortLabel: "Web",
    description: "PCから届いた「このページをください」という要求を読み、成功を表す200 OKと学習指導要領ページのデータを安全な通信で返します。",
    observes: ["PCとの通信路", "暗号化の状態", "してほしい操作", "求められたページ"],
    accent: "#ff7e8c",
  },
  {
    id: "OBSERVER",
    label: "観察者",
    shortLabel: "Observer",
    description: "DNSへの質問、Webサーバへの要求、PCへ戻る返事が通った道と、各担当が操作を選んだ理由を記録します。",
    observes: ["質問・要求・返事が通った道", "各担当の操作", "選んだ理由", "学習の振り返り"],
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
    instruction: "学習指導要領ページを表示するために、6つの機器が担当する仕事を順番に確認します。",
  },
  {
    id: "TOPOLOGY",
    index: 2,
    label: "機器構成",
    shortLabel: "構成",
    instruction: "PCからWebサーバまで、どの機器と接続を通るのかを確かめます。",
  },
  {
    id: "ADDRESSING",
    index: 3,
    label: "IP設定",
    shortLabel: "IP",
    instruction: "PCがDNSへ質問し、Webサーバへ要求を送り、返事を受け取れるように、PCの住所・範囲・出口・DNSサーバを設定します。",
  },
  {
    id: "PROTOCOL",
    index: 4,
    label: "通信実験",
    shortLabel: "通信",
    instruction: "学習指導要領ページが表示されるまで、6つの機器の判断を1つずつ動かします。",
  },
  {
    id: "DIAGNOSIS",
    index: 5,
    label: "障害診断",
    shortLabel: "診断",
    instruction: "学習指導要領ページが表示されない原因を、予想と確認コマンドで順番に絞ります。",
  },
  {
    id: "REFLECTION",
    index: 6,
    label: "振り返り",
    shortLabel: "説明",
    instruction: "学習指導要領ページが表示されるまでに分かったことを、自分の言葉で整理します。",
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
      ? "ARPの問い合わせ：192.168.10.1のMACアドレスは？"
      : protocol === "DNS"
        ? "DNSの問い合わせ：www.mext.go.jpのIPアドレスは？"
        : protocol === "TCP"
          ? "TCPの合図：Webサーバと確実に送受信する準備をしたい"
          : protocol === "TLS"
            ? "TLSのやり取り：Webサーバの証明書を確認し、暗号化の鍵を準備"
        : protocol === "HTTPS"
          ? "学習指導要領ページの要求：GET /a_menu/shotou/new-cs/1384661.htm（TLSで暗号化）"
          : "通信内容を確認";

  return [
    {
      id: "application",
      label: "いま運んでいる質問・要求・合図",
      value: application,
      visibleTo: ["CLIENT_PC", "DNS_SERVER", "WEB_SERVER", "OBSERVER"],
    },
    {
      id: "security",
      label: "暗号化の状態",
      value: protocol === "TLS" || protocol === "HTTPS" ? "TLS 1.3で暗号化 / サーバ証明書を確認" : "まだ暗号化していません",
      visibleTo: ["CLIENT_PC", "WEB_SERVER", "OBSERVER"],
    },
    {
      id: "transport",
      label: "PCとサーバの受付窓口（ポート番号）",
      value: protocol === "DNS" ? "DNSへの質問：PC側53144番 → DNSサーバ側53番" : protocol === "ARP" ? "ARPはポート番号を使わず、同じLAN内で直接問い合わせ" : "Web通信：PC側53144番 → Webサーバ側443番",
      visibleTo: ["CLIENT_PC", "WEB_SERVER", "DNS_SERVER", "OBSERVER"],
    },
    {
      id: "network",
      label: "送信元と最終宛先のIP",
      value: `IPv4 192.168.10.23 → ${protocol === "DNS" ? "198.51.100.53" : "203.0.113.80"} / TTL ${ttl}`,
      visibleTo: ["CLIENT_PC", "ROUTER", "OBSERVER"],
    },
    {
      id: "link",
      label: "次の機器までの運び方",
      value: "Wi-FiまたはEthernet用のフレーム",
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
  step(0, "ARP", "DNSへの質問を出口へ渡すため、ルータの機器番号を調べる", "PCはWebサイト名をDNSへ質問したいと考えています。まずARPを使い、最初の渡し先であるルータ192.168.10.1のMACアドレスを調べます。", "CLIENT_PC", "pc", "CREATE_PACKET", 64),
  step(1, "ARP", "ルータの機器番号を尋ねるARPの質問を、有線LANへ渡す", "無線アクセスポイントは、ARPの質問をWi-Fi用フレームからEthernet用フレームへ載せ替えます。尋ねているIPアドレス192.168.10.1は変えません。", "ACCESS_POINT", "ap", "FORWARD_PACKET", 64),
  step(2, "ARP", "ARPの質問を、届いた差込口以外へ広げて送る", "この時点ではルータのMACアドレスがまだ分からないため、ARPの質問はブロードキャスト用の宛先MACアドレスを使います。L2スイッチは、質問が入ってきた差込口を除く同じLAN内の差込口へ広げて送ります。", "L2_SWITCH", "switch", "FORWARD_PACKET", 64),
  step(3, "DNS", "Webサイト名の質問を、DNSサーバ側へ送る", "ARPの回答で出口のMACアドレスが分かった後、PCは「www.mext.go.jpのIPアドレスを教えて」というDNSの質問を作りました。この学習モデルでは同じLAN内の繰り返しを省略し、ルータが質問を外部側へ送る判断から続けます。", "ROUTER", "router", "FORWARD_PACKET", 63),
  step(4, "DNS", "Webサイト名に対応するIPアドレスを答える", "登録されたAレコードを調べ、WebサーバのIPアドレス203.0.113.80をPCへ返します。", "DNS_SERVER", "dns", "CREATE_PACKET", 63),
  step(5, "DNS", "DNSサーバの答えを、校内LAN側へ戻す", "PCのIPアドレスに合う帰り道を選び、次のLAN区間で使うフレームに入れ替えます。", "ROUTER", "router", "FORWARD_PACKET", 62),
  step(6, "DNS", "DNSサーバの答えを、PCにつながる差込口へ送る", "PCの機器番号（MACアドレス）と対応表を比べ、PC側の1番の差込口へ送ります。", "L2_SWITCH", "switch", "FORWARD_PACKET", 62),
  step(7, "TCP", "DNSの答えを使い、Webサーバとの通信路を作り始める", "DNSの答え203.0.113.80がPCへ戻りました。PCはページを要求する前に、Webサーバの443番窓口へ通信開始の合図（SYN）を送ります。", "CLIENT_PC", "pc", "CHANGE_PROTOCOL", 64),
  step(8, "TCP", "通信開始の合図を、Webサーバ側へ送る", "WebサーバのIPアドレスに合う道を経路表から選び、通過できる残り回数（TTL）を1減らします。", "ROUTER", "router", "FORWARD_PACKET", 63),
  step(9, "TCP", "Webサーバ側でも通信路を準備する", "PCからの通信開始の合図を受け取り、受け取ったことを示す返事（SYN/ACK）を返します。", "WEB_SERVER", "web", "CREATE_PACKET", 63),
  step(10, "TLS", "Webサーバが本物だと確認できる情報を送る", "Webサーバの名前や有効期限が書かれたサーバ証明書と、暗号化の条件をPCへ送ります。", "WEB_SERVER", "web", "CHANGE_PROTOCOL", 63),
  step(11, "TLS", "接続先が本物か確認し、暗号化を始める", "証明書のWebサイト名・有効期限・発行元を確認し、安全に通信できる状態を作ります。", "CLIENT_PC", "pc", "CHANGE_PROTOCOL", 64),
  step(12, "HTTPS", "暗号化した状態で、学習指導要領ページを要求する", "暗号化された通信の中で、「学習指導要領ページをください」というGET要求を送ります。", "CLIENT_PC", "pc", "CREATE_PACKET", 64),
  step(13, "HTTPS", "要求された学習指導要領ページを返す", "GET /a_menu/shotou/new-cs/1384661.htmという要求を読み、成功を表す200 OKとページのHTMLを返します。", "WEB_SERVER", "web", "CREATE_PACKET", 63),
  step(14, "HTTPS", "学習指導要領ページのデータを、校内LAN側へ戻す", "PCのIPアドレスに合う帰り道を選び、通過できる残り回数（TTL）を1減らします。", "ROUTER", "router", "FORWARD_PACKET", 62),
  step(15, "HTTPS", "学習指導要領ページのデータを、PC側の差込口へ送る", "PCの機器番号（MACアドレス）を対応表で調べ、PCにつながる1番の差込口へ送ります。", "L2_SWITCH", "switch", "FORWARD_PACKET", 62),
  step(16, "HTTPS", "Webサーバから届いたページのデータを、ブラウザに表示する", "PCはTLSの暗号化を解除し、TCPで分けて運ばれた受信データを正しい順番に戻します。ブラウザがHTMLを読み取り、学習指導要領ページを画面に表示します。", "CLIENT_PC", "pc", "FORWARD_PACKET", 62),
];

export const FAULT_DEFINITIONS: Array<{
  type: FaultType;
  label: string;
  target: string;
  symptom: string;
  hint: string;
}> = [
  { type: "AP_DOWN", label: "無線APが停止", target: "ap", symptom: "PCがWi-Fiへ接続できず、DNSへの質問やWebサーバへの要求を最初の機器へ渡せません。", hint: "PCと無線アクセスポイントの接続状態を確認します。" },
  { type: "CABLE_CUT", label: "ルータへ続くケーブルが切断", target: "switch-router", symptom: "PCから校内の機器へは届きますが、校外のWebサイトへ進めません。", hint: "返事があった最後の機器と、その次の接続を確認します。" },
  { type: "BAD_GATEWAY", label: "PCの出口が誤設定", target: "pc", symptom: "同じ校内LANの機器へは届きますが、外部のWebサーバへ送れません。", hint: "PCのIPアドレスと、外部への出口のIPアドレスを確認します。" },
  { type: "DNS_DOWN", label: "DNSサーバが停止", target: "dns", symptom: "WebサーバのIPアドレスを指定すると届きますが、Webサイト名では届きません。", hint: "Webサイト名をIPアドレスへ変換できるかを確認します。" },
  { type: "ROUTE_MISSING", label: "ルータの道案内が不足", target: "router", symptom: "PCから出口のルータまでは届きますが、その先のWebサーバへ進めません。", hint: "WebサーバのIPアドレスに合う道が、ルータの経路表にあるか確認します。" },
  { type: "CERT_ERROR", label: "Webサイトの証明書に問題", target: "web", symptom: "Webサーバへは接続できますが、安全な通信を開始できません。", hint: "証明書のWebサイト名と有効期限を確認します。" },
  { type: "WEB_DOWN", label: "Webサーバが停止", target: "web", symptom: "WebサーバのIPアドレスまでは届きますが、学習指導要領ページが返りません。", hint: "Webサーバが学習指導要領ページの要求へ応答しているか確認します。" },
];

export const REFLECTION_PROMPTS = [
  { id: "explain-flow", label: "文部科学省の学習指導要領ページを見るために、PCからWebサーバまでの6つの機器は何をしましたか。順番に説明してください。" },
  { id: "diagnosis", label: "学習指導要領ページが表示されない原因を調べたとき、どの結果から「ここまでは正常」「この先に問題がある」と判断しましたか。" },
  { id: "lesson-design", label: "今回いちばん理解できた機器の仕事と、もう一度確認したいことを書いてください。" },
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
