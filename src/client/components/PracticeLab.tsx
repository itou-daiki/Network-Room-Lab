import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  PRACTICE_TASKS,
  QUICK_PRACTICE_COMMANDS,
  localPracticeOutput,
  parsePracticeCommand,
  type PracticeMilestone,
} from "../../shared/practice";
import type { ClientAction, RoomPhase, RoomSnapshot } from "../../shared/types";
import { ContextTerms } from "./Glossary";

interface PracticeLabProps {
  snapshot: RoomSnapshot;
  busy: boolean;
  act: (action: ClientAction) => Promise<void>;
  completed: ReadonlySet<PracticeMilestone>;
  onComplete: (milestone: PracticeMilestone) => void;
}

interface TerminalEntry {
  id: number;
  command?: string;
  lines: string[];
  success?: boolean;
  inference?: string;
}

interface PendingDiagnostic {
  command: string;
  diagnosticCount: number;
  milestone: PracticeMilestone;
}

const phaseTasks: Partial<Record<RoomPhase, PracticeMilestone[]>> = {
  TOPOLOGY: ["PING_GATEWAY"],
  ADDRESSING: ["IPCONFIG", "PING_GATEWAY"],
  PROTOCOL: ["ARP", "NSLOOKUP", "PING_WEB"],
  DIAGNOSIS: ["IPCONFIG", "PING_GATEWAY", "NSLOOKUP", "PING_WEB", "TRACEROUTE", "HTTPS"],
  REFLECTION: ["TRACEROUTE", "HTTPS"],
};

export function PracticeLab({ snapshot, busy, act, completed, onComplete }: PracticeLabProps) {
  const [input, setInput] = useState("");
  const [predictions, setPredictions] = useState<Partial<Record<RoomPhase, string>>>({});
  const [observations, setObservations] = useState<Partial<Record<RoomPhase, string>>>({});
  const [entries, setEntries] = useState<TerminalEntry[]>([
    { id: 0, lines: ["Network Room Lab practice terminal", "help と入力すると、使えるコマンドを確認できます。"] },
  ]);
  const [pending, setPending] = useState<PendingDiagnostic | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const nextEntryId = useRef(1);
  const outputRef = useRef<HTMLDivElement>(null);

  const suggestedIds = phaseTasks[snapshot.room.phase] ?? PRACTICE_TASKS.map((task) => task.id);
  const suggestedTasks = PRACTICE_TASKS.filter((task) => suggestedIds.includes(task.id));
  const completedSuggested = suggestedTasks.filter((task) => completed.has(task.id)).length;
  const prediction = predictions[snapshot.room.phase] ?? "";
  const observation = observations[snapshot.room.phase] ?? "";
  const phaseExplanations = snapshot.explanations.filter((item) => item.phase === snapshot.room.phase);
  const myExplanation = phaseExplanations.find((item) => item.participantId === snapshot.viewer.participantId);
  const explanationSaved = Boolean(myExplanation && myExplanation.text === observation.trim());
  const nextIncompleteTask = suggestedTasks.find((task) => !completed.has(task.id));
  const predictionReady = prediction.trim().length >= 5;
  const practiceAction = pending
    ? { title: `「${pending.command}」の結果を待ちます`, detail: "終わると黒い画面へ結果と観察ポイントが表示されます。" }
    : snapshot.viewer.kind === "participant" && !predictionReady
      ? { title: "まず「実行前の予想」を5文字以上で書きます", detail: "正解でなくて大丈夫です。「届くと思う」だけでも始められます。" }
      : nextIncompleteTask
        ? { title: `左側の「${nextIncompleteTask.label}」を押します`, detail: `コマンドは自動入力されます。実行後、黒い画面の「観察のポイント」を読みます。` }
        : observation.trim().length < 10
          ? { title: "右側の説明欄へ、分かったことを1文で書きます", detail: "成功・失敗だけでなく、「どこまで正常だったか」を10文字以上で書きます。" }
          : snapshot.viewer.kind === "participant" && !explanationSaved
            ? { title: "「この説明をみんなに共有」を押します", detail: "ひとり学習でも、保存が完了すると次のステップへ進めるようになります。" }
            : { title: "この実践課題は完了です", detail: "上の学習コーチに表示された次の操作へ進みます。" };

  useEffect(() => {
    if (!myExplanation) return;
    setObservations((current) => ({ ...current, [snapshot.room.phase]: myExplanation.text }));
  }, [myExplanation?.submittedAt, snapshot.room.phase]);

  const latestDiagnosticId = snapshot.room.diagnostics.at(-1)?.id;
  useEffect(() => {
    if (!pending || snapshot.room.diagnostics.length <= pending.diagnosticCount) return;
    const result = snapshot.room.diagnostics.at(-1);
    if (!result) return;
    setEntries((current) => [
      ...current,
      { id: nextEntryId.current++, lines: result.output, success: result.success, inference: result.inference },
    ]);
    onComplete(pending.milestone);
    setPending(null);
  }, [latestDiagnosticId, onComplete, pending, snapshot.room.diagnostics]);

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: "smooth" });
  }, [entries, pending]);

  const quickCommands = useMemo(
    () => QUICK_PRACTICE_COMMANDS.filter((item) => suggestedTasks.some((task) => task.command === item.command)),
    [suggestedTasks],
  );

  const appendOutput = (entry: Omit<TerminalEntry, "id">) => {
    setEntries((current) => [...current, { ...entry, id: nextEntryId.current++ }]);
  };

  const execute = async (commandValue = input) => {
    const parsed = parsePracticeCommand(commandValue);
    if (parsed.kind === "CLEAR") {
      setEntries([]);
      setInput("");
      return;
    }

    if (parsed.raw) {
      appendOutput({ command: parsed.raw, lines: [] });
      setCommandHistory((current) => [...current, parsed.raw]);
      setHistoryIndex(commandHistory.length + 1);
    }
    setInput("");

    if (parsed.kind === "OUTPUT") {
      appendOutput({ lines: parsed.lines, success: parsed.success, inference: parsed.inference });
      return;
    }

    if (parsed.kind === "LOCAL") {
      const result = localPracticeOutput(parsed.command, snapshot.room.interfaceConfig);
      appendOutput({ lines: result.lines, success: true, inference: result.inference });
      onComplete(parsed.milestone);
      return;
    }

    setPending({ command: parsed.raw, diagnosticCount: snapshot.room.diagnostics.length, milestone: parsed.milestone });
    try {
      await act({ type: "RUN_DIAGNOSTIC", tool: parsed.tool, target: parsed.target });
    } catch (error) {
      setPending(null);
      appendOutput({
        lines: [error instanceof Error ? `❌ ${error.message}` : "❌ コマンドを実行できませんでした。"],
        success: false,
        inference: "現在の学習ステップと接続状態を確認して、もう一度試します。",
      });
    }
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!pending && !busy) void execute();
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    if (commandHistory.length === 0) return;
    const nextIndex = event.key === "ArrowUp"
      ? Math.max(0, historyIndex - 1)
      : Math.min(commandHistory.length, historyIndex + 1);
    setHistoryIndex(nextIndex);
    setInput(nextIndex === commandHistory.length ? "" : commandHistory[nextIndex] ?? "");
  };

  return (
    <section className="panel practice-panel" id="practice-lab" aria-labelledby="practice-title">
      <div className="panel-heading practice-heading">
        <div><p className="panel-kicker">easy_Packetの操作体験を統合</p><h2 id="practice-title">実践ワークベンチ：自分で調べて確かめる</h2></div>
        <span>{completedSuggested} / {suggestedTasks.length} このステップの課題</span>
      </div>

      <div className="practice-cycle" aria-label="体験学習の進め方">
        <div><span>1</span><b>予想する</b><small>何が起きると思う？</small></div>
        <i>→</i>
        <div><span>2</span><b>実行する</b><small>コマンドを試す</small></div>
        <i>→</i>
        <div><span>3</span><b>観察する</b><small>成功・失敗を比べる</small></div>
        <i>→</i>
        <div><span>4</span><b>説明する</b><small>根拠を言葉にする</small></div>
      </div>

      <div className="inline-learning-lead practice-inline-lead" role="status">
        <span>次にやること</span><div><b>{practiceAction.title}</b><p>{practiceAction.detail}</p></div>
      </div>

      <div className="practice-layout">
        <aside className="practice-tasks" aria-label="実践課題">
          <h3>このステップで試すこと</h3>
          {suggestedTasks.map((task) => (
            <button type="button" key={task.id} className={completed.has(task.id) ? "done" : task.id === nextIncompleteTask?.id && predictionReady ? "guide-target" : ""} disabled={Boolean(pending) || busy} onClick={() => void execute(task.command)}>
              <span>{completed.has(task.id) ? "✓" : "○"}</span><div><b>{task.label}</b><code>{task.command}</code><small>{task.observation}</small></div>
            </button>
          ))}
          <label className={`practice-note-field ${!predictionReady && snapshot.viewer.kind === "participant" ? "guide-field" : ""}`}>実行前の予想
            <textarea rows={3} value={prediction} onChange={(event) => setPredictions((current) => ({ ...current, [snapshot.room.phase]: event.target.value }))} placeholder="例：IPでは届くが、名前では失敗すると思う。" />
            {snapshot.viewer.kind === "participant" && <small>{prediction.trim().length}文字 / まず5文字を目安に予想します（正解でなくて大丈夫）</small>}
          </label>
        </aside>

        <div className="practice-terminal">
          <div className="terminal-titlebar"><span /><span /><span /><b>practice-terminal — 学習用・外部通信なし</b></div>
          <div className="terminal-output" ref={outputRef} aria-live="polite">
            {entries.map((entry) => (
              <div className={`terminal-entry ${entry.success === false ? "failure" : entry.success ? "success" : ""}`} key={entry.id}>
                {entry.command && <code><b>$</b> {entry.command}</code>}
                {entry.lines.length > 0 && <pre>{entry.lines.join("\n")}</pre>}
                {entry.inference && <p><b>観察のポイント：</b>{entry.inference}</p>}
              </div>
            ))}
            {pending && <div className="terminal-pending"><i /> {pending.command} を実行しています…</div>}
          </div>
          <div className="quick-command-list" aria-label="クイックコマンド">
            {quickCommands.map((item) => <button type="button" key={item.command} disabled={Boolean(pending) || busy} onClick={() => setInput(item.command)} title={item.label}>{item.command}</button>)}
          </div>
          <label className="terminal-input-line"><span>$</span><input autoCapitalize="none" autoComplete="off" spellCheck={false} value={input} disabled={Boolean(pending) || busy} onChange={(event) => setInput(event.target.value)} onKeyDown={onInputKeyDown} placeholder="コマンドを入力して Enter（例: ping 192.168.10.1）" /><button type="button" disabled={Boolean(pending) || busy || !input.trim()} onClick={() => void execute()}>実行</button></label>
        </div>

        <aside className="practice-observation">
          <h3>結果を説明する</h3>
          <label>予想と比べて分かったこと
            <textarea rows={5} value={observation} onChange={(event) => {
              const value = event.target.value;
              setObservations((current) => ({ ...current, [snapshot.room.phase]: value }));
            }} placeholder="例：ゲートウェイには届いたので、PCからルータまでは正常だと分かった。" />
          </label>
          <div className={observation.trim().length >= 10 ? "explanation-ready" : "explanation-waiting"}>
            <span>{observation.trim().length >= 10 ? "✓" : "…"}</span>
            <p><b>{observation.trim().length >= 10 ? "根拠を言葉にできました" : "結果を1文で説明してみよう"}</b>成功・失敗だけでなく、「どこまでは正常か」を書くのがポイントです。</p>
          </div>
          {snapshot.viewer.kind === "participant" && (
            <button
              type="button"
              className="primary-button share-explanation-button"
              disabled={busy || observation.trim().length < 10 || explanationSaved}
              onClick={() => void act({ type: "SUBMIT_EXPLANATION", phase: snapshot.room.phase, text: observation })}
            >{explanationSaved ? "✓ みんなに共有済み" : "この説明をみんなに共有"}</button>
          )}
          <div className="shared-explanations" aria-label="みんなの説明">
            <div className="shared-explanations-heading"><h4>みんなの説明</h4><span>{phaseExplanations.length}件</span></div>
            <p className="shared-explanations-guide">正解を競う場所ではありません。ほかの人が、どの結果に注目したかを比べてみましょう。</p>
            {phaseExplanations.length === 0
              ? <p className="shared-explanations-empty">まだ説明はありません。最初の1件を共有してみましょう。</p>
              : <div className="shared-explanation-list">{phaseExplanations.map((item) => (
                <article key={`${item.participantId}-${item.phase}`} className={item.participantId === snapshot.viewer.participantId ? "mine" : ""}>
                  <header><b>{item.displayName}</b>{item.participantId === snapshot.viewer.participantId && <span>自分</span>}<time>{new Date(item.submittedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</time></header>
                  <p>{item.text}</p>
                </article>
              ))}</div>}
          </div>
          <ContextTerms ids={["ipconfig", "ping", "nslookup", "traceroute"]} title="調査コマンドの意味" />
        </aside>
      </div>
    </section>
  );
}
