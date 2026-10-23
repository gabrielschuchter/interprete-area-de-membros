// Pure rules for the recording room: when a recording counts as done and how
// the series line and thumbnail labels read.

export interface RecordingCompletionInput {
  readonly completedPlaybackAt: Date | null;
  readonly manualCompletion: boolean | null;
}

// The member's own choice wins. Without one, the 90% rule decides.
export const isRecordingCompleted = (
  progress: RecordingCompletionInput | null | undefined
) => {
  if (!progress) {
    return false;
  }
  return progress.manualCompletion ?? progress.completedPlaybackAt !== null;
};

export interface RecordingSortInput {
  readonly id: string;
  readonly meetingDate: Date | null;
}

// Newest first. Recordings without a date go last, in a stable order.
export const compareRecordingsByDate = (
  a: RecordingSortInput,
  b: RecordingSortInput
) => {
  if (a.meetingDate && b.meetingDate) {
    return (
      b.meetingDate.getTime() - a.meetingDate.getTime() ||
      b.id.localeCompare(a.id)
    );
  }
  if (a.meetingDate || b.meetingDate) {
    return a.meetingDate ? -1 : 1;
  }
  return b.id.localeCompare(a.id);
};
