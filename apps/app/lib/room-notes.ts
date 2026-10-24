// Order of the notes list in the room: pinned first, then notes with a video
// timestamp by time, then the rest from newest to oldest.

export interface RoomNoteOrderInput {
  readonly createdAt: Date;
  readonly id: string;
  readonly pinned: boolean;
  readonly videoTimeSeconds: number | null;
}

const compareRoomNotes = (a: RoomNoteOrderInput, b: RoomNoteOrderInput) => {
  if (a.pinned !== b.pinned) {
    return a.pinned ? -1 : 1;
  }
  const aStamped = a.videoTimeSeconds !== null;
  const bStamped = b.videoTimeSeconds !== null;
  if (aStamped !== bStamped) {
    return aStamped ? -1 : 1;
  }
  if (aStamped && bStamped && a.videoTimeSeconds !== b.videoTimeSeconds) {
    return (a.videoTimeSeconds ?? 0) - (b.videoTimeSeconds ?? 0);
  }
  return (
    b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id)
  );
};

export const sortRoomNotes = <Note extends RoomNoteOrderInput>(
  notes: readonly Note[]
) => [...notes].sort(compareRoomNotes);

export const formatVideoTimestamp = (totalSeconds: number) => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, "0");

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${String(minutes).padStart(2, "0")}:${rest}`;
};
