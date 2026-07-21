import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  FAULT_DEFINITIONS,
  PHASE_DEFINITIONS,
  PROTOCOL_STEPS,
  REFLECTION_PROMPTS,
  ROLE_DEFINITIONS,
  phaseDefinition,
  roleDefinition,
} from "../../shared/scenario";
import type {
  ClientAction,
  DiagnosticTool,
  InterfaceConfig,
  ParticipantPublic,
  RoomSnapshot,
  TopologyLink,
} from "../../shared/types";
import { downloadRoomExport } from "../api";
import type { AppSession } from "../session";
import { useRoom } from "../useRoom";

interface RoomPageProps {
  session: AppSession;
  onLeave: () => void;
}

interface SharedPanelProps {
  snapshot: RoomSnapshot;
  busy: boolean;
  act: (action: ClientAction) => Promise<void>;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function Brand() {
  return (
    <span className="brand room-brand">
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
      <span className="brand-copy">
        <span className="brand-title"><b>Network Room</b><small>LAB</small></span>
        <span className="brand-credit">Created by Dit-Lab,（Daiki ITO）</span>
      </span>
    </span>
  );
}

function PhaseStepper({ snapshot }: { snapshot: RoomSnapshot }) {
  const currentIndex = phaseDefinition(snapshot.room.phase).index;
  return (
    <nav className="phase-stepper" aria-label="学習フェーズ">
      {PHASE_DEFINITIONS.map((phase) => {
        const state = phase.index < currentIndex ? "done" : phase.index === currentIndex ? "current" : "future";
        return (
          <div key={phase.id} className={`phase-step ${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span>{state === "done" ? "✓" : phase.index}</span>
            <div><b>{phase.shortLabel}</b><small>{phase.label}</small></div>
          </div>
        );
      })}
    </nav>
  );
}

function DeviceNode({
  id,
  label,
  role,
  address,
  active,
  faulted,
}: {
  id: string;
  label: string;
  role: ParticipantPublic["role"] | null;
  address?: string;
  active: boolean;
  faulted: boolean;
}) {
  const definition = role ? roleDefinition(role) : null;
  return (
    <div
      className={`topology-device ${active ? "active" : ""} ${faulted ? "faulted" : ""}`}
      style={{ "--device-accent": definition?.accent ?? "#8da5b6" } as React.CSSProperties}
      data-device={id}
    >
      <span className="device-status" />
      <div className="device-glyph" aria-hidden="true">{id === "internet" ? "◎" : definition?.shortLabel.slice(0, 3) ?? "NET"}</div>
      <b>{label}</b>
      <small>{address ?? definition?.observes[0] ?? "複数経路"}</small>
      {active && <em>PACKET</em>}
      {faulted && <em className="fault-tag">FAULT</em>}
    </div>
  );
}

function LinkControl({ link, canEdit, busy, act }: { link: TopologyLink; canEdit: boolean; busy: boolean; act: SharedPanelProps["act"] }) {
  return (
    <button
      className={`topology-link ${link.up ? "up" : "down"}`}
      type="button"
      aria-label={`${link.from}と${link.to}の${link.medium}接続。現在${link.up ? "接続" : "切断"}`}
      title={canEdit ? "クリックで接続状態を切り替え" : link.medium}
      disabled={!canEdit || busy}
      onClick={() => void act({ type: "TOGGLE_LINK", linkId: link.id })}
    >
      <i /><span>{link.medium}</span>
    </button>
  );
}

function TopologyPanel({ snapshot, busy, act }: SharedPanelProps) {
  const room = snapshot.room;
  const currentStep = PROTOCOL_STEPS[room.protocolIndex];
  const editableRole = snapshot.viewer.role && ["ACCESS_POINT", "L2_SWITCH", "ROUTER"].includes(snapshot.viewer.role);
  const canEdit = snapshot.viewer.kind === "teacher" || (room.phase === "TOPOLOGY" && Boolean(editableRole));
  const link = (id: string) => room.links.find((candidate) => candidate.id === id)!;
  const device = (id: string) => room.devices.find((candidate) => candidate.id === id)!;
  const faulted = (id: string) => room.activeFaults.some((fault) => fault.target === id || fault.target.includes(id));

  return (
    <section className="panel topology-panel" aria-labelledby="topology-title">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">通信が通る道</p>
          <h2 id="topology-title">ネットワークの全体図</h2>
        </div>
        <div className="topology-legend"><span><i className="packet-dot" />現在地</span><span><i className="link-dot" />接続中</span></div>
      </div>

      <div className="topology-canvas">
        <div className="topology-mainline">
          <DeviceNode {...device("pc")} active={currentStep?.nodeId === "pc"} faulted={faulted("pc")} />
          <LinkControl link={link("pc-ap")} canEdit={canEdit} busy={busy} act={act} />
          <DeviceNode {...device("ap")} active={currentStep?.nodeId === "ap"} faulted={faulted("ap")} />
          <LinkControl link={link("ap-switch")} canEdit={canEdit} busy={busy} act={act} />
          <DeviceNode {...device("switch")} active={currentStep?.nodeId === "switch"} faulted={faulted("switch")} />
          <LinkControl link={link("switch-router")} canEdit={canEdit} busy={busy} act={act} />
          <DeviceNode {...device("router")} active={currentStep?.nodeId === "router"} faulted={faulted("router")} />
          <LinkControl link={link("router-internet")} canEdit={canEdit} busy={busy} act={act} />
          <DeviceNode {...device("internet")} active={currentStep?.nodeId === "internet"} faulted={false} />
          <div className="server-branch">
            <div>
              <LinkControl link={link("internet-dns")} canEdit={canEdit} busy={busy} act={act} />
              <DeviceNode {...device("dns")} active={currentStep?.nodeId === "dns"} faulted={faulted("dns")} />
            </div>
            <div>
              <LinkControl link={link("internet-web")} canEdit={canEdit} busy={busy} act={act} />
              <DeviceNode {...device("web")} active={currentStep?.nodeId === "web"} faulted={faulted("web")} />
            </div>
          </div>
        </div>
      </div>

      {room.observedSymptoms.length > 0 && snapshot.viewer.kind === "participant" && (
        <div className="symptom-banner" role="status">
          <b>観察された症状</b>
          <span>{room.observedSymptoms.join(" / ")}</span>
        </div>
      )}
    </section>
  );
}

function AddressingMission({ snapshot, busy, act }: SharedPanelProps) {
  const [config, setConfig] = useState<InterfaceConfig>(snapshot.room.interfaceConfig);
  useEffect(() => setConfig(snapshot.room.interfaceConfig), [snapshot.room.interfaceConfig]);
  const canEdit = snapshot.viewer.kind === "teacher" || snapshot.viewer.role === "CLIENT_PC";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void act({ type: "CONFIGURE_INTERFACE", ...config });
  };

  return (
    <form className="address-form" onSubmit={submit}>
      <div className="mission-callout">
        <span>やること</span>
        <p>PCが外のネットワークへデータを送れるように、4つの設定を順番に確認します。</p>
      </div>
      <div className="field-grid">
        <label>PCのIPアドレス<input value={config.address} disabled={!canEdit} onChange={(event) => setConfig({ ...config, address: event.target.value })} /></label>
        <label>範囲（/ の後ろ）<input type="number" min={1} max={30} value={config.prefix} disabled={!canEdit} onChange={(event) => setConfig({ ...config, prefix: Number(event.target.value) })} /></label>
        <label>出口となるルータ<input value={config.gateway} disabled={!canEdit} onChange={(event) => setConfig({ ...config, gateway: event.target.value })} /></label>
        <label>名前を調べるDNS<input value={config.dns} disabled={!canEdit} onChange={(event) => setConfig({ ...config, dns: event.target.value })} /></label>
      </div>
      <div className="subnet-check"><span>PC network</span><b>192.168.10.0/24</b><span>GW</span><b>192.168.10.1</b></div>
      {canEdit ? <button className="primary-button" disabled={busy}>設定を保存</button> : <p className="waiting-note">PC担当の設定を観察しています。</p>}
    </form>
  );
}

function ProtocolMission({ snapshot, busy, act }: SharedPanelProps) {
  const [decision, setDecision] = useState("");
  const step = PROTOCOL_STEPS[snapshot.room.protocolIndex];
  const complete = snapshot.room.protocolIndex >= PROTOCOL_STEPS.length;
  const canAdvance =
    !complete &&
    (snapshot.viewer.kind === "teacher" || snapshot.viewer.role === step?.actorRole);

  useEffect(() => setDecision(step ? `${step.description}` : ""), [step?.id]);

  if (complete) {
    return (
      <div className="mission-complete">
        <span>✓</span><h3>Webページが表示されました</h3>
        <p>ARP・DNS・TCP・TLS・HTTPが連動し、全17ステップを完了しました。</p>
        {snapshot.viewer.kind === "teacher" && <button className="secondary-button" disabled={busy} onClick={() => void act({ type: "RESET_PROTOCOL" })}>最初から再生</button>}
      </div>
    );
  }

  const activeStep = step!;

  return (
    <div className="protocol-mission">
      <div className="protocol-breadcrumb">
        {(["ARP", "DNS", "TCP", "TLS", "HTTPS"] as const).map((protocol) => (
          <span key={protocol} className={activeStep.protocol === protocol ? "active" : ""}>{protocol}</span>
        ))}
      </div>
      <div className="step-counter"><span>STEP {String(activeStep.index + 1).padStart(2, "0")}</span><b>{activeStep.title}</b></div>
      <p>{activeStep.description}</p>
      <div className="actor-line">
        <span style={{ background: roleDefinition(activeStep.actorRole).accent }} />
        次の担当: <b>{roleDefinition(activeStep.actorRole).label}</b>
        {snapshot.viewer.role === activeStep.actorRole && <em>あなたの番です</em>}
      </div>
      <label className="decision-field">
        なぜこの操作をする？
        <textarea rows={3} value={decision} disabled={!canAdvance} placeholder="例：外のネットワークへ送るため、まず出口となるルータを確認します。" onChange={(event) => setDecision(event.target.value)} />
      </label>
      {canAdvance ? (
        <button className="primary-button packet-action" disabled={busy || decision.trim().length < 1} onClick={() => void act({ type: "ADVANCE_PROTOCOL", decision })}>
          この判断で次へ進む <span>→</span>
        </button>
      ) : (
        <p className="waiting-note"><i /> 今は{roleDefinition(activeStep.actorRole).label}の担当者が操作する番です。</p>
      )}
    </div>
  );
}

function DiagnosisMission({ snapshot, busy, act }: SharedPanelProps) {
  const [tool, setTool] = useState<DiagnosticTool>("PING");
  const [target, setTarget] = useState("class.yamanashi.example");
  const latest = snapshot.room.diagnostics.at(-1);
  return (
    <div className="diagnosis-mission">
      <div className="mission-callout warning"><span>調べ方</span><p>「どこまでは届くのか」を一つずつ確認すると、問題の場所を見つけやすくなります。</p></div>
      <div className="diagnostic-tools">
        {(["PING", "NSLOOKUP", "TRACEROUTE", "HTTPS"] as DiagnosticTool[]).map((value) => (
          <button type="button" className={tool === value ? "active" : ""} key={value} onClick={() => setTool(value)}>{value.toLowerCase()}</button>
        ))}
      </div>
      <label>調べたい相手<input value={target} onChange={(event) => setTarget(event.target.value)} /></label>
      <button className="primary-button" disabled={busy || !target.trim()} onClick={() => void act({ type: "RUN_DIAGNOSTIC", tool, target })}>この方法で調べる</button>
      {latest && (
        <div className={`terminal-card ${latest.success ? "success" : "failure"}`}>
          <div><span>●</span><span>●</span><span>●</span><b>{latest.tool.toLowerCase()} / {latest.success ? "SUCCESS" : "FAILED"}</b></div>
          <pre>{latest.output.join("\n")}</pre>
          <p><b>推論：</b>{latest.inference}</p>
        </div>
      )}
    </div>
  );
}

function ReflectionMission({ snapshot, busy, act }: SharedPanelProps) {
  const existing = useMemo(
    () => Object.fromEntries(snapshot.reflections.map((item) => [item.promptId, item.response])),
    [snapshot.reflections],
  );
  const [responses, setResponses] = useState<Record<string, string>>(existing);
  useEffect(() => setResponses(existing), [existing]);

  if (snapshot.viewer.kind === "teacher") {
    return (
      <div className="teacher-reflection-summary">
        <div className="mission-callout"><span>振り返り</span><p>学習者の回答は履歴CSVに含まれます。提出状況を確認して講評してください。</p></div>
        <div className="reflection-count"><b>{snapshot.reflections.length}</b><span>保存済み回答</span></div>
      </div>
    );
  }

  return (
    <div className="reflection-form">
      {REFLECTION_PROMPTS.map((prompt, index) => (
        <div className="reflection-item" key={prompt.id}>
          <span>0{index + 1}</span>
          <label>{prompt.label}
            <textarea
              rows={4}
              value={responses[prompt.id] ?? ""}
              onChange={(event) => setResponses({ ...responses, [prompt.id]: event.target.value })}
              placeholder="観察したイベントや判断を根拠に書きます…"
            />
          </label>
          <button
            className="secondary-button"
            disabled={busy || (responses[prompt.id]?.trim().length ?? 0) < 10}
            onClick={() => void act({ type: "SUBMIT_REFLECTION", promptId: prompt.id, text: responses[prompt.id] ?? "" })}
          >保存</button>
        </div>
      ))}
    </div>
  );
}

function MissionPanel({ snapshot, busy, act }: SharedPanelProps) {
  const phase = phaseDefinition(snapshot.room.phase);
  const role = snapshot.viewer.role ? roleDefinition(snapshot.viewer.role) : null;
  let content: React.ReactNode;

  if (snapshot.room.phase === "LOBBY") {
    content = <div className="lobby-mission"><div className="radar" aria-hidden="true"><i /><i /><i /></div><h3>チームがそろうのを待っています</h3><p>先生から聞いた部屋コード <b>{snapshot.room.code}</b> を入力して参加します。</p><span>{snapshot.room.participants.length} / {snapshot.room.capacity} 人が参加中</span></div>;
  } else if (snapshot.room.phase === "ROLES") {
    content = role ? (
      <div className="role-mission" style={{ "--role-accent": role.accent } as React.CSSProperties}>
        <span className="role-id">あなたの担当 / {role.shortLabel.toUpperCase()}</span>
        <h3>{role.label}</h3><p>{role.description}</p>
        <h4>この担当で確認できる情報</h4><div className="tag-list">{role.observes.map((item) => <span key={item}>{item}</span>)}</div>
      </div>
    ) : <p>教員モードです。参加者へ役割を割り当ててください。</p>;
  } else if (snapshot.room.phase === "TOPOLOGY") {
    content = <div className="topology-mission"><div className="mission-callout"><span>やること</span><p>機器をつなぐ線を確認します。緑は「つながっている」、赤は「切れている」という意味です。</p></div><ul>{snapshot.room.links.map((link) => <li key={link.id}><span className={link.up ? "ok" : "ng"}>{link.up ? "接続中" : "切断"}</span><b>{link.from} → {link.to}</b><small>{link.medium}</small></li>)}</ul></div>;
  } else if (snapshot.room.phase === "ADDRESSING") {
    content = <AddressingMission snapshot={snapshot} busy={busy} act={act} />;
  } else if (snapshot.room.phase === "PROTOCOL") {
    content = <ProtocolMission snapshot={snapshot} busy={busy} act={act} />;
  } else if (snapshot.room.phase === "DIAGNOSIS") {
    content = <DiagnosisMission snapshot={snapshot} busy={busy} act={act} />;
  } else {
    content = <ReflectionMission snapshot={snapshot} busy={busy} act={act} />;
  }

  return (
    <section className="panel mission-panel" aria-labelledby="mission-title">
      <div className="panel-heading"><div><p className="panel-kicker">いま取り組むこと</p><h2 id="mission-title">{phase.label}</h2></div><span className="phase-number">ステップ {phase.index + 1}</span></div>
      <p className="phase-instruction">{phase.instruction}</p>
      {content}
    </section>
  );
}

function PacketInspector({ snapshot }: { snapshot: RoomSnapshot }) {
  const index = snapshot.room.protocolIndex;
  const step = PROTOCOL_STEPS[Math.min(index, PROTOCOL_STEPS.length - 1)]!;
  const complete = index >= PROTOCOL_STEPS.length;
  const role = snapshot.viewer.role;
  const layers = step.layers.filter((layer) => snapshot.viewer.kind === "teacher" || role === "OBSERVER" || (role && layer.visibleTo.includes(role)));

  return (
    <section className="panel packet-panel" aria-labelledby="packet-title">
      <div className="panel-heading"><div><p className="panel-kicker">流れているデータ</p><h2 id="packet-title">パケットの中身</h2></div><span className={`packet-state ${complete ? "complete" : "moving"}`}>{complete ? "到着" : "通信中"}</span></div>
      <p className="beginner-glossary"><b>パケットとは？</b> ネットワークを流れる、小さく分けられたデータのまとまりです。</p>
      <div className="packet-meta"><span>ID</span><b>pkt_web_001</b><span>FLOW</span><b>{step.protocol}</b></div>
      <div className="packet-layers">
        {layers.map((layer, layerIndex) => (
          <div className={`packet-layer layer-${layer.id}`} key={layer.id}>
            <span>0{layerIndex + 1}</span><div><small>{layer.label}</small><b>{layer.value}</b></div>
          </div>
        ))}
      </div>
      <div className="packet-progress"><div><span>通信シーケンス</span><b>{Math.min(index, PROTOCOL_STEPS.length)} / {PROTOCOL_STEPS.length}</b></div><progress max={PROTOCOL_STEPS.length} value={index} /></div>
      <p className="model-note"><b>学習用モデル</b> まず全体の流れをつかめるよう、細かな処理は省略しています。</p>
    </section>
  );
}

function ParticipantsPanel({ snapshot }: { snapshot: RoomSnapshot }) {
  return (
    <section className="panel participants-panel" aria-labelledby="participants-title">
      <div className="panel-heading"><div><p className="panel-kicker">一緒に学ぶ仲間</p><h2 id="participants-title">チームメンバーと担当</h2></div><span>{snapshot.room.participants.filter((item) => item.connectionState === "online").length} 人が接続中</span></div>
      <div className="participant-list">
        {snapshot.room.participants.map((participant) => {
          const role = roleDefinition(participant.role);
          return <div className="participant" key={participant.id}><span className={`presence ${participant.connectionState}`} /><div className="avatar" style={{ background: role.accent }}>{participant.displayName.slice(0, 1).toUpperCase()}</div><div><b>{participant.displayName}</b><small>{role.label}</small></div><em>{role.shortLabel}</em></div>;
        })}
        {snapshot.room.participants.length === 0 && <p className="empty-state">まだ参加者はいません。部屋コードを伝えて、参加を待ちましょう。</p>}
      </div>
    </section>
  );
}

function EventPanel({ snapshot }: { snapshot: RoomSnapshot }) {
  const events = snapshot.room.latestEvents.slice(-12).reverse();
  return (
    <section className="panel events-panel" aria-labelledby="events-title">
      <div className="panel-heading"><div><p className="panel-kicker">これまでの操作</p><h2 id="events-title">チームの活動履歴</h2></div><span>更新 {snapshot.room.version}</span></div>
      <div className="event-list">
        {events.map((event) => <div className="event-row" key={event.id}><time>{formatTime(event.createdAt)}</time><i /><div><b>{event.summary}</b><small>{event.type} · event #{event.id}</small></div></div>)}
      </div>
    </section>
  );
}

function TeacherPanel({ snapshot, busy, act, session }: SharedPanelProps & { session: AppSession }) {
  const [message, setMessage] = useState(snapshot.room.teacherMessage);
  const [exporting, setExporting] = useState(false);
  useEffect(() => setMessage(snapshot.room.teacherMessage), [snapshot.room.teacherMessage]);

  const exportData = async () => {
    setExporting(true);
    try { await downloadRoomExport(session.code, session.token); } finally { setExporting(false); }
  };

  return (
    <section className="panel teacher-panel" aria-labelledby="teacher-title">
      <div className="panel-heading"><div><p className="panel-kicker">先生用メニュー</p><h2 id="teacher-title">授業の進行とサポート</h2></div><button className="secondary-button" disabled={exporting} onClick={() => void exportData()}>{exporting ? "出力中…" : "記録をCSVで保存"}</button></div>
      <div className="teacher-grid">
        <div>
          <h3>フェーズ</h3>
          <div className="teacher-phase-buttons">{PHASE_DEFINITIONS.map((phase) => <button type="button" key={phase.id} className={snapshot.room.phase === phase.id ? "active" : ""} disabled={busy} onClick={() => void act({ type: "CHANGE_PHASE", phase: phase.id })}><span>{phase.index}</span>{phase.shortLabel}</button>)}</div>
          <label className="teacher-message">チームへの指示<div><input maxLength={240} value={message} onChange={(event) => setMessage(event.target.value)} /><button disabled={busy || !message.trim()} onClick={() => void act({ type: "TEACHER_MESSAGE", text: message })}>送信</button></div></label>
        </div>
        <div>
          <h3>役割割当</h3>
          <div className="role-assignments">{snapshot.room.participants.map((participant) => <label key={participant.id}><span>{participant.displayName}</span><select value={participant.role} disabled={busy} onChange={(event) => void act({ type: "ASSIGN_ROLE", participantId: participant.id, role: event.target.value as ParticipantPublic["role"] })}>{ROLE_DEFINITIONS.map((role) => <option value={role.id} key={role.id}>{role.label}</option>)}</select></label>)}</div>
        </div>
        <div>
          <h3>障害注入</h3>
          <div className="fault-controls">{FAULT_DEFINITIONS.map((fault) => { const active = snapshot.room.activeFaults.some((item) => item.type === fault.type); return <button key={fault.type} type="button" className={active ? "active" : ""} disabled={busy} title={fault.hint} onClick={() => void act(active ? { type: "CLEAR_FAULT", faultType: fault.type } : { type: "INJECT_FAULT", faultType: fault.type })}><span>{active ? "×" : "+"}</span>{fault.label}</button>; })}</div>
          {snapshot.room.activeFaults.length > 0 && <button className="clear-faults" disabled={busy} onClick={() => void act({ type: "CLEAR_FAULT" })}>すべて修復</button>}
        </div>
      </div>
    </section>
  );
}

export function RoomPage({ session, onLeave }: RoomPageProps) {
  const { snapshot, connectionStatus, error, busy, act, dismissError } = useRoom(session);
  const [copied, setCopied] = useState(false);

  if (!snapshot) {
    return <div className="loading-screen"><Brand /><div className="loader"><i /><i /><i /></div><p>{error ?? "実験ルームへ接続しています…"}</p>{error && <button className="secondary-button" onClick={onLeave}>トップへ戻る</button>}</div>;
  }

  const copyCode = async () => {
    await navigator.clipboard.writeText(snapshot.room.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  const currentPhase = phaseDefinition(snapshot.room.phase);
  const viewerRole = snapshot.viewer.role ? roleDefinition(snapshot.viewer.role) : null;

  return (
    <div className="room-shell">
      <header className="room-header">
        <Brand />
        <div className="room-heading"><div><small>{snapshot.viewer.kind === "teacher" ? "INSTRUCTOR ROOM" : "TEAM ROOM"}</small><h1>{snapshot.room.title}</h1></div><button className="room-code" onClick={() => void copyCode()}><span>ROOM CODE</span><b>{snapshot.room.code}</b><em>{copied ? "コピー済み" : "COPY"}</em></button></div>
        <div className="room-user"><span className={`connection-badge ${connectionStatus}`}><i />{connectionStatus === "online" ? "同期中" : connectionStatus === "connecting" ? "接続中" : "再接続中"}</span><div><b>{snapshot.viewer.displayName}</b><small>{snapshot.viewer.kind === "teacher" ? "担当教員" : roleDefinition(snapshot.viewer.role ?? "OBSERVER").label}</small></div><button onClick={onLeave} aria-label="部屋から退出">退出</button></div>
      </header>

      <div className="teacher-message-banner"><span>先生からの案内</span><p>{snapshot.room.teacherMessage}</p></div>
      <PhaseStepper snapshot={snapshot} />
      <section className="beginner-guide" aria-label="現在の学習ガイド">
        <span className="guide-number" aria-hidden="true">{currentPhase.index + 1}</span>
        <div className="guide-task">
          <small>いまやること</small>
          <b>{currentPhase.instruction}</b>
        </div>
        <div className="guide-role">
          <small>{snapshot.viewer.kind === "teacher" ? "利用モード" : "あなたの担当"}</small>
          <b>{snapshot.viewer.kind === "teacher" ? "先生として進行" : viewerRole?.label ?? "観察者"}</b>
        </div>
      </section>
      {error && <div className="room-error" role="alert"><span>!</span>{error}<button onClick={dismissError}>閉じる</button></div>}

      <main className="room-grid">
        <TopologyPanel snapshot={snapshot} busy={busy} act={act} />
        <MissionPanel snapshot={snapshot} busy={busy} act={act} />
        <PacketInspector snapshot={snapshot} />
        <ParticipantsPanel snapshot={snapshot} />
        <EventPanel snapshot={snapshot} />
        {snapshot.viewer.kind === "teacher" && <TeacherPanel snapshot={snapshot} busy={busy} act={act} session={session} />}
      </main>

      <footer className="room-footer"><span>Network Room Lab · Created by Dit-Lab,（Daiki ITO）</span><span>学習用ネットワークシミュレーション <i className={connectionStatus} /></span></footer>
    </div>
  );
}
