export type GestaoRole = "ADMIN" | "TEACHER" | "MEMBER";

export type GestaoAction =
  | "dashboard.read"
  | "content.manage"
  | "cohort.manage"
  | "students.read"
  | "assignments.manage"
  | "community.moderate"
  | "administration.open"
  | "members.manage"
  | "access.manage"
  | "recordings.manage"
  | "customization.manage"
  | "badges.manage"
  | "integrations.manage"
  | "audit.read";

const teacherActions = new Set<GestaoAction>([
  "dashboard.read",
  "content.manage",
  "cohort.manage",
  "students.read",
  "assignments.manage",
  "community.moderate",
  "administration.open",
]);

export const isGestaoStaff = (role: GestaoRole) =>
  role === "ADMIN" || role === "TEACHER";

export const canPerformGestaoAction = (
  role: GestaoRole,
  action: GestaoAction
) => role === "ADMIN" || (role === "TEACHER" && teacherActions.has(action));

export const canOpenGestaoAdministration = (role: GestaoRole) =>
  canPerformGestaoAction(role, "administration.open");

export const gestaoAdminOnlyActions = [
  "members.manage",
  "access.manage",
  "recordings.manage",
  "customization.manage",
  "badges.manage",
  "integrations.manage",
  "audit.read",
] as const satisfies readonly GestaoAction[];
