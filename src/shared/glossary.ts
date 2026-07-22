import type { RoomPhase } from "./types";
import type { LearningTarget } from "./types";
import { materializeTargetText } from "./learningTarget";

export type GlossaryCategory = "機器・接続" | "アドレス" | "通信" | "安全" | "調査コマンド";

export interface NetworkTerm {
  id: string;
  label: string;
  reading?: string;
  fullName?: string;
  short: string;
  detail: string;
  example: string;
  category: GlossaryCategory;
}

export const NETWORK_GLOSSARY: NetworkTerm[] = [
  { id: "packet", label: "パケット", short: "質問・要求・返事などの通信内容を、ネットワークで運びやすい大きさに分けたまとまりです。", detail: "PCから送る「IPアドレスを教えて」「ページをください」も、サーバから戻るIPアドレスの答えやページのデータも、パケットとして運ばれます。各パケットには送信元と宛先など、届けるために必要な情報が付きます。", example: "大きなページのデータを複数の小箱に分け、それぞれに送り元と届け先を書いた送り状を付けるイメージです。", category: "通信" },
  { id: "frame", label: "フレーム", short: "パケットを、同じLAN内で直接つながる次の機器まで運ぶための入れ物です。", detail: "フレームの外側には、同じLANでの送り主と次の届け先を示すMACアドレスが付きます。PCから無線アクセスポイントまではWi-Fi用、無線アクセスポイントからL2スイッチまではEthernet用の入れ物を使います。区間ごとに外側のフレームは替わっても、中のIPパケットが目指す最終宛先は変わりません。", example: "ページ要求を入れた同じIPパケットを、PC → 無線APではWi-Fiフレーム、無線AP → L2スイッチではEthernetフレームに入れて運びます。", category: "通信" },
  { id: "client-server", label: "クライアントとサーバ", short: "クライアントが要求を送り、サーバがその要求に応じた返事を返す関係です。", detail: "Webを見る場面では、ブラウザを動かすPCがクライアントです。PCは見たいページを指定してWebサーバへ要求します。Webサーバは要求を処理し、成功したかを示す情報とページのデータを返します。", example: "この実習では、クライアントPCが「学習指導要領ページをください」と送り、Webサーバが200 OKとHTMLを返します。", category: "通信" },
  { id: "request-response", label: "要求と応答", short: "PCからサーバへ送るお願いが要求、サーバからPCへ戻る返事が応答です。", detail: "Webページはサーバから一方的に届くのではありません。PCが先に「どのページが必要か」を要求し、サーバが処理結果とページのデータを応答として返します。要求と応答は反対方向へ流れる別々のデータです。", example: "行きはGETによるページ要求、帰りは200 OKと学習指導要領ページのHTMLです。", category: "通信" },
  { id: "ip-address", label: "IPアドレス", fullName: "Internet Protocol Address（インターネット・プロトコル・アドレス）", short: "ネットワーク上で、データの送り元と最終的な届け先を示す住所です。", detail: "IPはInternet Protocolの略です。PCは宛先IPアドレスを付けてデータを送り、途中のルータはその値を読んで次の道を選びます。同じLAN内で次に渡す機器を示すMACアドレスとは役割が異なります。", example: "この学習モデルでは、PCのIPアドレスは192.168.10.23、WebサーバのIPアドレスは203.0.113.80です。", category: "アドレス" },
  { id: "private-ip", label: "プライベートIPアドレス", short: "学校や家庭など、組織内で使うIPアドレス。", detail: "インターネット全体では直接使わず、同じ番号を別の組織でも利用できます。", example: "192.168.10.23 はプライベートIPアドレスです。", category: "アドレス" },
  { id: "prefix", label: "プレフィックス長", short: "IPアドレスのどこまでが、同じネットワークを表す部分かを示す数。", detail: "/24では、点で区切った先頭3つの数を比べます。先頭3つが同じ機器どうしは、同じネットワークにいると判断できます。", example: "192.168.10.23/24 と 192.168.10.1/24 は、先頭の192.168.10が同じなので同じネットワークです。", category: "アドレス" },
  { id: "subnet-mask", label: "サブネットマスク", short: "IPアドレスのネットワーク部を示す値。", detail: "255の部分がネットワーク部、0の部分が機器を表す部分です。プレフィックス長を別の形で表します。", example: "255.255.255.0 は /24 と同じ範囲を表します。", category: "アドレス" },
  { id: "subnet", label: "サブネット", short: "IPアドレスで区切られた、同じネットワークの範囲。", detail: "届け先が同じ範囲なら、その機器へ直接渡します。違う範囲なら、外部への出口となるデフォルトゲートウェイへ最初に渡します。", example: "192.168.10.0/24 は、192.168.10.1〜192.168.10.254を同じ範囲として扱います。", category: "アドレス" },
  { id: "lan", label: "LAN", reading: "ラン", fullName: "Local Area Network（ローカル・エリア・ネットワーク）", short: "教室・学校・家庭など、比較的狭い範囲にある機器をつないだネットワークです。", detail: "同じLAN内では、L2スイッチや無線アクセスポイントがMACアドレスを使って次の機器へデータを渡します。別のLANへ出るときはルータを通ります。", example: "この実習では、PC・無線AP・L2スイッチ・校内側ルータの間が校内LANです。", category: "機器・接続" },
  { id: "wan", label: "WAN", reading: "ワン", fullName: "Wide Area Network（ワイド・エリア・ネットワーク）", short: "離れたLANどうしをつなぐ、広い範囲のネットワークです。", detail: "学校のLANから校外のDNSサーバやWebサーバへ進むとき、ルータはWAN側へパケットを送ります。WANは特定の1本の線の名前ではなく、離れたネットワークを結ぶ範囲を表します。", example: "この学習モデルでは、校内ルータからインターネット側へ出る接続を仮想WANとして表します。", category: "機器・接続" },
  { id: "gateway", label: "デフォルトゲートウェイ", short: "別のネットワークへ出るときの最初の出口。", detail: "PCは宛先が別サブネットだと判断すると、パケットをルータへ渡します。", example: "この実験では 192.168.10.1 のルータが出口です。", category: "アドレス" },
  { id: "mac-address", label: "MACアドレス", fullName: "Media Access Control Address（メディア・アクセス・コントロール・アドレス）", short: "同じLAN内で、データを次に渡す機器を見分けるための番号です。", detail: "MACはMedia Access Controlの略です。一般的には16進数2桁を6組並べて表します。L2スイッチは、宛先MACアドレスと差込口の対応表を比べ、どの差込口からフレームを出すか決めます。IPアドレスが最終目的地を示すのに対し、MACアドレスは今いるLANでの次の渡し先を示します。", example: "この学習モデルでは、出口のルータのMACアドレスを02-00-00-00-10-01として扱います。", category: "アドレス" },
  { id: "arp", label: "ARP", reading: "アープ", fullName: "Address Resolution Protocol（アドレス・リゾリューション・プロトコル／アドレス解決プロトコル）", short: "同じLAN内で、次に渡す機器のIPv4アドレスからMACアドレスを調べる仕組みです。", detail: "Addressは「住所」、Resolutionは「対応する答えを見つけること」、Protocolは「通信の約束」を表します。PCは同じLAN内の全機器へ「このIPv4アドレスを持つ機器は、あなたですか。MACアドレスを教えてください」と問い合わせます。該当する機器だけが自分のMACアドレスを返し、PCはその組をARPキャッシュへ一時保存します。Webサーバが別ネットワークにある場合、PCがARPで調べるのはWebサーバではなく、最初の出口であるデフォルトゲートウェイです。画面に出る問い合わせ文はコマンドではなく、機器同士が交換する通信内容です。", example: "PCは、デフォルトゲートウェイ192.168.10.1にデータを渡すため、ARPで対応するMACアドレス02-00-00-00-10-01を調べます。", category: "通信" },
  { id: "arp-cache", label: "ARPキャッシュ", short: "ARPで調べたIPアドレスとMACアドレスの組を、一時的に覚える表。", detail: "近くの同じ機器へ送るたびに問い合わせなくてよいよう、PCが調べた組を保存します。", example: "PCで実際に表を見るときは、arp -aという確認コマンドを使います。192.168.10.1と02-00-00-00-10-01が同じ行にあれば、出口の番号を覚えています。", category: "通信" },
  { id: "broadcast", label: "ブロードキャスト", short: "同じLAN内の全機器へ、まとめて問い合わせを届ける送り方です。", detail: "ARPを始める時点では、調べたい相手のMACアドレスがまだ分かりません。そこで宛先MACアドレスをFF-FF-FF-FF-FF-FFとして同じLAN全体へ送り、該当するIPアドレスを持つ機器だけが回答します。ルータを越えてインターネット全体へ広がるものではありません。", example: "PCが「192.168.10.1を持つ機器はMACアドレスを教えてください」と校内LANへ送るARPの質問です。", category: "通信" },
  { id: "dns", label: "DNS", reading: "ディーエヌエス", fullName: "Domain Name System（ドメイン・ネーム・システム）", short: "Webサイト名などのドメイン名を、通信に使うIPアドレスへ対応付ける仕組みです。", detail: "Domain Name Systemの略です。人はwww.mext.go.jpのような名前を使いますが、PCがデータの最終的な届け先を指定するときはIPアドレスが必要です。そこでPCはDNSサーバへ名前を質問し、対応するIPアドレスを受け取ってからWebサーバへの通信を始めます。DNSが返すのはWebページ本体ではなく、通信先を探すための情報です。", example: "この部屋では、教員が指定したURLのホスト名を公開DNSへ実際に問い合わせ、そのとき返ったAレコードを表示します。回答は時間や接続場所によって変わることがあります。", category: "通信" },
  { id: "domain", label: "ドメイン名", short: "人が読みやすい形で付けられた、ネットワーク上の名前です。", detail: "点で区切られた部分を右から左へたどると、所属する名前の範囲がしだいに細かくなります。PCは通信前にDNSへ問い合わせ、この名前に対応するIPアドレスを取得します。URL全体ではなく、通信先を表す名前の部分です。", example: "https://www.mext.go.jp/a_menu/... というURLでは、www.mext.go.jpがドメイン名です。", category: "アドレス" },
  { id: "url", label: "URL", reading: "ユーアールエル", fullName: "Uniform Resource Locator（ユニフォーム・リソース・ロケーター）", short: "Webページなど、インターネット上の情報がある場所を表す文字列です。", detail: "Uniformは「共通の形式」、Resourceは「Webページなどの情報」、Locatorは「場所を示すもの」という意味です。URLには、通信方法を表すhttps、通信先を表すドメイン名、サーバ内のページ位置を表すパスなどが含まれます。ブラウザはURLを読み、まずDNSで通信先IPアドレスを調べます。", example: "https://www.mext.go.jp/a_menu/shotou/new-cs/1384661.htm では、httpsが通信方法、www.mext.go.jpがドメイン名、/a_menu/shotou/new-cs/1384661.htmがページの場所です。", category: "アドレス" },
  { id: "route", label: "経路表", short: "届け先の範囲ごとに、次に送る方向をまとめた道案内の表。", detail: "ルータは、データの最終目的地となるIPアドレスと表の各範囲を比べ、当てはまる道を選びます。", example: "WebサーバのIPアドレスに当てはまる道がなければ、ルータはデータを先へ送れません。", category: "通信" },
  { id: "router", label: "ルータ", short: "異なるネットワーク同士をつなぐ機器。", detail: "宛先IPアドレスと経路表を見て、次にパケットを送るネットワークを選びます。", example: "PCから見た192.168.10.1のルータが、外部ネットワークへの出口です。", category: "機器・接続" },
  { id: "hop", label: "ホップ", short: "目的地へ向かう途中で通過する、ルータ1台分の経由地点。", detail: "tracerouteという確認コマンドでは、PCから目的地までに返事をしたルータを、1番目、2番目のように順番に表示します。その1段階をホップと呼びます。", example: "1ホップ目が校内ルータ、2ホップ目が外部側ルータ、というように読みます。", category: "通信" },
  { id: "ttl", label: "TTL", reading: "ティーティーエル", fullName: "Time To Live（タイム・トゥ・リブ）", short: "IPパケットがネットワーク上を通り続けられる回数の上限です。", detail: "直訳は「生存時間」ですが、IPv4では通常、通過できるルータ数の残りとして扱います。ルータを1台通るたびに1減り、0になるとそのパケットは破棄されます。経路設定の誤りでパケットが同じ場所を回り続けることを防ぎます。DNS回答を保存できる時間にもTTLという名前がありますが、そちらは秒数を表す別の値です。", example: "TTL 64のIPパケットが校内ルータを1台通ると、次のネットワークへ出るときはTTL 63になります。", category: "通信" },
  { id: "port", label: "ポート番号", short: "1台の機器内で、どのサービスへ渡すかを示す番号。", detail: "IPアドレスが建物の住所なら、ポート番号は受付窓口の番号です。", example: "HTTPSは通常443番、DNSは通常53番を使います。", category: "通信" },
  { id: "tcp", label: "TCP", reading: "ティーシーピー", fullName: "Transmission Control Protocol（トランスミッション・コントロール・プロトコル）", short: "相手と通信路を準備し、データを正しい順番で確実に届けるための仕組みです。", detail: "Transmissionは「伝送」、Controlは「制御」、Protocolは「通信の約束」という意味です。送信前にPCとWebサーバの間で接続を作り、データへ順番を付けます。届かなかったデータがあれば送り直し、受信側で元の順番へ戻せるようにします。", example: "学習指導要領ページを要求する前に、PCとWebサーバの443番ポートの間でTCP接続を準備します。", category: "通信" },
  { id: "tls", label: "TLS", reading: "ティーエルエス", fullName: "Transport Layer Security（トランスポート・レイヤー・セキュリティ）", short: "通信相手を証明書で確認し、やり取りする内容を暗号化する仕組みです。", detail: "Transport Layer Securityの略です。PCはサーバ証明書の名前・有効期限・発行元を確認し、正しい相手か判断します。その後、通信内容を暗号化するための鍵を安全に共有し、途中での盗み見や改ざんを防ぎます。TLSはページを要求する決まりではなく、その要求と応答を安全に包む仕組みです。", example: "PCはwww.mext.go.jp用の証明書を確認してから、HTTPの要求と応答をTLSで暗号化します。", category: "安全" },
  { id: "https", label: "HTTPS", reading: "エイチティーティーピーエス", fullName: "Hypertext Transfer Protocol Secure（ハイパーテキスト・トランスファー・プロトコル・セキュア）", short: "HTTPの要求と応答を、TLSで保護して送る安全なWeb通信です。", detail: "HTTP over TLSとも呼ばれます。HTTPが「どのページをください」「正常に返せました」といったWebのやり取りを決め、TLSが通信相手の確認と暗号化を担当します。ブラウザのURLがhttps://で始まるときに使われます。", example: "https://www.mext.go.jp/... へ接続すると、通常はTCPの443番ポート上でTLSを準備し、その中でHTTPを送ります。", category: "安全" },
  { id: "http", label: "HTTP", reading: "エイチティーティーピー", fullName: "Hypertext Transfer Protocol（ハイパーテキスト・トランスファー・プロトコル）", short: "PCがWebページを要求し、Webサーバが処理結果とページ内容を返すための決まりです。", detail: "Hypertextはリンクで結び付いた文書、Transferは転送、Protocolは通信の約束という意味です。PCはメソッドとパスを使い「何をしてほしいか」「どのページか」を伝えます。Webサーバはステータスコードとページのデータを返します。HTTP自体には暗号化機能がないため、実際のHTTPSではTLSの中で送ります。", example: "GET /a_menu/shotou/new-cs/1384661.htm は「この場所のページをください」、200 OKは「要求を正常に処理できました」という意味です。", category: "通信" },
  { id: "html", label: "HTML", reading: "エイチティーエムエル", fullName: "HyperText Markup Language（ハイパーテキスト・マークアップ・ランゲージ）", short: "Webページの見出し・文章・リンクなどの構造を表すための言語です。", detail: "WebサーバはHTMLを文字データとしてPCへ返します。ブラウザはHTMLの印を読み取り、見出しや段落などを画面に組み立てます。HTMLがそのまま画像として送られてくるわけではありません。", example: "この実習では、Webサーバが学習指導要領ページのHTMLを返し、PCのブラウザがページとして表示します。", category: "通信" },
  { id: "http-method", label: "HTTPメソッド", short: "Webサーバへ、何をしてほしいかを伝える操作名。", detail: "GETはページを受け取る操作、POSTは入力したデータを送る操作です。", example: "GET / は、「サイトのトップページをください」という要求です。", category: "通信" },
  { id: "status-code", label: "HTTPステータスコード", short: "Webサーバが、要求を処理できたかを3桁の数で伝えるもの。", detail: "200番台は成功、400番台はPCからの要求に問題、500番台はWebサーバ側に問題があることを表します。", example: "200 OKは「学習指導要領ページを正常に用意できました」という意味です。", category: "通信" },
  { id: "certificate", label: "サーバ証明書", short: "接続先が本物か確認するための電子的な身分証明書。", detail: "名前・有効期限・発行者への信頼を確かめてから暗号化通信を始めます。", example: "証明書の名前がURLと違うと、ブラウザは警告します。", category: "安全" },
  { id: "wifi", label: "Wi-Fi", short: "電波を使って機器をネットワークへつなぐ方式。", detail: "無線アクセスポイントが、無線のフレームと有線LANを橋渡しします。", example: "PCと無線APの間がWi-Fi区間です。", category: "機器・接続" },
  { id: "access-point", label: "無線アクセスポイント", short: "Wi-Fi端末と有線LANを橋渡しする機器。", detail: "端末の接続を管理し、無線で受けたデータを次の有線区間へ渡します。", example: "classroom-netへ接続したPCの通信をL2スイッチへ渡します。", category: "機器・接続" },
  { id: "ethernet", label: "Ethernet", reading: "イーサネット", short: "有線LANで広く使われる通信方式。", detail: "LANケーブルなどを使い、MACアドレスを付けたフレームを運びます。", example: "無線AP・L2スイッチ・ルータの間で使います。", category: "機器・接続" },
  { id: "ssid", label: "SSID", reading: "エスエスアイディー", fullName: "Service Set Identifier（サービス・セット・アイデンティファイア）", short: "PCが接続先を選ぶための、Wi-Fiネットワークの名前です。", detail: "Identifierは「見分けるための名前や番号」という意味です。周囲に複数のWi-Fiがあるとき、PCはSSIDの一覧から接続したいネットワークを選びます。SSIDだけで安全性が決まるわけではなく、実際にはパスワードや暗号化方式も必要です。", example: "この学習モデルでは、PCがSSID「classroom-net」を選んで無線アクセスポイントへ接続します。", category: "機器・接続" },
  { id: "l2-switch", label: "L2スイッチ", fullName: "Layer 2 Switch（レイヤー2スイッチ）", short: "同じLAN内で、宛先MACアドレスに合う差込口へフレームを送る機器です。", detail: "L2はLayer 2の略で、主にMACアドレスを使ってデータを運ぶ段階を表します。スイッチは、受信したフレームの送信元MACアドレスと差込口を対応表へ覚えます。次に宛先MACアドレスを表で調べ、一致する差込口だけからフレームを送ります。IPアドレスを見て別ネットワークへの道を選ぶルータとは役割が異なります。", example: "ルータのMACアドレス02-00-00-00-10-01が2番の差込口に登録されていれば、フレームを2番だけへ送ります。", category: "機器・接続" },
  { id: "switch-port", label: "L2スイッチのポート", short: "LANケーブルを接続する差込口です。", detail: "L2スイッチは各ポートに番号を付け、どのMACアドレスの機器がどのポート側にいるかをMACアドレス表へ記録します。TCPやHTTPSで使う受付番号の「ポート番号」とは別の意味です。", example: "この実習では、1番のポートに無線AP、2番のポートにルータがつながっています。", category: "機器・接続" },
  { id: "mac-table", label: "MACアドレス表", short: "MACアドレスと、機器がつながる差込口の対応を記録した表。", detail: "L2スイッチは、データを送った機器のMACアドレスと入ってきた差込口を覚えます。次にデータを送るとき、この表から届け先の差込口を探します。", example: "02-00-00-00-10-01 → 2番の差込口（port 2）のように読みます。", category: "通信" },
  { id: "dns-record", label: "DNSレコード", short: "Webサイト名と、その答えを登録した項目。", detail: "答えの種類によって名前が付きます。Aレコードは、Webサイト名に対応するIPv4アドレスを登録した項目です。", example: "この学習モデルのAレコードは「www.mext.go.jp → 203.0.113.80」です。300秒は、この答えを覚えてよい時間です。", category: "通信" },
  { id: "ping", label: "ping", reading: "ピング", short: "相手までIP通信が届くかを確かめるコマンド。", detail: "小さな確認用パケットを送り、返事の有無と往復時間を調べます。Webサービス自体の正常までは保証しません。", example: "ping 192.168.10.1 で、まず出口のルータまで確認します。", category: "調査コマンド" },
  { id: "nslookup", label: "nslookup", reading: "エヌエスルックアップ", short: "Webサイト名に対応するIPアドレスを、DNSサーバへ問い合わせるコマンド。", detail: "Webサイト名をIPアドレスへ変換する部分だけを確認できます。名前では開けないときに、DNSが答えを返しているかを調べます。", example: "この学習モデルでは nslookup www.mext.go.jp と入力し、203.0.113.80が返るか確認します。", category: "調査コマンド" },
  { id: "traceroute", label: "traceroute", reading: "トレースルート", short: "目的地までに返事をしたルータを、通過順に表示するコマンド。", detail: "最後に返事があったルータと、その次の返事がない地点を比べて、どの区間から先で届かないかを調べます。", example: "traceroute 203.0.113.80 と入力し、1番目、2番目の経由地点を順に確認します。", category: "調査コマンド" },
  { id: "ipconfig", label: "ipconfig", reading: "アイピーコンフィグ", fullName: "IP Configuration（アイピー・コンフィギュレーション）", short: "Windowsで、PC自身のIP設定を表示する確認コマンドです。", detail: "Configurationは「設定」という意味です。Webページが表示されないとき、外部へ通信する前提となるPCのIPv4アドレス、サブネットマスク、デフォルトゲートウェイ、DNSサーバをまとめて確認できます。このコマンドは設定を表示するもので、相手へ確認パケットを送るコマンドではありません。", example: "この学習ではipconfigを実行し、IPv4 Address、Subnet Mask、Default Gateway、DNS Serversの4行を上から確認します。", category: "調査コマンド" },
  { id: "latency", label: "レイテンシ", short: "データを送り、反応が返るまでの時間。", detail: "一般にミリ秒（ms）で表し、小さいほど応答が速いと判断できます。", example: "pingの time=18ms は、往復に約18ミリ秒かかった意味です。", category: "通信" },
];

export const PHASE_TERM_IDS: Partial<Record<RoomPhase, string[]>> = {
  ROLES: ["client-server", "url", "request-response", "packet", "ip-address", "mac-address"],
  TOPOLOGY: ["wifi", "ethernet", "frame", "ssid"],
  ADDRESSING: ["ip-address", "prefix", "subnet", "gateway", "dns"],
  PROTOCOL: ["arp", "broadcast", "dns", "tcp", "tls", "https", "ttl"],
  DIAGNOSIS: ["ipconfig", "ping", "nslookup", "traceroute", "hop", "latency"],
  REFLECTION: ["packet", "route", "https"],
};

export function glossaryTerm(id: string): NetworkTerm | undefined {
  return NETWORK_GLOSSARY.find((term) => term.id === id);
}

export function networkGlossaryForTarget(target: LearningTarget): NetworkTerm[] {
  return NETWORK_GLOSSARY.map((term) => {
    const mapped = {
      ...term,
      short: materializeTargetText(term.short, target),
      detail: materializeTargetText(term.detail, target),
      example: materializeTargetText(term.example, target),
    };
    if (term.id === "dns") {
      mapped.example = `この部屋では、作成時に${target.resolver}へ${target.hostname}のAレコードを実際に問い合わせ、「${target.ipv4Addresses.join("、")}」が返りました。問い合わせ日時は${target.resolvedAt}です。`;
    }
    if (term.id === "dns-record") {
      mapped.example = `実際のAレコードは「${target.hostname} → ${target.ipv4Addresses.join("、")}」です。TTLは${target.dnsTtl > 0 ? `${target.dnsTtl}秒` : "回答に記載なし"}でした。`;
    }
    if (term.id === "nslookup") {
      mapped.example = `nslookup ${target.hostname} と入力し、部屋作成時に得た「${target.ipv4Addresses.join("、")}」と見比べます。`;
    }
    return mapped;
  });
}

export function glossaryTermForTarget(id: string, target: LearningTarget): NetworkTerm | undefined {
  return networkGlossaryForTarget(target).find((term) => term.id === id);
}
