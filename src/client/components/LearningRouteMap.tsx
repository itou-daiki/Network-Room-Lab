type RouteFocus = "all" | "gateway" | "dns" | "web";

interface LearningRouteMapProps {
  activeNodeId?: string;
  focus?: RouteFocus;
  compact?: boolean;
}

interface RouteNode {
  id: string;
  label: string;
  action: string;
}

const commonRoute: RouteNode[] = [
  { id: "pc", label: "PC", action: "URLを入力し、通信を始める" },
  { id: "ap", label: "無線AP", action: "Wi-Fiのデータを有線LANへ渡す" },
  { id: "switch", label: "L2スイッチ", action: "次の機器につながる差込口を選ぶ" },
  { id: "router", label: "ルータ", action: "PCの出口として、外部へ続く道を選ぶ" },
  { id: "internet", label: "インターネット", action: "校外のサーバへ運ぶ" },
];

const routes: Array<{
  id: "dns" | "web";
  step: string;
  title: string;
  purpose: string;
  outbound: string;
  returnText: string;
  destination: RouteNode;
}> = [
  {
    id: "dns",
    step: "往復 1",
    title: "Webサイト名から、通信先のIPアドレスを調べる",
    purpose: "PCはURLの名前だけでは通信先を決められないため、最初にDNSサーバへ質問します。",
    outbound: "Webサイト名についての質問を送る",
    returnText: "DNSサーバが、WebサーバのIPアドレス203.0.113.80を同じ道でPCへ返す",
    destination: { id: "dns", label: "DNSサーバ", action: "Webサイト名に対応するIPアドレスを答える" },
  },
  {
    id: "web",
    step: "往復 2",
    title: "分かったIPアドレスへ、学習指導要領ページを取りに行く",
    purpose: "PCはWebサーバの場所が分かった後、安全な通信を準備して学習指導要領ページを要求します。",
    outbound: "学習指導要領ページをください、という要求を送る",
    returnText: "Webサーバが、成功の返事（200 OK）と学習指導要領ページを同じ道でPCへ返す",
    destination: { id: "web", label: "Webサーバ", action: "要求された学習指導要領ページを返す" },
  },
];

export function LearningRouteMap({ activeNodeId, focus = "all", compact = false }: LearningRouteMapProps) {
  return (
    <section className={`learning-route-map ${compact ? "compact" : ""}`} aria-labelledby={compact ? undefined : "learning-route-title"}>
      <header>
        <div>
          <small>大きな目的までの道のり</small>
          <h2 id={compact ? undefined : "learning-route-title"}>学習指導要領ページを見るまでに、データが通る経路</h2>
          <p>矢印の順に質問や要求を送り、サーバからの答えは同じ機器を逆向きに通ってPCへ戻ります。</p>
        </div>
        <div className="gateway-explanation"><b>ルータとゲートウェイは別の機器？</b><span>この実習では同じ機器です。PCから見て、外部への最初の出口として働くルータを「デフォルトゲートウェイ」と呼びます。</span></div>
      </header>

      <div className="route-lanes">
        {routes.map((route) => {
          const nodes = [...commonRoute, route.destination];
          const focused = focus === "all" || focus === "gateway" || focus === route.id;
          return (
            <article className={`route-lane route-${route.id} ${focused ? "focused" : "muted"}`} key={route.id}>
              <div className="route-lane-heading">
                <span>{route.step}</span>
                <div><h3>{route.title}</h3><p>{route.purpose}</p></div>
              </div>
              <div className="route-scroll" tabIndex={0} aria-label={`${route.title}の経路。横にスクロールして確認できます。`}>
                <p className="route-scroll-hint">左右に動かして、1番のPCから6番の{route.destination.label}まで順番に確認できます</p>
                <div className="route-outbound"><span>行き</span>{route.outbound}<b>→</b></div>
                <ol className="route-track">
                  {nodes.map((node, index) => {
                    const isActive = focused && activeNodeId === node.id;
                    return (
                      <li className={isActive ? "active" : ""} key={node.id}>
                        <div className="route-node">
                          <span>{index + 1}</span>
                          <b>{node.id === "router" ? "ルータ" : node.label}</b>
                          {node.id === "router" && <em>PCの出口<br />デフォルトゲートウェイ</em>}
                          <small>{node.action}</small>
                          {isActive && <strong>いまここ</strong>}
                        </div>
                        {index < nodes.length - 1 && <i className="route-arrow" aria-hidden="true">→</i>}
                      </li>
                    );
                  })}
                </ol>
                <div className="route-return"><b>←</b><span>帰り</span>{route.returnText}</div>
              </div>
            </article>
          );
        })}
      </div>
      <footer><span className="route-current-key" />青い枠は、いま担当している機器または通信データの現在地です。</footer>
    </section>
  );
}
