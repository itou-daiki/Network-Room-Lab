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
import { PHASE_TERM_IDS } from "../../shared/glossary";
import { PRACTICE_TASKS, protocolDecisionChoices, protocolTermIds, type PracticeMilestone } from "../../shared/practice";
import { validateInterfaceConfig } from "../../shared/network";
import type {
  ClientAction,
  InterfaceConfig,
  ParticipantPublic,
  RoomSnapshot,
  TopologyLink,
} from "../../shared/types";
import { downloadRoomExport } from "../api";
import type { AppSession } from "../session";
import { useRoom } from "../useRoom";
import { ContextTerms, GlossaryPanel } from "./Glossary";
import { PracticeLab } from "./PracticeLab";

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

const PHASE_PRACTICE_REQUIREMENTS: Partial<Record<RoomSnapshot["room"]["phase"], PracticeMilestone[]>> = {
  TOPOLOGY: ["PING_GATEWAY"],
  ADDRESSING: ["IPCONFIG", "PING_GATEWAY"],
  PROTOCOL: ["ARP", "NSLOOKUP", "PING_WEB"],
  DIAGNOSIS: ["TRACEROUTE", "HTTPS"],
};

function SoloProgressControls({
  snapshot,
  busy,
  act,
  practiceCompleted,
}: SharedPanelProps & { practiceCompleted: ReadonlySet<PracticeMilestone> }) {
  const current = phaseDefinition(snapshot.room.phase);
  const previous = PHASE_DEFINITIONS.find((phase) => phase.index === current.index - 1 && phase.id !== "LOBBY");
  const next = PHASE_DEFINITIONS.find((phase) => phase.index === current.index + 1);
  const protocolIncomplete = snapshot.room.phase === "PROTOCOL" && snapshot.room.protocolIndex < PROTOCOL_STEPS.length;
  const topologyIncomplete = snapshot.room.phase === "TOPOLOGY" && snapshot.room.links.some((link) => !link.up);
  const requiredPractice = PHASE_PRACTICE_REQUIREMENTS[snapshot.room.phase] ?? [];
  const missingPractice = requiredPractice.filter((milestone) => !practiceCompleted.has(milestone));
  const practiceIncomplete = missingPractice.length > 0;
  const explanationIncomplete = requiredPractice.length > 0 && !snapshot.explanations.some((item) => item.participantId === snapshot.viewer.participantId && item.phase === snapshot.room.phase);
  const nextDisabled = protocolIncomplete || topologyIncomplete || practiceIncomplete || explanationIncomplete;
  const progressHint = protocolIncomplete
    ? "通信実験は17ステップを最後まで進めると、次へ移動できます。"
    : topologyIncomplete
      ? "切断を試した後は、すべての接続を元に戻してから進みます。"
      : practiceIncomplete
        ? `下の実践ワークベンチで「${missingPractice.map((milestone) => PRACTICE_TASKS.find((task) => task.id === milestone)?.label ?? milestone).join("」「")}」を実行します。`
        : explanationIncomplete
          ? "実行結果を観察し、「予想と比べて分かったこと」を10文字以上で説明します。"
          : undefined;

  return (
    <section className="solo-progress" aria-label="ひとり学習の進行">
      <div>
        <small>ひとり学習</small>
        <b>{next ? `説明と操作を確認したら「${next.label}」へ進みます。` : "振り返りを保存したら学習完了です。"}</b>
        {progressHint && <span>{progressHint}</span>}
      </div>
      <div className="solo-progress-actions">
        <button className="secondary-button" type="button" disabled={busy || !previous} onClick={() => previous && void act({ type: "CHANGE_PHASE", phase: previous.id })}>← 前へ</button>
        {next && <button className="primary-button" type="button" disabled={busy || nextDisabled} onClick={() => void act({ type: "CHANGE_PHASE", phase: next.id })}>次のステップへ →</button>}
      </div>
    </section>
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
  const canEdit = snapshot.viewer.kind === "teacher" || (room.phase === "TOPOLOGY" && (room.learningMode === "SOLO" || Boolean(editableRole)));
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
  const canEdit = snapshot.viewer.kind === "teacher" || snapshot.room.learningMode === "SOLO" || snapshot.viewer.role === "CLIENT_PC";
  const configErrors = validateInterfaceConfig(config);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void act({ type: "CONFIGURE_INTERFACE", ...config });
  };

  return (
    <form className="address-form" onSubmit={submit}>
      <div className="mission-callout">
        <span>設定実験</span>
        <p>値を変えると判定がどう変わるか試します。「別ネットワークのGWを試す」→理由を読む→推奨値へ戻す、の順で体験しましょう。</p>
      </div>
      <div className="field-grid">
        <label>PCのIPアドレス<input value={config.address} disabled={!canEdit} onChange={(event) => setConfig({ ...config, address: event.target.value })} /></label>
        <label>範囲（/ の後ろ）<input type="number" min={1} max={30} value={config.prefix} disabled={!canEdit} onChange={(event) => setConfig({ ...config, prefix: Number(event.target.value) })} /></label>
        <label>出口となるルータ<input value={config.gateway} disabled={!canEdit} onChange={(event) => setConfig({ ...config, gateway: event.target.value })} /></label>
        <label>名前を調べるDNS<input value={config.dns} disabled={!canEdit} onChange={(event) => setConfig({ ...config, dns: event.target.value })} /></label>
      </div>
      {canEdit && (
        <div className="address-experiment-actions">
          <button type="button" className="secondary-button" onClick={() => setConfig({ ...config, gateway: "192.168.20.1" })}>別ネットワークのGWを試す</button>
          <button type="button" className="secondary-button" onClick={() => setConfig({ address: "192.168.10.23", prefix: 24, gateway: "192.168.10.1", dns: "198.51.100.53" })}>推奨値へ戻す</button>
        </div>
      )}
      <div className={`config-feedback ${configErrors.length > 0 ? "failure" : "success"}`} role="status">
        <span>{configErrors.length > 0 ? "!" : "✓"}</span>
        <div><b>{configErrors.length > 0 ? "このままでは通信を始められません" : "IP設定の形式とネットワーク範囲は整っています"}</b>
          {configErrors.length > 0
            ? <ul>{configErrors.map((error) => <li key={error}>{error}</li>)}</ul>
            : <p>保存したら、下のターミナルで <code>ipconfig</code> と <code>ping 192.168.10.1</code> を実行して確かめます。</p>}
        </div>
      </div>
      <div className="subnet-check"><span>PC network</span><b>192.168.10.0/24</b><span>GW</span><b>192.168.10.1</b></div>
      <ContextTerms ids={PHASE_TERM_IDS.ADDRESSING ?? []} />
      {canEdit ? <button className="primary-button" disabled={busy || configErrors.length > 0}>この設定を保存してコマンドで確認</button> : <p className="waiting-note">PC担当の設定を観察しています。</p>}
    </form>
  );
}

function ProtocolMission({ snapshot, busy, act }: SharedPanelProps) {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const step = PROTOCOL_STEPS[snapshot.room.protocolIndex];
  const complete = snapshot.room.protocolIndex >= PROTOCOL_STEPS.length;
  const isSolo = snapshot.room.learningMode === "SOLO";
  const choices = useMemo(() => step ? protocolDecisionChoices(step) : [], [step]);
  const selectedChoice = choices.find((choice) => choice.id === selectedChoiceId);
  const canAdvance =
    !complete &&
    (snapshot.viewer.kind === "teacher" || isSolo || snapshot.viewer.role === step?.actorRole);

  useEffect(() => setSelectedChoiceId(null), [step?.id]);

  if (complete) {
    return (
      <div className="mission-complete">
        <span>✓</span><h3>Webページが表示されました</h3>
        <p>ARP・DNS・TCP・TLS・HTTPが連動し、全17ステップを完了しました。</p>
        {(snapshot.viewer.kind === "teacher" || isSolo) && <button className="secondary-button" disabled={busy} onClick={() => void act({ type: "RESET_PROTOCOL" })}>最初から再生</button>}
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
      <p>届いた情報と担当機器の役割をもとに、次に行う操作を自分で選びます。</p>
      <div className="actor-line">
        <span style={{ background: roleDefinition(activeStep.actorRole).accent }} />
        {isSolo ? "いま体験する役割" : "次の担当"}: <b>{roleDefinition(activeStep.actorRole).label}</b>
        {(isSolo || snapshot.viewer.role === activeStep.actorRole) && <em>{isSolo ? "この役割として考えます" : "あなたの番です"}</em>}
      </div>
      <fieldset className="decision-challenge" disabled={!canAdvance || busy}>
        <legend>この機器では、次に何をする？</legend>
        {choices.map((choice, index) => (
          <button type="button" key={choice.id} className={selectedChoiceId === choice.id ? choice.correct ? "selected correct" : "selected wrong" : ""} aria-pressed={selectedChoiceId === choice.id} onClick={() => setSelectedChoiceId(choice.id)}>
            <span>{String.fromCharCode(65 + index)}</span><b>{choice.label}</b>
          </button>
        ))}
      </fieldset>
      {selectedChoice && (
        <div className={`decision-feedback ${selectedChoice.correct ? "success" : "failure"}`} role="status">
          <span>{selectedChoice.correct ? "✓" : "×"}</span>
          <p><b>{selectedChoice.correct ? "その判断で進めます" : "情報を見る層と機器の役割をもう一度確認"}</b>{selectedChoice.correct ? activeStep.description : `${roleDefinition(activeStep.actorRole).label}が確認できる「${roleDefinition(activeStep.actorRole).observes.slice(0, 2).join("・")}」に注目します。`}</p>
        </div>
      )}
      <ContextTerms ids={protocolTermIds(activeStep)} title="この判断で使う用語" />
      {canAdvance ? (
        <button className="primary-button packet-action" disabled={busy || !selectedChoice?.correct} onClick={() => void act({ type: "ADVANCE_PROTOCOL", decision: selectedChoice?.label ?? "" })}>
          正しい判断として次へ進む <span>→</span>
        </button>
      ) : (
        <p className="waiting-note"><i /> 今は{roleDefinition(activeStep.actorRole).label}の担当者が操作する番です。</p>
      )}
    </div>
  );
}

function DiagnosisMission({ snapshot }: SharedPanelProps) {
  const [hypothesis, setHypothesis] = useState("");
  const latest = snapshot.room.diagnostics.at(-1);
  const hypotheses = [
    { id: "LINK", label: "PCからルータまでの接続" },
    { id: "GATEWAY", label: "IP設定または経路" },
    { id: "DNS", label: "DNSによる名前解決" },
    { id: "WEB", label: "TLS証明書またはWebサービス" },
  ];
  return (
    <div className="diagnosis-mission">
      <div className="mission-callout warning"><span>まず予想する</span><p>症状だけを見て、問題がありそうな場所を1つ選びます。正解を当てることより、コマンド結果で仮説を修正することが目的です。</p></div>
      <div className="hypothesis-choices" role="group" aria-label="最初の仮説">
        {hypotheses.map((item) => (
          <button type="button" key={item.id} className={hypothesis === item.id ? "active" : ""} aria-pressed={hypothesis === item.id} onClick={() => setHypothesis(item.id)}><span>{hypothesis === item.id ? "●" : "○"}</span>{item.label}</button>
        ))}
      </div>
      <p className="diagnosis-next"><b>{hypothesis ? "仮説を記録しました。" : "まず仮説を1つ選びましょう。"}</b>下の実践ワークベンチで <code>ping</code>、<code>nslookup</code>、<code>traceroute</code> を使い、「最後に成功した地点」を探します。</p>
      {latest && (
        <div className={`latest-observation ${latest.success ? "success" : "failure"}`}>
          <span>{latest.success ? "✓" : "!"}</span><div><b>直前の観察：{latest.tool.toLowerCase()} は{latest.success ? "成功" : "失敗"}</b><p>{latest.inference}</p></div>
        </div>
      )}
      <ContextTerms ids={PHASE_TERM_IDS.DIAGNOSIS ?? []} title="障害を切り分ける用語" />
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
      <ContextTerms ids={PHASE_TERM_IDS.REFLECTION ?? []} title="説明に使える用語" />
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
    content = snapshot.room.learningMode === "SOLO" ? (
      <div className="solo-role-overview">
        <div className="mission-callout"><span>ひとり学習の進め方</span><p>通信の場所に合わせて役割が自動で切り替わります。それぞれの機器が「何を見て、どう判断するか」を確認しましょう。</p></div>
        <div className="solo-role-grid">
          {ROLE_DEFINITIONS.filter((definition) => definition.id !== "OBSERVER").map((definition, index) => (
            <article key={definition.id} style={{ "--role-accent": definition.accent } as React.CSSProperties}>
              <span>{String(index + 1).padStart(2, "0")}</span><div><b>{definition.label}</b><small>{definition.description}</small></div>
            </article>
          ))}
        </div>
        <ContextTerms ids={PHASE_TERM_IDS.ROLES ?? []} />
      </div>
    ) : role ? (
      <div className="role-mission" style={{ "--role-accent": role.accent } as React.CSSProperties}>
        <span className="role-id">あなたの担当 / {role.shortLabel.toUpperCase()}</span>
        <h3>{role.label}</h3><p>{role.description}</p>
        <h4>この担当で確認できる情報</h4><div className="tag-list">{role.observes.map((item) => <span key={item}>{item}</span>)}</div>
        <ContextTerms ids={PHASE_TERM_IDS.ROLES ?? []} />
      </div>
    ) : <p>教員モードです。参加者へ役割を割り当ててください。</p>;
  } else if (snapshot.room.phase === "TOPOLOGY") {
    content = <div className="topology-mission"><div className="mission-callout"><span>接続実験</span><p>全体図の線を1本クリックして切断し、下のターミナルで <code>ping 192.168.10.1</code> を実行します。失敗地点を観察したら、同じ線をもう一度押して元に戻します。</p></div><ul>{snapshot.room.links.map((link) => <li key={link.id}><span className={link.up ? "ok" : "ng"}>{link.up ? "接続中" : "切断"}</span><b>{link.from} → {link.to}</b><small>{link.medium}</small></li>)}</ul><ContextTerms ids={PHASE_TERM_IDS.TOPOLOGY ?? []} /></div>;
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
  const layers = step.layers.filter((layer) => snapshot.viewer.kind === "teacher" || snapshot.room.learningMode === "SOLO" || role === "OBSERVER" || (role && layer.visibleTo.includes(role)));

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
  if (snapshot.room.learningMode === "SOLO") {
    const roles = ROLE_DEFINITIONS.filter((definition) => definition.id !== "OBSERVER");
    return (
      <section className="panel participants-panel" aria-labelledby="participants-title">
        <div className="panel-heading"><div><p className="panel-kicker">一人で順番に体験</p><h2 id="participants-title">あなたが担当する6つの役割</h2></div><span>自分のペースで進行</span></div>
        <div className="participant-list solo-role-list">
          {roles.map((role, index) => <div className="participant solo-role-card" key={role.id}><div className="avatar" style={{ background: role.accent }}>{index + 1}</div><div><b>{role.label}</b><small>{role.observes.slice(0, 2).join("・")}</small></div><em>{role.shortLabel}</em></div>)}
        </div>
      </section>
    );
  }
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
      <div className="panel-heading"><div><p className="panel-kicker">これまでの操作</p><h2 id="events-title">{snapshot.room.learningMode === "SOLO" ? "あなたの活動履歴" : "チームの活動履歴"}</h2></div><span>更新 {snapshot.room.version}</span></div>
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
  const [practiceCompleted, setPracticeCompleted] = useState<Set<PracticeMilestone>>(() => new Set());
  const practiceStorageKey = snapshot?.viewer.participantId ? `network-room-lab:practice:${snapshot.room.code}:${snapshot.viewer.participantId}` : undefined;

  useEffect(() => {
    if (!practiceStorageKey) return;
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(practiceStorageKey) ?? "[]") as PracticeMilestone[];
      setPracticeCompleted(new Set(saved));
    } catch {
      setPracticeCompleted(new Set());
    }
  }, [practiceStorageKey]);

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
  const isSolo = snapshot.room.learningMode === "SOLO";
  const soloActor = snapshot.room.phase === "PROTOCOL" ? PROTOCOL_STEPS[snapshot.room.protocolIndex]?.actorRole : undefined;
  const currentRoleLabel = isSolo
    ? soloActor
      ? roleDefinition(soloActor).label
      : "6つの役割を順番に担当"
    : viewerRole?.label ?? "観察者";
  const showPractice = currentPhase.index >= 2;

  return (
    <div className="room-shell">
      <header className="room-header">
        <Brand />
        <div className="room-heading"><div><small>{snapshot.viewer.kind === "teacher" ? "INSTRUCTOR ROOM" : isSolo ? "SELF-PACED LAB" : "TEAM ROOM"}</small><h1>{snapshot.room.title}</h1></div>{isSolo ? <span className="solo-mode-badge">ひとり学習</span> : <button className="room-code" onClick={() => void copyCode()}><span>ROOM CODE</span><b>{snapshot.room.code}</b><em>{copied ? "コピー済み" : "COPY"}</em></button>}</div>
        <div className="room-user"><span className={`connection-badge ${connectionStatus}`}><i />{connectionStatus === "online" ? "同期中" : connectionStatus === "connecting" ? "接続中" : "再接続中"}</span><div><b>{snapshot.viewer.displayName}</b><small>{snapshot.viewer.kind === "teacher" ? "担当教員" : isSolo ? "ひとり学習者" : roleDefinition(snapshot.viewer.role ?? "OBSERVER").label}</small></div><button onClick={onLeave} aria-label="部屋から退出">退出</button></div>
      </header>

      <div className="teacher-message-banner"><span>{isSolo ? "学習ガイド" : "先生からの案内"}</span><p>{snapshot.room.teacherMessage}</p></div>
      <PhaseStepper snapshot={snapshot} />
      <section className="beginner-guide" aria-label="現在の学習ガイド">
        <span className="guide-number" aria-hidden="true">{currentPhase.index + 1}</span>
        <div className="guide-task">
          <small>いまやること</small>
          <b>{currentPhase.instruction}</b>
        </div>
        <div className="guide-role">
          <small>{snapshot.viewer.kind === "teacher" ? "利用モード" : isSolo ? "いまの役割" : "あなたの担当"}</small>
          <b>{snapshot.viewer.kind === "teacher" ? "先生として進行" : currentRoleLabel}</b>
        </div>
      </section>
      {isSolo && <SoloProgressControls snapshot={snapshot} busy={busy} act={act} practiceCompleted={practiceCompleted} />}
      {error && <div className="room-error" role="alert"><span>!</span>{error}<button onClick={dismissError}>閉じる</button></div>}

      <main className="room-grid">
        <TopologyPanel snapshot={snapshot} busy={busy} act={act} />
        <MissionPanel snapshot={snapshot} busy={busy} act={act} />
        <PacketInspector snapshot={snapshot} />
        {showPractice && <PracticeLab
          snapshot={snapshot}
          busy={busy}
          act={act}
          completed={practiceCompleted}
          onComplete={(milestone) => setPracticeCompleted((current) => {
            const next = new Set(current).add(milestone);
            if (practiceStorageKey) window.sessionStorage.setItem(practiceStorageKey, JSON.stringify([...next]));
            return next;
          })}
        />}
        <ParticipantsPanel snapshot={snapshot} />
        <EventPanel snapshot={snapshot} />
        <GlossaryPanel />
        {snapshot.viewer.kind === "teacher" && <TeacherPanel snapshot={snapshot} busy={busy} act={act} session={session} />}
      </main>

      <footer className="room-footer"><span>Network Room Lab · Created by Dit-Lab,（Daiki ITO）</span><span>学習用ネットワークシミュレーション <i className={connectionStatus} /></span></footer>
    </div>
  );
}
