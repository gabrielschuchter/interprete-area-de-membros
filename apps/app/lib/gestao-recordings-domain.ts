export type RecordingGroupTab = "all" | "linked" | "pending";

export const parseRecordingTab = (value: string | undefined) => {
  if (value === "vinculados") {
    return "linked" as const;
  }
  return value === "todos" ? ("all" as const) : ("pending" as const);
};

export const recordingTabParam: Record<RecordingGroupTab, string> = {
  all: "todos",
  linked: "vinculados",
  pending: "sem-vinculo",
};

export const matchesRecordingTab = (
  tab: RecordingGroupTab,
  linked: boolean
) => {
  if (tab === "all") {
    return true;
  }
  return tab === "linked" ? linked : !linked;
};

export const recordingActionLabels: Record<string, string> = {
  ASSIGNED: "atribuído",
  REASSIGNED: "reatribuído",
  REVOKED: "revogado",
};

export const minEvidence = 20;
export const maxEvidence = 1000;
