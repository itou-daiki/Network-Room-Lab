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
    { id: 0, lines: ["学習用のコマンド実行画面です。", "まず左側の課題ボタンを押してください。コマンドは自動で実行されます。"] },
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
    ? { title: `「${pending.command}」の結果を待ちます`, detail: "終わると中央の学習用画面に、実行結果と「結果から分かること」が表示されます。" }
    : snapshot.viewer.kind === "participant" && !predictionReady
      ? { title: "まず「実行前の予想」を5文字以上で書きます", detail: "実行前と後の考えを比べるためです。正解でなくてよく、「届くと思う」だけでも始められます。" }
      : nextIncompleteTask
        ? { title: `左側の「${nextIncompleteTask.label}」を押します`, detail: "ボタンを押すと、表示中のコマンドが自動で実行されます。実行後は中央の「結果から分かること」を読みます。" }
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
        <div><p className="panel-kicker">教材ページが表示されるまでを、順番に確認</p><h2 id="practice-title">コマンド実験：通信のどこまで正常か確かめる</h2></div>
        <span>{completedSuggested} / {suggestedTasks.length} このステップの課題</span>
      </div>

      <div className="practice-cycle" aria-label="体験学習の進め方">
        <div><span>1</span><b>予想する</b><small>実行前の考えを書く</small></div>
        <i>→</i>
        <div><span>2</span><b>実行する</b><small>コマンドを試す</small></div>
        <i>→</i>
        <div><span>3</span><b>結果を見る</b><small>返事と確認項目を読む</small></div>
        <i>→</i>
        <div><span>4</span><b>説明する</b><small>根拠を言葉にする</small></div>
      </div>

      <div className="inline-learning-lead practice-inline-lead" role="status">
        <span>次にやること</span><div><b>{practiceAction.title}</b><p>{practiceAction.detail}</p></div>
      </div>

      <div className="practice-layout">
        <aside className="practice-tasks" aria-label="実践課題">
          <h3>目的を確認してから、課題ボタンを押します</h3>
          {suggestedTasks.map((task) => (
            <button type="button" key={task.id} className={completed.has(task.id) ? "done" : task.id === nextIncompleteTask?.id && predictionReady ? "guide-target" : ""} disabled={Boolean(pending) || busy} onClick={() => void execute(task.command)}>
              <span>{completed.has(task.id) ? "✓" : "○"}</span><div><b>{task.label}</b><small><strong>目的：</strong>{task.purpose}</small><code><em>実行するコマンド</em>{task.command}</code><small><strong>結果で見るところ：</strong>{task.observation}</small></div>
            </button>
          ))}
          <label className={`practice-note-field ${!predictionReady && snapshot.viewer.kind === "participant" ? "guide-field" : ""}`}>実行前の予想（正解でなくて大丈夫です）
            <textarea rows={3} value={prediction} onChange={(event) => setPredictions((current) => ({ ...current, [snapshot.room.phase]: event.target.value }))} placeholder="例：出口のルータから返事が来ると思う。" />
            {snapshot.viewer.kind === "participant" && <small>{prediction.trim().length}文字 / まず5文字を目安に予想します（正解でなくて大丈夫）</small>}
          </label>
        </aside>

        <div className="practice-terminal">
          <div className="terminal-titlebar"><span /><span /><span /><b>学習用の実行結果（実際の外部通信は行いません）</b></div>
          <div className="terminal-reading-guide"><b>英語の行は何ですか？</b><span>実際のPCで表示される結果に近い見本です。暗記や入力は不要です。実行後に表示される「この結果から分かること」の日本語を読めば進めます。</span></div>
          <div className="terminal-output" ref={outputRef} aria-live="polite">
            {entries.map((entry) => (
              <div className={`terminal-entry ${entry.success === false ? "failure" : entry.success ? "success" : ""}`} key={entry.id}>
                {entry.command && <code><b>$</b> {entry.command}</code>}
                {entry.lines.length > 0 && <pre>{entry.lines.join("\n")}</pre>}
                {entry.inference && <p><b>この結果から分かること：</b>{entry.inference}</p>}
              </div>
            ))}
            {pending && <div className="terminal-pending"><i /> {pending.command} を実行しています…</div>}
          </div>
          <div className="quick-command-list" aria-label="コマンドを自分で入力するときの候補">
            {quickCommands.map((item) => <button type="button" key={item.command} disabled={Boolean(pending) || busy} onClick={() => setInput(item.command)} title={item.label}>{item.command}</button>)}
          </div>
          <label className="terminal-input-line"><span>$</span><input aria-label="コマンドを自分で入力" autoCapitalize="none" autoComplete="off" spellCheck={false} value={input} disabled={Boolean(pending) || busy} onChange={(event) => setInput(event.target.value)} onKeyDown={onInputKeyDown} placeholder="慣れてきたら、コマンドを自分で入力できます" /><button type="button" disabled={Boolean(pending) || busy || !input.trim()} onClick={() => void execute()}>実行</button></label>
        </div>

        <aside className="practice-observation">
          <h3>結果を根拠に、分かったことを書く</h3>
          <label>実行前の予想と比べて分かったこと
            <textarea rows={5} value={observation} onChange={(event) => {
              const value = event.target.value;
              setObservations((current) => ({ ...current, [snapshot.room.phase]: value }));
            }} placeholder="例：ゲートウェイには届いたので、PCからルータまでは正常だと分かった。" />
          </label>
          <div className={observation.trim().length >= 10 ? "explanation-ready" : "explanation-waiting"}>
            <span>{observation.trim().length >= 10 ? "✓" : "…"}</span>
            <p><b>{observation.trim().length >= 10 ? "結果を根拠に説明できました" : "結果を使って1文で説明します"}</b>「成功・失敗」だけでなく、「どの機器までは届いたか」を入れると原因を絞れます。</p>
          </div>
          {snapshot.viewer.kind === "participant" && (
            <button
              type="button"
              className="primary-button share-explanation-button"
              disabled={busy || observation.trim().length < 10 || explanationSaved}
              onClick={() => void act({ type: "SUBMIT_EXPLANATION", phase: snapshot.room.phase, text: observation })}
            >{explanationSaved ? "✓ 説明を保存・共有済み" : "この説明を保存して、同じ部屋のみんなと共有"}</button>
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
          <ContextTerms ids={["ipconfig", "ping", "nslookup", "traceroute"]} title="この画面で使った確認コマンド" />
        </aside>
      </div>
    </section>
  );
}
