# Áreas do aluno atrás de flag

Este arquivo registra as áreas que foram tiradas do acesso do aluno sem apagar a estrutura. Cada entrada diz o que some, o que continua funcionando e como religar.

## Atividades (desligada em 04/11/2026)

Atividades são as entregas discursivas com rubrica, prazo e feedback do professor. A decisão de 04/11/2026 foi tirar a seção do aluno e manter tudo o que está por trás dela: modelos Prisma, dados, telas de Gestão, correções, atribuições e histórico.

A flag é `NEXT_PUBLIC_MEMBER_ACTIVITIES_ENABLED`, lida em `apps/app/lib/member-features.ts` (`memberActivitiesEnabled`). Sem a variável, ou com qualquer valor diferente de `true`, a área fica desligada. Com ela desligada, o aluno deixa de ver:

- a aba Atividades no Estudar, o atalho no Início e a linha na visão geral do Estudar;
- os resultados de atividade na busca global;
- a "Prática relacionada" na página da aula e as atividades da sala de aula;
- a atividade relacionada em Encontros (página do encontro e calendário);
- os prazos de atividade no calendário de Ferramentas e no feed ICS;
- a estatística "Atividades entregues" em Metas;
- as notificações `ACTIVITY_ASSIGNED`, `ACTIVITY_DEADLINE` e `FEEDBACK_RECEIVED` (o filtro é aplicado na consulta, então elas também não entram na contagem do sino);
- o envio diário do cron `/api/cron/activity-deadlines`, que responde `skipped`.

As rotas `/atividades` e `/atividades/[slug]` respondem com a página de não encontrado (`atividades/layout.tsx`).

### Como religar

1. No projeto Vercel do app, defina `NEXT_PUBLIC_MEMBER_ACTIVITIES_ENABLED=true` em Production e Preview.
2. Publique um novo deploy. A variável é `NEXT_PUBLIC_`, então entra no bundle no momento do build; trocar o valor sem novo deploy não tem efeito.
3. Confira `/atividades` logado como aluno e o sino de notificações.

Para testar localmente, exporte a mesma variável antes de subir o servidor de desenvolvimento.

Para procurar todos os pontos de corte no código, busque por `memberActivitiesEnabled` e `hiddenMemberNotificationTypes`.
