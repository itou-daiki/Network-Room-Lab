import type { LearningTarget } from "./types";

export const DEFAULT_TARGET_URL = "https://www.mext.go.jp/a_menu/shotou/new-cs/1384661.htm";
export const DEFAULT_TARGET_HOSTNAME = "www.mext.go.jp";
export const DEFAULT_TARGET_PATH = "/a_menu/shotou/new-cs/1384661.htm";
export const TEMPLATE_TARGET_IPV4 = "203.0.113.80";

export function isDefaultLearningTarget(target: Pick<LearningTarget, "url">): boolean {
  return target.url === DEFAULT_TARGET_URL;
}

export function targetPageLabel(target: Pick<LearningTarget, "url" | "hostname">): string {
  return isDefaultLearningTarget(target)
    ? "文部科学省の学習指導要領ページ"
    : `${target.hostname}にある指定したWebページ`;
}

export function targetPageShortLabel(target: Pick<LearningTarget, "url">): string {
  return isDefaultLearningTarget(target) ? "学習指導要領ページ" : "指定したWebページ";
}

export function targetSiteLabel(target: Pick<LearningTarget, "url" | "hostname">): string {
  return isDefaultLearningTarget(target) ? "文部科学省サイト" : `${target.hostname}のWebサイト`;
}

/** 既存教材の固定例を、部屋ごとの実URL・実DNS結果へ置き換える。 */
export function materializeTargetText(template: string, target: LearningTarget): string {
  const pageLabel = targetPageLabel(target);
  const pageShortLabel = targetPageShortLabel(target);
  const siteLabel = targetSiteLabel(target);
  return template
    .replaceAll(DEFAULT_TARGET_URL, target.url)
    .replaceAll(DEFAULT_TARGET_PATH, target.requestTarget)
    .replaceAll(DEFAULT_TARGET_HOSTNAME, target.hostname)
    .replaceAll(TEMPLATE_TARGET_IPV4, target.primaryIpv4)
    .replaceAll("文部科学省の学習指導要領ページ", pageLabel)
    .replaceAll("文部科学省Webサイト", `${target.hostname}のWebサイト`)
    .replaceAll("文部科学省サイト", siteLabel)
    .replaceAll("学習指導要領ページ", pageShortLabel);
}

export function unavailableLegacyTarget(): LearningTarget {
  return {
    url: DEFAULT_TARGET_URL,
    hostname: DEFAULT_TARGET_HOSTNAME,
    requestTarget: DEFAULT_TARGET_PATH,
    ipv4Addresses: [],
    primaryIpv4: "DNS結果未取得",
    dnsTtl: 0,
    resolvedAt: "",
    resolver: "更新前に作成された部屋",
  };
}
