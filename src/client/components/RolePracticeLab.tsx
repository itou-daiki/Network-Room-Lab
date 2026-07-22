import { useEffect, useMemo, useState } from "react";

import { CORE_ROLE_IDS, ROLE_PRACTICES, ROLE_READING_GUIDES, rolePractice, type CoreRoleId } from "../../shared/rolePractice";
import { roleDefinition } from "../../shared/scenario";
import type { RoomSnapshot } from "../../shared/types";
import { ContextTerms } from "./Glossary";

interface RolePracticeLabProps {
  snapshot: RoomSnapshot;
  completed: ReadonlySet<CoreRoleId>;
  onComplete: (role: CoreRoleId) => void;
}

export function RolePracticeLab({ snapshot, completed, onComplete }: RolePracticeLabProps) {
  const assignedPractice = snapshot.viewer.role ? rolePractice(snapshot.viewer.role) : undefined;
  const canChooseRole = snapshot.room.learningMode === "SOLO" || snapshot.viewer.kind === "teacher" || snapshot.viewer.role === "OBSERVER";
  const initialRole = assignedPractice?.role ?? CORE_ROLE_IDS[0]!;
  const [activeRole, setActiveRole] = useState<CoreRoleId>(initialRole);
  const [selections, setSelections] = useState<Partial<Record<CoreRoleId, string>>>({});
  const [explanations, setExplanations] = useState<Partial<Record<CoreRoleId, string>>>({});

  useEffect(() => {
    if (!canChooseRole && assignedPractice) setActiveRole(assignedPractice.role);
  }, [assignedPractice?.role, canChooseRole]);

  const practice = rolePractice(activeRole) ?? ROLE_PRACTICES[0]!;
  const role = roleDefinition(practice.role);
  const selected = practice.choices.find((choice) => choice.id === selections[practice.role]);
  const explanation = explanations[practice.role] ?? "";
  const isComplete = completed.has(practice.role);
  const completedCount = CORE_ROLE_IDS.filter((roleId) => completed.has(roleId)).length;
  const roleIndex = CORE_ROLE_IDS.indexOf(practice.role);

  const nextIncompleteRole = useMemo(
    () => CORE_ROLE_IDS.find((roleId) => roleId !== practice.role && !completed.has(roleId)),
    [completed, practice.role],
  );

  const finishRole = () => {
    onComplete(practice.role);
    if (canChooseRole && nextIncompleteRole) setActiveRole(nextIncompleteRole);
  };

  return (
    <section className="panel role-practice-panel" aria-labelledby="role-practice-title">
      <div className="panel-heading role-practice-heading">
        <div><p className="panel-kicker">役割ごとに手を動かして確認</p><h2 id="role-practice-title">6つの機器役割 実践ラボ</h2></div>
        <span>{canChooseRole ? `${completedCount} / ${CORE_ROLE_IDS.length} 役割完了` : isComplete ? "この役割を完了" : "担当役割を実習中"}</span>
      </div>

      {canChooseRole && (
        <div className="role-practice-tabs" role="tablist" aria-label="実習する役割">
          {ROLE_PRACTICES.map((item, index) => {
            const definition = roleDefinition(item.role);
            return (
              <button
                type="button"
                role="tab"
                aria-selected={item.role === practice.role}
                className={`${item.role === practice.role ? "active" : ""} ${completed.has(item.role) ? "complete" : ""}`}
                key={item.role}
                onClick={() => setActiveRole(item.role)}
                style={{ "--role-accent": definition.accent } as React.CSSProperties}
              ><span>{completed.has(item.role) ? "✓" : index + 1}</span><b>{definition.shortLabel}</b><small>{definition.label}</small></button>
            );
          })}
        </div>
      )}

      <div className="role-practice-intro" style={{ "--role-accent": role.accent } as React.CSSProperties}>
        <span>{String(roleIndex + 1).padStart(2, "0")}</span>
        <div><small>今回の役割</small><h3>{role.label}</h3><p>{practice.mission}</p></div>
        <em>{role.shortLabel}</em>
      </div>

      <div className="role-practice-cycle" aria-label="役割実習の進め方">
        <span><b>1 観察</b>届いた情報を見る</span><i>→</i>
        <span><b>2 判断</b>次の操作を選ぶ</span><i>→</i>
        <span><b>3 実行</b>機器の変化を確認</span><i>→</i>
        <span><b>4 説明</b>根拠を言葉にする</span>
      </div>

      <details className="role-reading-guide" open>
        <summary><span>?</span><div><b>値の見方・確認方法</b><small>{role.label}で「どこを見るか」を先に確認</small></div><em>開く／閉じる</em></summary>
        <div className="role-reading-guide-grid">
          {ROLE_READING_GUIDES[practice.role].map((item) => (
            <article key={item.target}>
              <code>{item.target}</code>
              <p><b>読み方</b>{item.reading}</p>
              <p><b>確認方法</b>{item.check}</p>
            </article>
          ))}
        </div>
      </details>

      <div className="role-practice-layout">
        <div className="role-console">
          <div className="role-console-title"><span />{practice.observationTitle}</div>
          <p>{practice.situation}</p>
          <dl>{practice.observations.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
          <small>表示されている情報だけを使って、次の操作を考えます。</small>
        </div>

        <div className="role-decision">
          <small>あなたの判断</small>
          <h3>{practice.question}</h3>
          <div className="role-choice-list">
            {practice.choices.map((choice, index) => (
              <button
                type="button"
                key={choice.id}
                aria-pressed={selected?.id === choice.id}
                className={selected?.id === choice.id ? choice.correct ? "selected correct" : "selected wrong" : ""}
                onClick={() => setSelections((current) => ({ ...current, [practice.role]: choice.id }))}
              ><span>{String.fromCharCode(65 + index)}</span><b>{choice.label}</b></button>
            ))}
          </div>
          {selected && <div className={`role-choice-feedback ${selected.correct ? "success" : "failure"}`} role="status"><span>{selected.correct ? "✓" : "×"}</span><p><b>{selected.correct ? "その操作で進めます" : "もう一度、観察情報を確認"}</b>{selected.feedback}</p></div>}
        </div>

        <div className={`role-result ${selected?.correct ? "success" : "waiting"}`}>
          <small>実行後の変化</small>
          <h3>{selected?.correct ? practice.successTitle : "正しい操作を選ぶと、機器の変化が表示されます"}</h3>
          {selected?.correct
            ? <pre>{practice.successOutput.join("\n")}</pre>
            : <div className="role-result-placeholder"><i /><i /><i /><p>左の観察情報と役割の仕事を結びつけます。</p></div>}
        </div>
      </div>

      <div className="role-explanation-area">
        <div>
          <small>この役割として説明する</small>
          <label>{practice.explainPrompt}<textarea rows={3} value={explanation} onChange={(event) => setExplanations((current) => ({ ...current, [practice.role]: event.target.value }))} placeholder="観察した値や表を根拠に、10文字以上で説明します。" /></label>
        </div>
        <button type="button" className="primary-button" disabled={!selected?.correct || explanation.trim().length < 10 || isComplete} onClick={finishRole}>{isComplete ? "✓ この役割は完了済み" : canChooseRole && nextIncompleteRole ? "この役割を完了して次へ →" : "この役割の実習を完了"}</button>
      </div>

      <ContextTerms ids={practice.termIds} title={`${role.label}で使う用語`} />
    </section>
  );
}
