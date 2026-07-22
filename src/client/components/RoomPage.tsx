import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  DEVICES,
  FAULT_DEFINITIONS,
  LEARNING_SCENARIO_GOAL,
  PHASE_DEFINITIONS,
  PROTOCOL_STEPS,
  REFLECTION_PROMPTS,
  ROLE_DEFINITIONS,
  phaseDefinition,
  roleDefinition,
} from "../../shared/scenario";
import { PHASE_TERM_IDS } from "../../shared/glossary";
import { learningLead, type LearningLead } from "../../shared/learningLead";
import { PRACTICE_TASKS, protocolDecisionChoices, protocolTermIds, type PracticeMilestone } from "../../shared/practice";
import { CORE_ROLE_IDS, type CoreRoleId } from "../../shared/rolePractice";
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
import { LearningRouteMap } from "./LearningRouteMap";
import { PracticeLab } from "./PracticeLab";
import { RolePracticeLab } from "./RolePracticeLab";

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

function deviceLabel(id: string): string {
  return DEVICES.find((device) => device.id === id)?.label ?? id;
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
    <nav className="phase-stepper" aria-label="学習の進み具合">
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

function LearningCoach({ lead }: { lead: LearningLead }) {
  const moveToAction = () => {
    if (!lead.targetId) return;
    document.getElementById(lead.targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <section className={`learning-coach ${lead.state}`} aria-label="次にやること" aria-live="polite">
      <span className="learning-coach-icon" aria-hidden="true">{lead.state === "complete" ? "✓" : lead.state === "waiting" ? "…" : "→"}</span>
      <div className="learning-coach-main">
        <small>いま行う1つの操作</small>
        <b>{lead.title}</b>
        <p>{lead.detail}</p>
      </div>
      <div className="learning-coach-after"><small>終わったら</small><span>{lead.after}</span></div>
      {lead.targetId && <button type="button" onClick={moveToAction}>{lead.targetLabel ?? "その場所へ移動"} ↓</button>}
    </section>
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
  rolePracticeCompleted,
}: SharedPanelProps & { practiceCompleted: ReadonlySet<PracticeMilestone>; rolePracticeCompleted: ReadonlySet<CoreRoleId> }) {
  const current = phaseDefinition(snapshot.room.phase);
  const previous = PHASE_DEFINITIONS.find((phase) => phase.index === current.index - 1 && phase.id !== "LOBBY");
  const next = PHASE_DEFINITIONS.find((phase) => phase.index === current.index + 1);
  const protocolIncomplete = snapshot.room.phase === "PROTOCOL" && snapshot.room.protocolIndex < PROTOCOL_STEPS.length;
  const topologyIncomplete = snapshot.room.phase === "TOPOLOGY" && snapshot.room.links.some((link) => !link.up);
  const missingRoles = snapshot.room.phase === "ROLES" ? CORE_ROLE_IDS.filter((roleId) => !rolePracticeCompleted.has(roleId)) : [];
  const rolePracticeIncomplete = missingRoles.length > 0;
  const requiredPractice = PHASE_PRACTICE_REQUIREMENTS[snapshot.room.phase] ?? [];
  const missingPractice = requiredPractice.filter((milestone) => !practiceCompleted.has(milestone));
  const practiceIncomplete = missingPractice.length > 0;
  const explanationIncomplete = requiredPractice.length > 0 && !snapshot.explanations.some((item) => item.participantId === snapshot.viewer.participantId && item.phase === snapshot.room.phase);
  const nextDisabled = rolePracticeIncomplete || protocolIncomplete || topologyIncomplete || practiceIncomplete || explanationIncomplete;
  const progressHint = rolePracticeIncomplete
    ? `下の役割学習で、あと${missingRoles.length}役を「目的・情報・操作・結果・説明」の順に体験します。`
    : protocolIncomplete
    ? "学習指導要領ページが表示されるまでの17段階を最後まで進めると、次へ移動できます。"
    : topologyIncomplete
      ? "切断を試した後は、すべての接続を元に戻してから進みます。"
      : practiceIncomplete
        ? `下のコマンド実験で「${missingPractice.map((milestone) => PRACTICE_TASKS.find((task) => task.id === milestone)?.label ?? milestone).join("」「")}」を順番に実行します。`
        : explanationIncomplete
          ? "実行結果を観察し、「予想と比べて分かったこと」を10文字以上で説明します。"
          : undefined;

  return (
    <section className="solo-progress" id="solo-progress" aria-label="ひとり学習の進行">
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
      <small>{id === "router" ? `PCの出口（デフォルトゲートウェイ）${address ? ` / ${address}` : ""}` : address ?? definition?.observes[0] ?? "複数経路"}</small>
      {active && <em>通信データ</em>}
      {faulted && <em className="fault-tag">障害中</em>}
    </div>
  );
}

function LinkControl({ link, canEdit, busy, act }: { link: TopologyLink; canEdit: boolean; busy: boolean; act: SharedPanelProps["act"] }) {
  return (
    <button
      className={`topology-link ${link.up ? "up" : "down"}`}
      type="button"
      aria-label={`${deviceLabel(link.from)}と${deviceLabel(link.to)}の${link.medium}接続。現在${link.up ? "接続" : "切断"}`}
      title={canEdit ? "押すと、この接続を切断または接続できます" : link.medium}
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
    <section className="panel topology-panel" id="topology-panel" aria-labelledby="topology-title">
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
  const [triedBadGateway, setTriedBadGateway] = useState(false);
  useEffect(() => setConfig(snapshot.room.interfaceConfig), [snapshot.room.interfaceConfig]);
  const canEdit = snapshot.viewer.kind === "teacher" || snapshot.room.learningMode === "SOLO" || snapshot.viewer.role === "CLIENT_PC";
  const configErrors = validateInterfaceConfig(config);
  const configSaved = snapshot.room.latestEvents.some((event) => event.type === "CONFIGURE_INTERFACE");
  const addressAction = configSaved
    ? { title: "設定を保存できました", detail: "次は下のコマンド実験で、まずPCの設定を表示し、次に出口のルータまで届くかを確かめます。" }
    : configErrors.length > 0
      ? { title: "赤い理由を読み、「推奨値へ戻す」を押します", detail: "エラーは学習用です。推奨値へ戻せば、元の正しい設定になります。" }
      : triedBadGateway
        ? { title: "「この設定を保存してコマンドで確認」を押します", detail: "PCの住所・範囲・出口・DNSサーバの4項目が推奨設定へ戻っていることを確認してから保存します。" }
        : { title: "まず「誤った出口の設定を試す」を押します", detail: "Webサイトへ届かない設定をわざと体験し、どの項目が原因になるかを赤い説明で確かめます。" };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void act({ type: "CONFIGURE_INTERFACE", ...config });
  };

  return (
    <form className="address-form" onSubmit={submit}>
      <div className="mission-callout">
        <span>この実験の目的</span>
        <p>PCが文部科学省の学習指導要領ページへデータを送れる設定を理解するために、出口の設定をわざと間違え、理由を確認してから正しい設定へ戻します。</p>
      </div>
      <div className="inline-learning-lead" role="status"><span>次にやること</span><div><b>{addressAction.title}</b><p>{addressAction.detail}</p></div></div>
      <div className="field-grid">
        <label>PCのIPアドレス<input value={config.address} disabled={!canEdit} onChange={(event) => setConfig({ ...config, address: event.target.value })} /></label>
        <label>同じネットワークの範囲（/ の後ろ）<input type="number" min={1} max={30} value={config.prefix} disabled={!canEdit} onChange={(event) => setConfig({ ...config, prefix: Number(event.target.value) })} /></label>
        <label>外部への出口（デフォルトゲートウェイ）<input value={config.gateway} disabled={!canEdit} onChange={(event) => setConfig({ ...config, gateway: event.target.value })} /></label>
        <label>Webサイト名を調べるDNSサーバ<input value={config.dns} disabled={!canEdit} onChange={(event) => setConfig({ ...config, dns: event.target.value })} /></label>
      </div>
      {canEdit && (
        <div className="address-experiment-actions">
          <button type="button" className={`secondary-button ${!triedBadGateway && !configSaved ? "guide-target" : ""}`} onClick={() => { setTriedBadGateway(true); setConfig({ ...config, gateway: "192.168.20.1" }); }}>誤った出口の設定を試す</button>
          <button type="button" className={`secondary-button ${configErrors.length > 0 ? "guide-target" : ""}`} onClick={() => setConfig({ address: "192.168.10.23", prefix: 24, gateway: "192.168.10.1", dns: "198.51.100.53" })}>推奨値へ戻す</button>
        </div>
      )}
      <div className={`config-feedback ${configErrors.length > 0 ? "failure" : "success"}`} role="status">
        <span>{configErrors.length > 0 ? "!" : "✓"}</span>
        <div><b>{configErrors.length > 0 ? "このままでは通信を始められません" : "IP設定の形式とネットワーク範囲は整っています"}</b>
          {configErrors.length > 0
            ? <ul>{configErrors.map((error) => <li key={error}>{error}</li>)}</ul>
            : <p>保存後は、下のコマンド実験で「PCの設定を表示する」「出口のルータまで届くか確かめる」を順番に行います。</p>}
        </div>
      </div>
      <div className="subnet-check"><span>PCがいるネットワーク</span><b>192.168.10.0/24</b><span>外部への出口</span><b>192.168.10.1</b></div>
      <ContextTerms ids={PHASE_TERM_IDS.ADDRESSING ?? []} />
      {canEdit ? <button className={`primary-button ${triedBadGateway && configErrors.length === 0 && !configSaved ? "guide-target" : ""}`} disabled={busy || configErrors.length > 0}>この設定を保存してコマンドで確認</button> : <p className="waiting-note">PC担当の設定を観察しています。</p>}
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
  const actorAssigned = step
    ? snapshot.room.participants.some((participant) => participant.role === step.actorRole)
    : false;
  const canAdvance =
    !complete &&
    (snapshot.viewer.kind === "teacher" || isSolo || snapshot.viewer.role === step?.actorRole || !actorAssigned);

  useEffect(() => setSelectedChoiceId(null), [step?.id]);

  if (complete) {
    return (
      <div className="mission-complete">
        <span>✓</span><h3>Webページが表示されました</h3>
        <p>学習指導要領ページを表示するために必要な、名前の確認・接続・暗号化・ページ取得の全17段階を完了しました。</p>
        {(snapshot.viewer.kind === "teacher" || isSolo) && <button className="secondary-button" disabled={busy} onClick={() => void act({ type: "RESET_PROTOCOL" })}>最初から再生</button>}
      </div>
    );
  }

  const activeStep = step!;
  const sharedUnassignedRole = !isSolo && !actorAssigned;
  const protocolAction = !canAdvance
    ? { title: `${roleDefinition(activeStep.actorRole).label}の操作を待ちます`, detail: "担当者が進めると、この画面は自動で次の段階へ切り替わります。" }
    : selectedChoice?.correct
      ? { title: "理由を読み、青い「次の段階へ進む」を押します", detail: "目的に合う操作を選べています。通信データを次の機器へ渡します。" }
      : selectedChoice
        ? { title: "表示された理由を読み、別の答えを選びます", detail: "間違えても減点されません。A・B・Cは何度でも選び直せます。" }
        : sharedUnassignedRole
          ? { title: "この役割は、班のみんなで操作を選びます", detail: `${roleDefinition(activeStep.actorRole).label}の担当者がいないため、「${activeStep.title}」という目的を班で確認します。班の誰が操作しても大丈夫です。` }
          : { title: "学習指導要領ページの表示に必要な操作を、A・B・Cから1つ選びます", detail: `いまは${roleDefinition(activeStep.actorRole).label}の担当です。「${activeStep.title}」という目的を手がかりにします。` };

  return (
    <div className="protocol-mission">
      <div className="inline-learning-lead" role="status"><span>次にやること</span><div><b>{protocolAction.title}</b><p>{protocolAction.detail}</p></div></div>
      <div className="protocol-breadcrumb" aria-label="学習指導要領ページが表示されるまでに行うこと">
        {([
          ["ARP", "近くの機器番号を調べる"],
          ["DNS", "Webサイト名から住所を調べる"],
          ["TCP", "通信路を準備する"],
          ["TLS", "相手確認と暗号化を行う"],
          ["HTTPS", "学習指導要領ページを受け取る"],
        ] as const).map(([protocol, purpose]) => (
          <span key={protocol} className={activeStep.protocol === protocol ? "active" : ""} title={purpose}>{protocol}<small>{purpose}</small></span>
        ))}
      </div>
      <div className="step-counter"><span>全17段階の {activeStep.index + 1}</span><b>{activeStep.title}</b></div>
      <p>学習指導要領ページの表示に一歩近づけるため、いまの機器が行う操作を1つ選びます。</p>
      <div className="actor-line">
        <span style={{ background: roleDefinition(activeStep.actorRole).accent }} />
        {isSolo ? "いま体験する役割" : "次の担当"}: <b>{roleDefinition(activeStep.actorRole).label}</b>
        {(isSolo || snapshot.viewer.role === activeStep.actorRole || sharedUnassignedRole) && <em>{isSolo ? "この役割として考えます" : sharedUnassignedRole ? "班で担当します" : "あなたの番です"}</em>}
      </div>
      <fieldset className="decision-challenge" disabled={!canAdvance || busy}>
        <legend>学習指導要領ページの表示に近づけるために、この機器は次に何をする？</legend>
        {choices.map((choice, index) => (
          <button type="button" key={choice.id} className={selectedChoiceId === choice.id ? choice.correct ? "selected correct" : "selected wrong" : ""} aria-pressed={selectedChoiceId === choice.id} onClick={() => setSelectedChoiceId(choice.id)}>
            <span>{String.fromCharCode(65 + index)}</span><b>{choice.label}</b>
          </button>
        ))}
      </fieldset>
      {selectedChoice && (
        <div className={`decision-feedback ${selectedChoice.correct ? "success" : "failure"}`} role="status">
          <span>{selectedChoice.correct ? "✓" : "×"}</span>
          <p><b>{selectedChoice.correct ? "この操作で目的に近づけます" : "いまの機器の目的をもう一度確認します"}</b>{selectedChoice.correct ? activeStep.description : `「${activeStep.title}」を行うために必要な操作はどれか、選択肢をもう一度比べます。`}</p>
        </div>
      )}
      <ContextTerms ids={protocolTermIds(activeStep)} title="この画面で出てきた用語を確認する" />
      {canAdvance ? (
        <button className="primary-button packet-action" disabled={busy || !selectedChoice?.correct} onClick={() => void act({ type: "ADVANCE_PROTOCOL", decision: selectedChoice?.label ?? "" })}>
          この操作で次の段階へ進む <span>→</span>
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
    { id: "GATEWAY", label: "PCの住所・外部への出口・ルータの道案内" },
    { id: "DNS", label: "Webサイト名をIPアドレスへ変えるDNSサーバ" },
    { id: "WEB", label: "Webサイトの証明書または学習指導要領ページを返す機能" },
  ];
  const latestToolLabel = latest
    ? ({
        PING: "相手まで届くかの確認（ping）",
        NSLOOKUP: "Webサイト名からIPアドレスを調べる確認（nslookup）",
        TRACEROUTE: "目的地までに通った道の確認（traceroute）",
        HTTPS: "学習指導要領ページの応答の確認（curl）",
      } as const)[latest.tool]
    : "";
  return (
    <div className="diagnosis-mission">
      <div className="mission-callout warning"><span>この実験の目的</span><p>学習指導要領ページが表示されない原因を見つけます。まず原因になりそうな場所を予想し、その後に確認コマンドの結果を見て予想を直します。</p></div>
      <div className="inline-learning-lead" role="status"><span>次にやること</span><div><b>{hypothesis ? "下のコマンド実験で「通った道から失敗地点を絞る」を押します" : "4つの候補から、原因だと思う場所を1つ選びます"}</b><p>{hypothesis ? "最初の予想を記録できました。通過したルータを順に表示して、最後に返事があった場所を確認します。" : "最初から正解する必要はありません。今の予想を1つ選べば進めます。"}</p></div></div>
      <div className="hypothesis-choices" role="group" aria-label="原因についての最初の予想">
        {hypotheses.map((item) => (
          <button type="button" key={item.id} className={hypothesis === item.id ? "active" : ""} aria-pressed={hypothesis === item.id} onClick={() => setHypothesis(item.id)}><span>{hypothesis === item.id ? "●" : "○"}</span>{item.label}</button>
        ))}
      </div>
      <p className="diagnosis-next"><b>{hypothesis ? "最初の予想を記録しました。" : "まず原因だと思う場所を1つ選びましょう。"}</b>次に、下のコマンド実験で「PCの出口」「Webサイト名の変換」「目的地までに通ったルータ」を順番に確かめます。</p>
      {latest && (
        <div className={`latest-observation ${latest.success ? "success" : "failure"}`}>
          <span>{latest.success ? "✓" : "!"}</span><div><b>直前の結果：{latestToolLabel}は{latest.success ? "成功" : "失敗"}</b><p>{latest.inference}</p></div>
        </div>
      )}
      <ContextTerms ids={PHASE_TERM_IDS.DIAGNOSIS ?? []} title="原因を調べるときに出てきた用語" />
    </div>
  );
}

function ReflectionMission({ snapshot, busy, act }: SharedPanelProps) {
  const existing = useMemo(
    () => Object.fromEntries(snapshot.reflections.filter((item) => item.participantId === snapshot.viewer.participantId).map((item) => [item.promptId, item.response])),
    [snapshot.reflections, snapshot.viewer.participantId],
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

  const nextPromptIndex = REFLECTION_PROMPTS.findIndex((prompt) => existing[prompt.id] === undefined);
  const nextPrompt = nextPromptIndex >= 0 ? REFLECTION_PROMPTS[nextPromptIndex] : undefined;
  const nextDraftReady = nextPrompt ? (responses[nextPrompt.id]?.trim().length ?? 0) >= 10 : false;

  return (
    <div className="reflection-form">
      <div className="inline-learning-lead" role="status"><span>次にやること</span><div><b>{nextPrompt ? nextDraftReady ? `振り返り ${nextPromptIndex + 1} の「保存」を押します` : `振り返り ${nextPromptIndex + 1} を10文字以上で書きます` : "3つの振り返りを保存できました"}</b><p>{nextPrompt ? nextDraftReady ? "必要なら文を読み直し、保存すると次の問いへ進みます。" : "正解は1つではありません。体験中に確認した情報や選んだ操作を1つ入れます。" : "これで学習完了です。必要なら前の学習段階へ戻って復習できます。"}</p></div></div>
      <ContextTerms ids={PHASE_TERM_IDS.REFLECTION ?? []} title="説明に使える用語" />
      {REFLECTION_PROMPTS.map((prompt, index) => (
        <div className="reflection-item" key={prompt.id}>
          <span>0{index + 1}</span>
          <label>{prompt.label}
            <textarea
              rows={4}
              value={responses[prompt.id] ?? ""}
              onChange={(event) => setResponses({ ...responses, [prompt.id]: event.target.value })}
              placeholder="例：PCはWebサイトの住所を調べるために、まずDNSサーバへ質問した。"
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
        <div className="mission-callout"><span>この実習全体のゴール</span><p><b>{LEARNING_SCENARIO_GOAL.title}</b><br />6つの機器を順番に担当し、それぞれがページ表示のために行う仕事を確かめます。</p></div>
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
        <div className="mission-callout"><span>この担当の目的</span><p>下の役割学習で、学習指導要領ページを表示するために、この機器が担当する仕事を順番に確かめます。</p></div>
        {snapshot.room.participants.length < 6 && <div className="mission-callout shared-role-callout"><span>担当者がいない機器について</span><p>この班は{snapshot.room.participants.length}人です。割り当てられていない機器の通信段階では、班のみんなが選択肢を操作できます。</p></div>}
        <ContextTerms ids={PHASE_TERM_IDS.ROLES ?? []} />
      </div>
    ) : <p>教員モードです。参加者へ役割を割り当ててください。</p>;
  } else if (snapshot.room.phase === "TOPOLOGY") {
    content = <div className="topology-mission"><div className="mission-callout"><span>この実験の目的</span><p>文部科学省の学習指導要領ページを見るために、PCのデータがどの機器を順番に通るかを確かめます。次に道の線を1本だけ切り、どこまで届かなくなるかを体験してから、同じ線を押して元に戻します。</p></div><ul>{snapshot.room.links.map((link) => <li key={link.id}><span className={link.up ? "ok" : "ng"}>{link.up ? "接続中" : "切断"}</span><b>{deviceLabel(link.from)} → {deviceLabel(link.to)}</b><small>{link.medium}</small></li>)}</ul><ContextTerms ids={PHASE_TERM_IDS.TOPOLOGY ?? []} /></div>;
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
    <section className="panel mission-panel" id="mission-panel" aria-labelledby="mission-title">
      <div className="panel-heading"><div><p className="panel-kicker">いま取り組むこと</p><h2 id="mission-title">{phase.label}</h2></div><span className="phase-number">{phase.id === "LOBBY" ? "準備" : `ステップ ${phase.index}`}</span></div>
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
      <div className="packet-meta"><span>データの識別名</span><b>pkt_web_001</b><span>いまの通信</span><b>{step.protocol}</b></div>
      <div className="packet-layers">
        {layers.map((layer, layerIndex) => (
          <div className={`packet-layer layer-${layer.id}`} key={layer.id}>
            <span>0{layerIndex + 1}</span><div><small>{layer.label}</small><b>{layer.value}</b></div>
          </div>
        ))}
      </div>
      <div className="packet-progress"><div><span>学習指導要領ページが表示されるまでの進み具合</span><b>{Math.min(index, PROTOCOL_STEPS.length)} / {PROTOCOL_STEPS.length}</b></div><progress max={PROTOCOL_STEPS.length} value={index} /></div>
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
        {events.map((event) => <div className="event-row" key={event.id}><time>{formatTime(event.createdAt)}</time><i /><div><b>{event.summary}</b><small>操作記録 #{event.id}</small></div></div>)}
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
    <section className="panel teacher-panel" id="teacher-panel" aria-labelledby="teacher-title">
      <div className="panel-heading"><div><p className="panel-kicker">先生用メニュー</p><h2 id="teacher-title">授業の進行とサポート</h2></div><button className="secondary-button" disabled={exporting} onClick={() => void exportData()}>{exporting ? "出力中…" : "記録をCSVで保存"}</button></div>
      <div className="teacher-grid">
        <div>
          <h3>学習段階</h3>
          <div className="teacher-phase-buttons">{PHASE_DEFINITIONS.map((phase) => <button type="button" key={phase.id} className={snapshot.room.phase === phase.id ? "active" : ""} disabled={busy} onClick={() => void act({ type: "CHANGE_PHASE", phase: phase.id })}><span>{phase.index}</span>{phase.shortLabel}</button>)}</div>
          <label className="teacher-message">チームへの指示<div><input maxLength={240} value={message} onChange={(event) => setMessage(event.target.value)} /><button disabled={busy || !message.trim()} onClick={() => void act({ type: "TEACHER_MESSAGE", text: message })}>送信</button></div></label>
        </div>
        <div>
          <h3>役割割当</h3>
          <div className="role-assignments">{snapshot.room.participants.map((participant) => <label key={participant.id}><span>{participant.displayName}</span><select value={participant.role} disabled={busy} onChange={(event) => void act({ type: "ASSIGN_ROLE", participantId: participant.id, role: event.target.value as ParticipantPublic["role"] })}>{ROLE_DEFINITIONS.map((role) => <option value={role.id} key={role.id}>{role.label}</option>)}</select></label>)}</div>
        </div>
        <div>
          <h3>学習用の障害を起こす</h3>
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
  const [rolePracticeCompleted, setRolePracticeCompleted] = useState<Set<CoreRoleId>>(() => new Set());
  const practiceStorageKey = snapshot?.viewer.participantId ? `network-room-lab:practice:${snapshot.room.code}:${snapshot.viewer.participantId}` : undefined;
  const rolePracticeStorageKey = snapshot?.viewer.participantId ? `network-room-lab:role-practice:${snapshot.room.code}:${snapshot.viewer.participantId}` : undefined;

  useEffect(() => {
    if (!practiceStorageKey) return;
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(practiceStorageKey) ?? "[]") as PracticeMilestone[];
      setPracticeCompleted(new Set(saved));
    } catch {
      setPracticeCompleted(new Set());
    }
  }, [practiceStorageKey]);

  useEffect(() => {
    if (!rolePracticeStorageKey) return;
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(rolePracticeStorageKey) ?? "[]") as CoreRoleId[];
      setRolePracticeCompleted(new Set(saved.filter((roleId) => CORE_ROLE_IDS.includes(roleId))));
    } catch {
      setRolePracticeCompleted(new Set());
    }
  }, [rolePracticeStorageKey]);

  if (!snapshot) {
    return <div className="loading-screen"><Brand /><div className="loader"><i /><i /><i /></div><p>{error ?? "実験ルームへ接続しています…"}</p>{error && <button className="secondary-button" onClick={onLeave}>トップへ戻る</button>}</div>;
  }

  const copyCode = async () => {
    await navigator.clipboard.writeText(snapshot.room.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  const isSolo = snapshot.room.learningMode === "SOLO";
  const focusedRolePractice = snapshot.room.phase === "ROLES" && snapshot.viewer.kind !== "teacher";
  const focusedSoloPhase = isSolo && snapshot.room.phase !== "ROLES";
  const showPractice = Boolean(PHASE_PRACTICE_REQUIREMENTS[snapshot.room.phase]);
  const nextAction = learningLead(snapshot, practiceCompleted, rolePracticeCompleted);
  const activeProtocolStep = PROTOCOL_STEPS[snapshot.room.protocolIndex];
  const routeFocus = snapshot.room.phase === "ADDRESSING"
    ? "gateway"
    : snapshot.room.phase === "PROTOCOL" && activeProtocolStep?.protocol === "DNS"
      ? "dns"
      : snapshot.room.phase === "PROTOCOL" && activeProtocolStep?.protocol !== "ARP"
        ? "web"
        : "all";
  const activeRouteNode = snapshot.room.phase === "ADDRESSING"
    ? "pc"
    : snapshot.room.phase === "PROTOCOL"
      ? activeProtocolStep?.nodeId
      : undefined;

  const completeRolePractice = (roleId: CoreRoleId) => setRolePracticeCompleted((current) => {
    const next = new Set(current).add(roleId);
    if (rolePracticeStorageKey) window.sessionStorage.setItem(rolePracticeStorageKey, JSON.stringify([...next]));
    return next;
  });
  const completePractice = (milestone: PracticeMilestone) => setPracticeCompleted((current) => {
    const next = new Set(current).add(milestone);
    if (practiceStorageKey) window.sessionStorage.setItem(practiceStorageKey, JSON.stringify([...next]));
    return next;
  });

  return (
    <div className="room-shell">
      <header className="room-header">
        <Brand />
        <div className="room-heading"><div><small>{snapshot.viewer.kind === "teacher" ? "先生用の授業画面" : isSolo ? "自分のペースで学習" : "チームで学習"}</small><h1>{snapshot.room.title}</h1></div>{isSolo ? <span className="solo-mode-badge">ひとり学習</span> : <button className="room-code" onClick={() => void copyCode()}><span>部屋コード</span><b>{snapshot.room.code}</b><em>{copied ? "コピー済み" : "コピー"}</em></button>}</div>
        <div className="room-user"><span className={`connection-badge ${connectionStatus}`}><i />{connectionStatus === "online" ? "同期中" : connectionStatus === "connecting" ? "接続中" : "再接続中"}</span><div><b>{snapshot.viewer.displayName}</b><small>{snapshot.viewer.kind === "teacher" ? "担当教員" : isSolo ? "ひとり学習者" : roleDefinition(snapshot.viewer.role ?? "OBSERVER").label}</small></div><button onClick={onLeave} aria-label="部屋から退出">退出</button></div>
      </header>

      {(!focusedRolePractice || !isSolo) && <div className="teacher-message-banner"><span>{isSolo ? "学習ガイド" : "先生からの案内"}</span><p>{snapshot.room.teacherMessage}</p></div>}
      <PhaseStepper snapshot={snapshot} />
      <LearningCoach lead={nextAction} />
      {snapshot.room.phase !== "ROLES" && <LearningRouteMap activeNodeId={activeRouteNode} focus={routeFocus} />}
      {isSolo && snapshot.room.phase !== "ROLES" && <SoloProgressControls snapshot={snapshot} busy={busy} act={act} practiceCompleted={practiceCompleted} rolePracticeCompleted={rolePracticeCompleted} />}
      {error && <div className="room-error" role="alert"><span>!</span>{error}<button onClick={dismissError}>閉じる</button></div>}

      <main className={`room-grid ${focusedRolePractice ? "focused-learning" : focusedSoloPhase ? "guided-learning" : ""}`}>
        {focusedRolePractice ? (
          <>
            <RolePracticeLab
              snapshot={snapshot}
              completed={rolePracticeCompleted}
              onComplete={completeRolePractice}
              act={act}
              busy={busy}
              onContinue={isSolo ? () => void act({ type: "CHANGE_PHASE", phase: "TOPOLOGY" }) : undefined}
            />
            <details className="learning-support-drawer">
              <summary><span>＋</span><div><b>いまの操作を別の図や用語説明でも確認する</b><small>役割の5段階を終えてから、通信全体を見直したいときに開きます</small></div></summary>
              <div className="room-support-grid">
                <TopologyPanel snapshot={snapshot} busy={busy} act={act} />
                <PacketInspector snapshot={snapshot} />
                <GlossaryPanel />
              </div>
            </details>
          </>
        ) : focusedSoloPhase ? (
          <>
            <MissionPanel snapshot={snapshot} busy={busy} act={act} />
            {snapshot.room.phase === "TOPOLOGY" && <TopologyPanel snapshot={snapshot} busy={busy} act={act} />}
            {showPractice && <PracticeLab snapshot={snapshot} busy={busy} act={act} completed={practiceCompleted} onComplete={completePractice} />}
            <details className="learning-support-drawer">
              <summary><span>＋</span><div><b>いまの操作を別の資料でも確認する</b><small>通信の全体図、データの中身、これまでの操作、用語説明を見直せます</small></div></summary>
              <div className="room-support-grid">
                {snapshot.room.phase !== "TOPOLOGY" && <TopologyPanel snapshot={snapshot} busy={busy} act={act} />}
                <PacketInspector snapshot={snapshot} />
                <EventPanel snapshot={snapshot} />
                <GlossaryPanel />
              </div>
            </details>
          </>
        ) : (
          <>
            <TopologyPanel snapshot={snapshot} busy={busy} act={act} />
            <MissionPanel snapshot={snapshot} busy={busy} act={act} />
            <PacketInspector snapshot={snapshot} />
            {snapshot.room.phase === "ROLES" && <RolePracticeLab snapshot={snapshot} completed={rolePracticeCompleted} onComplete={completeRolePractice} act={act} busy={busy} />}
            {showPractice && <PracticeLab
              snapshot={snapshot}
              busy={busy}
              act={act}
              completed={practiceCompleted}
              onComplete={completePractice}
            />}
            <ParticipantsPanel snapshot={snapshot} />
            <EventPanel snapshot={snapshot} />
            <GlossaryPanel />
            {snapshot.viewer.kind === "teacher" && <TeacherPanel snapshot={snapshot} busy={busy} act={act} session={session} />}
          </>
        )}
      </main>

      <footer className="room-footer"><span>Network Room Lab · Created by Dit-Lab,（Daiki ITO）</span><span>学習用ネットワークシミュレーション <i className={connectionStatus} /></span></footer>
    </div>
  );
}
