export type ErasureBlocker =
  | "last-admin"
  | "not-member-role"
  | "owns-shared-space"
  | "self"
  | "staff-records";

export interface ErasureCounts {
  readonly bookmarks: number;
  readonly cohortMemberships: number;
  readonly comments: number;
  readonly commentsFromOthers: number;
  readonly enrollments: number;
  readonly lessonProgress: number;
  readonly notes: number;
  readonly posts: number;
  readonly submissions: number;
  readonly votes: number;
}

export const erasureBlockerLabels: Record<ErasureBlocker, string> = {
  "last-admin": "É o único administrador ativo.",
  "not-member-role":
    "Só dá para apagar quem está com o papel Membro. Mude o papel antes.",
  "owns-shared-space":
    "É dono de um grupo de estudo que tem outras pessoas. Passe a posse ou arquive o grupo antes.",
  self: "Você não apaga a própria conta.",
  "staff-records":
    "Criou turmas, convites, acessos ou eventos que dependem dele. Isso é registro da equipe e fica preservado.",
};
