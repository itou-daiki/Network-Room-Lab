import { FormEvent, useState } from "react";

import { LEARNING_SCENARIO_GOAL } from "../../shared/scenario";
import { createRoom, joinRoom } from "../api";
import type { AppSession } from "../session";

interface HomePageProps {
  onEnterRoom: (session: AppSession) => void;
}

type EntryMode = "join" | "solo" | "create";

const flowNodes = [
  { id: "pc", label: "PC", sub: "URLを入力して出発", tone: "blue" },
  { id: "ap", label: "無線AP", sub: "Wi-Fiから有線LANへ", tone: "mint" },
  { id: "l2", label: "L2スイッチ", sub: "次の差込口を選ぶ", tone: "violet" },
  { id: "router", label: "ルータ", sub: "PCの出口（ゲートウェイ）", tone: "amber" },
  { id: "server", label: "DNS・Webサーバ", sub: "IPを答え、ページを返す", tone: "rose" },
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
        const room = await createRoom({ title, capacity, scenario: "STANDARD_WEB_ACCESS", learningMode: "CLASSROOM" });
        onEnterRoom({ code: room.code, token: room.teacherToken, mode: "teacher" });
      } else if (mode === "solo") {
        const room = await createRoom({
          title: "ひとりで学ぶネットワーク",
          capacity: 1,
          scenario: "STANDARD_WEB_ACCESS",
          learningMode: "SOLO",
          displayName,
        });
        if (!room.participantToken) throw new Error("ひとり学習を開始できませんでした。もう一度お試しください。");
        onEnterRoom({ code: room.code, token: room.participantToken, mode: "participant" });
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
    <main className="landing-shell bg-dodger-50 text-slate-900">
      <nav className="landing-nav" aria-label="メインナビゲーション">
        <a className="brand" href="/" aria-label="Network Room Lab トップ">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="brand-copy">
            <span className="brand-title">
              <b>Network Room</b>
              <small>LAB</small>
            </span>
            <span className="brand-credit">Created by Dit-Lab,（Daiki ITO）</span>
          </span>
        </a>
        <div className="nav-context">
          <span className="status-dot" />
          はじめてのネットワーク学習
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow"><span>●</span> はじめてでも安心のネットワーク体験</p>
          <h1>
            通信のしくみを、<br />
            <span>ひとりでも、チームでも。</span>
          </h1>
          <p className="hero-lead">
            今回のゴールは「{LEARNING_SCENARIO_GOAL.title}」ことです。
            むずかしい設定を暗記せず、ページが表示されるまでの6つの機器の仕事を順番に確かめます。
          </p>
          <div className="beginner-promise" role="note" aria-label="初めて利用する方へ">
            <span aria-hidden="true">✓</span>
            <div><b>初めてでも大丈夫です</b><p>分からない言葉は画面の中で説明します。失敗しても、何度でもやり直せます。</p></div>
          </div>
          <div className="hero-facts" aria-label="利用想定">
            <div><b>1</b><span>案内を読む</span></div>
            <div><b>2</b><span>役割を体験する</span></div>
            <div><b>3</b><span>操作して確かめる</span></div>
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
              授業に参加
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "solo"}
              className={mode === "solo" ? "active" : ""}
              onClick={() => setMode("solo")}
            >
              ひとりで学ぶ
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "create"}
              className={mode === "create" ? "active" : ""}
              onClick={() => setMode("create")}
            >
              先生用
            </button>
          </div>

          <form onSubmit={submit} className="entry-form">
            <div className="entry-heading">
              <span className="step-chip">{mode === "join" ? "参加" : mode === "solo" ? "ひとり学習" : "作成"}</span>
              <div>
                <h2>{mode === "join" ? "授業の部屋に入る" : mode === "solo" ? "自分のペースで始める" : "新しい授業を始める"}</h2>
                <p>{mode === "join" ? "先生から教えてもらった6文字のコードを入力します。" : mode === "solo" ? "特定のWebサイトを表示するまで、6つの機器の仕事を一人で順番に体験します。" : "授業名と人数を決めて部屋を作ります。"}</p>
              </div>
            </div>

            {mode === "join" && (
              <ol className="join-steps" aria-label="参加までの手順">
                <li><span>1</span>部屋コードを入力</li>
                <li><span>2</span>表示名を入力</li>
                <li><span>3</span>参加ボタンを押す</li>
              </ol>
            )}

            {mode === "solo" && (
              <div className="solo-intro" role="note">
                <b>先生や部屋コードは不要です</b>
                <span>画面が次の操作を案内します。途中で失敗しても、何度でもやり直せます。</span>
              </div>
            )}

            {mode === "join" ? (
              <>
                <label>
                  部屋コード（6文字）
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
                  あなたの表示名
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
            ) : mode === "solo" ? (
              <label>
                あなたの表示名
                <input
                  autoComplete="name"
                  maxLength={32}
                  placeholder="例：やまなし"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                />
              </label>
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
              {busy ? "接続しています…" : mode === "join" ? "この部屋に参加する" : mode === "solo" ? "ひとり学習を始める" : "授業の部屋を作る"}
            </button>
            <p className="privacy-note">個人アカウントは不要です。入力した表示名は、この学習画面の中だけで使用します。</p>
          </form>
        </div>
      </section>

      <section className="flow-showcase" aria-labelledby="flow-title">
        <div className="section-kicker">みんなでつなぐ通信の道</div>
        <div className="flow-title-row">
          <div>
            <h2 id="flow-title">教材ページを表示するために、データを次の機器へ渡します。</h2>
            <p>一人で6つの機器を順番に担当することも、仲間と分担することもできます。</p>
          </div>
          <span className="live-pill"><i /> みんなの画面が同時に更新</span>
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
          <h3>まずは「見る」</h3>
          <p>自分の担当機器に届いた情報を、やさしい説明と図で確認します。</p>
        </article>
        <article>
          <span>02</span>
          <h3>役割を変えて「考える」</h3>
          <p>ひとりなら全機器を順番に、授業なら仲間と情報を持ち寄って考えます。</p>
        </article>
        <article>
          <span>03</span>
          <h3>操作して「確かめる」</h3>
          <p>失敗しても大丈夫。診断ツールと操作履歴を使って、理由を一緒に見つけます。</p>
        </article>
      </section>

      <footer className="landing-footer">
        <span>Network Room Lab / NRL-SD-001</span>
        <span>学習用のネットワークシミュレーションです。実際の外部ネットワークへの通信や調査は行いません。</span>
      </footer>
    </main>
  );
}
