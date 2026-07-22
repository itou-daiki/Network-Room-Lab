import { describe, expect, it } from "vitest";

import { normalizeLearningUrl } from "../src/worker/learningTarget";

describe("learning target URL", () => {
  it("keeps the complete HTTPS goal URL, including its in-page fragment", () => {
    expect(normalizeLearningUrl(" https://example.com/lesson/unit?id=1#answer ").toString())
      .toBe("https://example.com/lesson/unit?id=1#answer");
  });

  it("rejects targets that would not exercise public HTTPS DNS resolution", () => {
    expect(() => normalizeLearningUrl("http://example.com/lesson")).toThrow("https://");
    expect(() => normalizeLearningUrl("https://user:pass@example.com/lesson")).toThrow("パスワード");
    expect(() => normalizeLearningUrl("https://203.0.113.80/lesson")).toThrow("ドメイン名");
    expect(() => normalizeLearningUrl("https://localhost/lesson")).toThrow("ドメイン名");
  });
});
