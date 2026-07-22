import { materializeTargetText, targetPageLabel } from "../../shared/learningTarget";
import type { LearningTarget } from "../../shared/types";

type RouteFocus = "all" | "gateway" | "dns" | "web";

interface LearningRouteMapProps {
  activeNodeId?: string;
  focus?: RouteFocus;
  compact?: boolean;
  target: LearningTarget;
}

interface RouteNode {
  id: string;
  label: string;
  action: string;
}

const commonRoute = (routeId: "dns" | "web"): RouteNode[] => routeId === "dns"
  ? [
      { id: "pc", label: "PC", action: "URLからWebサイト名を取り出し、DNSへの質問を作る" },
      { id: "ap", label: "無線AP", action: "DNSへの質問をWi-Fiから有線LANへ渡す" },
      { id: "switch", label: "L2スイッチ", action: "DNSへの質問をルータ側の差込口へ送る" },
      { id: "router", label: "ルータ", action: "DNSサーバのIPアドレスを見て、外部へ続く道を選ぶ" },
      { id: "internet", label: "インターネット", action: "DNSへの質問を校外のDNSサーバまで運ぶ" },
    ]
  : [
      { id: "pc", label: "PC", action: "DNSで分かったIPアドレスを使い、「ページをください」という要求を作る" },
      { id: "ap", label: "無線AP", action: "ページの要求をWi-Fiから有線LANへ渡す" },
      { id: "switch", label: "L2スイッチ", action: "ページの要求をルータ側の差込口へ送る" },
      { id: "router", label: "ルータ", action: "WebサーバのIPアドレスを見て、外部へ続く道を選ぶ" },
      { id: "internet", label: "インターネット", action: "ページの要求を校外のWebサーバまで運ぶ" },
    ];

const routes: Array<{
  id: "dns" | "web";
  step: string;
  title: string;
  purpose: string;
  startState: string;
  roundGoal: string;
  outbound: string;
  returnText: string;
  afterReturn: string;
  afterLabel: string;
  destination: RouteNode;
}> = [
  {
    id: "dns",
    step: "往復 1",
    title: "Webサイト名から、通信先のIPアドレスを調べる",
    purpose: "URLに書かれたwww.mext.go.jpは人が読みやすい名前です。PCは通信に使うIPアドレスをまだ知らないため、最初にDNSサーバへ質問します。",
    startState: "PCはWebサイト名「www.mext.go.jp」を知っていますが、通信先のIPアドレスはまだ知りません。",
    roundGoal: "DNSサーバから答えを受け取り、PCが通信先IPアドレス「203.0.113.80」を知ること",
    outbound: "「www.mext.go.jpのIPアドレスを教えて」という質問を送る",
    returnText: "DNSサーバが、WebサーバのIPアドレス「203.0.113.80」を答えとしてPCへ返します。",
    afterLabel: "往復1が終わったら",
    afterReturn: "PCは受け取ったIPアドレスを使い、往復2でWebサーバへ学習指導要領ページを取りに行きます。",
    destination: { id: "dns", label: "DNSサーバ", action: "Webサイト名に対応するIPアドレスを答える" },
  },
  {
    id: "web",
    step: "往復 2",
    title: "分かったIPアドレスへ、学習指導要領ページを取りに行く",
    purpose: "PCはWebサーバのIPアドレスが分かった後、通信路と暗号化を準備し、「学習指導要領ページをください」という要求を送ります。Webサーバはその返事としてページのデータを返します。",
    startState: "PCは往復1で、WebサーバのIPアドレス「203.0.113.80」を受け取りました。",
    roundGoal: "Webサーバからページのデータを受け取り、PCのブラウザに学習指導要領ページを表示すること",
    outbound: "「学習指導要領ページをください」という要求を送る",
    returnText: "Webサーバが、成功の返事「200 OK」と学習指導要領ページのデータをPCへ返します。",
    afterLabel: "往復2が終わったら",
    afterReturn: "PCが受け取ったデータをブラウザで組み立て、学習指導要領ページを画面に表示します。これで大きなゴールを達成します。",
    destination: { id: "web", label: "Webサーバ", action: "PCがURLで指定したページのデータを返す" },
  },
];

export function LearningRouteMap({ activeNodeId, focus = "all", compact = false, target }: LearningRouteMapProps) {
  const targetRoutes = routes.map((route) => ({
    ...route,
    title: materializeTargetText(route.title, target),
    purpose: materializeTargetText(route.purpose, target),
    startState: materializeTargetText(route.startState, target),
    roundGoal: materializeTargetText(route.roundGoal, target),
    outbound: materializeTargetText(route.outbound, target),
    returnText: materializeTargetText(route.returnText, target),
    afterReturn: materializeTargetText(route.afterReturn, target),
    destination: { ...route.destination, action: materializeTargetText(route.destination.action, target) },
  }));
  return (
    <section className={`learning-route-map ${compact ? "compact" : ""}`} aria-labelledby={compact ? undefined : "learning-route-title"}>
      <header>
        <div>
          <small>この実習全体のゴール</small>
          <h2 id={compact ? undefined : "learning-route-title"}>PCのブラウザに、{targetPageLabel(target)}を表示する</h2>
          <p>一度にページを取りに行くのではありません。まず往復1で通信先のIPアドレスを調べ、その答えを使って往復2でページを取りに行きます。</p>
        </div>
        <div className="gateway-explanation"><b>192.168.10.1は、何のアドレス？</b><span>この実習では、PCと同じLANにつながるルータのLAN側IPアドレスです。PCは、別のネットワークへ送るデータを最初にこのルータへ渡します。この役割のルータを、PCから見て「デフォルトゲートウェイ」と呼びます。</span></div>
      </header>

      <ol className="route-overview" aria-label={`${targetPageLabel(target)}が表示されるまでの全体の順番`}>
        <li><span>1</span><div><b>往復1：住所を調べる</b><small>Webサイト名 → IPアドレス</small></div></li>
        <li><i aria-hidden="true">→</i><span>2</span><div><b>往復2：ページを受け取る</b><small>IPアドレス → ページのデータ</small></div></li>
        <li><i aria-hidden="true">→</i><span>✓</span><div><b>大きなゴール</b><small>PCのブラウザにページを表示</small></div></li>
      </ol>

      <div className="route-lanes">
        {targetRoutes.map((route) => {
          const nodes = [...commonRoute(route.id).map((node) => ({ ...node, action: materializeTargetText(node.action, target) })), route.destination];
          const focused = focus === "all" || focus === "gateway" || focus === route.id;
          return (
            <article className={`route-lane route-${route.id} ${focused ? "focused" : "muted"}`} key={route.id}>
              <div className="route-lane-heading">
                <span>{route.step}</span>
                <div><h3>{route.title}</h3><p>{route.purpose}</p></div>
              </div>
              <div className="route-round-summary">
                <div><span>往復する前のPC</span><p>{route.startState}</p></div>
                <i aria-hidden="true">→</i>
                <div><span>この往復のゴール</span><p><b>{route.roundGoal}</b></p></div>
              </div>
              <div className="route-scroll" tabIndex={0} aria-label={`${route.title}の経路。横にスクロールして確認できます。`}>
                <p className="route-scroll-hint">左右に動かして、1番のPCから6番の{route.destination.label}まで順番に確認できます</p>
                <div className="route-outbound"><span>行き：PC → {route.destination.label}</span><b>{route.outbound}</b><i aria-hidden="true">→</i></div>
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
                          {index === nodes.length - 1 && <mark>行きの到着点</mark>}
                          {isActive && <strong>いまここ</strong>}
                        </div>
                        {index < nodes.length - 1 && <i className="route-arrow" aria-hidden="true">→</i>}
                      </li>
                    );
                  })}
                </ol>
                <div className="route-return"><i aria-hidden="true">←</i><span>帰り：{route.destination.label} → PC</span><b>{route.returnText}</b></div>
                <ol className="route-return-track" aria-label={`${route.destination.label}からPCへ戻る経路`}>
                  {nodes.map((node, index) => (
                    <li key={node.id}>
                      <span>{node.id === "router" ? "ルータ（出口）" : node.label}</span>
                      {index < nodes.length - 1 && <i aria-hidden="true">←</i>}
                    </li>
                  ))}
                </ol>
                <div className={`route-after-return ${route.id === "web" ? "complete" : ""}`}>
                  <span>{route.afterLabel}</span><b>{route.afterReturn}</b>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <footer><span className="route-current-key" />青い枠の「いまここ」は、現在操作している機器です。「行きの到着点」は、質問や要求を受け取るサーバです。</footer>
    </section>
  );
}
