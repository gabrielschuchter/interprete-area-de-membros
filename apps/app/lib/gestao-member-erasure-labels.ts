export type ErasureBlocker = "last-admin" | "self";

export interface ErasureCounts {
  readonly bookmarks: number;
  readonly cohortMemberships: number;
  readonly comments: number;
  readonly commentsFromOthers: number;
  readonly enrollments: number;
  readonly lessonProgress: number;
  readonly notes: number;
  readonly posts: number;
  /** Grupos com outras pessoas dentro; a posse passa para o membro mais antigo. */
  readonly sharedSpaces: number;
  /** Turmas, convites, acessos e eventos criados por ele; passam para quem apaga. */
  readonly staffRecords: number;
  readonly submissions: number;
  readonly votes: number;
}

export const erasureBlockerLabels: Record<ErasureBlocker, string> = {
  "last-admin":
    "É o único administrador ativo. Promova outra pessoa a administrador antes.",
  self: "Você não apaga a própria conta.",
};
