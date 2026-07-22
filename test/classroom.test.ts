import { describe, expect, it } from "vitest";

import { buildClassroomRoomRequests } from "../src/shared/classroom";
import { DEFAULT_TARGET_URL } from "../src/shared/learningTarget";

describe("classroom room batch", () => {
  it("builds ten numbered rooms with the selected group capacity", () => {
    const requests = buildClassroomRoomRequests("情報ネットワーク演習", 10, 4, DEFAULT_TARGET_URL);

    expect(requests).toHaveLength(10);
    expect(requests[0]).toMatchObject({ title: "情報ネットワーク演習 1班", capacity: 4, learningMode: "CLASSROOM", targetUrl: DEFAULT_TARGET_URL });
    expect(requests[9]).toMatchObject({ title: "情報ネットワーク演習 10班", capacity: 4, learningMode: "CLASSROOM" });
  });

  it("keeps a single room title unchanged", () => {
    expect(buildClassroomRoomRequests(" 少人数演習 ", 1, 2, DEFAULT_TARGET_URL)[0]?.title).toBe("少人数演習");
  });

  it("rejects values outside one-to-ten rooms and two-to-six learners", () => {
    expect(() => buildClassroomRoomRequests("授業", 11, 4, DEFAULT_TARGET_URL)).toThrow("1〜10部屋");
    expect(() => buildClassroomRoomRequests("授業", 2, 1, DEFAULT_TARGET_URL)).toThrow("2〜6人");
    expect(() => buildClassroomRoomRequests("授業", 2, 7, DEFAULT_TARGET_URL)).toThrow("2〜6人");
  });
});
