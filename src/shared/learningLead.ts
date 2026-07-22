import { PRACTICE_TASKS, type PracticeMilestone } from "./practice";
import { CORE_ROLE_IDS, type CoreRoleId } from "./rolePractice";
import { PROTOCOL_STEPS, REFLECTION_PROMPTS, roleDefinition } from "./scenario";
import type { RoomSnapshot } from "./types";

export interface LearningLead {
  title: string;
  detail: string;
  after: string;
  targetId?: string;
  targetLabel?: string;
  state: "action" | "waiting" | "complete";
}

const taskLabel = (milestone: PracticeMilestone) =>
  PRACTICE_TASKS.find((task) => task.id === milestone)?.label ?? milestone;

const hasMyExplanation = (snapshot: RoomSnapshot) =>
  snapshot.explanations.some((item) => item.participantId === snapshot.viewer.participantId && item.phase === snapshot.room.phase);

export function learningLead(
  snapshot: RoomSnapshot,
  practiceCompleted: ReadonlySet<PracticeMilestone>,
  rolePracticeCompleted: ReadonlySet<CoreRoleId>,
): LearningLead {
  const isSolo = snapshot.room.learningMode === "SOLO";
  const phase = snapshot.room.phase;

  if (phase === "LOBBY") {
    return snapshot.viewer.kind === "teacher"
      ? { title: "参加者へ部屋コードを伝えます", detail: "参加者がそろったら、先生用パネルで「役割確認」へ進めます。", after: "参加者へ役割を割り当てます。", targetId: "teacher-panel", targetLabel: "先生用パネルへ", state: "action" }
      : { title: "このまま待てば大丈夫です", detail: "先生が授業を開始すると、画面は自動で役割確認へ切り替わります。", after: "自分の担当機器が表示されます。", state: "waiting" };
  }

  if (phase === "ROLES") {
    const remaining = CORE_ROLE_IDS.filter((roleId) => !rolePracticeCompleted.has(roleId)).length;
    if (isSolo && remaining === 0) {
      return { title: "緑色の「機器構成へ進む」を押します", detail: "6つの役割は完了しています。役割ラボの一番上に完了ボタンがあります。", after: "機器がつながる順番を確かめます。", targetId: "role-practice-lab", targetLabel: "完了ボタンへ", state: "action" };
    }
    if (snapshot.viewer.kind === "teacher") {
      return { title: "参加者へ役割を割り当てます", detail: "先生用パネルで担当を確認し、準備ができたら次のフェーズへ進めます。", after: "各担当が同じ構成図を見られます。", targetId: "teacher-panel", targetLabel: "先生用パネルへ", state: "action" };
    }
    return { title: "青く表示された「次にやること」だけを進めます", detail: isSolo ? `残り${remaining}役です。役割・情報・操作・結果・説明の5段階を、上から1つずつ進めます。` : "担当機器の目的を確認してから、情報・操作・結果・説明の順に進めます。", after: "完了すると次の役割または機器構成へ進めます。", targetId: "role-practice-current", targetLabel: "現在の課題へ", state: "action" };
  }

  if (!isSolo) {
    if (snapshot.viewer.kind === "teacher") {
      return { title: "先生用パネルで、このフェーズの進行を確認します", detail: "参加者の操作と活動履歴を見ながら、必要な案内や次のフェーズへの切り替えを行います。", after: "参加者全員の画面が同時に更新されます。", targetId: "teacher-panel", targetLabel: "先生用パネルへ", state: "action" };
    }
    if (phase === "PROTOCOL" && snapshot.room.protocolIndex < PROTOCOL_STEPS.length) {
      const step = PROTOCOL_STEPS[snapshot.room.protocolIndex]!;
      const actorAssigned = snapshot.room.participants.some((participant) => participant.role === step.actorRole);
      if (actorAssigned && snapshot.viewer.role !== step.actorRole) {
        return { title: `${roleDefinition(step.actorRole).label}の操作を待ちます`, detail: "担当者が進めると画面は自動で更新されます。その間、経路図で通信データの現在地を見ます。", after: "自分の担当になったら選択肢が押せるようになります。", targetId: "topology-panel", targetLabel: "現在地を見る", state: "waiting" };
      }
      return actorAssigned
        ? { title: `あなたの番です。全17段階の${step.index + 1}で、操作を1つ選びます`, detail: `学習指導要領ページの表示に近づけるため、「${step.title}」を行う操作をA・B・Cから選びます。`, after: "目的に合う操作を選ぶと、通信データを次の担当へ渡せます。", targetId: "mission-panel", targetLabel: "選択肢へ", state: "action" }
        : { title: `班で担当します。全17段階の${step.index + 1}で、操作を1つ選びます`, detail: `${roleDefinition(step.actorRole).label}の担当者がいないため、班のみんなで「${step.title}」を行う操作を考えます。`, after: "班の誰かが目的に合う操作を選ぶと、全員の画面が次へ進みます。", targetId: "mission-panel", targetLabel: "選択肢へ", state: "action" };
    }
    if (phase === "REFLECTION") {
      const myReflectionIds = new Set(snapshot.reflections.filter((item) => item.participantId === snapshot.viewer.participantId).map((item) => item.promptId));
      const nextPromptIndex = REFLECTION_PROMPTS.findIndex((prompt) => !myReflectionIds.has(prompt.id));
      return nextPromptIndex >= 0
        ? { title: `振り返り ${nextPromptIndex + 1} を1文で書き、「保存」を押します`, detail: REFLECTION_PROMPTS[nextPromptIndex]!.label, after: "保存すると次の問いへ進みます。", targetId: "mission-panel", targetLabel: "記入欄へ", state: "action" }
        : { title: "3つの振り返りを保存できました", detail: "ほかの担当者の説明や活動履歴を読み、チームで気付きを共有します。", after: "先生のまとめを待ちます。", targetId: "mission-panel", targetLabel: "保存内容を見る", state: "complete" };
    }
    return { title: "「いま取り組むこと」カードを確認します", detail: "学習指導要領ページを表示するために、いまの担当が行う仕事を確認します。操作できないときは、担当者の画面更新を待てば大丈夫です。", after: "カード内の案内に沿って、次の1操作へ進みます。", targetId: "mission-panel", targetLabel: "現在の課題へ", state: "action" };
  }

  if (phase === "TOPOLOGY") {
    const downLink = snapshot.room.links.find((link) => !link.up);
    const pingDone = practiceCompleted.has("PING_GATEWAY");
    if (downLink && !pingDone) {
      return { title: "「PCから最初の出口まで届くか確かめる」を押します", detail: `現在「${downLink.medium}」の接続が切れています。コマンド実験で、PCから出口のルータへ返事が来ないことを確かめます。`, after: "結果を確認したら、切断した接続線を元に戻します。", targetId: "practice-lab", targetLabel: "確認課題へ", state: "action" };
    }
    if (downLink) {
      return { title: "切断した接続線をもう一度押して、元に戻します", detail: "赤い破線になっている同じ接続線を押します。すべての線が接続中になれば完了です。", after: "実行結果を1文で説明します。", targetId: "topology-panel", targetLabel: "切れた線へ", state: "action" };
    }
    if (!pingDone) {
      return { title: "全体図の接続線を1本押して、切断します", detail: "Wi-FiまたはEthernetの線を1本だけ選びます。失敗しても、同じ線をもう一度押せば戻せます。", after: "切れた状態でpingを試します。", targetId: "topology-panel", targetLabel: "接続線へ", state: "action" };
    }
    if (!hasMyExplanation(snapshot)) {
      return { title: "確認結果から分かったことを1文で書きます", detail: "コマンド実験の右側へ、「PCからどの機器までは届いたか」を10文字以上で書き、保存します。", after: "「IP設定」へ進めるようになります。", targetId: "practice-lab", targetLabel: "説明欄へ", state: "action" };
    }
    return { title: "「次のステップへ」を押します", detail: "接続実験・ping・説明がすべて完了しました。", after: "PCのIP設定を体験します。", targetId: "solo-progress", targetLabel: "次へ進む", state: "complete" };
  }

  if (phase === "ADDRESSING") {
    const configured = snapshot.room.latestEvents.some((event) => event.type === "CONFIGURE_INTERFACE");
    if (!configured) {
      return { title: "IP設定カードの青い「次にやること」を進めます", detail: "まず誤ったゲートウェイを試し、理由を読んでから推奨値へ戻して保存します。", after: "コマンドで保存結果を確認します。", targetId: "mission-panel", targetLabel: "IP設定カードへ", state: "action" };
    }
    const missing = (["IPCONFIG", "PING_GATEWAY"] as PracticeMilestone[]).find((item) => !practiceCompleted.has(item));
    if (missing) {
      return { title: `「${taskLabel(missing)}」を押します`, detail: "コマンド実験の左側にある課題ボタンです。目的を読んでから押すと、確認コマンドが自動で実行されます。", after: "中央に表示される結果と「この結果から分かること」を読みます。", targetId: "practice-lab", targetLabel: "未完了の課題へ", state: "action" };
    }
    if (!hasMyExplanation(snapshot)) {
      return { title: "確認結果から分かったことを1文で書きます", detail: "PCの住所・外部への出口・DNSサーバのうち、画面で確認できた情報を1つ根拠にして10文字以上で書きます。", after: "「通信実験」へ進めるようになります。", targetId: "practice-lab", targetLabel: "説明欄へ", state: "action" };
    }
    return { title: "「次のステップへ」を押します", detail: "IP設定・2つの確認コマンド・説明が完了しました。", after: "通信を17段階で動かします。", targetId: "solo-progress", targetLabel: "次へ進む", state: "complete" };
  }

  if (phase === "PROTOCOL") {
    if (snapshot.room.protocolIndex < PROTOCOL_STEPS.length) {
      const step = PROTOCOL_STEPS[snapshot.room.protocolIndex]!;
      return { title: `全17段階の${step.index + 1}：通信カードの青い案内を進めます`, detail: `学習指導要領ページの表示に近づけるため、今は「${roleDefinition(step.actorRole).label}」の操作を1つ選びます。`, after: "目的に合う操作を選び、理由を読むと次の段階へ進めます。", targetId: "mission-panel", targetLabel: "現在の通信段階へ", state: "action" };
    }
    const missing = (["ARP", "NSLOOKUP", "PING_WEB"] as PracticeMilestone[]).find((item) => !practiceCompleted.has(item));
    if (missing) {
      return { title: `「${taskLabel(missing)}」を押します`, detail: "学習指導要領ページが表示されるまでの流れを動かせました。次はコマンド実験で、PCから同じ情報を確認する方法を体験します。", after: "3つの確認が終わったら、結果を根拠に説明します。", targetId: "practice-lab", targetLabel: "確認課題へ", state: "action" };
    }
    if (!hasMyExplanation(snapshot)) {
      return { title: "通信結果から分かったことを1文で書きます", detail: "出口の機器番号、Webサイト名から得たIPアドレス、Webサーバからの返事のうち、確認できた結果を1つ根拠にします。", after: "「障害診断」へ進めるようになります。", targetId: "practice-lab", targetLabel: "説明欄へ", state: "action" };
    }
    return { title: "「次のステップへ」を押します", detail: "17段階の通信・確認コマンド・説明が完了しました。", after: "わざと起きた障害の場所を調べます。", targetId: "solo-progress", targetLabel: "次へ進む", state: "complete" };
  }

  if (phase === "DIAGNOSIS") {
    if (!practiceCompleted.has("TRACEROUTE")) {
      return { title: "原因調査カードの青い「次にやること」を進めます", detail: "学習指導要領ページが表示されない原因を、まず4候補から予想します。選ぶと、次の確認方法が表示されます。", after: "通過したルータを順に表示し、最後に返事があった地点を確認します。", targetId: "mission-panel", targetLabel: "原因の予想へ", state: "action" };
    }
    if (!practiceCompleted.has("HTTPS")) {
      return { title: "「教材サイトからWebの応答が返るか確かめる」を押します", detail: "通信経路を確認した次は、暗号化の準備とWebページの応答まで正常かを調べます。", after: "2つの結果を比べて、原因がありそうな地点を説明します。", targetId: "practice-lab", targetLabel: "Web応答の確認へ", state: "action" };
    }
    if (!hasMyExplanation(snapshot)) {
      return { title: "最後に返事があった地点と、その次の返事がない地点を書きます", detail: "コマンド実験の右側へ、画面に表示された結果を根拠に10文字以上で説明します。", after: "「振り返り」へ進めるようになります。", targetId: "practice-lab", targetLabel: "説明欄へ", state: "action" };
    }
    return { title: "「次のステップへ」を押します", detail: "最初の予想・2つの確認コマンド・説明が完了しました。", after: "学んだことを3つの問いで振り返ります。", targetId: "solo-progress", targetLabel: "次へ進む", state: "complete" };
  }

  const myReflectionIds = new Set(snapshot.reflections.filter((item) => item.participantId === snapshot.viewer.participantId).map((item) => item.promptId));
  const nextPromptIndex = REFLECTION_PROMPTS.findIndex((prompt) => !myReflectionIds.has(prompt.id));
  if (nextPromptIndex >= 0) {
    return { title: `振り返り ${nextPromptIndex + 1} を1文で書き、「保存」を押します`, detail: REFLECTION_PROMPTS[nextPromptIndex]!.label, after: nextPromptIndex < REFLECTION_PROMPTS.length - 1 ? `振り返り ${nextPromptIndex + 2} へ進みます。` : "3つすべて保存すると学習完了です。", targetId: "mission-panel", targetLabel: `振り返り ${nextPromptIndex + 1} へ`, state: "action" };
  }
  return { title: "学習完了です", detail: "6つの役割、通信経路、IP設定、通信、障害診断、振り返りをすべて体験しました。", after: "必要なら前のフェーズへ戻って復習できます。", targetId: "mission-panel", targetLabel: "保存内容を見る", state: "complete" };
}
