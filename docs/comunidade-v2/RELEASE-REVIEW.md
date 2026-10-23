# Comunidade V2 — Revisão adversarial (Etapa 11)

## Encerramento por ordem do usuário — 23/10/2026

**Parecer vigente: NO-GO; correções interrompidas.** Código sincronizado:
`80f6c1341acea4a56830d4091cc10e904e1cbbcc`. A rechecagem encontrou um P1
concreto: notificação comunitária legada com `communitySpaceId=NULL` permanece
visível para post `UNRESOLVED`. Não há fechamento comprovado desse caso.
A migration local `20261023140000_notification_audience_reconcile` e seu
teste permanecem fora do commit. Nenhuma nova rechecagem será solicitada.

[POST-AUDIT-CLOSURE.md](POST-AUDIT-CLOSURE.md) é o checkpoint vigente.
Os registros abaixo são históricos, inclusive as afirmações de correção
completa ou rechecagem em andamento. A Etapa 12 não foi iniciada.

**Data:** 23/10/2026

**Parecer:** **NO-GO para release.**

**Etapa 12:** não iniciada.

## Estado atual do candidato pós-correção — 23/10/2026

**Candidato de código:** `80f6c1341acea4a56830d4091cc10e904e1cbbcc`, publicado
em `origin/codex/comunidade-v2`. RV-01 e o novo RV-06 P1 estão corrigidos no
código; a rechecagem adversarial independente do SHA final foi solicitada ao
auditor da Etapa 11 e está em andamento. Nenhum P0 foi identificado.

**RV-06 — reprodução anterior:** a FK de `CommunityPost.spaceId` usava
`ON DELETE SET NULL`, e filtros globais tratavam `spaceId=NULL` como post
global. Em transação QA com tabelas temporárias reproduzindo esse contrato,
o filtro retornou 0 posts antes da exclusão do grupo privado; depois da
exclusão retornou 1 e entregou `CONTEUDO PRIVADO`.

**RV-06 — correção:** a migration `20261023130000_community_post_audience_scope`
persiste `GLOBAL`, `GROUP` ou `UNRESOLVED`, aplica constraint de consistência e
troca a FK para `ON DELETE RESTRICT`. Escritas definem audiência
explicitamente; feed, detalhe, share público, acesso a recurso, produtor de
notificação e consumer do outbox exigem escopo coerente. Posts legados com
`spaceId=NULL` ficam armazenados como `UNRESOLVED`, sem exposição até sua
proveniência ser confirmada. A exclusão física foi rejeitada no E2E e o post
continuou `GROUP`, ligado ao mesmo grupo.

**Validação do candidato:** focused producer/rules + consumer, 24/24; shares
E2E 8/8 e exclusão física 1/1. QA integrado `8fd64ff585134fd8aab62c725bc7a827`
teve 21/22; a única falha foi o fixture residual da meta coletiva. A suíte
focada `c681476924c84337ae2c7803a32e7779` passou 5/5 e restaurou os nove
registros do snapshot protegido com igualdade exata. Seis gates: `check` 1.058;
`typecheck` 16/16; `boundaries` 986/19; testes scripts 32 pass/1 skip, App
853/177, API 14/14, domínio 24/24; `build` 8/8; performance 26 rotas sob
225 KiB gzip, Comunidade 216,2 KiB. Graphify: 8.440 nós/22.124 arestas/358
comunidades. O banco foi PostgreSQL QA loopback com TLS `verify-full`; nenhuma
migration remota foi executada.

**Parecer atual: NO-GO para release.** Além da rechecagem independente,
continuam bloqueadores externos RV-02/OPS-01, RV-03/rollback, RV-04/dados
legados, RV-05/performance autenticada e confirmação remota de grants/RLS,
Storage, Clerk/Supabase, crawler no Preview e Broadcast/Realtime. Não houve
publicação, alteração de ambiente produtivo ou início da Etapa 12.

O conteúdo abaixo registra a auditoria inicial e a correção intermediária; os
estados atuais são os desta seção.

## Registro histórico — candidato complementar `a20b28d`

O candidato de então era `a20b28d2d0854c82d543048cc66fb5d81981ea1a`.
O diagnóstico posterior ao primeiro patch encontrou legado com grupo excluído
e origem NULL; a migration complementar e o consumer agora falham fechados.
Os seis gates passaram em `4296978`; o delta até o candidato final remove
somente um escape literal inválido na primeira migration. O ensaio SQL
completo posterior passou para ambas as migrations, com sete casos em tabelas
temporárias e rollback. O harness com SQL/consumer real cobriu legado e
concorrência. QA final concluído: integrado `6543bd9d` 20/21 e meta no reteste
`ad6e6f88` 5/5, após isolamento/restauração de fixtures da execução anterior
interrompida, sem mudar produto ou asserções. Rechecagem independente pendente.
O estado, os limites e o requisito de não coexistência com binários inseguros
estão em [POST-AUDIT-HANDOFF.md](./POST-AUDIT-HANDOFF.md).

Os achados e pareceres seguintes preservam o histórico. O fechamento de código
de RV-01 depende da rechecagem acima; os gates operacionais e remotos continuam
impedindo release, com execução reservada ao preflight 12A em conversa própria.

**Atualização pós-auditoria:** RV-01 P1 foi corrigido no candidato `53d4ae5c017eab9e7ed3136483dac3ecd4e79e08`, enviado para `origin/codex/comunidade-v2`, e passou por testes unitários, integração PostgreSQL/API e E2E integrado local. A rechecagem adversarial independente foi solicitada na conversa da Etapa 11 e está pendente. A correção local do caminho Data API também passou: RLS habilitado e sem `SELECT` para `anon`/`authenticated` no QA isolado. Isso não confirma os grants do projeto remoto nem aplica a migration nele.

**Parecer atual:** **NO-GO para release.** RV-02 (OPS-01), RV-03 (rollback de enums), RV-04 (preflight de convites legados), RV-05 (performance autenticada/mobile) e a confirmação remota de grants/RLS continuam bloqueadores de release. Nenhum P0 foi identificado. A validação de teclado em dispositivo físico segue P3. Não houve migration remota, publicação ou alteração de ambiente produtivo; Etapa 12 não começou.

## Registro histórico — correção inicial de RV-01 em `53d4ae5`

O código de RV-01 foi inicialmente enviado no SHA `53d4ae5c017eab9e7ed3136483dac3ecd4e79e08`. A rechecagem vigente abrange RV-01 e RV-06 no candidato final `80f6c1341acea4a56830d4091cc10e904e1cbbcc`.

**Antes — reprodução do RV-01:** uma notificação `MENTION` de comentário privado era gravada com título, corpo, link e IDs; após remover o membro, o predicado de leitura admitia qualquer tipo fora de `GROUP_POST` e `ANNOUNCEMENT`. A linha continuava visível na API e nas contagens. Um evento atrasado de comentário também não revalidava a associação antes de persistir. A análise e a reprodução original, com seus limites, permanecem documentadas em [RV-01](#rv-01--p1--notificações-de-grupo-privado-sobrevivem-à-remoção-do-membro).

**Depois — correção aplicada:** `Notification.communitySpaceId` agora registra o escopo; a migration aditiva `20261023110000_notification_community_audience` reclassifica linhas legadas sem contexto resolvível com um marcador fail-closed, recupera o grupo por post/comentário/convite quando possível e revoga grants diretos da Data API. O consumer do outbox resolve publicação, grupo e comentário no momento da entrega, confirma estado publicado e destinatário ainda autorizado, e bloqueia as linhas de associação/grupo contra corrida com remoção. As consultas de lista, resumo, contagens e mutações de leitura usam o mesmo predicado de audiência em transação `RepeatableRead`. Tipos de notificação sem classificação explícita deixam de passar por uma regra genérica aberta.

**Evidência da correção:**

- Reprodução persistente no PostgreSQL QA + Clerk Development: o membro vê a notificação privada e o incremento de `unreadCount`/`unseenCount`; após remover a associação, a API oculta a linha e os dois contadores voltam ao baseline, enquanto uma consulta ao banco confirma que a notificação e o texto/link permanecem persistidos. Run focado `77452eea0cdd45a6976aed3d67a54076`, 1/1.
- E2E integrado final `ea0e06a4ffd4408bbd4cfe324bc458ac`: status `passed`, `failedTests: []`; a listagem do Playwright confirma **21 testes em 15 arquivos**, incluindo a nova regressão persistente. Duração observada: 17 min 58 s. Evidências locais em `C:\Users\gabsc\AppData\Local\Codex\qa\community-v2-foundation-20261015\playwright\results\ea0e06a4ffd4408bbd4cfe324bc458ac`.
- Testes direcionados de leitura/produtor: 2 arquivos, 9 testes aprovados; testes de revalidação/idempotência do consumer estão incluídos no gate monorepo.
- No banco QA isolado `interprete_community_v2_qa` (`127.0.0.1:54325`, TLS `verify-full`), consulta pós-run confirmou 73 migrations concluídas, zero pendentes, migration nova aplicada, RLS de `Notification` habilitado, grants `SELECT` para `anon` e `authenticated` falsos, e trigger local `Notification_broadcast_invalidation` restaurado ao estado original `D`.
- Seis gates no código candidato: `check` 1.057 arquivos; `typecheck` 16/16; `boundaries` 985 arquivos/19 pacotes; `test` scripts 32 aprovados/1 skip, App 848 testes/176 arquivos, API 11/3 e domínio 24/5; `build` 8/8; `performance:check` 216,2 KiB gzip/225 KiB. O build terminou com sucesso, embora Turbo tenha emitido aviso de IO por espaço insuficiente; Storybook também mostrou avisos de tamanho de assets. `graphify update .` terminou com 8.420 nós, 22.098 arestas e 353 comunidades.

**Estado dos demais bloqueadores:** RV-02–RV-05 e a confirmação de grants/RLS remotos continuam pendentes nos termos registrados abaixo. A verificação local fecha somente a condição de schema/grants no QA local. Não trate o E2E local nem a migration local como comprovação de Preview, Production, crawler, Storage remoto, Clerk/Supabase remoto, Broadcast ou OPS-01. Por isso, o parecer continua **NO-GO** mesmo se a rechecagem de RV-01 confirmar a correção.

**Integridade e limite de execução:** o spec protegido `apps/app/e2e/community-v2/community-groups.spec.ts` mantém o hash `43bb75e8482c3638840cbfa760a91e01927ed770` e permaneceu fora do commit; nenhum outro arquivo protegido foi incluído. O código foi enviado para rechecagem, sem publicação ou migration remota. Etapa 12 não iniciada.

## Parecer e candidato

O candidato original da Etapa 10 era `f4ada2616f23a48b3f17bdeb4bc90eb568d3cbfa`. Sua aprovação local — E2E 20/20, seis gates e revisão dos 53 boards — foi tratada como evidência local, não como prova de runtime remoto. O código de correção pós-auditoria está identificado acima pelo SHA `53d4ae5c017eab9e7ed3136483dac3ecd4e79e08`.

Na auditoria inicial, RV-01 foi confirmado; sua reprodução e a implementação corretiva estão registradas acima. Permanecem gates operacionais, de rollback, de dados legados, de performance e de validação remota sem prova atual. O parecer só muda após a rechecagem independente, a validação autorizada dos controles externos e o fechamento dos preflights descritos abaixo.

## Estado preservado do worktree

- A primeira leitura do worktree alvo ocorreu no SHA `f4ada2616f23a48b3f17bdeb4bc90eb568d3cbfa`, na branch `codex/comunidade-v2`. Havia alterações locais protegidas em `apps/app/e2e/community-v2/community-groups.spec.ts` e `docs/comunidade-v2/QA-MATRIX.md`.
- Enquanto a auditoria ocorria, a branch avançou para `f8ac68672a6a44587e9fe1b3c382977eb0421010`, igual a `origin/codex/comunidade-v2`. A comparação identifica apenas `docs/comunidade-v2/NOW.md`, `QA-MATRIX.md` e `STATUS.md`. A alteração local de `QA-MATRIX.md` entrou nesse commit; não foi feita por esta auditoria.
- A alteração protegida de `community-groups.spec.ts` permanece fora do staging, sem edição do auditor, com hash Git `43bb75e8482c3638840cbfa760a91e01927ed770` (igual ao verificado no início). Os dois testes temporários de reprodução foram removidos após execução.
- A checkout original em `C:\Users\gabsc\Documents\Codex\interprete-area-de-membros` permaneceu intocada. Este relatório é o único artefato novo da auditoria; não houve edição de código candidato.

## Achados

### RV-01 — P1 — notificações de grupo privado sobrevivem à remoção do membro

**Classe:** confirmado no código e reproduzido com testes unitários focalizados.
**Bloqueador de release:** sim no candidato original auditado (`f4ada2616f23a48b3f17bdeb4bc90eb568d3cbfa`). O código corrigido foi inicialmente enviado em `53d4ae5c017eab9e7ed3136483dac3ecd4e79e08` e está incluído no candidato final `80f6c1341acea4a56830d4091cc10e904e1cbbcc`; a rechecagem independente do candidato final está em andamento.

**Evidência.** `notifyCommunityComment` filtra destinatários privados no momento da criação e grava tipos como `MENTION`, `COMMENT_REPLY`, `TOPIC_COMMENT` e `FOLLOWED_TOPIC_ACTIVITY`, com `body` igual ao título do post e um `href` para o comentário (`apps/app/lib/notifications.ts:680-821`). Esse evento pode aguardar no outbox. No consumer, a revalidação de grupo ocorre somente quando o tipo é `GROUP_POST`; os demais tipos passam pelo retorno genérico `true` (`packages/member-domain/src/notification-outbox-consumer.ts:342-346, 809-853`).

Depois que uma notificação já existe, `memberNotificationAudienceWhere` restringe somente `GROUP_POST` e `ANNOUNCEMENT`; o primeiro ramo aceita qualquer outro tipo sem conferir a associação atual (`apps/app/lib/notifications.ts:106-150`). `getNotifications` seleciona e devolve `body` e `href`, e aplica o mesmo predicado às contagens não lidas/não vistas (`apps/app/lib/notifications.ts:344-429`). A rota HTTP retorna esse resultado à sessão autenticada sem cache compartilhado (`apps/app/app/api/notifications/route.ts:10-44`).

**Reprodução executada.**

1. Um membro recebe uma notificação `MENTION` de uma discussão em grupo privado enquanto ainda pertence ao grupo.
2. Remove-se a associação, mantendo o membro ativo no Clerk.
3. Caso o job ainda esteja na fila, processa-se o evento com o consumer; alternativamente, consulta-se `/api/notifications` após a remoção.
4. O consumer grava a notificação, ou a leitura devolve a linha, o título privado, o link com IDs do post/comentário e contagens `unreadCount`/`unseenCount` iguais a 1.

O harness temporário chamou o consumer real com uma transação simulada e confirmou que `communitySpace.findMany` não é consultado para `MENTION`, enquanto `notification.createMany` persiste o título e o link. Um segundo harness chamou `getNotifications` real e avaliou o predicado Prisma para uma notificação privada antiga. O harness da leitura implementou apenas o subconjunto de filtros usados nessa consulta; nenhum dos dois foi integração com PostgreSQL, RLS ou Clerk. Os comandos executados foram `bun run test src/community-revocation-outbox.review.test.ts src/notification-outbox-consumer.test.ts` e `bun run test lib/community-revocation-visibility.review.test.ts lib/community-comment-notifications.test.ts`; os dois arquivos `*.review.test.ts` foram temporários e removidos após o run. Resultados: consumer + teste existente, **2 arquivos/3 testes passaram**; leitura + produtor existente, **2 arquivos/7 testes passaram**. Também passaram os testes de regras de acesso, permissões de grupo, mutações e metadados: **4 arquivos/21 testes**. Não se repetiu E2E visual.

**Impacto observado e limite.** A pessoa removida ainda descobre a existência da conversa, título do post, ator, IDs/slug do link e atividade pelas contagens. O conteúdo completo da publicação não foi enviado pela notificação, e a rota da publicação revalida acesso; não afirmo leitura do corpo completo do post. A falha já viola a regra de que conteúdo privado só aparece enquanto a sessão mantém autorização.

**Correção recomendada.** Centralizar um filtro de audiência para cada tipo de notificação comunitária. No consumer, resolver comentário → post → grupo e validar associação ativa do destinatário, owner e estado publicado imediatamente antes de persistir. Na leitura, reaplicar a mesma autorização a todas as notificações que apontam para comentário, post, grupo ou convite, incluindo contagens e cursores; tornar linhas antigas inacessíveis após revogação. O predicado não pode depender apenas de `type` nem de `groupKey` ausente/inconsistente.

### RV-02 — P2 — recuperação periódica do outbox falha em todos os schedules observados

**Classe:** falha operacional confirmada; causa HTTP subjacente não identificada.
**Bloqueador de release:** sim, conforme o próprio preflight de release do `BACKLOG.md`.

`apps/api/app/cron/outbox/route.ts:12-53` oferece um worker protegido por `CRON_SECRET`, mas `apps/api/vercel.json` não agenda esse endpoint; os crons de `apps/app/vercel.json` são para prazos de atividade e limpeza de upload. O workflow de recuperação não está na branch do candidato, mas foi integrado em `main` pelo [PR #10](https://github.com/gabrielschuchter/interprete-area-de-membros/pull/10) e está ativo: `.github/workflows/community-v2-preview-outbox.yml` agenda a cada cinco minutos e chama um host Preview fixado com OIDC.

**Verificação externa somente de leitura, 23/10/2026 10:01 UTC:** `gh run list` retornou **46 runs agendados, todos concluídos com falha**, de 16/10 a 23/10; a Actions API retornou 50 execuções totais, incluindo quatro eventos `dynamic` também falhos. Não há run bem-sucedido. O workflow permanece `active`, mas não apareceu novo schedule depois de 05:59 UTC, apesar do cron de cinco em cinco minutos; o próprio workflow observa que o agendamento do GitHub é best-effort, então registro uma lacuna de cadência, sem atribuir sua causa. O run agendado mais recente é [run 39908818699](https://github.com/gabrielschuchter/interprete-area-de-membros/actions/runs/39908818699), no SHA atual de `main`, `90aa250e3d50a077df013edec38f90ce3e828316`. Falhou no passo `Process the Preview outbox`; o log termina em exit code 1 sem diagnóstico de curl/status HTTP. O corpo é descartado pelo script. A causa exata (OIDC, autenticação/redirect do Preview, worker ou outra falha do script) não ficou provada. Nenhum run bem-sucedido ou recuperação periódica foi demonstrado. Isso atualiza o estado anterior do `BACKLOG.md` (15/10), que não conhecia esses runs.

**Impacto.** OPS-01 falha na integração agendada observada. Jobs com falha ou lease expirado podem aguardar sem entrega/recovery periódico; invalidation por Broadcast também não foi observada remotamente. O log não permite atribuir a falha ao segredo, OIDC, proteção do Preview ou worker.
**Correção recomendada.** Instrumentar classificação segura da falha (status HTTP, tipo de resposta e identificador de request, sem segredo/token/corpo privado); confirmar host/deployment Preview, Trusted Source/SSO e segredo da rota. Só fechar OPS-01 depois de runs agendados bem-sucedidos e observação repetida de um job realmente recuperado, além de confirmação de Broadcast no cliente. Manter o cron GREEN/Production intocado. Não considerar chamada manual nem persistência local como fechamento do gate.

### RV-03 — P2 — rollback para cliente anterior é incompatível com novos valores enum

**Classe:** incompatibilidade de schema demonstrada; falha de desserialização do cliente antigo é risco inferido, não reproduzido.
**Bloqueador de release:** sim até que haja estratégia de reversão comprovada.

As migrations adicionam `MODERATOR` em `CommunitySpaceMemberRole` e `COHORT` em `AnnouncementAudience` (`20261021120000_community_group_moderation/migration.sql:2`; `20261022140000_community_announcement_integration/migration.sql:1`). Esses valores não existiam no schema anterior ao candidato; o PostgreSQL não oferece remoção direta segura desses valores enum, e as migrations não têm caminho de downgrade. Se forem gravadas linhas com esses valores, reverter somente o app para um Prisma Client/schema antigo pode deixar leituras incompatíveis. O problema potencial é reconhecido em `PLAN.md` como risco de valores enum novos.

**Impacto.** Rollback de aplicação após uso de moderadores ou audiência por coorte pode não restaurar a leitura do banco, mesmo que o binário anterior volte a servir tráfego.
**Correção recomendada.** Preferir rollback compatível por avanço de código; antes de release, testar o binário anterior contra dados com os novos valores, ou documentar e ensaiar uma reversão de dados segura. Não tentar apagar valores enum remotamente como rollback.

### RV-04 — P2 — migration de convites reclassifica pendências legadas

**Classe:** efeito de migration demonstrado; quantidade/impacto na base atual não verificado.
**Bloqueador de release:** sim até o preflight de dados.

`20261021140000_community_group_invitation_pending_unique/migration.sql:3-21` conserva a primeira pendência por grupo/convidado e altera as duplicadas para `REVOKED`, depois cria índice único parcial. A linha é mantida, mas o estado do convite muda. Não executei consulta no banco remoto nem migration remota.

**Impacto.** Convites duplicados ainda pendentes podem ser invalidados no deploy. A ordenação por data/ID escolhe qual continua válido; sem contagem e inspeção atuais, não se sabe se o resultado corresponde à intenção operacional.

**Correção recomendada.** Fazer preflight somente de leitura que liste pares duplicados e IDs, comparar com backup e resultado esperado, registrar contagem aprovada e só então submeter a migration ao processo de mudança autorizado. Não tratar snapshot histórico de QA como estado atual de Production.

### RV-05 — P2 — aceite de performance autenticada e mobile segue aberto

**Classe:** gate obrigatório sem evidência atual; não é uma falha de latência reproduzida nesta auditoria.
**Bloqueador de release:** sim, conforme o gate permanente de performance e a fase 10 geral do roadmap (distinta da Etapa 10 local da Comunidade).

O `performance:check` local informado no handoff da Etapa 10 mede Comunidade em 216,2 KiB gzip frente ao teto de 225 KiB. Isso confirma apenas o orçamento de bundle. Os budgets de feedback ≤100 ms, primeira navegação utilizável p95 ≤1 s, navegação aquecida p95 ≤300 ms e pequena mutação persistida p95 ≤500 ms exigem medições autenticadas; o mesmo vale para perfis/papéis, rede móvel e isolamento de cache. `docs/architecture/performance.md:1177-1179` ainda registra como abertas jornadas autenticadas, CLS, 4x CPU, dispositivo físico e p75 real, mantendo a fase 10 aberta. O E2E local 20/20 e a revisão visual dos boards não substituem essas evidências de campo.

**Impacto.** Não há base para afirmar que as rotas e mutações comunitárias cumprem os limites de desempenho em sessões e dispositivos reais. A ausência de medida não demonstra uma regressão, mas impede fechar o gate de release documentado.

**Correção recomendada.** Medir rotas e mutações da Comunidade em Preview aprovado com sessões autenticadas representativas, rede/dispositivo móvel e cache frio/aquecido; registrar percentis, papel, build/deployment, projeção/paginação e resposta após persistência. Confirmar também isolamento de identidade, grants e conteúdo privado entre sessões. Não alterar Production para obter a evidência.

### RV-06 — P1 — exclusão de grupo converte post privado em global

**Classe:** falha de autorização confirmada no estado anterior e reproduzida
por simulação transacional do contrato da FK e do filtro global.
**Bloqueador de release:** sim no candidato anterior; correção presente em
`80f6c1341acea4a56830d4091cc10e904e1cbbcc`, aguardando rechecagem independente.

**Antes — reprodução:** a relação de `CommunityPost.spaceId` permitia
`ON DELETE SET NULL`, e os leitores globais usavam `spaceId=NULL` como critério
de audiência global. Em tabelas temporárias no PostgreSQL QA, a consulta do
leitor global retornou zero linhas antes de excluir um grupo privado; após a
exclusão, retornou uma linha e o corpo `CONTEUDO PRIVADO`. A transação foi
revertida, sem tocar tabelas permanentes.

**Impacto:** uma publicação de grupo privado podia entrar no feed global,
detalhe de post ou share público, e habilitar produtor/consumer a emitir
notificações fora do escopo original. A causa era a perda de proveniência ao
apagar fisicamente o grupo, não um bypass de convite ou share token.

**Correção aplicada:** a migration
`20261023130000_community_post_audience_scope` adiciona `audienceScope` com
`GLOBAL`, `GROUP` ou `UNRESOLVED`, constraint coerente com `spaceId` e FK
`ON DELETE RESTRICT`. Os dois writes da aplicação definem o valor
explicitamente. Feed, detalhe, share público, acesso a recurso, produtor de
notificação e consumer exigem escopo e relação coerentes; registros legados
com FK nula permanecem armazenados, marcados `UNRESOLVED` e invisíveis até
proveniência ser verificada. A E2E pós-correção tentou excluir fisicamente um
grupo com post, recebeu a rejeição esperada e confirmou `GROUP` e o mesmo FK.

**Validação:** testes direcionados de regras/produtor e consumer, 24/24;
shares E2E 8/8 e regressão de exclusão 1/1. O QA integrado ficou em 21/22 por
fixture anterior da meta coletiva; a suíte focada da meta passou 5/5 com os
nove registros QA restaurados e comparados ao snapshot original. Os seis gates
e os limites do teste integrado estão no estado atual no início deste relatório.

## Risco remoto de RLS / Data API — P2

No PostgreSQL QA isolado, a consulta pós-run confirmou RLS habilitado e `has_table_privilege` falso para `SELECT` por `anon` e `authenticated`. A migration corretiva revoga esses grants porque Notification é lida pela API Prisma server-side. A migration não foi aplicada remotamente e não foi possível confirmar os grants do projeto Supabase atual. A policy antiga permite ao `sub` ler suas próprias linhas (`20260926143000_notifications_mentions_preferences/migration.sql:106-112`), sem restringir associação atual ao grupo; a rota `realtime-token` entrega ao navegador um token Clerk/Supabase com `sub` e `role=authenticated` após validação (`apps/app/app/api/notifications/realtime-token/route.ts:22-59`). Se o projeto remoto ainda conceder o privilégio, o Data API pode contornar o filtro corrigido do endpoint Prisma.

**Classificação:** o bypass remoto segue hipótese, não exploit confirmado. RLS policy não concede por si só privilégios SQL; o QA local não prova o catálogo remoto nem exercitou PostgREST com o JWT de um membro removido. **Bloqueador de release:** sim até confirmar ausência de `SELECT` direto no projeto atual, após processo autorizado de migration, e validar que a leitura direta é negada. Não aplique grants ou migrations remotas como parte desta correção.

## Controles revisados sem outro defeito confirmado

- **Identidade e IDOR de grupo:** o helper de auth transforma membros desativados em sessão sem `userId` (`apps/app/lib/auth.ts:29-87`); papéis de staff vêm de `Member.role`. `getCommunitySpace` filtra o grupo por audiência antes de retornar posts e revalida owner/membership/staff (`apps/app/lib/community.ts:581-685`). As actions de convite revalidam ator e autoridade dentro da transação e bloqueiam o grupo com `FOR UPDATE` (`invitation-actions.ts:66-110, 179-200, 399-409`). Os quatro testes de regras/permissões/mutações passaram. Não encontrei outro IDOR confirmado nos entrypoints inspecionados.
- **Tokens de convite e share:** share gera 32 bytes aleatórios, persiste apenas SHA-256 e verifica revogação (`community-post-shares.ts:15-47, 104-145`); convite usa token aleatório, hash e revalida grupo/ator na aceitação (`invitation-actions.ts:20, 390-409, 543-600`). A aceitação está limitada por membro/action e associação é criada com `skipDuplicates`. O SSR de convite é genérico, dinâmico, `noindex`/`no-referrer` e não resolve detalhes do grupo antes da autenticação (`app/(unauthenticated)/comunidade/convite/[token]/page.tsx:12-34, 82-126`). Não encontrei token cru persistido, bypass confirmado ou vazamento do token nessa página.
- **SSR/OG/cache:** share SSR é `force-dynamic`, `revalidate=0`, retorna metadados genéricos sem preview autorizado e define `noindex`/`no-referrer` (`app/(unauthenticated)/comunidade/compartilhar/[token]/page.tsx:14-40, 72-123`). OG e cover retornam `private, no-store`, sem referrer e sem indexação. A matriz local diz que token privado retornou HTML/OG/capa genéricos, mas crawler externo no Preview protegido continua sem prova.
- **Concorrência/idempotência/rate limit:** worker usa claim com `FOR UPDATE SKIP LOCKED` e lease; consumer cria notificações com `skipDuplicates`. Convites têm índice único parcial e mutações usam contador atômico por membro/action/janela (`outbox-worker.ts:70-104, 151-204`; `notification-outbox-consumer.ts:855-859`; `mutation-reliability.ts:32-61`). A falha RV-01 é uma lacuna de reautorização entre transações, não uma duplicação ou claim concorrente.
- **RLS das tabelas novas:** as migrations de links de convite/share, dismissal/cohort de aviso e snapshots habilitam RLS e revogam acesso de `anon`/`authenticated`. As policies de `realtime.messages` restringem tópico/extension; a policy Broadcast de notificações confina o canal ao `sub` e o trigger envia somente uma invalidação, não o corpo (`20260927160000_community_presence_realtime/migration.sql:1-20`; `20261003120000_private_notification_realtime_topics/migration.sql:1-55`). Isso foi revisão de SQL local, não validação de catálogo remoto.

## Integrações e validações externas

| Área | Evidência inspecionada | Estado desta revisão |
|---|---|---|
| Clerk → Supabase | O endpoint exige `exp`, `sub` e `role=authenticated`. A documentação oficial atual descreve `auth().getToken()` com a integração nativa habilitada e o claim `authenticated`; isso sustenta o padrão de código, não prova a configuração da instância atual. | Token/troca e RLS não exercitados no Preview. Ver [Clerk: Integrate Supabase](https://clerk.com/docs/guides/development/integrations/databases/supabase) e [Supabase: Clerk](https://supabase.com/docs/guides/auth/third-party/clerk). |
| Supabase / RLS / Data API | QA local confirmou `relrowsecurity=true` e `SELECT=false` para os papéis `anon`/`authenticated`; migration corretiva revoga esses grants. | A migration não foi aplicada remotamente. Grants atuais e negação de PostgREST para JWT Clerk não foram confirmados; segue como bloqueador remoto. A ferramenta conectada Supabase não disponibilizou `list_projects` nesta sessão. |
| Vercel / Preview protegido | Workflow ativo em `main` fixa o host Preview e envia OIDC. Às 10:01 UTC, 46 schedules tinham falhado e não havia schedule posterior a 05:59; o log mais recente termina em exit 1 sem diagnóstico específico. | Não consegui inspecionar configuração/deployment pelo conector Vercel: a chamada retornou `tool not available`. A resposta HTTP não está registrada nos runs. Não gerei bypass nem acessei Production. |
| Storage remoto / capas | A rota limita tipos e tamanho, usa busca sem cache e URL assinada; QA Stage 10 exercitou Storage local. | Upload, persistência, permissão e revogação em Storage remoto não comprovados. |
| Crawler / OG | HTML e arte OG foram inspecionados localmente; saídas privadas são genéricas por código e QA local. | Crawler externo no Preview protegido pendente. |
| Realtime / Broadcast | Migrações definem canais privados e trigger com payload de invalidação. Runner local restaurou o trigger de Notification ao estado anterior. | Broadcast real e persistência de presença não observados; OPS-01 segue sem fechamento. |
| Recuperação periódica | Workflow de `main` ativo; Actions API mostra 46 schedules entre 16 e 23/10, mais quatro eventos `dynamic` falhos. | 46/46 schedules falharam, nenhum sucesso; nenhum novo schedule após 05:59 UTC na verificação das 10:01. Sem prova de recuperação de job. OPS-01 é bloqueador P2 confirmado. |
| Performance autenticada / mobile | Gate de bundle passou localmente em 216,2/225 KiB gzip. | Percentis atuais, papéis, cache, rede/dispositivo móvel e mutation latency não estão demonstrados; RV-05 bloqueia release. Teclado em dispositivo físico permanece pendência P3. |

## Handoff

1. Manter o veredito **NO-GO** e não iniciar Etapa 12.
2. Obter e registrar a rechecagem independente de RV-01 no commit `53d4ae5c017eab9e7ed3136483dac3ecd4e79e08`; corrigir qualquer achado novo antes de declarar resolvido.
3. No processo autorizado de release, confirmar grants/RLS atuais e negar a leitura Data API direta com o JWT do membro removido; executar também o preflight dos convites legados, sem usar snapshot de QA como substituto.
4. Definir e ensaiar rollback compatível com os enums novos; fechar OPS-01 com runs periódicos bem-sucedidos e recuperação observada; validar Preview protegido, Storage remoto e crawler externo sem tocar cron GREEN/Production.
5. Fechar o gate de performance com medições autenticadas, percentis e dispositivos/redes representativos, sem usar o orçamento de bundle como substituto.
6. Manter a Etapa 12 fechada até conclusão dos bloqueadores e autorização separada para avançar.

Nenhuma migration remota, publicação, alteração de ambiente produtivo, configuração Vercel, alias ou tarefa da Etapa 12 foi executada nesta revisão.
