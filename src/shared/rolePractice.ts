import type { RoleId } from "./types";

export type CoreRoleId = Exclude<RoleId, "OBSERVER">;

export interface RolePracticeChoice {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

export interface RolePracticeDefinition {
  role: CoreRoleId;
  mission: string;
  situation: string;
  observationTitle: string;
  observations: Array<{ label: string; value: string }>;
  question: string;
  choices: RolePracticeChoice[];
  successTitle: string;
  successOutput: string[];
  explainPrompt: string;
  termIds: string[];
}

export interface RoleReadingGuideItem {
  target: string;
  reading: string;
  check: string;
}

export const CORE_ROLE_IDS: CoreRoleId[] = [
  "CLIENT_PC",
  "ACCESS_POINT",
  "L2_SWITCH",
  "ROUTER",
  "DNS_SERVER",
  "WEB_SERVER",
];

export const ROLE_READING_GUIDES: Record<CoreRoleId, RoleReadingGuideItem[]> = {
  CLIENT_PC: [
    { target: "IP: 192.168.10.23/24", reading: "IPv4は点で区切った4つの数です。/24では先頭3つ（192.168.10）がネットワーク、最後の23が機器を表します。", check: "ipconfigでIPv4 Address・Subnet Mask・Default Gateway・DNS Serversを順に確認します。" },
    { target: "GW: 192.168.10.1", reading: "PCと先頭3つが同じなので、/24の同じLANにいる出口だと分かります。", check: "ipconfigで設定値、ping 192.168.10.1で出口まで届くかを確認します。" },
    { target: "MAC: 02-00-00-00-10-01", reading: "16進数2桁を6組並べた、同じリンク内の識別番号です。ARPでIPとMACの対応を調べます。", check: "arp -aで192.168.10.1に対応するPhysical Addressを確認します。" },
  ],
  ACCESS_POINT: [
    { target: "SSID: classroom-net", reading: "SSIDはWi-Fiを見分ける名前です。似た名前ではなく、文字列全体が一致しているかを見ます。", check: "接続端末一覧で、PCがclassroom-netへ接続済みか確認します。" },
    { target: "Wi-Fi → Ethernet", reading: "区間が変わるため外側のフレーム形式は変わりますが、中のIPアドレスはそのままです。", check: "受信側がWi-Fi、上り側がEthernetで、ともに接続中かを画面で確認します。" },
    { target: "送信元・宛先MAC", reading: "送信元は届いた端末、宛先は次に渡す同一LAN内の機器です。IPの送信元・宛先とは役割が異なります。", check: "フレーム情報でSource MACとDestination MACを分けて確認します。" },
  ],
  L2_SWITCH: [
    { target: "MAC表: 10-01 → port 2", reading: "左がMACアドレス、右がその機器を見つけたポートです。宛先MACに一致する行を探します。", check: "受信フレームの宛先MACと、MACアドレス表の各行を照合します。" },
    { target: "送信元MAC", reading: "フレームが入ってきたポートと送信元MACの組を学習し、表を更新します。", check: "02-00-00-00-10-23が受信port 1として記録されたか確認します。" },
    { target: "宛先MAC", reading: "宛先が表にあれば該当ポートだけへ、なければ受信ポート以外へ広げて送ります。", check: "今回の02-00-00-00-10-01はport 2にあるため、port 2だけが選ばれることを確認します。" },
  ],
  ROUTER: [
    { target: "宛先IP: 203.0.113.80", reading: "IPアドレスを経路表のネットワーク範囲と比べ、最も長く具体的に一致する行を選びます。", check: "192.168.10.0/24には含まれないため、0.0.0.0/0の既定経路に一致することを確認します。" },
    { target: "経路: 0.0.0.0/0 → WAN", reading: "/0はどの宛先にも一致する最後の候補で、より具体的な経路がないときに使います。", check: "traceroute 203.0.113.80で、ルータの次に外部側へ進むことを確認します。" },
    { target: "TTL: 64 → 63", reading: "TTLは通過できるルータ数の上限で、ルータを1台通るたびに1減ります。", check: "受信時と送信時のTTLを比較し、ちょうど1減ったか確認します。" },
  ],
  DNS_SERVER: [
    { target: "class.yamanashi.example", reading: "点で区切られた名前です。この教材ではclassがホスト部分、yamanashi.exampleが所属する名前の範囲です。", check: "nslookup class.yamanashi.exampleで、質問名が入力と同じか確認します。" },
    { target: "A 203.0.113.80", reading: "Aは名前に対応するIPv4アドレスを示すレコード種類です。", check: "nslookupのAnswerで、NameとAddressの組が登録値と一致するか確認します。" },
    { target: "TTL: 300秒", reading: "このDNS回答を一時的に覚えてよい秒数です。IPパケットのTTLとは意味が異なります。", check: "DNS応答のレコード横にあるTTL値を確認し、通信経路のTTLと区別します。" },
  ],
  WEB_SERVER: [
    { target: "203.0.113.80:443", reading: "コロンの左がサーバのIPアドレス、右の443がHTTPSサービスの受付ポートです。", check: "curl https://class.yamanashi.exampleで、接続先とHTTPS応答を確認します。" },
    { target: "GET /lesson", reading: "GETは取得する操作、/lessonはサーバ内の教材ページの場所です。", check: "要求行のメソッドがGET、パスが/lessonであることを確認します。" },
    { target: "TLS 1.3 / 証明書", reading: "HTTPを送る前に、証明書の名前・有効期限・信頼関係を確認して暗号化します。", check: "HTTPS確認結果で証明書が有効、その後に200 OKが返る順番を確認します。" },
  ],
};

export const ROLE_PRACTICES: RolePracticeDefinition[] = [
  {
    role: "CLIENT_PC",
    mission: "外部のWebサーバへ送る最初の準備をする",
    situation: "ブラウザへURLが入力されました。相手はPCとは別のネットワークにいます。",
    observationTitle: "PCのネットワーク設定",
    observations: [
      { label: "自分のIP", value: "192.168.10.23/24" },
      { label: "宛先IP", value: "203.0.113.80" },
      { label: "出口（GW）", value: "192.168.10.1" },
      { label: "ARPキャッシュ", value: "192.168.10.1 → 未登録" },
    ],
    question: "このPCが、最初に行う操作はどれですか？",
    choices: [
      { id: "pc-web-direct", label: "WebサーバのMACアドレスをインターネット全体へ問い合わせる", correct: false, feedback: "MACアドレスを使う範囲は同じリンク内です。遠いWebサーバではなく、まず同じLANにいる出口を調べます。" },
      { id: "pc-arp-gateway", label: "ARPでデフォルトゲートウェイのMACアドレスを調べる", correct: true, feedback: "宛先が別ネットワークなので、PCは最初の出口となるルータへフレームを渡します。" },
      { id: "pc-change-ip", label: "自分のIPアドレスをWebサーバと同じ値へ変更する", correct: false, feedback: "同じIPアドレスを使うと重複します。異なるネットワークへはルータを経由します。" },
    ],
    successTitle: "ARPキャッシュへ出口を登録しました",
    successOutput: ["ARP who has 192.168.10.1?", "192.168.10.1 is at 02-00-00-00-10-01", "次の送信先: デフォルトゲートウェイ"],
    explainPrompt: "なぜWebサーバではなく、ゲートウェイのMACアドレスを調べたのですか？",
    termIds: ["ip-address", "prefix", "subnet-mask", "gateway", "arp", "arp-cache", "mac-address"],
  },
  {
    role: "ACCESS_POINT",
    mission: "Wi-Fiで届いた通信を有線LANへ橋渡しする",
    situation: "接続済みPCからWi-Fiフレームが届きました。上位のIPパケットは変更せずに運びます。",
    observationTitle: "無線APの受信情報",
    observations: [
      { label: "SSID", value: "classroom-net" },
      { label: "接続端末", value: "PC / 02-00-00-00-10-23" },
      { label: "受信", value: "Wi-Fiフレーム" },
      { label: "上りポート", value: "Ethernet / 接続中" },
    ],
    question: "無線APとして、どの橋渡しを行いますか？",
    choices: [
      { id: "ap-change-ip", label: "送信元と宛先のIPアドレスを書き換える", correct: false, feedback: "無線APは、この場面ではIPの経路選択をしません。リンク層の形式を橋渡しします。" },
      { id: "ap-drop", label: "無線で届いたため、有線側へは送らず破棄する", correct: false, feedback: "上りEthernetポートは接続中です。無線端末の通信を有線LANへ渡すのが役割です。" },
      { id: "ap-bridge", label: "Wi-Fiのリンク情報をEthernet用へ載せ替えて転送する", correct: true, feedback: "IPパケットの内容を保ったまま、次の区間に合うフレームへ橋渡しします。" },
    ],
    successTitle: "Wi-FiからEthernetへ橋渡ししました",
    successOutput: ["受信: 802.11 Wi-Fi frame", "保持: IPv4 packet 192.168.10.23 → 203.0.113.80", "送信: Ethernet frame → L2スイッチ"],
    explainPrompt: "無線APがIPパケットの中身を変えなかったのはなぜですか？",
    termIds: ["access-point", "wifi", "ssid", "frame", "ethernet", "mac-address"],
  },
  {
    role: "L2_SWITCH",
    mission: "MACアドレス表を使って、出力ポートを選ぶ",
    situation: "無線AP側のポート1から、ルータ宛てのEthernetフレームを受信しました。",
    observationTitle: "L2スイッチの転送情報",
    observations: [
      { label: "受信ポート", value: "port 1 / 無線AP" },
      { label: "送信元MAC", value: "02-00-00-00-10-23" },
      { label: "宛先MAC", value: "02-00-00-00-10-01" },
      { label: "MAC表", value: "10-01 → port 2 / 10-23 → port 1" },
    ],
    question: "このフレームをどのポートへ出しますか？",
    choices: [
      { id: "switch-port-2", label: "MACアドレス表に従い、ルータ側のport 2へ送る", correct: true, feedback: "宛先MACに対応するポートが分かっているので、そのポートだけへ転送できます。" },
      { id: "switch-port-1", label: "受信した無線AP側のport 1へ送り返す", correct: false, feedback: "port 1は送信元側です。宛先MACとMACアドレス表を照合します。" },
      { id: "switch-dns", label: "DNSへ問い合わせて、出力ポートを決めてもらう", correct: false, feedback: "L2スイッチの転送判断にはDNSではなくMACアドレス表を使います。" },
    ],
    successTitle: "ルータ側のport 2だけへ転送しました",
    successOutput: ["学習: 02-00-00-00-10-23 → port 1", "検索: 02-00-00-00-10-01 → port 2", "転送: port 1 → port 2"],
    explainPrompt: "すべてのポートではなく、port 2だけへ送れた根拠は何ですか？",
    termIds: ["l2-switch", "mac-address", "mac-table", "frame", "ethernet"],
  },
  {
    role: "ROUTER",
    mission: "経路表とTTLを確認して、次のネットワークへ送る",
    situation: "LAN側から、外部Webサーバ宛てのIPパケットが届きました。",
    observationTitle: "ルータの受信情報と経路表",
    observations: [
      { label: "宛先IP", value: "203.0.113.80" },
      { label: "受信時TTL", value: "64" },
      { label: "LAN経路", value: "192.168.10.0/24 → LAN" },
      { label: "既定経路", value: "0.0.0.0/0 → WAN" },
    ],
    question: "ルータとして、どの処理を行いますか？",
    choices: [
      { id: "router-default", label: "既定経路でWANへ送り、TTLを63へ減らす", correct: true, feedback: "より具体的なLAN経路には一致しないため既定経路を選び、ルータ通過時にTTLを1減らします。" },
      { id: "router-lan", label: "LAN経路を選び、無線AP側へ送り返す", correct: false, feedback: "203.0.113.80は192.168.10.0/24に含まれません。宛先と経路表を照合します。" },
      { id: "router-ttl-up", label: "既定経路でWANへ送り、TTLを65へ増やす", correct: false, feedback: "TTLはルータを通るたびに1減ります。増やすとループ防止の役割を果たせません。" },
    ],
    successTitle: "既定経路を選び、WANへ転送しました",
    successOutput: ["route match: 0.0.0.0/0 → WAN", "TTL: 64 → 63", "next hop: 学習用インターネット"],
    explainPrompt: "LAN経路ではなく既定経路を選び、TTLを減らした理由を説明してください。",
    termIds: ["router", "ip-address", "prefix", "route", "ttl", "hop"],
  },
  {
    role: "DNS_SERVER",
    mission: "ドメイン名に対応するIPアドレスを回答する",
    situation: "PCからAレコードの問い合わせが届きました。ゾーン内に一致するレコードがあります。",
    observationTitle: "DNS問い合わせとレコード",
    observations: [
      { label: "問い合わせ", value: "class.yamanashi.example" },
      { label: "種類", value: "A（IPv4アドレス）" },
      { label: "登録値", value: "203.0.113.80" },
      { label: "TTL", value: "300秒" },
    ],
    question: "DNSサーバとして、どの応答を返しますか？",
    choices: [
      { id: "dns-gateway", label: "デフォルトゲートウェイの192.168.10.1を回答する", correct: false, feedback: "ゲートウェイはPCの出口です。問い合わせ名に登録されたAレコードを返します。" },
      { id: "dns-a-record", label: "Aレコード203.0.113.80とTTL 300秒を回答する", correct: true, feedback: "問い合わせ名と種類が一致したため、登録済みのIPv4アドレスを回答します。" },
      { id: "dns-html", label: "教材ページのHTML本文を回答する", correct: false, feedback: "DNSは名前をIPアドレスへ変換します。ページ本文を返すのはWebサーバです。" },
    ],
    successTitle: "名前に対応するAレコードを回答しました",
    successOutput: ["status: NOERROR", "class.yamanashi.example. 300 IN A 203.0.113.80", "answer count: 1"],
    explainPrompt: "DNSサーバがWebページそのものではなく、IPアドレスを返すのはなぜですか？",
    termIds: ["dns", "domain", "dns-record", "ip-address", "ttl"],
  },
  {
    role: "WEB_SERVER",
    mission: "安全な接続上のHTTP要求へ教材ページを返す",
    situation: "TCP接続とTLS確認が終わり、暗号化されたHTTP要求が届きました。",
    observationTitle: "Webサーバが受け取った要求",
    observations: [
      { label: "TCP", value: "ESTABLISHED / port 443" },
      { label: "TLS", value: "証明書確認済み / TLS 1.3" },
      { label: "メソッド", value: "GET" },
      { label: "パス", value: "/lesson" },
    ],
    question: "Webサーバとして、どの応答を返しますか？",
    choices: [
      { id: "web-dns", label: "ドメイン名をIPアドレスへ変換して回答する", correct: false, feedback: "名前解決はすでにDNSが行いました。WebサーバはHTTP要求の内容を処理します。" },
      { id: "web-redirect-arp", label: "ARP問い合わせを返し、PCにもう一度接続させる", correct: false, feedback: "TCPとTLSは確立済みです。GETされたパスに対応するコンテンツを返します。" },
      { id: "web-200", label: "200 OKと教材HTMLをTLSで暗号化して返す", correct: true, feedback: "接続は安全に確立され、GET /lessonを処理できるため、成功応答とページ内容を返します。" },
    ],
    successTitle: "教材ページを安全な応答として返しました",
    successOutput: ["HTTP/1.1 200 OK", "Content-Type: text/html; charset=utf-8", "TLS record: encrypted application data", "body: <main>Network lesson</main>"],
    explainPrompt: "TCP・TLS・HTTPは、この応答でそれぞれ何を担当していますか？",
    termIds: ["tcp", "port", "tls", "certificate", "http", "http-method", "status-code", "https"],
  },
];

export function rolePractice(role: RoleId): RolePracticeDefinition | undefined {
  return ROLE_PRACTICES.find((practice) => practice.role === role);
}
