# Comunidade V2 — matriz de QA integrado da Etapa 10

## Candidato e conclusão

- **Ambiente:** worktree `codex/comunidade-v2`; PostgreSQL QA local `interprete_community_v2_qa` em loopback com TLS verificado; Clerk Development. Nenhuma escrita ou migration em GREEN, BLUE ou Production.
- **Base executada:** `codex/comunidade-v2` em `58d4dcbea50dcbc6cf0fa726ba533eb0199ed840`, com ajustes de QA desta rodada.
- **Resultado integrado:** Playwright `full`, run `ec93c94c16fe43a7923e8e26554523b9`, 17/19 aprovados. A jornada de grupos parou em asserção incompatível do teste protegido; o teardown de convites falhou ao gravar trace com `ENOSPC`. As asserções funcionais de convite passaram; o runner isolado `invitations` passou 6/6.
- **Estado:** QA local amplo, mas Etapa 10 não aceita como integralmente limpa. O bloqueio de grupos e a inspeção visual individual de todos os 53 boards ainda não têm evidência suficiente para fechar a matriz sem ressalva.
- **Referências:** `BOARDS.md` associa todos os 53 HTMLs oficiais às jornadas abaixo. HTMLs oficiais foram renderizados diretamente para comparação dos boards 10, 12, 13, 37b e 51; comparação de detalhe confirmada nesta rodada para o board 51, e geometria do aviso medida em 10/37b. As demais comparações e capturas anteriores estão nos checkpoints de cada etapa, mas não foram todas repetidas individualmente nesta rodada.

## Matriz A–G

| Jornada / boards | Papel e dispositivo | Resultado e evidência | Severidade |
|---|---|---|---|
| **A — Explorar, publicações, editor e capas** — 01, 04, 09, 11, 16b, 17, 18, 41b, 42 | MEMBER; desktop e mobile; integrações staff quando aplicável | Fluxo de publicação e leitura passou no E2E `full`; Storage/capas passou 3/3 em `c53f2f52ca1640ce9c4f0127fb94c075` (upload, persistência, publicação, troca, remoção e privacidade). Usado bucket QA local isolado. | Sem falha funcional local observada; Preview/Production Storage não validado. |
| **B — comentários, respostas, menções, seguir/silenciar e retorno** — 03, 06, 14, 15, 30, 39, 40, 49 | MEMBER, ADMIN/TEACHER e visitante conforme ação; desktop/mobile | Discussão passou no E2E integrado; contratos e jornada autenticada previamente passaram no runner `discussion` 4/4. Teclado virtual nativo não foi simulado. | Sem falha local observada; cobertura nativa de teclado limitada. |
| **C — grupos, privacidade, membros, papéis, convites e capas** — 05, 06, 20–26, 36, 44–46 | OWNER, MODERATOR, MEMBER, staff e visitante; desktop/tablet/mobile | Convites isolados passaram 6/6 (`cc1788841e06493aa7b0a39c703bd068`); o teste protegido de grupos passou os setups Clerk, mas expirou aguardando `select[name=role]` para TEACHER/ADMIN. O produto mantém esses alvos inelegíveis para promoção a MODERATOR. Jornada anterior de grupos passou 5/5 no checkpoint da Etapa 05. | **P2 — gate local de QA:** spec preexistente contradiz o contrato e não pôde ser corrigido sem editar arquivo protegido; nenhuma regressão de produto foi provada. |
| **D — compartilhar, landing, OG, links e revogação** — 27–29, 47–48 | MEMBER e visitante; desktop/mobile | Shares passaram 8/8 (`05fa1f6bd97c496db306d03b553d795b`): link público, autorização privada, HTML/OG genéricos, capa privada 404 e revogação. Foram testadas dimensões de 320 a 1440 px. | Sem falha local observada; crawler externo no Preview protegido segue pendente. |
| **E — avisos, meta coletiva, fontes, períodos e avatares** — 07, 10, 12, 13, 31, 37b, 51 | ADMIN/TEACHER, MEMBER e visitante; 1440, 820 e 390 px | Avisos 5/5 (`1499131935c24c2883ad1073b3fa4a42`); meta 5/5 (`e7c441570dd14ba0867d925f631671ad`) e checkpoint Stage09 `7899f86041154902b3fc416885c10189`. Cobertos períodos e bordas, fontes reais, sobreposição por membro, intervalo de 30 s em sessão-fonte elegível, sessões inelegíveis, renovação concorrente, snapshots, opt-out e rotação pausada em aba oculta. Aviso ficou entre hero e filtros em desktop/mobile. | Sem falha funcional local observada; Realtime e recovery periódico não comprovados. |
| **F — navegação, Salvos, Encontros e shell** — 02, 03, 03b, 19, 32, 33, 35, 37, 38, 43, 50 | MEMBER e visitante; desktop/tablet/mobile | Rotas comuns e recursos existentes foram incluídos nos testes integrados e checkpoints anteriores; não houve falha reportada no run `full`. As larguras e estados têm evidências por fluxo nos checkpoints de Etapas 02–08. | Sem falha reproduzida; não foi feita uma nova captura visual individual de cada board nesta rodada. |
| **G — acessibilidade, responsividade, confiabilidade, segurança e regressão** — 08, 34 e critérios transversais | MEMBER, TEACHER, ADMIN, proprietário, moderador, não membro e visitante; larguras 320/360/390/768/820/1024/1280/1440 px | Testes locais cobriram privacidade, autorização direta, reload/persistência, expiração Clerk, concorrência da meta, abas visíveis/ocultas, dimensões responsivas e regressões de rotas. O E2E `full` teve 17/19; erro de teardown `ENOSPC` não invalida asserções funcionais de convites, mas impede declarar execução limpa. Bundle Comunidade 215,9 KiB gzip / 225 KiB. | **P2 — candidato não integralmente limpo:** teardown de trace e comparação visual total dos 53 boards pendentes. Sem prova de Realtime/crawler/release. |

## Evidências focadas desta rodada

| Fluxo | Execução | Resultado |
|---|---|---|
| Storage e capas | `c53f2f52ca1640ce9c4f0127fb94c075` | 3/3 |
| Grupos | `81cdd7d2d9b0449cb2f37cedaf794c60` | Setups de autenticação aprovados; fluxo interrompido pela incompatibilidade do seletor no teste protegido |
| Convites | `cc1788841e06493aa7b0a39c703bd068` | 6/6; trigger local de broadcast suspenso durante o runner e restaurado ao estado `O` |
| Compartilhamento | `05fa1f6bd97c496db306d03b553d795b` | 8/8 |
| Avisos | `1499131935c24c2883ad1073b3fa4a42` | 5/5 |
| Meta coletiva | `e7c441570dd14ba0867d925f631671ad` | 5/5; etapa também tem checkpoint anterior 5/5 |
| E2E completo | `ec93c94c16fe43a7923e8e26554523b9` | 17/19; grupos e finalização de trace de convites falharam conforme descrito acima |

Os diretórios Playwright preservados estão em `C:\Users\gabsc\AppData\Local\Codex\qa\community-v2-foundation-20261015\playwright\results\<run-id>`. As capturas originais renderizadas diretamente nesta rodada estão em `C:\Users\gabsc\AppData\Local\Codex\qa\community-v2-foundation-20261015\playwright\official-html-comparison\`.

## Gates do monorepo

| Gate | Resultado |
|---|---|
| `bun run check` | Passou, 1.055 arquivos |
| `bun run typecheck` | Passou, 16/16 tarefas |
| `bun run boundaries` | Passou, 983 arquivos |
| `bun run test` | Passou: scripts 32 pass/1 skip; App 845 testes/175 arquivos; API 9 testes/3 arquivos; member-domain 24 testes/5 arquivos |
| `bun run build` | Passou, exit 0, 8/8 tarefas; Turbo avisou `ENOSPC` ao gravar cache após concluir |
| `bun run performance:check` | Passou; Comunidade 215,9 KiB gzip de 225 KiB |

`git diff --check` passou. Não houve mudança funcional no bundle de produção nesta rodada.

## Pendências de ambiente e evidência externa

- **Storage/capas:** loopback QA local com bucket isolado validou persistência e permissões; nenhuma escrita de objeto em Preview ou Production ocorreu.
- **HTML/OG:** privacidade foi verificada localmente em HTML/OG/capa; não houve requisição de crawler externo ao Preview protegido.
- **Migrations legadas:** 72 migrations locais reconciliadas, zero pendentes. Nenhuma migration remota foi executada; o estado histórico de schema/dados remotos não foi reavaliado por escrita.
- **OPS-01:** nenhuma entrega Supabase Realtime/Broadcast ou recuperação periódica remota foi simulada ou declarada validada. O trigger de broadcast local foi suspenso apenas para os runners que dependem do harness PostgreSQL local e restaurado ao estado original.
- **Preview/Production:** os resultados desta matriz são locais. Checkpoints Preview anteriores não validam este candidato atual; Production não foi publicada nem alterada.
- **Arquivos locais protegidos:** `actions.ts`, `community-groups-db.ts` e `community-groups.spec.ts` ficaram fora das correções e do staging. O contrato de teste de grupos continua sendo um bloqueio explícito para execução integrada limpa.

Hashes SHA-256 conferidos antes do staging: `actions.ts` `6B95C910BFB5120FC27E440AA1CCAF89FD12A19110A1CF88FF5BB47FDC03B9E7`; `community-groups-db.ts` `FD67E4F97893BB5BA96996633BC1842D6A41B80421D62A7E219A331878C7F3B9`; `community-groups.spec.ts` `84E45F95FDB31AE9F1E2B6BECF5A872E3BA495783003AF0B37B62D32A46DDFA7`.
