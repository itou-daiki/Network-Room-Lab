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
  { id: "frame", label: "フレーム", short: "直接つながる次の機器まで、データを運ぶための入れ物。", detail: "入れ物の外側には、送り主と次の届け先を表すMACアドレスが付きます。PCから無線アクセスポイントまではWi-Fi用、無線アクセスポイントからL2スイッチまではEthernet用の入れ物を使います。中に入っているIPパケットの宛先は変わりません。", example: "PC → 無線APではWi-Fiフレーム、無線AP → L2スイッチではEthernetフレームに入れて運びます。", category: "通信" },
  { id: "ip-address", label: "IPアドレス", short: "ネットワーク上の機器を示す住所。", detail: "送信元と宛先を識別し、異なるネットワークを越えて届けるために使います。", example: "学習用PCは 192.168.10.23、Webサーバは 203.0.113.80 です。", category: "アドレス" },
  { id: "private-ip", label: "プライベートIPアドレス", short: "学校や家庭など、組織内で使うIPアドレス。", detail: "インターネット全体では直接使わず、同じ番号を別の組織でも利用できます。", example: "192.168.10.23 はプライベートIPアドレスです。", category: "アドレス" },
  { id: "prefix", label: "プレフィックス長", short: "IPアドレスのどこまでが、同じネットワークを表す部分かを示す数。", detail: "/24では、点で区切った先頭3つの数を比べます。先頭3つが同じ機器どうしは、同じネットワークにいると判断できます。", example: "192.168.10.23/24 と 192.168.10.1/24 は、先頭の192.168.10が同じなので同じネットワークです。", category: "アドレス" },
  { id: "subnet-mask", label: "サブネットマスク", short: "IPアドレスのネットワーク部を示す値。", detail: "255の部分がネットワーク部、0の部分が機器を表す部分です。プレフィックス長を別の形で表します。", example: "255.255.255.0 は /24 と同じ範囲を表します。", category: "アドレス" },
  { id: "subnet", label: "サブネット", short: "IPアドレスで区切られた、同じネットワークの範囲。", detail: "届け先が同じ範囲なら、その機器へ直接渡します。違う範囲なら、外部への出口となるデフォルトゲートウェイへ最初に渡します。", example: "192.168.10.0/24 は、192.168.10.1〜192.168.10.254を同じ範囲として扱います。", category: "アドレス" },
  { id: "gateway", label: "デフォルトゲートウェイ", short: "別のネットワークへ出るときの最初の出口。", detail: "PCは宛先が別サブネットだと判断すると、パケットをルータへ渡します。", example: "この実験では 192.168.10.1 のルータが出口です。", category: "アドレス" },
  { id: "mac-address", label: "MACアドレス", short: "同じLAN内で、次に届ける機器を見分けるための番号。", detail: "16進数2桁を6組並べて表します。L2スイッチは、この番号と差込口の対応表を見て、データを出す差込口を選びます。", example: "IPアドレスが最終目的地の住所なら、MACアドレスは次の機器へ渡すための宛名です。", category: "アドレス" },
  { id: "arp", label: "ARP", reading: "アープ", short: "近くの機器について、IPアドレスに対応するMACアドレスを調べる仕組み。", detail: "PCが同じ校内LANの次の機器へデータを渡す前に、「192.168.10.1を持つ機器のMACアドレスを教えてください」と問い合わせます。この文章はコマンドではなく、機器同士の問い合わせ内容です。", example: "この実習では、PCが出口のルータ192.168.10.1のMACアドレスをARPで調べます。", category: "通信" },
  { id: "arp-cache", label: "ARPキャッシュ", short: "ARPで調べたIPアドレスとMACアドレスの組を、一時的に覚える表。", detail: "近くの同じ機器へ送るたびに問い合わせなくてよいよう、PCが調べた組を保存します。", example: "PCで実際に表を見るときは、arp -aという確認コマンドを使います。192.168.10.1と02-00-00-00-10-01が同じ行にあれば、出口の番号を覚えています。", category: "通信" },
  { id: "dns", label: "DNS", reading: "ディーエヌエス", short: "ドメイン名をIPアドレスへ変換する仕組み。", detail: "人が覚えやすい名前と、機器が通信に使うIPアドレスを対応付けます。", example: "class.yamanashi.example → 203.0.113.80 と調べます。", category: "通信" },
  { id: "domain", label: "ドメイン名", short: "人が覚えやすい、ネットワーク上の名前。", detail: "通信前にDNSへ問い合わせ、対応するIPアドレスを得ます。", example: "class.yamanashi.example のような名前です。", category: "アドレス" },
  { id: "route", label: "経路表", short: "届け先の範囲ごとに、次に送る方向をまとめた道案内の表。", detail: "ルータは、データの最終目的地となるIPアドレスと表の各範囲を比べ、当てはまる道を選びます。", example: "WebサーバのIPアドレスに当てはまる道がなければ、ルータはデータを先へ送れません。", category: "通信" },
  { id: "router", label: "ルータ", short: "異なるネットワーク同士をつなぐ機器。", detail: "宛先IPアドレスと経路表を見て、次にパケットを送るネットワークを選びます。", example: "PCから見た192.168.10.1のルータが、外部ネットワークへの出口です。", category: "機器・接続" },
  { id: "hop", label: "ホップ", short: "目的地へ向かう途中で通過する、ルータ1台分の経由地点。", detail: "tracerouteという確認コマンドでは、PCから目的地までに返事をしたルータを、1番目、2番目のように順番に表示します。その1段階をホップと呼びます。", example: "1ホップ目が校内ルータ、2ホップ目が外部側ルータ、というように読みます。", category: "通信" },
  { id: "ttl", label: "TTL", reading: "ティーティーエル", short: "パケットが通過できるルータ数の上限。", detail: "ルータを1台通るたびに1減り、0になると破棄されます。通信の無限ループを防ぎます。", example: "TTL 64のパケットがルータを1台通るとTTL 63になります。", category: "通信" },
  { id: "port", label: "ポート番号", short: "1台の機器内で、どのサービスへ渡すかを示す番号。", detail: "IPアドレスが建物の住所なら、ポート番号は受付窓口の番号です。", example: "HTTPSは通常443番、DNSは通常53番を使います。", category: "通信" },
  { id: "tcp", label: "TCP", reading: "ティーシーピー", short: "相手と通信路を準備し、データが順番どおり届くようにする仕組み。", detail: "送る前にWebサーバと接続を作り、届かなかったデータがあれば送り直します。", example: "教材ページを要求する前に、PCとWebサーバの間にTCPの通信路を準備します。", category: "通信" },
  { id: "tls", label: "TLS", reading: "ティーエルエス", short: "通信相手を確認し、内容を暗号化する仕組み。", detail: "証明書を使って相手を確認し、盗み見や改ざんを防ぐための鍵を共有します。", example: "HTTPSではHTTPの内容をTLSで暗号化します。", category: "安全" },
  { id: "https", label: "HTTPS", reading: "エイチティーティーピーエス", short: "HTTPをTLSで安全にしたWeb通信。", detail: "ブラウザとWebサーバのやり取りを暗号化し、相手の証明書も確認します。", example: "https:// で始まるWebページの取得に使います。", category: "安全" },
  { id: "http", label: "HTTP", reading: "エイチティーティーピー", short: "PCがWebページを求め、Webサーバが結果とページ内容を返すための決まり。", detail: "PCは「何をしてほしいか」と「どのページか」を伝えます。Webサーバは、処理できたかを表す番号とページ内容を返します。", example: "GET /lessonは「教材ページをください」、200 OKは「正常に用意できました」という意味です。", category: "通信" },
  { id: "http-method", label: "HTTPメソッド", short: "Webサーバへ、何をしてほしいかを伝える操作名。", detail: "GETはページを受け取る操作、POSTは入力したデータを送る操作です。", example: "GET /lesson は、「/lessonにある教材ページをください」という要求です。", category: "通信" },
  { id: "status-code", label: "HTTPステータスコード", short: "Webサーバが、要求を処理できたかを3桁の数で伝えるもの。", detail: "200番台は成功、400番台はPCからの要求に問題、500番台はWebサーバ側に問題があることを表します。", example: "200 OKは「教材ページを正常に用意できました」という意味です。", category: "通信" },
  { id: "certificate", label: "サーバ証明書", short: "接続先が本物か確認するための電子的な身分証明書。", detail: "名前・有効期限・発行者への信頼を確かめてから暗号化通信を始めます。", example: "証明書の名前がURLと違うと、ブラウザは警告します。", category: "安全" },
  { id: "wifi", label: "Wi-Fi", short: "電波を使って機器をネットワークへつなぐ方式。", detail: "無線アクセスポイントが、無線のフレームと有線LANを橋渡しします。", example: "PCと無線APの間がWi-Fi区間です。", category: "機器・接続" },
  { id: "access-point", label: "無線アクセスポイント", short: "Wi-Fi端末と有線LANを橋渡しする機器。", detail: "端末の接続を管理し、無線で受けたデータを次の有線区間へ渡します。", example: "classroom-netへ接続したPCの通信をL2スイッチへ渡します。", category: "機器・接続" },
  { id: "ethernet", label: "Ethernet", reading: "イーサネット", short: "有線LANで広く使われる通信方式。", detail: "LANケーブルなどを使い、MACアドレスを付けたフレームを運びます。", example: "無線AP・L2スイッチ・ルータの間で使います。", category: "機器・接続" },
  { id: "ssid", label: "SSID", short: "Wi-Fiネットワークを見分けるための名前。", detail: "PCは接続したいSSIDを選び、無線アクセスポイントへ接続します。", example: "学校のWi-Fi一覧に表示されるネットワーク名です。", category: "機器・接続" },
  { id: "l2-switch", label: "L2スイッチ", short: "複数のLANケーブルの中から、次の届け先につながる差込口を選ぶ機器。", detail: "機器を見分けるMACアドレスと差込口の対応を覚え、次に届ける機器のMACアドレスに合う差込口へデータを送ります。", example: "ルータのMACアドレスが2番の差込口（port 2）に登録されていれば、データを2番だけへ送ります。", category: "機器・接続" },
  { id: "mac-table", label: "MACアドレス表", short: "MACアドレスと、機器がつながる差込口の対応を記録した表。", detail: "L2スイッチは、データを送った機器のMACアドレスと入ってきた差込口を覚えます。次にデータを送るとき、この表から届け先の差込口を探します。", example: "02-00-00-00-10-01 → 2番の差込口（port 2）のように読みます。", category: "通信" },
  { id: "dns-record", label: "DNSレコード", short: "Webサイト名と、その答えを登録した項目。", detail: "答えの種類によって名前が付きます。Aレコードは、Webサイト名に対応するIPv4アドレスを登録した項目です。", example: "この実習のAレコードは「class.yamanashi.example → 203.0.113.80」です。300秒は、この答えを覚えてよい時間です。", category: "通信" },
  { id: "ping", label: "ping", reading: "ピング", short: "相手までIP通信が届くかを確かめるコマンド。", detail: "小さな確認用パケットを送り、返事の有無と往復時間を調べます。Webサービス自体の正常までは保証しません。", example: "ping 192.168.10.1 で、まず出口のルータまで確認します。", category: "調査コマンド" },
  { id: "nslookup", label: "nslookup", reading: "エヌエスルックアップ", short: "Webサイト名に対応するIPアドレスを、DNSサーバへ問い合わせるコマンド。", detail: "Webサイト名をIPアドレスへ変換する部分だけを確認できます。名前では開けないときに、DNSが答えを返しているかを調べます。", example: "nslookup class.yamanashi.example と入力し、203.0.113.80が返るか確認します。", category: "調査コマンド" },
  { id: "traceroute", label: "traceroute", reading: "トレースルート", short: "目的地までに返事をしたルータを、通過順に表示するコマンド。", detail: "最後に返事があったルータと、その次の返事がない地点を比べて、どの区間から先で届かないかを調べます。", example: "traceroute 203.0.113.80 と入力し、1番目、2番目の経由地点を順に確認します。", category: "調査コマンド" },
  { id: "ipconfig", label: "ipconfig", reading: "アイピーコンフィグ", short: "PC自身のネットワーク設定を表示する確認コマンド。", detail: "教材ページへ送る準備ができているかを調べるために、PCのIPアドレス・同じネットワークの範囲・外部への出口・DNSサーバを確認します。", example: "まずipconfigを実行し、4項目がこの実習の設定と一致するかを上から順に見ます。", category: "調査コマンド" },
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
