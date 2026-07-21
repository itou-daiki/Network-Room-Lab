import { FormEvent, useState } from "react";

import { createRoom, joinRoom } from "../api";
import type { AppSession } from "../session";

interface HomePageProps {
  onEnterRoom: (session: AppSession) => void;
}

type EntryMode = "join" | "create";

const flowNodes = [
  { id: "pc", label: "PC", sub: "URL・IP", tone: "blue" },
  { id: "ap", label: "無線AP", sub: "Wi-Fi ↔ LAN", tone: "mint" },
  { id: "l2", label: "L2", sub: "MAC", tone: "violet" },
  { id: "router", label: "Router", sub: "IP・TTL", tone: "amber" },
  { id: "server", label: "DNS / Web", sub: "名前解決・HTTPS", tone: "rose" },
];

export function HomePage({ onEnterRoom }: HomePageProps) {
  const [mode, setMode] = useState<EntryMode>("join");
  const [displayName, setDisplayName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [title, setTitle] = useState("情報ネットワーク演習");
  const [capacity, setCapacity] = useState(6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "create") {
        const room = await createRoom({ title, capacity, scenario: "STANDARD_WEB_ACCESS" });
        onEnterRoom({ code: room.code, token: room.teacherToken, mode: "teacher" });
      } else {
        const code = roomCode.trim().toUpperCase();
        if (!/^[A-Z2-9]{6}$/.test(code)) throw new Error("部屋コードは英数字6文字で入力してください。");
        const participant = await joinRoom(code, { displayName });
        onEnterRoom({ code, token: participant.participantToken, mode: "participant" });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "部屋へ接続できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="landing-shell">
      <nav className="landing-nav" aria-label="メインナビゲーション">
        <a className="brand" href="/" aria-label="Network Room Lab トップ">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            <b>Network Room</b>
            <small>LAB</small>
          </span>
        </a>
        <div className="nav-context">
          <span className="status-dot" />
          協働型ネットワーク演習
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow"><span>●</span> PACKET JOURNEY / TEAM LEARNING</p>
          <h1>
            通信を、<br />
            <span>チームで動かす。</span>
          </h1>
          <p className="hero-lead">
            PC・無線AP・L2スイッチ・ルータ・DNS・Webサーバ。
            一人ひとりが機器になって、URLから画面が届くまでを実験します。
          </p>
          <div className="hero-facts" aria-label="利用想定">
            <div><b>6</b><span>つの役割</span></div>
            <div><b>7</b><span>つの学習フェーズ</span></div>
            <div><b>ARP → HTTPS</b><span>一続きの通信体験</span></div>
          </div>
        </div>

        <div className="entry-card">
          <div className="entry-tabs" role="tablist" aria-label="参加方法">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "join"}
              className={mode === "join" ? "active" : ""}
              onClick={() => setMode("join")}
            >
              部屋に参加
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "create"}
              className={mode === "create" ? "active" : ""}
              onClick={() => setMode("create")}
            >
              教員として作成
            </button>
          </div>

          <form onSubmit={submit} className="entry-form">
            <div className="entry-heading">
              <span className="step-chip">{mode === "join" ? "JOIN" : "CREATE"}</span>
              <div>
                <h2>{mode === "join" ? "実験ルームに入る" : "新しい授業を始める"}</h2>
                <p>{mode === "join" ? "教員から共有されたコードを入力します。" : "30日間有効な実験ルームを作成します。"}</p>
              </div>
            </div>

            {mode === "join" ? (
              <>
                <label>
                  部屋コード
                  <input
                    className="code-input"
                    autoComplete="one-time-code"
                    inputMode="text"
                    maxLength={6}
                    placeholder="A7K9QP"
                    value={roomCode}
                    onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))}
                    required
                  />
                </label>
                <label>
                  表示名（ニックネーム・座席番号）
                  <input
                    autoComplete="name"
                    maxLength={32}
                    placeholder="例：A-12 / やまなし"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  授業名
                  <input
                    maxLength={80}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                  />
                </label>
                <label>
                  定員
                  <select value={capacity} onChange={(event) => setCapacity(Number(event.target.value))}>
                    {[5, 6, 7, 8].map((value) => <option key={value} value={value}>{value}名</option>)}
                  </select>
                </label>
              </>
            )}

            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button entry-submit" disabled={busy}>
              {busy ? "接続しています…" : mode === "join" ? "部屋に入る →" : "ルームを作成 →"}
            </button>
            <p className="privacy-note">個人アカウント不要。氏名やメールアドレスは収集しません。</p>
          </form>
        </div>
      </section>

      <section className="flow-showcase" aria-labelledby="flow-title">
        <div className="section-kicker">VIRTUAL NETWORK TOPOLOGY</div>
        <div className="flow-title-row">
          <div>
            <h2 id="flow-title">見える情報が違うから、相談が始まる。</h2>
            <p>各担当には、その機器が本当に参照する層・ヘッダ・表だけを表示します。</p>
          </div>
          <span className="live-pill"><i /> REAL-TIME SYNC</span>
        </div>
        <div className="landing-network" aria-label="PCからサーバまでの仮想ネットワーク">
          {flowNodes.map((node, index) => (
            <div className="landing-node-wrap" key={node.id}>
              <div className={`landing-node tone-${node.tone}`}>
                <span className="node-number">0{index + 1}</span>
                <b>{node.label}</b>
                <small>{node.sub}</small>
              </div>
              {index < flowNodes.length - 1 && (
                <div className="packet-link" aria-hidden="true"><i /></div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="principles-grid" aria-label="学びの特徴">
        <article>
          <span>01</span>
          <h3>判断して転送</h3>
          <p>正解ボタンではなく、次ホップ・出力ポート・応答内容と、その根拠を選びます。</p>
        </article>
        <article>
          <span>02</span>
          <h3>失敗から診断</h3>
          <p>ping・名前解決・経路追跡で、最初の正常地点と失敗地点を切り分けます。</p>
        </article>
        <article>
          <span>03</span>
          <h3>履歴から説明</h3>
          <p>各ホップで変化したヘッダと判断を振り返り、高校生向けの説明へ変換します。</p>
        </article>
      </section>

      <footer className="landing-footer">
        <span>Network Room Lab / NRL-SD-001</span>
        <span>Educational network simulation — 実ネットワークへの通信・スキャンは行いません</span>
      </footer>
    </main>
  );
}
