import {
  canPerformGestaoAction,
  type GestaoAction,
  type GestaoRole,
} from "./gestao-permissions";

export const memberRoleLabels: Record<GestaoRole, string> = {
  ADMIN: "Administrador",
  MEMBER: "Membro",
  TEACHER: "Professor",
};

export const memberRoleTabLabels: Record<GestaoRole, string> = {
  ADMIN: "Administradores",
  MEMBER: "Membros",
  TEACHER: "Professores",
};

export const roleCapabilities: readonly {
  readonly action: GestaoAction;
  readonly description: string;
  readonly label: string;
}[] = [
  {
    action: "content.manage",
    description: "Cursos, aulas, atividades, biblioteca e coleções",
    label: "Editar conteúdo",
  },
  {
    action: "cohort.manage",
    description: "Somente nas turmas pelas quais é responsável",
    label: "Gerenciar turmas",
  },
  {
    action: "students.read",
    description: "Acompanhar e corrigir os alunos sob sua responsabilidade",
    label: "Acompanhar e corrigir alunos",
  },
  {
    action: "assignments.manage",
    description: "Atribuições, tarefas e avisos aos alunos",
    label: "Atribuir conteúdo",
  },
  {
    action: "community.moderate",
    description: "Publicações, grupos e encontros",
    label: "Moderar comunidade",
  },
  {
    action: "members.manage",
    description: "Papéis, acessos, medalhas, integrações e registro",
    label: "Administrar a escola",
  },
];

export const roleEffects = (from: GestaoRole, to: GestaoRole) => {
  const gained: string[] = [];
  const lost: string[] = [];
  for (const capability of roleCapabilities) {
    const before = canPerformGestaoAction(from, capability.action);
    const after = canPerformGestaoAction(to, capability.action);
    if (!before && after) {
      gained.push(capability.label);
    } else if (before && !after) {
      lost.push(capability.label);
    }
  }
  return { gained, lost };
};

export const memberSituations = [
  ["active", "Ativo"],
  ["inactive", "Inativo"],
  ["deactivated", "Desativado"],
] as const;

export type MemberSituation = (typeof memberSituations)[number][0];

export const inactiveAfterDays = 21;

export const parseMemberRole = (value: string | undefined): GestaoRole | null =>
  (["ADMIN", "TEACHER", "MEMBER"] as const).find((role) => role === value) ??
  null;

export const parseMemberSituation = (
  value: string | undefined
): MemberSituation | null =>
  memberSituations.find(([key]) => key === value)?.[0] ?? null;

export const memberSituation = (input: {
  readonly createdAt: Date;
  readonly deactivatedAt: Date | null;
  readonly lastStudyAt: Date | null;
  readonly now: Date;
  readonly role: GestaoRole;
}): MemberSituation => {
  if (input.deactivatedAt) {
    return "deactivated";
  }
  if (input.role !== "MEMBER") {
    return "active";
  }
  const reference = input.lastStudyAt ?? input.createdAt;
  const days = (input.now.getTime() - reference.getTime()) / 86_400_000;
  return days >= inactiveAfterDays ? "inactive" : "active";
};
