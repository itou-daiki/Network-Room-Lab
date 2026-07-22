import type { RoomPhase } from "./types";

export type GlossaryCategory = "機器・接続" | "アドレス" | "通信" | "安全" | "調査コマンド";

export interface NetworkTerm {
  id: string;
  label: string;
  reading?: string;
  short: string;
  detail: string;
  example: string;
  category: GlossaryCategory;
}

export const NETWORK_GLOSSARY: NetworkTerm[] = [
  { id: "packet", label: "パケット", short: "通信データを小さく分けたまとまり。", detail: "大きなデータを小分けにし、宛先などの情報を付けてネットワークへ送ります。", example: "荷物を複数の小箱に分け、それぞれに送り状を付けるイメージです。", category: "通信" },
  { id: "frame", label: "フレーム", short: "同じネットワーク内で運ぶためのデータの形。", detail: "Wi-FiやEthernetなど、リンクごとの宛先MACアドレスを付けて運びます。", example: "ルータを越えるたびに、外側のフレームは付け替えられます。", category: "通信" },
  { id: "ip-address", label: "IPアドレス", short: "ネットワーク上の機器を示す住所。", detail: "送信元と宛先を識別し、異なるネットワークを越えて届けるために使います。", example: "学習用PCは 192.168.10.23、Webサーバは 203.0.113.80 です。", category: "アドレス" },
  { id: "private-ip", label: "プライベートIPアドレス", short: "学校や家庭など、組織内で使うIPアドレス。", detail: "インターネット全体では直接使わず、同じ番号を別の組織でも利用できます。", example: "192.168.10.23 はプライベートIPアドレスです。", category: "アドレス" },
  { id: "prefix", label: "プレフィックス長", short: "IPアドレスのどこまでがネットワーク部かを示す数。", detail: "/24なら先頭24ビットが同じ機器を、同じネットワークと判断します。", example: "192.168.10.23/24 と 192.168.10.1/24 は同じネットワークです。", category: "アドレス" },
  { id: "subnet", label: "サブネット", short: "IPアドレスで区切られたネットワークの範囲。", detail: "相手が同じサブネットなら直接、違うならデフォルトゲートウェイへ送ります。", example: "192.168.10.0/24 は 192.168.10.1〜254 を含む範囲です。", category: "アドレス" },
  { id: "gateway", label: "デフォルトゲートウェイ", short: "別のネットワークへ出るときの最初の出口。", detail: "PCは宛先が別サブネットだと判断すると、パケットをルータへ渡します。", example: "この実験では 192.168.10.1 のルータが出口です。", category: "アドレス" },
  { id: "mac-address", label: "MACアドレス", short: "同じリンク内で機器を見分ける識別番号。", detail: "L2スイッチはMACアドレス表を使い、フレームを出すポートを選びます。", example: "IPが遠くの住所なら、MACは今いる区間で使う宛名です。", category: "アドレス" },
  { id: "arp", label: "ARP", reading: "アープ", short: "IPアドレスに対応するMACアドレスを調べる仕組み。", detail: "同じネットワーク内へフレームを送る前に『このIPを持つのは誰？』と問い合わせます。", example: "PCは 192.168.10.1 のMACアドレスをARPで調べます。", category: "通信" },
  { id: "dns", label: "DNS", reading: "ディーエヌエス", short: "ドメイン名をIPアドレスへ変換する仕組み。", detail: "人が覚えやすい名前と、機器が通信に使うIPアドレスを対応付けます。", example: "class.yamanashi.example → 203.0.113.80 と調べます。", category: "通信" },
  { id: "domain", label: "ドメイン名", short: "人が覚えやすい、ネットワーク上の名前。", detail: "通信前にDNSへ問い合わせ、対応するIPアドレスを得ます。", example: "class.yamanashi.example のような名前です。", category: "アドレス" },
  { id: "route", label: "経路表", short: "宛先ごとに次に送る場所をまとめた表。", detail: "ルータは宛先IPと経路表を比べ、最も具体的に一致する経路を選びます。", example: "一致する経路がなければ、パケットを先へ送れません。", category: "通信" },
  { id: "hop", label: "ホップ", short: "通信経路で通過するルータ1台分。", detail: "tracerouteでは、PCから目的地までのルータをホップ順に表示します。", example: "3ホップなら、目的地までに3段階の中継地点を通ります。", category: "通信" },
  { id: "ttl", label: "TTL", reading: "ティーティーエル", short: "パケットが通過できるルータ数の上限。", detail: "ルータを1台通るたびに1減り、0になると破棄されます。通信の無限ループを防ぎます。", example: "TTL 64のパケットがルータを1台通るとTTL 63になります。", category: "通信" },
  { id: "port", label: "ポート番号", short: "1台の機器内で、どのサービスへ渡すかを示す番号。", detail: "IPアドレスが建物の住所なら、ポート番号は受付窓口の番号です。", example: "HTTPSは通常443番、DNSは通常53番を使います。", category: "通信" },
  { id: "tcp", label: "TCP", reading: "ティーシーピー", short: "届いたことを確認しながら、確実にデータを運ぶ仕組み。", detail: "通信前に接続を作り、順序や欠けを確認して再送します。", example: "Webアクセスでは、まずSYNを送りTCP接続を作ります。", category: "通信" },
  { id: "tls", label: "TLS", reading: "ティーエルエス", short: "通信相手を確認し、内容を暗号化する仕組み。", detail: "証明書を使って相手を確認し、盗み見や改ざんを防ぐための鍵を共有します。", example: "HTTPSではHTTPの内容をTLSで暗号化します。", category: "安全" },
  { id: "https", label: "HTTPS", reading: "エイチティーティーピーエス", short: "HTTPをTLSで安全にしたWeb通信。", detail: "ブラウザとWebサーバのやり取りを暗号化し、相手の証明書も確認します。", example: "https:// で始まるWebページの取得に使います。", category: "安全" },
  { id: "certificate", label: "サーバ証明書", short: "接続先が本物か確認するための電子的な身分証明書。", detail: "名前・有効期限・発行者への信頼を確かめてから暗号化通信を始めます。", example: "証明書の名前がURLと違うと、ブラウザは警告します。", category: "安全" },
  { id: "wifi", label: "Wi-Fi", short: "電波を使って機器をネットワークへつなぐ方式。", detail: "無線アクセスポイントが、無線のフレームと有線LANを橋渡しします。", example: "PCと無線APの間がWi-Fi区間です。", category: "機器・接続" },
  { id: "ethernet", label: "Ethernet", reading: "イーサネット", short: "有線LANで広く使われる通信方式。", detail: "LANケーブルなどを使い、MACアドレスを付けたフレームを運びます。", example: "無線AP・L2スイッチ・ルータの間で使います。", category: "機器・接続" },
  { id: "ssid", label: "SSID", short: "Wi-Fiネットワークを見分けるための名前。", detail: "PCは接続したいSSIDを選び、無線アクセスポイントへ接続します。", example: "学校のWi-Fi一覧に表示されるネットワーク名です。", category: "機器・接続" },
  { id: "ping", label: "ping", reading: "ピング", short: "相手までIP通信が届くかを確かめるコマンド。", detail: "小さな確認用パケットを送り、返事の有無と往復時間を調べます。Webサービス自体の正常までは保証しません。", example: "ping 192.168.10.1 で、まず出口のルータまで確認します。", category: "調査コマンド" },
  { id: "nslookup", label: "nslookup", reading: "エヌエスルックアップ", short: "ドメイン名のDNS情報を調べるコマンド。", detail: "名前解決だけを切り分けて確認できるため、IP直指定との比較に役立ちます。", example: "nslookup class.yamanashi.example", category: "調査コマンド" },
  { id: "traceroute", label: "traceroute", reading: "トレースルート", short: "目的地までに通るルータを順番に調べるコマンド。", detail: "どのホップまでは届き、どこから先で失敗するかを観察します。", example: "traceroute 203.0.113.80", category: "調査コマンド" },
  { id: "ipconfig", label: "ipconfig", reading: "アイピーコンフィグ", short: "PCのIP設定を表示するコマンド。", detail: "IPアドレス、プレフィックス、デフォルトゲートウェイ、DNSサーバを確認します。", example: "障害調査では、最初に自分の設定を確かめます。", category: "調査コマンド" },
  { id: "latency", label: "レイテンシ", short: "データを送り、反応が返るまでの時間。", detail: "一般にミリ秒（ms）で表し、小さいほど応答が速いと判断できます。", example: "pingの time=18ms は、往復に約18ミリ秒かかった意味です。", category: "通信" },
];

export const PHASE_TERM_IDS: Partial<Record<RoomPhase, string[]>> = {
  ROLES: ["packet", "ip-address", "mac-address"],
  TOPOLOGY: ["wifi", "ethernet", "frame", "ssid"],
  ADDRESSING: ["ip-address", "prefix", "subnet", "gateway", "dns"],
  PROTOCOL: ["arp", "dns", "tcp", "tls", "https", "ttl"],
  DIAGNOSIS: ["ipconfig", "ping", "nslookup", "traceroute", "hop", "latency"],
  REFLECTION: ["packet", "route", "https"],
};

export function glossaryTerm(id: string): NetworkTerm | undefined {
  return NETWORK_GLOSSARY.find((term) => term.id === id);
}
