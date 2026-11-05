/**
 * Áreas do aluno que podem ficar fora do ar sem perder dados nem estrutura.
 *
 * Atividades (entregas discursivas com rubrica e feedback) está desligada
 * desde 04/11/2026: o aluno não vê a seção, os atalhos, os resultados de busca
 * nem os avisos de atividade, e as rotas /atividades respondem 404. Modelos,
 * Gestão, correções e histórico continuam intactos.
 *
 * Para reativar: defina NEXT_PUBLIC_MEMBER_ACTIVITIES_ENABLED=true no projeto
 * Vercel do app (Production e Preview) e publique um novo deploy. A variável é
 * lida no build, por isso uma troca exige deploy. Detalhes em
 * docs/product/feature-flags.md.
 */
export const memberActivitiesEnabled =
  process.env.NEXT_PUBLIC_MEMBER_ACTIVITIES_ENABLED === "true";

const activityNotificationTypes = new Set([
  "ACTIVITY_ASSIGNED",
  "ACTIVITY_DEADLINE",
  "FEEDBACK_RECEIVED",
]);

/** Tipos de notificação que o aluno não deve ver enquanto a área está desligada. */
export const hiddenMemberNotificationTypes = (): readonly string[] =>
  memberActivitiesEnabled ? [] : [...activityNotificationTypes];

export const isActivityHref = (href: string | null | undefined) =>
  Boolean(href && (href === "/atividades" || href.startsWith("/atividades/")));

/** Link de uma atividade, ou o destino alternativo quando a área está desligada. */
export const memberActivityHref = (slug: string, fallback: string) =>
  memberActivitiesEnabled ? `/atividades/${slug}` : fallback;
