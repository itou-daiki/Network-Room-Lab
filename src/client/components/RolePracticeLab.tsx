import { useEffect, useMemo, useState } from "react";

import { CORE_ROLE_IDS, ROLE_PRACTICES, ROLE_READING_GUIDES, ROLE_STAGE_TERM_IDS, rolePractice, type CoreRoleId, type RolePracticeStage } from "../../shared/rolePractice";
import { LEARNING_SCENARIO_GOAL, roleDefinition } from "../../shared/scenario";
import type { ClientAction, RoomSnapshot } from "../../shared/types";
import { ContextTerms } from "./Glossary";
import { LearningRouteMap } from "./LearningRouteMap";

interface RolePracticeLabProps {
  snapshot: RoomSnapshot;
  completed: ReadonlySet<CoreRoleId>;
  onComplete: (role: CoreRoleId) => void;
  act: (action: ClientAction) => Promise<void>;
  busy?: boolean;
  onContinue?: () => void;
}

const ROLE_ROUTE_NODE: Record<CoreRoleId, string> = {
  CLIENT_PC: "pc",
  ACCESS_POINT: "ap",
  L2_SWITCH: "switch",
  ROUTER: "router",
  DNS_SERVER: "dns",
  WEB_SERVER: "web",
};

export function RolePracticeLab({ snapshot, completed, onComplete, act, busy = false, onContinue }: RolePracticeLabProps) {
  const assignedPractice = snapshot.viewer.role ? rolePractice(snapshot.viewer.role) : undefined;
  const isSolo = snapshot.room.learningMode === "SOLO";
  const canBrowseRoles = snapshot.viewer.kind === "teacher" || snapshot.viewer.role === "OBSERVER";
  const firstIncompleteRole = CORE_ROLE_IDS.find((roleId) => !completed.has(roleId));
  const initialRole = isSolo ? firstIncompleteRole ?? CORE_ROLE_IDS[0]! : assignedPractice?.role ?? CORE_ROLE_IDS[0]!;
  const [activeRole, setActiveRole] = useState<CoreRoleId>(initialRole);
  const [introduced, setIntroduced] = useState<Partial<Record<CoreRoleId, boolean>>>({});
  const [observed, setObserved] = useState<Partial<Record<CoreRoleId, boolean>>>({});
  const [selections, setSelections] = useState<Partial<Record<CoreRoleId, string>>>({});
  const [resultReviewed, setResultReviewed] = useState<Partial<Record<CoreRoleId, boolean>>>({});
  const [explanations, setExplanations] = useState<Partial<Record<CoreRoleId, string>>>({});
  const [hints, setHints] = useState<Partial<Record<CoreRoleId, boolean>>>({});

  useEffect(() => {
    if (!isSolo && !canBrowseRoles && assignedPractice) {
      setActiveRole(assignedPractice.role);
      return;
    }
    if (isSolo && firstIncompleteRole && completed.has(activeRole)) setActiveRole(firstIncompleteRole);
  }, [activeRole, assignedPractice?.role, canBrowseRoles, completed, firstIncompleteRole, isSolo]);

  const practice = rolePractice(activeRole) ?? ROLE_PRACTICES[0]!;
  const role = roleDefinition(practice.role);
  const selected = practice.choices.find((choice) => choice.id === selections[practice.role]);
  const explanation = explanations[practice.role] ?? "";
  const explanationReady = explanation.trim().length >= 10 && explanation.trim() !== practice.sentenceStarter;
  const isComplete = completed.has(practice.role);
  const completedCount = CORE_ROLE_IDS.filter((roleId) => completed.has(roleId)).length;
  const allComplete = completedCount === CORE_ROLE_IDS.length;
  const roleExplanations = snapshot.explanations.filter((item) => item.phase === "ROLES");
  const hasIntroduction = Boolean(introduced[practice.role]) || isComplete;
  const hasObserved = Boolean(observed[practice.role]) || isComplete;
  const hasCorrectDecision = Boolean(selected?.correct) || isComplete;
  const hasReviewedResult = Boolean(resultReviewed[practice.role]) || isComplete;
  const currentStage = !hasIntroduction ? 1 : !hasObserved ? 2 : !hasCorrectDecision ? 3 : !hasReviewedResult ? 4 : 5;
  const currentStageTerms = ROLE_STAGE_TERM_IDS[practice.role][currentStage as RolePracticeStage];
  const currentAction = isComplete
    ? { title: "この役割は完了しています", detail: allComplete ? "上の緑色のボタンから機器構成へ進みます。" : "上の役割一覧で「いまここ」と表示された次の役割へ進みます。" }
    : currentStage === 1
      ? { title: `まず「${role.label}」の役割と今回のゴールを確認します`, detail: "身近な例と「いま起きたこと」を読み、何を達成する役割なのかをつかみます。専門用語は次の段階で説明します。" }
      : currentStage === 2
        ? { title: `「${practice.observationTitle}」に表示された4項目を確認します`, detail: `${practice.observationPurpose} 項目名、表示内容、そこから分かることを1番から順に読みます。` }
      : currentStage === 3
      ? selected && !selected.correct
        ? { title: "表示された理由またはヒントを読み、別の答えを選びます", detail: "間違いは減点されません。A・B・Cは何度でも選び直せます。" }
        : { title: "目的を思い出して、A・B・Cから操作を1つ選びます", detail: `解決したいことは「${practice.mission}」です。迷ったときは「ヒントを見る」を押してから選べます。` }
      : currentStage === 4
        ? { title: "操作後に、機器の中で起きたことを順番に確認します", detail: "黒い枠は入力するコマンドではありません。操作によって機器が行った処理を、学習用に整理した記録です。" }
        : explanationReady
          ? { title: "青い完了ボタンを押します", detail: "目的・選んだ操作・結果を自分の言葉で説明できました。完了すると次の役割へ移ります。" }
          : { title: "この操作が必要だった理由を、自分の言葉で1文書きます", detail: "問いの下にある「書き出し」や「使える言葉」を押してから、続きを書いても構いません。" };

  const nextIncompleteRole = useMemo(
    () => CORE_ROLE_IDS.find((roleId) => roleId !== practice.role && !completed.has(roleId)),
    [completed, practice.role],
  );
  const canMoveToNextRole = Boolean(nextIncompleteRole) && (isSolo || canBrowseRoles);

  const finishRole = async () => {
    if (!isSolo && snapshot.viewer.kind === "participant") {
      await act({ type: "SUBMIT_EXPLANATION", phase: "ROLES", text: `【${role.label}】${explanation.trim()}` });
    }
    onComplete(practice.role);
    if (canMoveToNextRole && nextIncompleteRole) setActiveRole(nextIncompleteRole);
  };

  const addKeyword = (keyword: string) => {
    setExplanations((current) => {
      const before = current[practice.role]?.trimEnd() ?? "";
      if (before.includes(keyword)) return current;
      return { ...current, [practice.role]: `${before}${before ? "、" : ""}${keyword}` };
    });
  };

  const chooseRole = (roleId: CoreRoleId) => {
    const unlocked = canBrowseRoles || !isSolo || completed.has(roleId) || roleId === firstIncompleteRole;
    if (unlocked) setActiveRole(roleId);
  };

  return (
    <section className="panel role-practice-panel" id="role-practice-lab" aria-labelledby="role-practice-title">
      <div className="panel-heading role-practice-heading">
        <div><p className="panel-kicker">画面の案内どおりに1つずつ</p><h2 id="role-practice-title">機器になって、通信を動かそう</h2></div>
        <span>{isSolo || canBrowseRoles ? `${completedCount} / ${CORE_ROLE_IDS.length} 役割完了` : isComplete ? "担当役割を完了" : "担当役割を学習中"}</span>
      </div>

      <div className="role-overall-goal" role="note">
        <span>この実習全体のゴール</span>
        <div><h3>{LEARNING_SCENARIO_GOAL.title}</h3><code>{LEARNING_SCENARIO_GOAL.url}</code><p>{LEARNING_SCENARIO_GOAL.detail}</p></div>
      </div>

      <div className="role-sequence-note" role="note">
        <span>役割番号について</span>
        <p><b>1〜6は、機器の仕事を学ぶ順番です。</b>通信が実際に進む順番ではありません。ここでは各機器の代表的な場面を体験し、後の「通信実験」で質問・要求・返事が進む順番を17段階で確かめます。</p>
      </div>

      <LearningRouteMap
        compact
        activeNodeId={ROLE_ROUTE_NODE[practice.role]}
        focus={practice.role === "DNS_SERVER" ? "dns" : practice.role === "WEB_SERVER" ? "web" : practice.role === "ROUTER" ? "gateway" : "all"}
      />

      {allComplete && (
        <div className="role-all-complete" role="status">
          <span>✓</span>
          <div><small>6つの役割をすべて体験しました</small><h3>通信は、機器どうしのリレーで届きます</h3><p>次は、機器がどの順番でつながっているかを確かめます。</p></div>
          {onContinue && <button type="button" className="primary-button" disabled={busy} onClick={onContinue}>次の「機器構成」へ進む →</button>}
        </div>
      )}

      {(isSolo || canBrowseRoles) && (
        <div className="role-practice-tabs" role="tablist" aria-label="役割の進み具合">
          {ROLE_PRACTICES.map((item, index) => {
            const definition = roleDefinition(item.role);
            const unlocked = canBrowseRoles || completed.has(item.role) || item.role === firstIncompleteRole || allComplete;
            return (
              <button
                type="button"
                role="tab"
                aria-selected={item.role === practice.role}
                aria-label={`${index + 1} ${definition.label}${completed.has(item.role) ? " 完了" : unlocked ? " 学習中" : " まだ選べません"}`}
                className={`${item.role === practice.role ? "active" : ""} ${completed.has(item.role) ? "complete" : ""} ${!unlocked ? "locked" : ""}`}
                key={item.role}
                disabled={!unlocked}
                onClick={() => chooseRole(item.role)}
                style={{ "--role-accent": definition.accent } as React.CSSProperties}
              ><span>{completed.has(item.role) ? "✓" : index + 1}</span><b>{definition.shortLabel}</b><small>{completed.has(item.role) ? "完了・見直せます" : item.role === firstIncompleteRole ? "いまここ" : "このあと"}</small></button>
            );
          })}
        </div>
      )}

      <div className="role-practice-stage" aria-label={`5段階のうち${currentStage}段階目`}>
        {[
          [1, "役割", "目的を知る"],
          [2, "情報", "判断材料を見る"],
          [3, "選ぶ", "操作を決める"],
          [4, "結果", "起きたことを見る"],
          [5, "説明", "理由を言葉にする"],
        ].map(([stage, label, note]) => (
          <div key={stage} className={currentStage === stage ? "current" : currentStage > Number(stage) || isComplete ? "done" : "future"}>
            <span>{currentStage > Number(stage) || isComplete ? "✓" : stage}</span><p><b>{label}</b><small>{note}</small></p>
          </div>
        ))}
      </div>

      <div className="inline-learning-lead" id="role-practice-current" role="status">
        <span>次にやること</span><div><b>{currentAction.title}</b><p>{currentAction.detail}</p></div>
      </div>

      {currentStage === 1 && (
        <div className="role-guided-step">
          <header><span>1</span><div><small>今回あなたが担当する機器</small><h3>{role.label}</h3><p>{practice.beginnerStory}</p></div></header>
          <div className="role-goal"><span>学習指導要領ページを見るための、{role.label}の仕事</span><p>{practice.mission}</p></div>
          <div className="role-analogy"><span aria-hidden="true">💡</span><p><b>身近なものに例えると</b>{practice.everydayExample}</p></div>
          <div className="role-situation"><span>いま起きたこと</span><p>{practice.situation}</p></div>
          <div className="role-safe-note"><span>✓</span><p><b>ここでは役割と目的だけ分かれば大丈夫です</b>次の段階で、判断に使う情報を1項目ずつ確認します。</p></div>
          <button type="button" className="primary-button role-main-action" onClick={() => setIntroduced((current) => ({ ...current, [practice.role]: true }))}>役割とゴールを確認した → 情報を見る</button>
        </div>
      )}

      {currentStage === 2 && (
        <div className="role-guided-step">
          <header><span>2</span><div><small>次の操作を決めるための情報</small><h3>{practice.observationTitle}</h3><p>{practice.observationPurpose}</p></div></header>
          <h4 className="observation-heading">「{practice.observationTitle}」に表示された4項目を、1番から順に確認します</h4>
          <div className="beginner-observation-list">
            {practice.observations.map((item, index) => (
              <article key={item.label}>
                <span>{index + 1}</span><div><small>{item.label}</small><code>{item.value}</code><p>{item.meaning}</p></div>
              </article>
            ))}
          </div>
          <div className="role-safe-note"><span>✓</span><p><b>番号や英字を暗記する必要はありません</b>各項目が何を表し、今回の判断にどう使うかが分かれば進めます。</p></div>
          <div className="role-decision-actions">
            <button type="button" className="text-button" onClick={() => setIntroduced((current) => ({ ...current, [practice.role]: false }))}>← 役割とゴールへ戻る</button>
            <button type="button" className="primary-button" onClick={() => setObserved((current) => ({ ...current, [practice.role]: true }))}>{practice.observationTitle}を確認した → 操作を選ぶ</button>
          </div>
        </div>
      )}

      {currentStage === 3 && (
        <div className="role-guided-step">
          <header><span>3</span><div><small>目的に合う操作を1つ選びます</small><h3>{practice.question}</h3><p>間違えても減点はありません。選ぶと、その操作で進めるかと理由が表示されます。</p></div></header>
          <div className="role-choice-list beginner-choice-list">
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
          {selected && !selected.correct && (
            <div className="role-choice-feedback failure" role="status"><span>↻</span><p><b>大丈夫。考え方を1つ確認しましょう</b>{selected.feedback}</p></div>
          )}
          <div className="role-decision-actions">
            <button type="button" className="text-button" onClick={() => setObserved((current) => ({ ...current, [practice.role]: false }))}>← {practice.observationTitle}へ戻る</button>
            <button type="button" className="secondary-button" onClick={() => setHints((current) => ({ ...current, [practice.role]: !current[practice.role] }))}>{hints[practice.role] ? "ヒントを閉じる" : "ヒントを見る"}</button>
          </div>
          {hints[practice.role] && <div className="role-hint" role="note"><span>ヒント</span><p>{practice.decisionHint}</p></div>}
        </div>
      )}

      {currentStage === 4 && (
        <div className="role-guided-step">
          <header className="success"><span>4</span><div><small>選んだ操作によって起きたこと</small><h3>{practice.successTitle}</h3><p>黒い枠はコマンド入力欄ではありません。機器の中で行われた処理を、学習用に順番に示しています。</p></div></header>
          <div className="beginner-result-list">
            {practice.successOutput.map((line, index) => <article key={line}><small>機器の動作記録</small><code>{line}</code><p><span>ここから分かること</span>{practice.successMeanings[index]}</p></article>)}
          </div>
          <div className="role-safe-note"><span>i</span><p><b>この記録を自分で入力する必要はありません</b>次の段階では、この操作が必要だった理由を1文で説明します。</p></div>
          <button type="button" className="primary-button role-main-action" onClick={() => setResultReviewed((current) => ({ ...current, [practice.role]: true }))}>結果を確認した → 理由を説明する</button>
        </div>
      )}

      {currentStage === 5 && (
        <div className="role-guided-step">
          <header className="success"><span>5</span><div><small>目的と結果をつなげて説明します</small><h3>{practice.explainPrompt}</h3><p>正解の文章を暗記するのではなく、なぜこの操作が必要だったかを自分の言葉で1文にします。</p></div></header>
          <div className="beginner-explanation">
            <small>説明を作る手助け</small>
            <h3>{practice.explainPrompt}</h3>
            <p>下の「書き出し」や「使える言葉」を押しても構いません。</p>
            <button type="button" className="sentence-starter" onClick={() => setExplanations((current) => ({ ...current, [practice.role]: current[practice.role]?.trim() ? current[practice.role] : practice.sentenceStarter }))}><span>書き出し</span>{practice.sentenceStarter}…</button>
            <div className="keyword-helper"><span>使える言葉</span>{practice.explainKeywords.map((keyword) => <button type="button" key={keyword} onClick={() => addKeyword(keyword)}>＋ {keyword}</button>)}</div>
            <label>
              あなたの説明
              <textarea rows={3} value={explanation} onChange={(event) => setExplanations((current) => ({ ...current, [practice.role]: event.target.value }))} placeholder="上の書き出しを押して、続きを書いてみましょう。" />
              <small className={explanationReady ? "ready" : ""}>{explanation.trim() === practice.sentenceStarter ? "書き出しの続きに、使える言葉を1つ足してみましょう" : `${explanation.trim().length}文字 / 10文字以上で完了できます`}</small>
            </label>
          </div>

          <div className="role-finish-actions">
            {!isComplete && <button type="button" className="text-button" onClick={() => setResultReviewed((current) => ({ ...current, [practice.role]: false }))}>← 操作後の結果へ戻る</button>}
            <button type="button" className="primary-button" disabled={busy || !explanationReady || isComplete} onClick={() => void finishRole().catch(() => undefined)}>{isComplete ? "✓ この役割は完了済み" : canMoveToNextRole ? "この役割を完了して、次へ →" : !isSolo && snapshot.viewer.kind === "participant" ? "説明を共有して、実習を完了する" : "この役割の実習を完了する"}</button>
          </div>

          {!isSolo && (
            <div className="shared-explanations role-shared-explanations" aria-label="チームの説明">
              <div className="shared-explanations-heading"><h4>チームのみんなの説明</h4><span>{roleExplanations.length}件</span></div>
              <p className="shared-explanations-guide">役割によって見える情報が違います。正解を写すのではなく、「画面のどの情報を根拠にしたか」を比べます。</p>
              {roleExplanations.length === 0
                ? <p className="shared-explanations-empty">まだ説明はありません。あなたの説明を共有すると、ここに表示されます。</p>
                : <div className="shared-explanation-list">{roleExplanations.map((item) => (
                    <article key={`${item.participantId}-${item.phase}`} className={item.participantId === snapshot.viewer.participantId ? "mine" : ""}>
                      <header><b>{item.displayName}</b>{item.participantId === snapshot.viewer.participantId && <span>自分</span>}<time>{new Date(item.submittedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</time></header>
                      <p>{item.text}</p>
                    </article>
                  ))}</div>}
            </div>
          )}
        </div>
      )}

      <details className="role-support-details">
        <summary><span>?</span><div><b>実際のPCや機器で、今回見た情報を確かめる方法</b><small>役割の5段階を終えた後、同じ情報が実機のどこに表示されるかを知りたいときに開きます</small></div><em>＋</em></summary>
        <div className="role-reading-guide-grid">
          {ROLE_READING_GUIDES[practice.role].map((item) => (
            <article key={item.target}><code>{item.target}</code><p><b>画面での読み方</b>{item.reading}</p><p><b>実際の機器での確認手順</b>{item.check}</p></article>
          ))}
        </div>
      </details>

      <details className="role-support-details term-support-details">
        <summary><span>あ</span><div><b>このセクションで出てきた用語</b><small>いま表示している「{currentStage === 1 ? "役割・目的を知る" : currentStage === 2 ? "情報・判断材料を見る" : currentStage === 3 ? "選ぶ・操作を決める" : currentStage === 4 ? "結果・起きたことを見る" : "説明・理由を言葉にする"}」の用語だけを表示します</small></div><em>＋</em></summary>
        <ContextTerms ids={currentStageTerms} title="このセクションで出てきた用語" />
      </details>
    </section>
  );
}
