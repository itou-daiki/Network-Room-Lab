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
  beginnerStory: string;
  everydayExample: string;
  situation: string;
  observationTitle: string;
  observationPurpose: string;
  observations: Array<{ label: string; value: string; meaning: string }>;
  decisionHint: string;
  question: string;
  choices: RolePracticeChoice[];
  successTitle: string;
  successOutput: string[];
  successMeanings: string[];
  explainPrompt: string;
  sentenceStarter: string;
  explainKeywords: string[];
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
    { target: "PCの住所：192.168.10.23/24", reading: "IPv4アドレスは、点で区切った4つの数です。/24では先頭3つ（192.168.10）が同じネットワーク、最後の23がこのPCを表します。", check: "WindowsのPCでは、ipconfigという確認コマンドを実行します。このPCの住所（IPv4 Address）、範囲（Subnet Mask）、出口（Default Gateway）、DNSサーバ（DNS Servers）の4行を上から確認します。" },
    { target: "PCの出口：192.168.10.1", reading: "PCと先頭3つが同じなので、/24の同じ校内LANにいる出口だと分かります。この出口がデフォルトゲートウェイです。", check: "まずipconfigで出口の設定を見ます。次にping 192.168.10.1という確認コマンドで、PCから出口のルータまで返事が来るかを確かめます。" },
    { target: "出口の機器番号：02-00-00-00-10-01", reading: "同じ校内LANで次に渡す機器を見分ける番号です。この番号をMACアドレスと呼びます。", check: "arp -aという確認コマンドで一覧を表示し、出口のIPアドレス192.168.10.1と、このMACアドレスが同じ行にあるかを確認します。" },
  ],
  ACCESS_POINT: [
    { target: "SSID: classroom-net", reading: "SSIDはWi-Fiを見分ける名前です。似た名前ではなく、文字列全体が一致しているかを見ます。", check: "接続端末一覧で、PCがclassroom-netへ接続済みか確認します。" },
    { target: "運び方：Wi-Fi → Ethernet", reading: "PCから受け取る無線区間と、次へ送る有線区間では運び方が変わります。外側の入れ物（フレーム）は替えますが、中の送信元と最終目的地のIPアドレスは変えません。", check: "無線アクセスポイントの管理画面で、PC側のWi-Fi接続と、L2スイッチ側の有線接続がどちらも接続中かを確認します。" },
    { target: "送った機器と次に届ける機器のMACアドレス", reading: "送信元MACはデータを送った近くの機器、宛先MACは次に渡す近くの機器を示します。", check: "管理画面のフレーム情報で、送った機器（Source MAC）と次に届ける機器（Destination MAC）を別々に確認します。" },
  ],
  L2_SWITCH: [
    { target: "対応表：ルータの番号10-01 → 2番の差込口", reading: "左が機器を見分けるMACアドレス、右がその機器につながる差込口です。次に届けるルータの番号と同じ行を探します。", check: "L2スイッチの管理画面で、ルータのMACアドレス02-00-00-00-10-01が2番の差込口（port 2）に登録されているか確認します。" },
    { target: "送ったPCの機器番号（送信元MAC）", reading: "データが入ってきた差込口と、送った機器のMACアドレスを組にして対応表へ覚えます。", check: "PCのMACアドレス02-00-00-00-10-23が、1番の差込口（port 1）に登録されたか確認します。" },
    { target: "次に届けるルータの機器番号（宛先MAC）", reading: "対応表に同じ番号があれば、その差込口だけへ送ります。番号がなければ、届いた差込口以外へ広げて送ります。", check: "今回はルータのMACアドレスが2番の差込口にあるため、2番だけが選ばれることを確認します。" },
  ],
  ROUTER: [
    { target: "宛先IP: 203.0.113.80", reading: "IPアドレスを経路表のネットワーク範囲と比べ、最も長く具体的に一致する行を選びます。", check: "192.168.10.0/24には含まれないため、0.0.0.0/0の既定経路に一致することを確認します。" },
    { target: "経路: 0.0.0.0/0 → WAN", reading: "/0はどの宛先にも一致する最後の候補で、より具体的な経路がないときに使います。", check: "traceroute 203.0.113.80で、ルータの次に外部側へ進むことを確認します。" },
    { target: "TTL: 64 → 63", reading: "TTLは通過できるルータ数の上限で、ルータを1台通るたびに1減ります。", check: "受信時と送信時のTTLを比較し、ちょうど1減ったか確認します。" },
  ],
  DNS_SERVER: [
    { target: "www.mext.go.jp", reading: "点で区切られた名前です。wwwはWebサイトを示す名前、mext.go.jpは文部科学省が使う名前の範囲です。", check: "この学習モデルで nslookup www.mext.go.jp を実行し、質問名が入力と同じか確認します。" },
    { target: "A 203.0.113.80", reading: "Aは名前に対応するIPv4アドレスを示すレコード種類です。", check: "nslookupのAnswerで、NameとAddressの組が登録値と一致するか確認します。" },
    { target: "TTL: 300秒", reading: "このDNS回答を一時的に覚えてよい秒数です。IPパケットのTTLとは意味が異なります。", check: "DNS応答のレコード横にあるTTL値を確認し、通信経路のTTLと区別します。" },
  ],
  WEB_SERVER: [
    { target: "Webサーバの住所と受付：203.0.113.80:443", reading: "コロンの左がWebサーバのIPアドレス、右の443が安全なWeb通信を受け付ける窓口番号です。", check: "この学習モデルで curl https://www.mext.go.jp/a_menu/shotou/new-cs/1384661.htm を実行し、接続先・証明書・ページの応答を順番に確認します。" },
    { target: "GET /a_menu/shotou/new-cs/1384661.htm", reading: "GETは取得する操作、その後ろは文部科学省サイト内にある学習指導要領ページの場所です。", check: "要求行のメソッドがGETで、パスが入力したURLと同じか確認します。" },
    { target: "TLS 1.3 / 証明書", reading: "HTTPを送る前に、証明書の名前・有効期限・信頼関係を確認して暗号化します。", check: "HTTPS確認結果で証明書が有効、その後に200 OKが返る順番を確認します。" },
  ],
};

export const ROLE_PRACTICES: RolePracticeDefinition[] = [
  {
    role: "CLIENT_PC",
    mission: "Webサーバへ送る「このページをください」という要求の、最初の渡し先を決める",
    beginnerStory: "あなたは、Webページを見たい人が使っているPCです。ページを見るためには、まずPCからWebサーバへ「このページをください」というお願いのデータを送ります。この時点でPCが送るのは、Webページそのものではありません。Webサーバはお願いを受け取った後、ページのデータをPCへ返します。",
    everydayExample: "遠くの店から商品を受け取りたいときは、先に注文書を送ります。注文書は、まず近くの郵便局へ渡され、遠くの店まで運ばれます。PCも、Webページを受け取るためのお願いを、まず近くの出口となるルータへ渡します。",
    situation: "ブラウザに、見たいWebページの場所を表すURLが入力されました。この場面では、DNSへの問い合わせが終わり、WebサーバのIPアドレスは分かっています。PCはこれから、別のネットワークにあるWebサーバへ「このページをください」という要求を送ります。",
    observationTitle: "PCのネットワーク設定",
    observationPurpose: "「このページをください」という要求を届けるWebサーバが同じネットワークにいるかを判断し、最初に要求を渡す相手を決めるためです。",
    observations: [
      { label: "このPCの住所（IPアドレス）", value: "192.168.10.23/24", meaning: "ネットワーク上で、このPCを見分ける住所です。/24は同じネットワークの範囲を判断する手がかりです。" },
      { label: "Webサーバの住所（宛先IP）", value: "203.0.113.80", meaning: "「このページをください」という要求を届けたいWebサーバの住所です。PCの住所と範囲が違うため、直接は渡せません。" },
      { label: "外部への出口（デフォルトゲートウェイ）", value: "192.168.10.1", meaning: "別のネットワークへ送るとき、PCが最初にデータを渡すルータです。" },
      { label: "出口の機器番号を覚えた表（ARPキャッシュ）", value: "192.168.10.1 → 未登録", meaning: "出口へ直接渡すために必要なMACアドレスが、まだ表に登録されていません。" },
    ],
    decisionHint: "自分と宛先のIPは先頭の数字が異なります。遠くのWebサーバへの要求は、まず同じLANにいる「出口」へ渡します。",
    question: "別ネットワークのWebサーバへ「このページをください」という要求を送り始めるために、このPCが最初に行う操作はどれですか？",
    choices: [
      { id: "pc-web-direct", label: "WebサーバのMACアドレスをインターネット全体へ問い合わせる", correct: false, feedback: "MACアドレスを使う範囲は同じリンク内です。遠いWebサーバではなく、まず同じLANにいる出口を調べます。" },
      { id: "pc-arp-gateway", label: "出口のルータの機器番号（MACアドレス）をARPで調べる", correct: true, feedback: "届け先が別ネットワークなので、PCは最初の出口となるルータの機器番号を調べてからデータを渡します。この仕組みをARPと呼びます。" },
      { id: "pc-change-ip", label: "自分のIPアドレスをWebサーバと同じ値へ変更する", correct: false, feedback: "同じIPアドレスを使うと重複します。異なるネットワークへはルータを経由します。" },
    ],
    successTitle: "ARPキャッシュへ出口を登録しました",
    successOutput: ["ARPの質問：192.168.10.1 のMACアドレスは？", "ARPの回答：192.168.10.1 は 02-00-00-00-10-01", "PCが選んだ最初の渡し先：デフォルトゲートウェイ"],
    successMeanings: ["PCが「192.168.10.1のMACアドレスを教えて」と質問しました。", "出口のMACアドレスが02-00-00-00-10-01だと分かりました。", "Webサーバへ送る「このページをください」という要求を、まず出口のルータへ渡します。"],
    explainPrompt: "なぜWebサーバではなく、ゲートウェイのMACアドレスを調べたのですか？",
    sentenceStarter: "宛先は別のネットワークにあるので、PCはまず",
    explainKeywords: ["出口", "ゲートウェイ", "MACアドレス"],
    termIds: ["url", "ip-address", "prefix", "subnet-mask", "gateway", "arp", "arp-cache", "mac-address"],
  },
  {
    role: "ACCESS_POINT",
    mission: "PCからWi-Fiで届いたデータを、有線LANへ渡す",
    beginnerStory: "あなたは無線アクセスポイントです。PCから電波で受け取ったデータを、次の有線機器へ渡します。",
    everydayExample: "駅の乗り換え通路で、同じ乗客が電車からバスへ乗り換える場面に似ています。運ぶ方法は変わりますが、向かう人と目的地は変わりません。",
    situation: "接続済みのPCから、Wi-Fiでデータが届きました。次は、有線でつながるL2スイッチへ渡します。",
    observationTitle: "無線アクセスポイントの接続と受信状態",
    observationPurpose: "PCからのデータを受け取れていて、次のL2スイッチへ渡せる状態かを判断するためです。",
    observations: [
      { label: "Wi-Fiの名前（SSID）", value: "classroom-net", meaning: "PCが接続しているWi-Fiを見分ける名前です。" },
      { label: "接続しているPC", value: "PC / 02-00-00-00-10-23", meaning: "データを送ったPCが、このWi-Fiへ接続済みだと分かります。" },
      { label: "PCから届いたデータ", value: "Wi-Fiフレーム", meaning: "PCから、Wi-Fi区間で使う形のデータを受け取りました。この形をフレームと呼びます。" },
      { label: "次の機器へ続く有線接続", value: "Ethernet / 接続中", meaning: "L2スイッチへ続く有線LANが使える状態です。Ethernetは有線LANの通信方式です。" },
    ],
    decisionHint: "入口はWi-Fi、出口はEthernetです。中のIPパケットは同じ相手へ向かうので変更しません。",
    question: "PCから届いたデータをL2スイッチ側へ渡すために、無線アクセスポイントが行う操作はどれですか？",
    choices: [
      { id: "ap-change-ip", label: "送信元と宛先のIPアドレスを書き換える", correct: false, feedback: "無線APは、この場面ではIPの経路選択をしません。リンク層の形式を橋渡しします。" },
      { id: "ap-drop", label: "無線で届いたため、有線側へは送らず破棄する", correct: false, feedback: "上りEthernetポートは接続中です。無線端末の通信を有線LANへ渡すのが役割です。" },
      { id: "ap-bridge", label: "Wi-Fiのリンク情報をEthernet用へ載せ替えて転送する", correct: true, feedback: "IPパケットの内容を保ったまま、次の区間に合うフレームへ橋渡しします。" },
    ],
    successTitle: "Wi-FiからEthernetへ橋渡ししました",
    successOutput: ["受け取った形：Wi-Fiフレーム", "中のIPアドレス：192.168.10.23 → 203.0.113.80（変更なし）", "次に送る形：Ethernetフレーム → L2スイッチ"],
    successMeanings: ["PCから無線の形式で受け取りました。", "送信元と宛先のIPアドレスは変えていません。", "有線の形式に包み直して、次のスイッチへ渡しました。"],
    explainPrompt: "無線APがIPパケットの中身を変えなかったのはなぜですか？",
    sentenceStarter: "無線APはWi-Fiと有線LANをつなぐ役割なので、",
    explainKeywords: ["橋渡し", "IPアドレス", "そのまま"],
    termIds: ["access-point", "wifi", "ssid", "frame", "ethernet", "mac-address"],
  },
  {
    role: "L2_SWITCH",
    mission: "届いたデータを出す差込口（ポート）を決める",
    beginnerStory: "あなたはL2スイッチです。複数のケーブルの中から、届け先につながる1本を選びます。",
    everydayExample: "教室の座席表を見て、手紙を相手の席にだけ届ける案内係に似ています。座席表がMACアドレス表、席へ続く通路がポートです。",
    situation: "無線アクセスポイントにつながる1番の差込口（port 1）から、ルータへ届けたいデータが届きました。",
    observationTitle: "L2スイッチが受け取ったデータとMACアドレス表",
    observationPurpose: "届け先のルータがどの差込口につながっているかを調べ、データを出すポートを決めるためです。",
    observations: [
      { label: "データが入ってきた差込口（受信ポート）", value: "1番の差込口（port 1） / 無線AP", meaning: "このデータは、無線アクセスポイント側につながる1番の差込口から届きました。" },
      { label: "送った機器の番号（送信元MAC）", value: "02-00-00-00-10-23", meaning: "同じLAN内で、データを送ったPCを見分ける番号です。" },
      { label: "次に届ける機器の番号（宛先MAC）", value: "02-00-00-00-10-01", meaning: "同じLAN内で、次に届けたいルータを見分ける番号です。" },
      { label: "機器番号と差込口の対応表（MACアドレス表）", value: "10-01 → 2番（port 2） / 10-23 → 1番（port 1）", meaning: "次に届ける機器番号の末尾10-01を探すと、ルータは2番の差込口側にいると分かります。" },
    ],
    decisionHint: "次に届ける機器番号の末尾「10-01」と、対応表の「10-01 → 2番の差込口」を照合します。",
    question: "ルータへデータを届けるために、L2スイッチはどのポートへ出しますか？",
    choices: [
      { id: "switch-port-2", label: "対応表に従い、ルータ側の2番の差込口へ送る", correct: true, feedback: "次に届けるルータのMACアドレスに対応する差込口が分かっているので、2番だけへ送れます。" },
      { id: "switch-port-1", label: "受け取った無線AP側の1番の差込口へ送り返す", correct: false, feedback: "1番の差込口は、データを送ってきた側です。次に届ける機器番号と対応表を比べます。" },
      { id: "switch-dns", label: "DNSへ問い合わせて、出力ポートを決めてもらう", correct: false, feedback: "L2スイッチの転送判断にはDNSではなくMACアドレス表を使います。" },
    ],
    successTitle: "ルータ側の2番の差込口だけへ送りました",
    successOutput: ["新しく記録：PCのMACアドレス → 1番の差込口", "対応表から発見：ルータのMACアドレス → 2番の差込口", "データを送る場所：2番の差込口"],
    successMeanings: ["データを送ったPCは1番の差込口側にいると記録しました。", "次に届けるルータは2番の差込口側にいると表から分かりました。", "必要な2番の差込口だけへデータを送りました。"],
    explainPrompt: "すべての差込口ではなく、2番の差込口だけへ送れた根拠は何ですか？",
    sentenceStarter: "宛先MACアドレスをMACアドレス表で調べると、",
    explainKeywords: ["10-01", "2番の差込口", "MACアドレス表"],
    termIds: ["l2-switch", "mac-address", "mac-table", "frame", "ethernet"],
  },
  {
    role: "ROUTER",
    mission: "宛先のIPアドレスを見て、外部へ続く道を選ぶ",
    beginnerStory: "あなたはルータです。別のネットワークへ向かうデータを受け取り、次に進む道を選びます。",
    everydayExample: "道路の分岐点で、荷物の住所と案内標識を見比べ、進む方向を決める案内係に似ています。経路表が案内標識です。",
    situation: "校内LAN側から、外部のWebサーバへ届けたい、IPアドレス付きのデータ（IPパケット）が届きました。",
    observationTitle: "ルータの受信情報と経路表",
    observationPurpose: "WebサーバのIPアドレスに合う道を経路表から探し、データをLAN側と外部側のどちらへ送るか決めるためです。",
    observations: [
      { label: "目的地の住所（宛先IP）", value: "203.0.113.80", meaning: "データが目指しているWebサーバのIPアドレスです。" },
      { label: "通過できるルータの残り回数（TTL）", value: "64", meaning: "データがルータを通れる残り回数です。ルータを1台通ると1減ります。" },
      { label: "校内LANへ戻す道（LAN経路）", value: "192.168.10.0/24 → LAN", meaning: "宛先が192.168.10から始まる同じ校内LANなら、LAN側へ送るという案内です。" },
      { label: "外部へ出す道（既定経路）", value: "0.0.0.0/0 → WAN", meaning: "ほかの道に当てはまらない宛先を、外部ネットワーク側へ送るための案内です。" },
    ],
    decisionHint: "宛先203.0.113.80はLAN経路の192.168.10.0/24に入りません。残った既定経路を使い、TTLを1減らします。",
    question: "外部のWebサーバへデータを近づけるために、ルータはどの処理を行いますか？",
    choices: [
      { id: "router-default", label: "既定経路でWANへ送り、TTLを63へ減らす", correct: true, feedback: "より具体的なLAN経路には一致しないため既定経路を選び、ルータ通過時にTTLを1減らします。" },
      { id: "router-lan", label: "LAN経路を選び、無線AP側へ送り返す", correct: false, feedback: "203.0.113.80は192.168.10.0/24に含まれません。宛先と経路表を照合します。" },
      { id: "router-ttl-up", label: "既定経路でWANへ送り、TTLを65へ増やす", correct: false, feedback: "TTLはルータを通るたびに1減ります。増やすとループ防止の役割を果たせません。" },
    ],
    successTitle: "既定経路を選び、WANへ転送しました",
    successOutput: ["選んだ道：既定経路 0.0.0.0/0 → 外部側", "通過できる残り回数：64 → 63", "次の渡し先：学習用インターネット"],
    successMeanings: ["宛先に合う具体的な経路がないため、既定経路を選びました。", "ルータを1台通ったので、残り回数を1減らしました。", "パケットを外部ネットワーク側へ送りました。"],
    explainPrompt: "LAN経路ではなく既定経路を選び、TTLを減らした理由を説明してください。",
    sentenceStarter: "宛先IPはLAN経路に当てはまらないため、",
    explainKeywords: ["既定経路", "WAN", "TTLを1減らす"],
    termIds: ["router", "ip-address", "prefix", "route", "ttl", "hop"],
  },
  {
    role: "DNS_SERVER",
    mission: "Webサイト名に対応するIPアドレスを答える",
    beginnerStory: "あなたはDNSサーバです。PCからWebサイトの名前を受け取り、通信に使うIPアドレスを答えます。",
    everydayExample: "店の名前から電話番号を調べる電話帳に似ています。DNSサーバは、Webサイト名から通信先のIPアドレスを探します。",
    situation: "PCから「www.mext.go.jpのIPv4アドレスを教えて」という質問が届きました。答えは、この学習モデルのDNSサーバに登録されています。",
    observationTitle: "PCからの質問とDNSサーバの登録内容",
    observationPurpose: "PCが質問したWebサイト名を確認し、それに対応する正しいIPアドレスを答えるためです。",
    observations: [
      { label: "PCが入力したWebサイト名（問い合わせ名）", value: "www.mext.go.jp", meaning: "PCがIPアドレスを知りたい文部科学省Webサイトの名前です。" },
      { label: "PCが知りたい情報（Aレコード）", value: "A（IPv4アドレス）", meaning: "Aは「この名前に対応するIPv4アドレスを教えて」という質問の種類です。" },
      { label: "登録されている答え（IPアドレス）", value: "203.0.113.80", meaning: "質問されたWebサイト名に対応して、DNSサーバに登録されているIPアドレスです。" },
      { label: "答えを一時保存できる時間（DNSのTTL）", value: "300秒", meaning: "PCなどがこの答えを覚えてよい時間です。ここでのTTLは、ルータの通過回数とは別の意味です。" },
    ],
    decisionHint: "質問は「A（IPv4アドレス）」です。登録値のIPアドレスと、その答えを覚えてよい時間を返します。",
    question: "PCがWebサーバへ接続できるようにするために、DNSサーバはどの答えを返しますか？",
    choices: [
      { id: "dns-gateway", label: "デフォルトゲートウェイの192.168.10.1を回答する", correct: false, feedback: "ゲートウェイはPCの出口です。問い合わせ名に登録されたAレコードを返します。" },
      { id: "dns-a-record", label: "Aレコード203.0.113.80とTTL 300秒を回答する", correct: true, feedback: "問い合わせ名と種類が一致したため、登録済みのIPv4アドレスを回答します。" },
      { id: "dns-html", label: "学習指導要領ページのHTML本文を回答する", correct: false, feedback: "DNSは名前をIPアドレスへ変換します。ページ本文を返すのはWebサーバです。" },
    ],
    successTitle: "名前に対応するAレコードを回答しました",
    successOutput: ["質問の処理結果：成功（NOERROR）", "学習モデルのDNS回答：www.mext.go.jp → 203.0.113.80（300秒保存可）", "PCへ返す答え：1件"],
    successMeanings: ["問い合わせを問題なく処理できました。", "名前・300秒・IPv4アドレスの組を回答しました。", "答えが1件含まれています。"],
    explainPrompt: "DNSサーバがWebページそのものではなく、IPアドレスを返すのはなぜですか？",
    sentenceStarter: "DNSサーバは名前から通信先を探す電話帳なので、",
    explainKeywords: ["ドメイン名", "IPアドレス", "Webサーバ"],
    termIds: ["dns", "domain", "dns-record", "ip-address", "ttl"],
  },
  {
    role: "WEB_SERVER",
    mission: "求められた学習指導要領ページを、安全な通信で返す",
    beginnerStory: "あなたはWebサーバです。PCから届いた「このページをください」という要求を読み、ページの内容を返します。",
    everydayExample: "図書館の係が貸出票を読み、指定された本と「用意できました」という返事を渡す場面に似ています。",
    situation: "PCとの通信路と暗号化の準備が終わり、「学習指導要領ページをください」という要求が届きました。",
    observationTitle: "Webサーバが受け取った要求",
    observationPurpose: "安全に通信できる状態か、どのページを求められているかを確認し、返す内容を決めるためです。",
    observations: [
      { label: "PCとの通信路（TCP）", value: "準備完了（ESTABLISHED） / 443番窓口", meaning: "ESTABLISHEDは、PCとWebサーバの間にデータを運ぶ通信路が準備できた状態です。443番は安全なWeb通信の受付窓口です。" },
      { label: "暗号化の準備（TLS）", value: "証明書確認済み / TLS 1.3", meaning: "接続相手を証明書で確認し、内容を暗号化して送れる状態です。" },
      { label: "PCがしてほしい操作（HTTPメソッド）", value: "GET", meaning: "GETは「ページの内容を取得したい」という要求です。" },
      { label: "求められたページの場所（パス）", value: "/a_menu/shotou/new-cs/1384661.htm", meaning: "文部科学省のWebサーバ内で、PCが求めている学習指導要領ページの場所です。" },
    ],
    decisionHint: "通信路と暗号化の準備は完了しています。GETは「ページをください」なので、指定された学習指導要領ページを成功応答と一緒に返します。",
    question: "PCが求めた学習指導要領ページを表示できるようにするために、Webサーバはどの答えを返しますか？",
    choices: [
      { id: "web-dns", label: "ドメイン名をIPアドレスへ変換して回答する", correct: false, feedback: "名前解決はすでにDNSが行いました。WebサーバはHTTP要求の内容を処理します。" },
      { id: "web-redirect-arp", label: "ARP問い合わせを返し、PCにもう一度接続させる", correct: false, feedback: "TCPとTLSは確立済みです。GETされたパスに対応するコンテンツを返します。" },
      { id: "web-200", label: "200 OKとページのHTMLをTLSで暗号化して返す", correct: true, feedback: "接続は安全に確立され、学習指導要領ページへのGET要求を処理できるため、成功応答とページ内容を返します。" },
    ],
    successTitle: "学習指導要領ページを安全な応答として返しました",
    successOutput: ["Webサーバの回答：200 OK（要求を処理できた）", "返す内容の種類：HTML / 文字コード UTF-8", "通信の保護：TLSで暗号化", "返した内容：学習指導要領ページの本文"],
    successMeanings: ["要求を正常に処理できた、と伝えました。", "返す内容が文字コードUTF-8のHTMLだと伝えました。", "応答を暗号化して送ります。", "学習指導要領ページの本文を返しました。"],
    explainPrompt: "TCP・TLS・HTTPは、この応答でそれぞれ何を担当していますか？",
    sentenceStarter: "TCPは通信路を用意し、TLSは内容を暗号化し、HTTPは",
    explainKeywords: ["要求", "200 OK", "ページを返す"],
    termIds: ["tcp", "port", "tls", "certificate", "http", "http-method", "status-code", "https"],
  },
];

export function rolePractice(role: RoleId): RolePracticeDefinition | undefined {
  return ROLE_PRACTICES.find((practice) => practice.role === role);
}
