# Comunidade V2 — RELEASE-PLAN — Etapa 12A

> Atualização exclusiva de OPS-01: acesso Vercel via navegador comprovado;
> credencial local expirada, integração indisponível nesta sessão. Patch de
> diagnóstico no PR draft #16, sem ativação em main ou prova de recovery.
> **OPS-01 continua BLOQUEADO e o release NO-GO.** Ver [OPS-01.md](OPS-01.md).
> O restante deste preflight permanece no snapshot original.


**Preflight fechado em 23/10/2026: NO-GO para a Etapa 12B de publicação.**
Branch `codex/comunidade-v2`; candidato de produto
`4e026b59eb99521ed1c6b94c8444a52049d317c6`. Inspeção remota entre
19:06 e 19:15 UTC (16:06–16:15 BRT). Este plano não autoriza executar operações
que ficaram bloqueadas. A próxima execução deve remover os bloqueadores abaixo
antes de promover tráfego; não repetir a auditoria visual ou RV-01.

Fonte dos resultados atuais:
[evidência sanitizada](evidence/preflight-12a-20261023/preflight.json).
Os checkpoints anteriores ficam históricos onde contradizem este fechamento.

## Gates e decisão

| Gate | Estado comprovado | O que falta para publicação |
|---|---|---|
| Código / Etapas 10–11 / RV-01 e RV-06 | Reutilizadas as evidências locais de `POST-AUDIT-CLOSURE.md` e `QA-MATRIX.md`. RV-01 encerrado no QA local; nenhuma regressão nova reproduzida. Seis gates no candidato anterior e teste 3/3 da reconciliação posterior permanecem válidos nos limites registrados. | Smoke remoto da versão migrada; não reabrir revisão geral. |
| OPS-01 / RV-02 — scheduler Preview | GitHub ativo, ambiente restrito a `main`, segredo de rota presente por metadata. **48 schedules, 48 falhas, zero sucessos**, de 16 a 23/10. Último run `39982199840`, 15:53 UTC, exit 1 sem status HTTP no log. | Diagnóstico seguro e correção da integração existente; schedules bem-sucedidos repetidos e recuperação real de job QA namespaced. A causa do exit 1 permanece indeterminada. |
| Cron GREEN / Production atual | `interprete-member-outbox`, `*/5 * * * *`, ativo, endpoint `https://interprete-area-de-membros-api.vercel.app/cron/outbox`. Comando SHA-256 idêntico ao baseline de 15/10. 288 execuções SQL bem-sucedidas/24 h; 72 respostas retidas de pg_net são HTTP 200, sem timeout. Três jobs históricos `SUCCEEDED`, nenhum elegível no snapshot. | Resposta 200 e fila vazia não demonstram recovery V2, retry ou atualização do cliente. Não redirecionar o cron para Preview. |
| Outbox / Broadcast / notificações / badge | Namespace canônico tem dois jobs concluídos, `preview.notifications.create.v1` tem um, entregue manualmente em 16/10. Trigger de invalidação de Notification habilitado (`O`) e policy de tópico privado presentes. | Observar entrega/recovery, assinatura privada autorizada, invalidação, atualização do badge de não lidas e persistência após reload. Catálogo e entrega manual histórica não fecham OPS-01. |
| Migrations e integridade | GREEN PostgreSQL 17.11; **65 migrations completas, nenhuma divergência de checksum, 11 pendentes**. 104/104 tabelas de domínio com RLS. Sem órfão de post/grupo ou conflito de pin no snapshot. | Aplicação somente em janela autorizada, após gates de compatibilidade/backup; plano abaixo. Nenhuma migration foi executada nesta etapa. |
| RV-04 — convites legados | **Zero convites PENDING e zero linhas que seriam REVOKED** pelo ranking. Nenhum conflito para o índice de pin. Gate de dados dos convites resolvido neste snapshot. | Reconsultar na janela de escrita congelada, pois a base pode mudar. |
| Proveniência de posts legados | 31 posts: 28 com `spaceId=NULL` (8 DRAFT, 2 PUBLISHED, 18 ARCHIVED); três ligados a grupo, todos ARCHIVED. A migration 1300 deixa os 28 como `UNRESOLVED`. | Os **dois publicados sairiam da leitura da V2**. Exigir prova de origem e reconciliação revisada, ou aceite explícito da indisponibilidade enquanto a origem é apurada. Não promover para GLOBAL por suposição. |
| Grants / Data API | `Notification`: RLS ativo, `anon SELECT=false`, **`authenticated SELECT=true`**, policy apenas por destinatário (`sub=memberId`). Demais tabelas de Comunidade/outbox/badges inspecionadas sem SELECT anon/authenticated. | Migration 1100 revoga grants de Notification. Depois da migração, provar negação PostgREST com JWT Clerk válido e filtro correto pela API. A condição de catálogo é confirmada; exploit com JWT não foi executado. |
| Backup de banco | Novo dump read-only/TLS `verify-full`, 573.006 bytes, cifrado com DPAPI, reaberto e hash conferido; `pg_restore --list` e decodificação de dados aprovados, ledger com 65 entradas. Backup de 15/10 reaberto; restauração histórica de 106 tabelas/1.486 linhas reutilizada. | Backup coordenado sob manutenção antes da mudança; recuperação independente deste perfil Windows e recuperação do novo arquivo em destino isolado ainda não comprovadas. |
| Storage / capas | Bucket único `learning-assets`, privado, limite 50 MiB. Quatro objetos/11.092 bytes baixados por GET autenticado; novo backup protegido reaberto, todos os hashes conferidos. Sem upload, substituição ou exclusão remota. | Reidratação dos bytes em Storage isolado e upload/leitura/revogação pela aplicação no alvo autorizado. Backup de metadados não substitui bytes. |
| Vercel App/API / Clerk | GitHub registra sucesso de deploy dos dois projetos para `4e026b5`. Acesso anônimo aos aliases App/API retorna 302 para SSO, sem bypass. API de gestão Vercel recusou a credencial local com **403 forbidden / Not authorized**; conectores indisponíveis. | Restabelecer acesso de leitura autorizado e conferir ambientes efetivos, alvo Production, proteções, Trusted Source, flags, consumers e Clerk atual. Configurações de 15/10 são históricas, não confirmação atual. |
| Compartilhamento SSR/OG / crawler | Provas locais de share/privacidade reutilizadas. Requisição externa com user-agent de crawler ao caminho de compartilhamento inválido recebe **302 SSO**. | Isso comprova a barreira, não OG de token real nem receipt de crawler. Testar sessão autorizada sem ampliar proteção e obter a evidência externa aprovada; se o crawler não puder atravessar SSO, registrar a limitação e obter decisão explícita antes de GO. |
| RV-03 — compatibilidade / rollback | Plano de reversão abaixo preserva enums, audiência e escritas posteriores. Não há fallback remoto ensaiado nem inventário atual de todos os leitores antigos. | Retirar leitores/workers incompatíveis e ensaiar artefato compatível antes da janela. Freeze sozinho não bloqueia leitura. |
| RV-05 — performance / operação | Bundle local 216,2/225 KiB gzip e jornadas/responsividade locais reutilizados. Sem medições representativas novas. | Percentis autenticados atuais, cache entre sessões e rede móvel. V2 depende das 11 migrations ausentes no GREEN; esta etapa proíbe aplicá-las. Não medir redirect SSO ou QA local como desempenho da V2 remota. |

## Bloqueadores que permanecem e ação necessária

1. **OPS-01 falha de fato.** A integração schedule existente nunca terminou com
   sucesso nos 48 runs observados. É necessário acesso de leitura Vercel para
   conferir host/Trusted Source/ambiente e instrumentar o workflow em `main` com
   diagnóstico sanitizado, sem alterar o modelo de confiança. Alterar/mergear
   `main` aqui acionaria deployments Production; não foi feito. Não reenviar
   jobs nem chamar worker manualmente para fabricar recuperação periódica.
2. **Não há fronteira remota liberada para validar a V2 migrada.** GREEN continua
   compartilhado e sem as 11 migrations; a permissão desta etapa proíbe aplicá-las
   e mudar proteção, credenciais ou cron GREEN. Storage pela aplicação, JWT/Broadcast,
   performance e smoke precisam de uma execução autorizada após resolver a fronteira
   de manutenção e os acessos. Um status de deploy bem-sucedido não remove essa dependência.
3. **Segurança e conteúdo exigem uma janela sem versões antigas.** O grant
   SELECT de Notification ainda existe; dois posts publicados seriam ocultados.
   É preciso revogar o grant pelo processo de migration, tratar proveniência e
   retirar todos os leitores/workers antigos, inclusive hosts imutáveis e previews
   conectados ao GREEN. Isso não pode ser certificado sem acesso de gestão atual.
4. **Recuperação completa e fallback ainda não foram ensaiados.** Os arquivos
   atuais são legíveis neste perfil; falta prova independente do DPAPI, reidratação
   em Storage e artefato de fallback compatível testado. Não restaurar sobre GREEN
   para provar recuperação e não usar BLUE congelado como rollback.

Esses itens bastam para NO-GO. Nenhum warning de Turbo/Storybook, e-mail opcional,
teclado físico P3 ou refinamento cosmético foi convertido em novo projeto.

## Preparação mínima antes da janela

- Recuperar acesso de gestão **somente leitura** aos projetos App
  `prj_bwG8vDd4x2flyPaRMq8HEvi7t5Lj` e API
  `prj_LzsMnY95oPtOdp6KUwUaPRQ5lfh6`, team `team_CCjIuZlYnLPF0Bjgc74lGy9H`.
  Registrar IDs/SHAs/aliases Production e Preview atuais e configuração efetiva
  por branch; nunca publicar valores de secrets.
- Confirmar Production: GREEN, runtime Supavisor 6543 com `pgbouncer=true` e
  limite explícito; CLI 5432; CA validada; Clerk Production; namespace vazio.
  Preview: GREEN/Clerk Development e namespace `preview`, allowlist somente QA.
  Validar tokens Clerk `sub`, `exp`, `role=authenticated` sem gravar o JWT.
- Corrigir o scheduler existente na trilha revisada de `main`, com efeito de
  deploy avaliado separadamente. Registrar sempre fase, exit code de curl e status
  HTTP **antes** de testar 200; não logar token, headers, Location com query,
  corpo, destinatários ou conteúdo privado. Não usar `curl -L` com credenciais,
  ampliar Trusted Source, criar bypass ou copiar secret para pg_net.
- Depois da correção, exigir pelo menos três schedules consecutivos bem-sucedidos
  e um caso QA real de RETRY/lease expirado recuperado sem visita ao App e sem
  chamada manual. Registrar tempos, namespace e resultado sanitizado; nenhuma
  reivindicação cruzada. A cadência deve caber no SLA operacional explicitamente
  adotado; GitHub best-effort, sozinho, não garante intervalo de cinco minutos.
- Resolver os dois posts publicados por proveniência/aceite explícito e guardar
  a seleção exata dos IDs no artefato protegido. Nenhum UPDATE amplo de audiência.
- Preparar e ensaiar fallback do **mesmo código de segurança/schema do candidato**,
  incluindo MODERATOR/COHORT, audiência do post, reconciliação da notificação e
  namespace. Não voltar para `main`, `53d4ae5` ou outro binário anterior.
- Definir o mecanismo real de manutenção que bloqueia **leituras e escritas** de
  todos os deployments conectados. `APP_WRITE_FREEZE` e pausa de upload existem;
  **não foi encontrada flag V2 que esconda/desative todas as rotas** nos contratos
  de ambiente inspecionados. Não inventar `COMMUNITY_V2_ENABLED` no runbook.

## Sequência de execução da 12B — condicional, não executada

**STOP enquanto qualquer bloqueador acima persistir.** Não fazer push/merge em
`main` para preparar release: a integração Git pode promover Production automaticamente.
Um Preview não vira artefato Production testado apenas por promoção.

1. Fixar SHA candidato, fallback compatível, IDs dos dois projetos e alvos
   atuais. Conferir a allowlist de arquivos/artefatos e a configuração efetiva.
   Se houver delta de código, executar somente checks/jornadas afetados e, se
   formar novo candidato relevante, os seis gates obrigatórios. Não repetir os
   53 boards sem regressão concreta.
2. Entrar na manutenção aprovada em **todos** os hosts App/API que alcançam GREEN,
   barrando leituras antigas. Congelar escritas e uploads; pausar/drain workers
   incompatíveis. O cron GREEN permanece com seu comando/agenda; durante a
   manutenção, sua chamada não pode alcançar worker incompatível nem consumir
   eventos. Registrar backlog/leases e aguardar chamadas em voo. Verificar a
   ausência de tráfego antigo antes de continuar; freeze não resolve esse item.
3. Fazer backup coordenado T0 de banco, ledger, catálogos e bytes Storage,
   com chaves recuperáveis conforme procedimento aprovado. Os snapshots desta
   12A são sequenciais, sem freeze: são evidência de legibilidade, não T0 atômico.
   Comparar inventário/hash e ensaiar recuperação isolada sem sobrescrever QA
   preexistente. Preservar o snapshot T0 durante todo o rollout.
4. Reexecutar somente preflight de drift, convites, pins, órfãos e seleção dos
   posts legados sob freeze. Exigir zero migrations incompletas, zero drift,
   contagens aprovadas e ausência de bloqueadores de lock. Se mudou a base,
   parar e revisar a diferença; não alterar checksums/ledger para fazer passar.
5. Injetar `DIRECT_URL` GREEN 5432 a partir do armazenamento seguro no processo;
   não carregar os `.env` antigos que apontam para BLUE. Configurar CA validada
   e `PGOPTIONS` com `lock_timeout=2s` e `statement_timeout=60s`, verificando que
   o processo de migration os recebe. Não aumentar pool/timeout para mascarar
   contenção. Executar a partir da raiz, em sessão autorizada:

   ```powershell
   Push-Location packages/database
   bun x prisma migrate status --config prisma.config.ts
   bun x prisma migrate deploy --config prisma.config.ts
   bun x prisma migrate status --config prisma.config.ts
   Pop-Location
   ```

   `prisma.config.ts` impõe `sslmode=verify-full` e a CA. Os comandos **não**
   instalam env/credenciais nem aprovam a janela. `migrate deploy` aplica os
   arquivos pendentes na ordem abaixo; não agrupar manualmente os enums e seus
   usos em uma única transação, não editar SQL já aplicado nem usar `db push`.
   Falha/timeout exige parar, inspecionar transação/ledger/objetos e preparar
   retomada revisada; não executar `migrate resolve` automaticamente.
6. Conferir 76 migrations concluídas, zero pendentes/drift, grants de Notification
   revogados, RLS preservado, FK RESTRICT e constraints/índices esperados.
   Registrar a classificação resultante de posts/notificações, sem conteúdo
   em logs. Aplicar apenas a reconciliação de proveniência que tiver sido
   revisada e autorizada; manter os demais UNRESOLVED intactos.
7. Implantar **API e App compatíveis**, ambos ainda isolados da leitura pública
   e com escritas/jobs congelados. Usar builds Production preparados sem domínio
   (`vercel deploy --prod --skip-domain`, com projeto explicitamente vinculado),
   preservando os segredos/envs corretos de cada alvo. Não promover o Preview
   com env Development. Definir os IDs/URLs exatos a partir da saída real;
   não existem IDs futuros aprovados neste plano.
8. Provar auth/negação PostgREST, share SSR/OG/cache e Storage no deployment
   autorizado; liberar apenas escopo QA para o smoke mutável quando a janela
   permitir. Validar remoção/revogação, reload e ausência de vazamento em outra
   sessão. Observar recuperação e Broadcast/badge conforme OPS-01. Não liberar
   o consumer enquanto outro compatível/incompatível puder disputar a mesma chave.
9. Medir performance da V2 com MEMBER A/B e staff, desktop e rede móvel: frio e
   aquecido, navegação por intenção, detalhe/volta, publicação/comentário pequeno,
   notificações e atualização. Registrar build, papel, rede/CPU, n e distribuição;
   pelo menos 20 amostras por caminho e cenário para o p95 laboratorial, sem
   tratá-lo como p75 de campo. Budgets: feedback ≤100 ms; primeira UI útil
   p95 ≤1 s; warm intent p95 ≤300 ms; pequena escrita persistida p95 ≤500 ms;
   LCP p75 ≤2,5 s, INP ≤200 ms, CLS ≤0,1 e bundle ≤225 KiB. Evidência de campo
   ausente permanece explícita; não fechar a fase 10 geral por ensaio local.
10. Somente com gates aprovados, promover o API compatível, depois o App
    compatível, mantendo a manutenção até ambos atenderem o SHA esperado.
    Confirmar que o endpoint do cron GREEN resolve o API compatível. Retirar
    o acesso aos leitores/workers antigos inclusive por URLs imutáveis; não
    basta mover o domínio público. Preservar SSO/Clerk e isolamento Preview.
11. Liberar o consumer canônico e depois as escritas/tráfego dos membros de
    forma coordenada. Manter `preview.*` restrito ao consumidor Preview/QA;
    não remover prefixo, reenfileirar na chave legada nem apagar backlog.
    Executar o smoke abaixo e observar pelo menos três ciclos do cron.
    Falha de gate reativa manutenção e aciona rollback compatível.

## Ordem das 11 migrations e riscos

Hashes SHA-256 exatos estão no [manifesto](evidence/preflight-12a-20261023/migrations.json).
O ledger remoto não contém nenhuma delas; a divergência histórica do QA local
não é drift remoto e não justifica editar o ledger GREEN.

| Ordem / migration | Efeito e controle de aplicação |
|---|---|
| 1 — `20261020190000_community_publication_ux` | coverAltText e índices, incluindo pins únicos. Zero conflitos no snapshot. CREATE INDEX normal bloqueia escritas; aplicar sob freeze. |
| 2 — `20261021120000_community_group_moderation` | Enum MODERATOR; não remover em rollback nem servir cliente antigo após seu uso. |
| 3 — `20261021130000_community_group_invite_links` | Nova tabela/link, FKs, índices, RLS e REVOKE; não expor Data API. |
| 4 — `20261021140000_community_group_invitation_pending_unique` | Ranking muda duplicadas para REVOKED e cria índice parcial; hoje 0 afetadas, recontar no T0. |
| 5 — `20261022130000_community_post_share_links` | Tabela/link de share, FKs, índices, RLS e REVOKE. |
| 6 — `20261022140000_community_announcement_integration` | COHORT, versionamento, turmas/dispensa e Notification. Enums novos exigem fallback compatível. |
| 7 — `20261022150000_community_collective_goal` | RenewalMode, Profile opt-out, snapshots e índice de intervalos; preservar RLS. |
| 8 — `20261023110000_notification_community_audience` | Revoga grants, adiciona escopo/índice e backfill. Trigger Broadcast ativo pode ser acionado pelos UPDATEs. Não desligá-lo no GREEN para fazer passar. |
| 9 — `20261023120000_notification_community_audience_fail_closed` | Default sentinela e fechamento de notificação legada; não omitir. |
| 10 — `20261023130000_community_post_audience_scope` | Escopo explícito, CHECK, backfill GROUP e FK RESTRICT. 28 linhas NULL ficam UNRESOLVED, incluindo 2 publicadas. Exige resolução operacional prévia. |
| 11 — `20261023140000_notification_audience_reconcile` | Reconciliação final coerente com audiência do post; não liberar leitores/workers entre as corretivas. |

ALTER TABLE/validação de constraints pode exigir ACCESS EXCLUSIVE; índices
normais bloqueiam escrita. No snapshot, CommunityPost ocupa 204.800 bytes e
Notification 147.456 bytes, com apenas AccessShareLocks concedidos observados.
Isso limita o volume esperado, **não mede a duração do DDL nem garante ausência
de lock na janela**. O tempo/concorrência do rollout remoto permanece sem ensaio;
usar os limites de lock/statement e parar se excedidos. Não modificar os SQLs
para concorrência depois de já aplicados no QA sem uma decisão explícita.

## Rollback e escritas posteriores

- Antes de migration, abortar mantendo o alvo atual somente se ele continua
  compatível com o schema ainda não alterado. Depois de qualquer corretiva de
  audiência, não reabrir leitores antigos. Um deploy antigo pode ignorar as
  colunas mesmo que os inserts tenham default seguro.
- Após migration, congelar ações/uploads/jobs e barrar leitura se houver risco
  de privacidade. Trocar App/API apenas pelo artefato compatível ensaiado,
  preservando todos os enums, campos, constraints, correções e namespaces.
  Sem esse artefato, manter manutenção e corrigir por avanço; não improvisar
  downgrade para `main` ou restaurar backup sobre GREEN.
- `APP_WRITE_FREEZE=true` bloqueia mutações e caminhos cron/webhook, não toda
  leitura. `UPLOADS_PAUSED_FOR_ROLLBACK=true` pausa uploads. Não afirmar que
  essas flags fazem rollback visual da V2 nem que invalidam URLs antigas.
- Manter migrations aditivas aplicadas. Não apagar MODERATOR/COHORT, linhas,
  Notification ou jobs; não converter `preview.*` em jobs Production. Mensurar
  entrega/replay com dedupe para evitar notificação duplicada.
- Se recuperação de banco for indispensável: preservar primeiro um snapshot T1
  completo e bytes novos; restaurar T0 em destino isolado, comparar T0/T1 por
  entidade/versão, reconciliar escritas posteriores e só então aprovar o destino
  recuperado. Não descartar comentários, grants, convites ou uploads posteriores
  para voltar o relógio. Preservar tokens/revogações e não ressuscitar acesso.
- Storage é reidratado separadamente do banco, com bucket privado, metadados,
  referências e hash por objeto. Sem chave recuperável e procedimento de
  reidratação comprovado, recuperação completa continua bloqueada.

## Smoke e interrupção

Depois da liberação autorizada: MEMBER A/B e TEACHER/ADMIN navegam Explorar,
grupo/detalhe, Salvos e wrappers de Encontros em desktop/mobile; criar uma
publicação QA com capa, comentar/mencionar, seguir/silenciar, convidar/aceitar,
revogar e conferir reload e negação cruzada. Verificar aviso e meta com dados
elegíveis existentes, sem fabricar métricas. Testar visitante, token revogado,
HTML/OG/capa genéricos de grupo privado, Data API negada e caches entre sessões.
Confirmar URL/Clerk Production e SHA de App/API efetivamente servidos.

Exercitar job QA com falha/lease real, recovery automático, uma Notification,
Broadcast no tópico próprio e badge de não lidas após entrega/reload. A conquista
de perfil usa BadgeAward real → outbox BADGE_AWARDED; uma award histórica não
comprova uma nova conquista. Não inventar atividade para conceder badge.

Observar pelo menos 15 min/três ciclos de cron, registrando disponibilidade,
erros por rota/deployment, filas elegíveis/leases/DEAD, latências e ausência de
reivindicação cruzada. Logs atuais Vercel e percentis continuam sem acesso;
não foi declarado que estão limpos nem que observabilidade está completa.

**Interromper imediatamente** por vazamento, leitura por membro removido,
Data API acessível após revogação de grant, worker antigo/cross-namespace,
perda/divergência de dados, migration parcial/drift ou timeout de lock.
Não liberar se smoke/autenticação falhar; depois da abertura, suspender nova
ativação se recovery perder dois ciclos esperados, houver job DEAD ou fila
elegível sem progresso, erros persistentes ou budgets excedidos. Diagnosticar
o evento específico; não iniciar auditoria geral por warning isolado.

## Backups produzidos e como recuperar

Fora do Git, diretório protegido
`C:\Users\gabsc\AppData\Local\Codex\migrations\interprete-supabase`:

- `green-12a-database-20261023T191322502Z.dpapi`: envelope
  `INTERPRETE-12A-DATABASE-SNAPSHOT-V1`, campo `bytes` contém PGDMP em base64,
  `sha256` do plaintext. Payload 573.006 bytes;
  `2784de6c5b2620434e7fe2b81cf75367b39d80554b466bfa620d132da88ee113`.
- `green-12a-storage-20261023T191322502Z.dpapi`: envelope
  `INTERPRETE-12A-STORAGE-SNAPSHOT-V1`, quatro objetos com `bucket_id`, `name`,
  `metadata`, `bytes` base64 e `sha256`. Total 11.092 bytes. Todos reabertos e
  conferidos; nenhum plaintext/secret foi versionado.

`readProtectedJson` de `scripts/migration/green-qa-ledger.mjs` abre os envelopes
no **mesmo perfil Windows**. Decodificar base64 e conferir SHA antes de passar
o PGDMP ao pg_restore via stdin; restaurar em banco novo/isolado com plataforma
compatível (`auth.jwt` etc.), remapeamento de owner documentado e TLS. Storage
exige upload dos bytes recuperados e conferência de hash/referências em destino
isolado autorizado. Não executar esse procedimento sobre GREEN ou sobre o QA
preexistente. Os hashes dos envelopes estão na evidência sanitizada.

O backup AES de banco de 15/10 também passou autenticação, hash e pg_restore;
sua restauração histórica local continua evidência válida. O arquivo AES
histórico de Storage teve hash cifrado conferido, mas seu decodificador/formato
completo não foi recuperado nesta execução; não foi declarado corrompido nem
restaurável por uma tentativa genérica. O novo snapshot explicita o formato.
Nenhuma dessas provas demonstra recuperação em outra máquina sem este perfil.

## Encerramento e continuidade

Etapa **12A encerrada com NO-GO**. Etapa **12B de publicação não iniciada**.
Não houve migration/escrita de produto remota, deploy/promote/alias, alteração de
cron, credencial, SSO ou configuração de ambiente. BLUE permaneceu intocado.
As únicas novas cópias de dados estão cifradas fora do repositório.

Não houve alteração de código de produto nem motivo para repetir seis gates,
RV-01 ou QA visual. Foram verificados diff/links locais, JSONs, ordem/checksums
das migrations e preservação do spec protegido. O diff preexistente de
`community-groups.spec.ts` continua fora dos commits, hash Git
`43bb75e8482c3638840cbfa760a91e01927ed770`.

Próxima execução: remover os quatro grupos de bloqueadores com as permissões
operacionais necessárias, executar apenas as provas faltantes e registrar GO
antes de iniciar a sequência de publicação. Este NO-GO não exige outra 12A
genérica, nem reabertura das Etapas 10–11.

Referências de plataforma consultadas: [backup Supabase](https://supabase.com/docs/guides/platform/backups)
(backup de banco não recupera bytes Storage) e
[deployments Vercel](https://vercel.com/docs/deployments/promoting-a-deployment)
(distinguir Preview de build Production preparado).
