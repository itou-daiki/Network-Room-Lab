import type { CreateRoomRequest } from "./types";

export const MIN_CLASSROOM_GROUP_SIZE = 2;
export const MAX_CLASSROOM_GROUP_SIZE = 6;
export const MAX_CLASSROOM_BATCH_SIZE = 10;

export function classroomRoomTitle(baseTitle: string, index: number, roomCount: number): string {
  const normalized = baseTitle.trim();
  return roomCount === 1 ? normalized : `${normalized} ${index + 1}班`;
}

export function buildClassroomRoomRequests(
  baseTitle: string,
  roomCount: number,
  capacity: number,
  targetUrl: string,
): CreateRoomRequest[] {
  if (!baseTitle.trim()) throw new Error("授業名を入力してください。");
  if (!Number.isInteger(roomCount) || roomCount < 1 || roomCount > MAX_CLASSROOM_BATCH_SIZE) {
    throw new Error(`作る部屋数は1〜${MAX_CLASSROOM_BATCH_SIZE}部屋で指定してください。`);
  }
  if (!Number.isInteger(capacity) || capacity < MIN_CLASSROOM_GROUP_SIZE || capacity > MAX_CLASSROOM_GROUP_SIZE) {
    throw new Error(`1部屋の定員は${MIN_CLASSROOM_GROUP_SIZE}〜${MAX_CLASSROOM_GROUP_SIZE}人で指定してください。`);
  }
  if (!targetUrl.trim()) throw new Error("学習対象URLを入力してください。");

  return Array.from({ length: roomCount }, (_, index) => ({
    title: classroomRoomTitle(baseTitle, index, roomCount),
    capacity,
    scenario: "STANDARD_WEB_ACCESS",
    learningMode: "CLASSROOM",
    targetUrl: targetUrl.trim(),
  }));
}
