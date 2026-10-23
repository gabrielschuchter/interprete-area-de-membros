# Comunidade V2 — encerramento das correções nesta execução

## Etapa 12A encerrada — NO-GO — 23/10/2026

Preflight do candidato `4e026b59eb99521ed1c6b94c8444a52049d317c6` concluído.
**Publicação 12B não iniciada.** O estado vigente e a sequência condicional estão
em [RELEASE-PLAN.md](RELEASE-PLAN.md); as seções anteriores abaixo são históricas
onde divergirem deste fechamento. RV-01 está encerrado no QA local conforme
[POST-AUDIT-CLOSURE.md](POST-AUDIT-CLOSURE.md), sem nova rechecagem nesta etapa.

- OPS-01: 48 schedules com falha, zero sucesso; cron GREEN inalterado e
  respostas HTTP 200 do caminho atual não comprovam recovery/Broadcast V2.
- GREEN: 65 migrations sem drift; 11 V2 pendentes. Convites pendentes e
  conflitos de pin: zero. Há 28 posts sem grupo, incluindo dois publicados
  que ficariam UNRESOLVED; exigem tratamento de proveniência/aceite explícito.
- Notification ainda concede SELECT a authenticated. Migration/revogação e
  smoke JWT/Realtime dependem da janela autorizada; nenhuma escrita remota.
- Novos backups protegidos de banco e quatro objetos Storage foram gerados
  e reabertos. Portabilidade de chave, reidratação Storage e fallback compatível
  ainda precisam de prova; restauração histórica local foi reaproveitada.
- Vercel gestão: 403; configuração efetiva/Trusted Source/Clerk atual não
  confirmados. App/API/crawler anônimo recebem 302 SSO, sem bypass. Performance
  remota autenticada depende da V2 migrada e permanece sem prova representativa.

Nenhum deploy Production, migration, alteração de cron, credencial ou proteção.
Spec preexistente `community-groups.spec.ts` preservado, hash Git
`43bb75e8482c3638840cbfa760a91e01927ed770`, fora dos commits.
Retomar somente os bloqueadores e provas faltantes do RELEASE-PLAN; não reabrir
QA visual, RV-01 ou auditoria geral. Não iniciar publicação enquanto NO-GO.


## Fechamento cirúrgico de RV-01 — 23/10/2026

**RV-01 encerrado no QA local migrado. Release continua NO-GO.** A nova
autorização do usuário limitou esta execução à reprodução original, ao endpoint
real e ao versionamento seletivo. Nenhuma suíte integrada, build geral,
Graphify, migration remota ou Etapa 12A foi executada.

- Base conferida: código `80f6c1341acea4a56830d4091cc10e904e1cbbcc`, seguido
  pelo fechamento documental `93f053cecb91b60d2d32ba4bd0d0514485bc5663`,
  idêntico no HEAD e em `origin/codex/comunidade-v2` antes deste patch.
- Reproducer original `rv01-existing-null-notification.ts`, sem alterações:
  mesma fixture `qa-rv01-1792773100683`, antes `visible=true`/2 itens, depois
  `visible=false`/0 itens na mesma consulta com cursor. O relatório anterior
  foi preservado antes da repetição.
- A notificação originalmente NULL agora persiste com
  `__community_scope_unresolved__`; o post permanece `UNRESOLVED`, `spaceId=NULL`
  e `DRAFT`. A fixture permanece no banco, não lida e não vista.
- HTTP real `GET http://localhost:3101/api/notifications`: 200 e
  `Cache-Control: private, no-store` em `MENTIONS`, `ALL` e `summary=1`.
  A fixture ficou ausente das listas completas. `MENTIONS` retornou 1 item,
  unread/unseen 1/1; `ALL` retornou 2 itens, unread/unseen 2/2; resumo 2/2.
  As contagens coincidiram exatamente com os itens visíveis, excluindo a
  fixture não lida/não vista. Autenticação pelo modo de desenvolvimento local
  existente, com o destinatário real da fixture; não valida Clerk remoto.
- A migration `20261023140000_notification_audience_reconcile` já aplicada
  foi somente consultada: checksum SHA-256
  `d9fcad34bc0bd88a03cee39153dbcbccae44537d914e5ea5ef03b73848d99df2`
  igual ao arquivo, concluída e sem rollback. PostgreSQL loopback
  `127.0.0.1:54325/interprete_community_v2_qa`, certificado QA validado.
- Teste diretamente afetado: `bun x vitest run lib/notification-audience-migration.test.ts`
  em `apps/app`: **3/3**. Nenhuma correção adicional de código foi necessária.
- Evidências antes/depois e HTTP preservadas em
  [evidence/rv01-reconcile-20261023/README.md](evidence/rv01-reconcile-20261023/README.md).
  O destinatário não tem controle global legítimo direto TOPIC elegível;
  não foi criada fixture para simular esse controle. O aceite desta missão é
  a exclusão da notificação original nas listas e contagens.
- O arquivo protegido `community-groups.spec.ts` permanece fora do commit,
  hash Git `43bb75e8482c3638840cbfa760a91e01927ed770`. Dados QA preexistentes
  foram somente lidos. O servidor HTTP iniciado para esta reprodução foi encerrado.

**Critério de parada atingido:** reprodução conclusiva e patch seletivo.
OPS-01 e os demais gates remotos/infraestrutura continuam na Etapa 12A;
nenhum release foi aprovado ou ambiente remoto modificado. O registro abaixo
é histórico e foi supersedido apenas quanto ao bloqueador local RV-01.

## Registro histórico da execução anterior

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
