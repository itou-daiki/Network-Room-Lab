import { FormEvent, useState } from "react";

import {
  MAX_CLASSROOM_BATCH_SIZE,
  MAX_CLASSROOM_GROUP_SIZE,
  MIN_CLASSROOM_GROUP_SIZE,
  buildClassroomRoomRequests,
} from "../../shared/classroom";
import { LEARNING_SCENARIO_GOAL } from "../../shared/scenario";
import { createRoom, joinRoom } from "../api";
import type { AppSession } from "../session";

interface HomePageProps {
  onEnterRoom: (session: AppSession) => void;
}

type EntryMode = "join" | "solo" | "create";

interface CreatedTeacherRoom {
  code: string;
  teacherToken: string;
  title: string;
  capacity: number;
  expiresAt: string;
}

const CREATED_ROOMS_STORAGE_KEY = "network-room-lab.teacher-rooms.v1";

function readCreatedTeacherRooms(): CreatedTeacherRoom[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(CREATED_ROOMS_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CreatedTeacherRoom => Boolean(
      item &&
      typeof item === "object" &&
      "code" in item && typeof item.code === "string" &&
      "teacherToken" in item && typeof item.teacherToken === "string" &&
      "title" in item && typeof item.title === "string" &&
      "capacity" in item && typeof item.capacity === "number" &&
      "expiresAt" in item && typeof item.expiresAt === "string",
    )).slice(0, MAX_CLASSROOM_BATCH_SIZE);
  } catch {
    window.localStorage.removeItem(CREATED_ROOMS_STORAGE_KEY);
    return [];
  }
}

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
  const [roomCount, setRoomCount] = useState(10);
  const [createdRooms, setCreatedRooms] = useState<CreatedTeacherRoom[]>(readCreatedTeacherRooms);
  const [showCreationForm, setShowCreationForm] = useState(false);
  const [createProgress, setCreateProgress] = useState(0);
  const [copiedRoom, setCopiedRoom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "create") {
        const requests = buildClassroomRoomRequests(title, roomCount, capacity);
        const rooms: CreatedTeacherRoom[] = [];
        setCreateProgress(0);
        for (const [index, request] of requests.entries()) {
          try {
            const room = await createRoom(request);
            rooms.push({
              code: room.code,
              teacherToken: room.teacherToken,
              title: request.title,
              capacity: request.capacity,
              expiresAt: room.expiresAt,
            });
            setCreateProgress(index + 1);
          } catch (caught) {
            if (rooms.length > 0) {
              setCreatedRooms(rooms);
              window.localStorage.setItem(CREATED_ROOMS_STORAGE_KEY, JSON.stringify(rooms));
              setShowCreationForm(false);
              const reason = caught instanceof Error ? caught.message : "通信エラーが発生しました。";
              throw new Error(`${rooms.length}部屋は作成できましたが、${index + 1}部屋目で停止しました。作成済みのコードは下に残しています。もう一度作る場合は「別の部屋を作る」を押してください。（${reason}）`);
            }
            throw caught;
          }
        }
        setCreatedRooms(rooms);
        window.localStorage.setItem(CREATED_ROOMS_STORAGE_KEY, JSON.stringify(rooms));
        setShowCreationForm(false);
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

  const copyRoomCodes = async () => {
    const text = createdRooms.map((room) => `${room.title}：${room.code}（生徒の参加上限${room.capacity}人）`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopiedRoom("ALL");
    window.setTimeout(() => setCopiedRoom(null), 1600);
  };

  const copyRoomCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedRoom(code);
    window.setTimeout(() => setCopiedRoom(null), 1600);
  };

  const showingCreatedRooms = mode === "create" && createdRooms.length > 0 && !showCreationForm;

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
            <span className="hero-title-line">通信のしくみを、</span>
            <span className="hero-title-line hero-title-accent">ひとりでも、</span>
            <span className="hero-title-line hero-title-accent">チームでも。</span>
          </h1>
          <p className="hero-lead">
            今回のゴールは「{LEARNING_SCENARIO_GOAL.title}」ことです。
            むずかしい設定を暗記せず、ページが表示されるまでの6つの機器の仕事を順番に確かめます。
          </p>
          <div className="beginner-promise" role="note" aria-label="初めて利用する方へ">
            <span aria-hidden="true">✓</span>
            <div><b>初めてでも大丈夫です</b><p>分からない言葉は画面の中で説明します。失敗しても、何度でもやり直せます。</p></div>
          </div>
          <section className="hero-facts" aria-labelledby="learning-flow-title">
            <p id="learning-flow-title">このアプリでの学び方</p>
            <ol>
              <li><span>1</span><div><b>案内を読む</b><small>画面に表示される「次にやること」を確認します。</small></div></li>
              <li><span>2</span><div><b>役割を体験する</b><small>PCやルータなどの機器になって考えます。</small></div></li>
              <li><span>3</span><div><b>操作して確かめる</b><small>選んだ操作の結果と、その理由を確認します。</small></div></li>
            </ol>
          </section>
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
                <h2>{mode === "join" ? "授業の部屋に入る" : mode === "solo" ? "自分のペースで始める" : showingCreatedRooms ? `${createdRooms.length}部屋を作成しました` : "班ごとの部屋を一括で作る"}</h2>
                <p>{mode === "join" ? "先生から教えてもらった6文字のコードを入力します。" : mode === "solo" ? "文部科学省の学習指導要領ページを表示するまで、6つの機器の仕事を一人で順番に体験します。" : showingCreatedRooms ? "班ごとに部屋コードを伝えます。先生は一覧から各部屋へ入れます。" : "1回の操作で1〜10部屋を作れます。各部屋は2〜6人の班で利用できます。"}</p>
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
            ) : showingCreatedRooms ? (
              <section className="created-rooms" aria-label="作成した授業部屋">
                <div className="created-rooms-guide" role="status">
                  <span>✓</span>
                  <div><b>参加者には6文字の部屋コードだけを伝えます</b><p>先生用の情報は、このブラウザーだけに保存しています。下の「先生として開く」から各班の進み具合を確認できます。</p></div>
                </div>
                <div className="created-rooms-actions">
                  <button type="button" className="primary-button" onClick={() => void copyRoomCodes()}>{copiedRoom === "ALL" ? "✓ コピーしました" : "全部屋のコードをまとめてコピー"}</button>
                  <button type="button" className="secondary-button" onClick={() => setShowCreationForm(true)}>別の部屋を作る</button>
                </div>
                <div className="created-room-list">
                  {createdRooms.map((room, index) => (
                    <article key={room.code}>
                      <span>{index + 1}班</span>
                      <div><small>{room.title}</small><b>{room.code}</b><em>生徒は最大 {room.capacity}人</em></div>
                      <div className="created-room-buttons">
                        <button type="button" onClick={() => void copyRoomCode(room.code)}>{copiedRoom === room.code ? "✓ コピー済み" : "コードをコピー"}</button>
                        <button type="button" onClick={() => onEnterRoom({ code: room.code, token: room.teacherToken, mode: "teacher" })}>先生として開く →</button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : (
              <>
                {createdRooms.length > 0 && <button type="button" className="previous-room-list" onClick={() => setShowCreationForm(false)}>← 前回作成した{createdRooms.length}部屋の一覧へ戻る</button>}
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
                  作る部屋数
                  <select value={roomCount} onChange={(event) => setRoomCount(Number(event.target.value))}>
                    {Array.from({ length: MAX_CLASSROOM_BATCH_SIZE }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}部屋</option>)}
                  </select>
                  <small>例：10班なら10部屋を選びます。</small>
                </label>
                <label>
                  1部屋に参加できる生徒の上限
                  <select value={capacity} onChange={(event) => setCapacity(Number(event.target.value))}>
                    {Array.from({ length: MAX_CLASSROOM_GROUP_SIZE - MIN_CLASSROOM_GROUP_SIZE + 1 }, (_, index) => index + MIN_CLASSROOM_GROUP_SIZE).map((value) => <option key={value} value={value}>最大 {value}人</option>)}
                  </select>
                  <small>2〜5人の班では、担当者がいない機器の操作を班全員で行います。</small>
                </label>
                <div className="room-batch-summary"><span>作成予定</span><b>{roomCount}部屋 × 1部屋最大{capacity}人</b><small>生徒は全体で最大{roomCount * capacity}人まで参加できます（先生は含みません）</small></div>
              </>
            )}

            {error && <div className="form-error" role="alert">{error}</div>}
            {!showingCreatedRooms && <button className="primary-button entry-submit" disabled={busy}>
              {busy ? mode === "create" ? `${createProgress} / ${roomCount}部屋を作成中…` : "接続しています…" : mode === "join" ? "この部屋に参加する" : mode === "solo" ? "ひとり学習を始める" : `${roomCount}部屋を一括作成する`}
            </button>}
            <p className="privacy-note">個人アカウントは不要です。入力した表示名は、この学習画面の中だけで使用します。</p>
          </form>
        </div>
      </section>

      <section className="flow-showcase" aria-labelledby="flow-title">
        <div className="section-kicker">みんなでつなぐ通信の道</div>
        <div className="flow-title-row">
          <div>
            <h2 id="flow-title">学習指導要領ページを表示するために、データを次の機器へ渡します。</h2>
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
