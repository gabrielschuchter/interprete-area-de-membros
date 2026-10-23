# Comunidade V2 — encerramento das correções nesta execução

Data: 23/10/2026. Encerramento determinado pelo usuário: sem novos testes,
builds, auditorias, código ou rechecagens. **Release NO-GO.** Não há aprovação
artificial de RV-01 nem início da Etapa 12.

## Código concluído e sincronizado

Branch `codex/comunidade-v2`; último código commitado e conferido no remoto:
`80f6c1341acea4a56830d4091cc10e904e1cbbcc`.

- `53d4ae5`: revalidação de audiência de notificações, filtros de
  lista/resumo/contagens/mutações e proteção do consumer.
- `4296978`: proveniência fail-closed de notificações legadas, classificação
  explícita, default sentinela e migration aditiva complementar.
- `a20b28d`: correção do escape SQL literal na migration anterior.
- `80f6c13`: audiência persistida no post (GLOBAL/GROUP/UNRESOLVED),
  FK ON DELETE RESTRICT, escritores explícitos e leitores/produtor/consumer
  fechados para posts ambíguos. Posts legados não foram promovidos a globais.

Essas correções não equivalem a afirmar que todos os casos de RV-01 foram
resolvidos: a rechecagem do último SHA encontrou o caso abaixo.

## Bloqueador concreto ainda sem fechamento comprovado

Uma notificação antiga com `communitySpaceId=NULL` permanece elegível no filtro
de notificações, embora o post referenciado seja `UNRESOLVED`, sem grupo e em
rascunho. A chamada real a `getNotifications` retornou essa linha
(`visible=true`). É bloqueador de código/dados de segurança, não dependência
de infraestrutura nem refinamento opcional.

Evidência existente:
`C:\Users\gabsc\AppData\Local\Codex\qa\community-v2-foundation-20261015\rv01-existing-null-notification-report.json`.
Fixture `qa-rv01-1792773100683`; reprodução somente leitura na rechecagem.

A tentativa de correção local está preservada, **fora do commit**:

- `packages/database/prisma/migrations/20261023140000_notification_audience_reconcile/migration.sql`;
- alteração em `apps/app/lib/notification-audience-migration.test.ts`.

O teste textual da migration passou 3/3 antes do encerramento. O executor
confirmou aplicação somente no PostgreSQL QA local (76 migrations) e a E2E
de exclusão física de grupo 1/1. O comando já ativo concluiu; não há comando
de teste pendente. Isso ainda não comprova a invisibilidade da notificação
ambígua pelo endpoint: o reproducer do auditor não foi executado depois
da migration. Nenhum novo integrado foi iniciado. Não incluir esse patch
como código validado apenas para limpar o worktree.

## Evidências já disponíveis do código 80f6c13

- Seis gates aprovados: check 1.058; typecheck 16/16; boundaries 986/19;
  scripts 32 pass/1 skip, App 853 testes/177 arquivos, API 14 e domínio 24;
  build 8/8; performance 26 rotas sob 225 KiB gzip (Comunidade 216,2 KiB).
- Produtor/regras/consumer direcionados 24/24; shares 8/8; exclusão física de
  grupo com post rejeitada (1/1), preservando audiência GROUP e o vínculo.
- QA integrado `8fd64ff585134fd8aab62c725bc7a827`: **21/22**.
  A falha foi a preparação da meta coletiva por nove sessões QA residuais.
  Suíte focada `c681476924c84337ae2c7803a32e7779`: **5/5**.
  Os nove IDs, membros e horários originais foram restaurados e comparados ao
  snapshot protegido. Não declarar 22/22.
- Evidência anterior de concorrência real do outbox:
  remoção antes do lock não entrega; entrega com lock impede remoção
  concorrente; replay permanece deduplicado. Relatório existente
  `rv01-final-targeted-report.json` no QA root acima.
- Grants/RLS confirmados apenas no QA local: RLS habilitado e SELECT negado
  a anon/authenticated. Isso não comprova o estado remoto.

Nenhum gate ou QA foi reiniciado por esta rotina de encerramento.

## Outras pendências, separadas do bloqueador de código

**Operacionais/remotas (preflight futuro):** RV-02/OPS-01, recuperação periódica;
RV-03, retirada de leitores/workers incompatíveis e rollback seguro; RV-04,
preflight de convites e reconciliação de proveniência legada; RV-05,
performance autenticada/mobile. Também faltam confirmação remota de
grants/RLS/PostgREST, Storage, Clerk/Supabase, crawler Preview e
Broadcast/Realtime. Há divergência histórica do checksum da migration
1100 no QA; o ledger não foi adulterado. Conferir alvos já migrados antes
de qualquer rollout.

**Não essenciais:** warnings conhecidos de Turbo/Storybook, detalhes
cosméticos e melhorias do runner não justificam novas suítes.

## Preservação e continuidade

- Worktree dedicado:
  `C:\Users\gabsc\.codex\worktrees\comunidade-v2\interprete-area-de-membros`.
- `community-groups.spec.ts` continua protegido e fora do commit, hash
  `43bb75e8482c3638840cbfa760a91e01927ed770`.
- Não houve reset, clean, stash destrutivo ou descarte das alterações.
  O PostgreSQL QA local permanece ativo; não foi encerrado à força.
- Nenhum comando de deploy, migration remota ou alteração de GREEN, BLUE
  ou Production foi executado nesta rotina. Efeitos automáticos de Preview
  disparados pelo Git não foram verificados como entrega aprovada.

**Próximo passo necessário, somente em nova execução autorizada:** retomar
exclusivamente a migration 1400 preservada e comprovar que a notificação
ambígua desaparece enquanto um global legítimo permanece acessível.
Registrar o resultado e commit seletivo se aprovado. Não repetir auditoria
geral nem reabrir a Etapa 10. O bloqueador impede declarar encerramento
técnico das correções e handoff aprovado para 12A.
