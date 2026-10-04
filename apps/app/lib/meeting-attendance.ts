export interface MeetingAttendanceEntry {
  readonly isPresent: boolean;
  readonly memberId: string;
}

export const resolveMeetingAttendance = (
  selectedMemberIds: readonly string[],
  eligibleMemberIds: readonly string[]
): MeetingAttendanceEntry[] | null => {
  const selected = new Set(selectedMemberIds);
  const eligible = new Set(eligibleMemberIds);

  if ([...selected].some((memberId) => !eligible.has(memberId))) {
    return null;
  }

  return [...eligible].map((memberId) => ({
    memberId,
    isPresent: selected.has(memberId),
  }));
};
