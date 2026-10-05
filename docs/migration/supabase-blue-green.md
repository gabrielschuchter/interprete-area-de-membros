# Migração blue/green do Supabase

**Origem (blue):** `wkclodjbrynerfgufmyb`

**Destino (green):** `qffqhilydtnrggbcnogh`
**Estado atual:** green restaurado; 48 migrations Prisma aplicadas, zero
pendentes. Production e blue permanecem intactos; não houve cutover. Release
imutável `310fb6955f0f02143417f0597f935c9bebe46b4c` está commitado e enviado à
branch de migração. App e API Preview desse commit estão `READY`; a suíte de
navegador real passou 51/51 checks no app Preview, com escritas somente no
green. A working tree mantém apenas o arquivo preexistente e não relacionado
`apps/api/CLAUDE.md` fora do release. `CRON_SECRET` já existe no target
Production do app, mas só será consumido por novo deployment. Storage blue
continua em 402 e não será sondado; os 15 objetos são perda aceita e as 99
associações de vídeo permanecem deferred/non-blocking. **Última conferência:**
05/10/2026 08:33 BRT (11:33 UTC).

## Estado operacional atual — fonte de verdade

Este bloco substitui status antigos mais abaixo. O usuário autorizou executar o
cutover após provar os gates. Ainda não houve troca de Production. O domínio
Clerk verificado e canônico continua sendo
`interprete-area-de-membros.vercel.app`; preserve o proxy FAPI `/__clerk` e não
altere os aliases. A API canônica é
`https://interprete-area-de-membros-api.vercel.app`.

O domínio Clerk Production `interprete-area-de-membros.vercel.app` está
**Verified** e **Primary**. O Frontend API usa o proxy
`https://interprete-area-de-membros.vercel.app/__clerk`; preserve-o. Com
autorização expressa do usuário, a integração nativa Supabase foi habilitada na
instância Clerk Production e o Setup mostra `Enabled`. A própria tela Clerk
fornece esse valor como “Clerk domain”. O cadastro correspondente em Auth →
Third-Party Auth do green foi tentado uma vez e recusado pelo validador: domínios
Clerk Production precisam começar por `https://clerk.`. O formulário foi fechado
sem salvar; o green permanece configurado apenas com o issuer Development
`teaching-stinkbug-5249.clerk.accounts.dev`. A documentação Clerk define `iss`
como a URL do Frontend API e mostra `https://clerk.<domínio>` para Production; a
documentação Supabase exige issuer/JWKS de um provedor third-party. O valor FAPI
com caminho `/__clerk` fornecido pelo Setup Clerk não passou no formulário e o
`iss` de um token Production ainda não foi observado de modo seguro. Assim, a
sessão Clerk do app não prova que Supabase aceite o token. Token Production com
`role=authenticated` aceito pelo green e Realtime Production continuam sem
prova. Não inventar um host `clerk.*`, remover o proxy ou configurar JWT
template/segredo compartilhado como contorno. Referências oficiais: [claims de
session token Clerk](https://clerk.com/docs/guides/sessions/session-tokens),
[integração Clerk/Supabase](https://supabase.com/docs/guides/auth/third-party/clerk)
e [proxy FAPI Clerk](https://clerk.com/docs/guides/dashboard/dns-domains/proxy-fapi).

O endpoint do webhook Clerk Production aponta para o hostname estável e correto
da API, `https://interprete-area-de-membros-api.vercel.app/webhooks/auth`, mas
continua **desabilitado**. O painel registra 102 falhas nos últimos sete dias.
`CLERK_WEBHOOK_SIGNING_SECRET` existe no target Production da API Vercel, mas seu
pareamento com o signing secret oculto do endpoint ainda não foi provado. Não
reativar entregas enquanto a API Production ainda usa blue.

O commit `310fb6955f0f02143417f0597f935c9bebe46b4c` contém a barreira de freeze,
os handlers revisados e o ajuste para que um GET de atribuição não grave estado
durante freeze. App Preview
`https://interprete-area-de-membros-khm9jq5x2-gabrielschuchters-projects.vercel.app`
(`dpl_Hy9YTBDjjwYUAxQuqmQ8MtNxC1LU`) e API Preview
`https://interprete-area-de-membros-39zgooqzw-gabrielschuchters-projects.vercel.app`
(`dpl_Brnz1GXTQthq8r7zi2dsNrUCzJSm`) estão `READY`. O harness Playwright no app
Preview concluiu **51/51 checks**: Clerk Development, persistência/reload,
leitura e escrita no Green, papéis e negações, cursos/aulas/progresso,
atividades/submissões, comunidade/comentários/votos/bookmarks, notificações,
Realtime próprio e negação de canal alheio, Storage privado/upload/readback,
logout, mobile e gravação pendente controlada. `browserErrors=[]`,
`sourceWrites=0`, `productionChanged=false`, e o único hostname Supabase
observado foi o Green. Isso comprova Development/Preview; não substitui a
confiança do issuer Clerk Production nem a entrega real do webhook Production.

`APP_WRITE_FREEZE` bloqueia métodos mutáveis e Server Actions; as rotas GET de
Cron/webhook também recebem 503. Em runtime local isolado, 21/21 checks passaram:
freeze OFF permite escrita persistida no green; freeze ON bloqueia escrita,
mantém leitura/busca e Clerk Development autenticado; Cron/webhook app/API
retornam 503; freeze OFF restaura escrita; uploads permanecem em pausa 503. O
contador de rate limit de busca não muda no freeze. O teste usou só a conta QA
Development existente e nenhuma escrita no blue/Production. O relatório ficou
cifrado em DPAPI local. Essa prova não equivale a deploy Preview nem à sessão
Clerk Production. Não há freeze ativado remotamente.

Vercel confirma um Cron válido no app: `/api/cron/activity-deadlines`, diário
às 12:00 UTC. `CRON_SECRET` foi criado como Secret somente para Production do
app; o Vercel envia esse valor como `Authorization: Bearer` nos disparos, e o
novo deployment precisa provar a execução autorizada. A API ainda tem o Cron
remoto obsoleto `/cron/keep-alive` diário às 01:00 UTC; `apps/api/vercel.json`
não o declara. Ele deve desaparecer após o deployment correto da API. Confirmar
com `vercel crons list --project interprete-area-de-membros-api`; não executar
o job obsoleto.

O snapshot comparado de 14:25:29Z (766 linhas) e 20:04:45Z (765 linhas) foi
decodificado apenas em memória. `public.Member` permaneceu em 5 linhas; uma
linha, identificada pelo fingerprint restrito `dec2c244bf07`, mudou somente
`updatedAt` de 10:03:45.398 para 15:56:01.853; nenhum campo de identidade ou role
mudou. As duas janelas removidas de `MutationRateLimit` (`member.search`, 13:49
e 13:50 do dia anterior) tinham 27,26/27,25 horas; a nova janela `member.search`
às 15:52 é do mesmo membro e explica a limpeza automática de janelas com mais
de 24 horas. O saldo dessa tabela foi 18→17. Os snapshots não guardam ator ou
consulta SQL, então a operação específica que apenas atualizou `Member.updatedAt`
não é recuperável; nenhum dado de perfil, papel ou relação divergiu. O snapshot
T0 será gerado no início da janela de cutover, após freeze remoto efetivo e
writers drenados; os snapshots anteriores são somente ensaios.

Matriz resumida no estado atual:

| Gate | Estado | Evidência / próximo passo |
| --- | --- | --- |
| Restore green, dados, schema, migrations, RLS, Realtime e QA | `PASS` | 48 migrations, zero pendentes; diff Prisma vazio, hashes/FKs e QA real do Preview no SHA candidato: 51/51. |
| Storage antigo e vídeos | `ACCEPTED DATA LOSS / NON-BLOCKING`; `DEFERRED / NON-BLOCKING` | Não baixar nem copiar; ausência controlada já aprovada. |
| Domínio/alias/proxy Clerk | `PASS` | Domínio verificado/primário; aliases do app convergem; `/__clerk` preservado. |
| Clerk Production domain/proxy/session atual | `PASS — runtime blue` | Dashboard mostra domínio canônico Verified/Primary e proxy `/__clerk`; sessão autenticada do app oficial segue funcionando. Nenhum alias/proxy foi alterado. |
| Clerk Production native Supabase integration | `PASS — habilitada` | A integração está `Enabled` no Clerk Production por autorização do usuário; o setup fornece o FAPI atual com `/__clerk`. |
| Clerk Production token/Realtime no green | `BLOCKED-EXTERNAL` | Integração nativa Clerk Production está `Enabled`, mas Green rejeitou o domínio FAPI com `/__clerk` fornecido pela tela oficial Clerk, exigindo host Production `https://clerk.*`; nada foi salvo. Somente issuer Development está cadastrado. Não registrar domínio inventado, mudar proxy/alias nem usar JWT template compartilhando o signing secret Supabase. É necessário obter configuração suportada por Clerk/Supabase que preserve o domínio/proxy atual; então verificar `iss`, `role=authenticated`, token e Realtime no green. |
| Webhook Clerk | `BLOCKED — cutover` | Endpoint canônico está correto, mas disabled; 102 falhas/7 dias. Secret Vercel existe, pareamento e entrega real não provados. Reativar após API Production apontar para green e teste assinado/replay. |
| Vercel Cron | `READY-FOR-CUTOVER` | Read-only confirma `/api/cron/activity-deadlines` diário no app e ainda `/cron/keep-alive` no deployment Production antigo da API. O commit candidato não declara Cron na API; reconciliar após deploy e antes de tirar freeze. `CRON_SECRET` está armazenado no target Production do app. |
| Writers acessíveis | `PASS — inventário de config` | Vercel: dois schedules conhecidos; Clerk webhook disabled; Supabase Cron/Functions/Vault inativos; Task Scheduler Windows sem tarefas Interprete; GitHub REST lista apenas Dependabot Updates, sem workflow executável de produto. Scripts importadores são manuais e dependem de invocação explícita. |
| APP_WRITE_FREEZE e pausa de uploads | `PASS — runtime local; Preview sem freeze` | 21/21 checks de runtime local no app/API contra Green: freeze OFF grava; ON bloqueia APIs, Server Actions, Cron, webhook e upload enquanto leitura/Clerk continuam; OFF restaura escrita. O Preview com freeze desligado passou 51/51 no SHA candidato. Ativar em Production somente na janela de virada. |
| 765/766 | `PASS` — divergência explicada | Uma atualização de timestamp sem mudança de conteúdo; limpeza de rate limits expirada identificada por row fingerprint e timestamps acima. Ver detalhes acima. |
| Snapshot final e green refresh | `READY-FOR-CUTOVER` | Divergência 765/766 explicada. No freeze gerar novo T0 e aplicar o sincronizador idempotente upsert-only; preservar QA green-only e comparar de novo. Não fazer reset nem deletar dados. |
| Release imutável | `PASS` | SHA commitado/enviado, `git diff --check` e checks do monorepo passaram; Previews app/API estão `READY` para o SHA candidato. Único arquivo untracked é `apps/api/CLAUDE.md`, preservado fora do release por ser preexistente e alheio à migração. |
| API Preview isolada | `READY-FOR-CUTOVER` | Deployment `READY` e proteção de Preview preservada. Health, webhook assinado/inválido/replay e Cron foram exercitados localmente contra Green em 8/8 checks; o E2E do app Preview alcançou as APIs integradas. Não criar bypass duradouro de proteção só para repetir handlers. |
| Cutover | `BLOCKED — issuer Clerk Production e webhook` | Native integration Clerk Production está habilitada, mas Supabase Green recusou o FAPI com `/__clerk`; o green não confia em tokens Production. Webhook Production continua disabled; o secret configurado na API não pode ser comparado ao segredo mascarado do endpoint nem testado contra Preview protegido. Production continua em Blue. |

`apps/app/vercel.json` declara somente `/api/cron/activity-deadlines` (`0 12 * * *`).
`apps/api/vercel.json` não declara Cron, mas o projeto remoto API ainda mostra
`/cron/keep-alive` (`0 1 * * *`). A CLI confirmou separadamente os dois projetos;
o comando sem `--project` pode resolver o link local errado. Depois do deployment
correto da API, conferir explicitamente:

```powershell
$env:NODE_OPTIONS = '--use-system-ca'
vercel crons list --project interprete-area-de-membros-api --scope gabrielschuchters-projects
vercel crons list --project interprete-area-de-membros-app --scope gabrielschuchters-projects
```

O QA de freeze foi executado por:
`node --use-system-ca scripts/migration/qa-green-write-freeze.mjs`. Ele usa a
conta Clerk Development isolada, faz uma alteração reversível na preferência de
notificação dessa conta QA no green, guarda o relatório em DPAPI e recusa Blue;
o campo booleano foi restaurado ao valor inicial. A próxima fotografia T0 deve
ser gerada depois desse teste e sob freeze real.

`READY` de build, deploy ou da prova Development não autoriza por si só a troca.

## Sequência operacional de cutover (preparada, ainda não executada)

1. Pré-check: commit limpo; app/API Preview no mesmo SHA e exclusivamente no
   Green; 48 migrations aplicadas, zero pendentes; smoke/e2e aprovado; Clerk
   Production aceito pelo Green; webhook assinado comprovado; `CRON_SECRET`
   validado; `vercel crons list` não mostra `/cron/keep-alive`; quotas no
   orçamento; cada writer conhecido tem owner e tratamento.
2. Suspender novos deployments automáticos durante a janela. Não alterar aliases
   nem pausar o projeto inteiro. As leituras continuam disponíveis enquanto o
   código de freeze retorna `503` às mutações; GETs de Cron/webhook também
   recebem `503` retryable.
3. Nos projetos Vercel Production da API e do app, definir
   `APP_WRITE_FREEZE=true`; no app manter `UPLOADS_PAUSED_FOR_ROLLBACK=true`.
   Fazer deploy dos SHAs validados ainda com URLs Blue. O `CRON_SECRET` do app
   já está armazenado como Secret Production; não o imprimir nem rotacionar.
   Durante o freeze, o handler autenticado não grava. Não reutilizar a key de
   Storage como credencial de banco ou Cron.
4. Com o freeze efetivo, comprovar leitura/auth/health e `503` para escrita,
   Cron e webhook. Parar Studio, workers e importadores manuais; aguardar
   requests/transações terminarem. Rodar
   `node scripts/migration/audit-supabase-writers.mjs`; exigir zero statement
   mutante e zero lock de escrita. A consulta é pontual e complementa o freeze
   da aplicação e a suspensão dos escritores diretos conhecidos.
5. Gerar o par T0 por
   `node scripts/migration/export-supabase-domain-backup.mjs`, somente para
   staging cifrado DPAPI/AES-GCM. Validar archive, contagens, IDs, hashes, FKs,
   constraints e fingerprint das 48 migrations. Abortar se a janela aprovada
   não comportar export, sincronização, validação e smoke.
6. Sincronizar T0 para Green pelo pipeline upsert-only ensaiado: sem reset,
   deletes ou replay histórico; preservar QA rows Green-only registradas no
   ledger. Aplicar apenas migrations ausentes (esperado zero) e comparar IDs,
   timestamps, relações, catálogo, grants/RLS, Realtime e quotas. Qualquer
   divergência interrompe antes de apontar tráfego.
7. Atualizar primeiro Production API (`DATABASE_URL`, `DIRECT_URL` e aliases
   existentes), depois o app (URLs de banco, aliases, Supabase URL, bucket,
   publishable/secret keys e flags). Manter `APP_WRITE_FREEZE=true`; secrets de
   servidor continuam server-only. Preservar Clerk, `/__clerk` e aliases atuais.
8. Deployar API e app do SHA fixado em freeze. Confirmar SHA, aliases,
   `GET /health?deep=1` e `databaseProjectRef=qffqhilydtnrggbcnogh`; conferir
   ausência de requests do runtime ao Blue. Testar sessão Production, leitura,
   roles e `503` de mutações. Fazer smoke desktop/mobile, incluindo ausência
   controlada de Storage e vídeo pendente.
9. Conferir os Crons remotos: somente `/api/cron/activity-deadlines` no app; o
   `/cron/keep-alive` deve desaparecer do projeto API após seu deployment. Não
   clicar Run nem invocar o Cron app com registros de produção elegíveis, pois
   ele pode emitir notificações reais. `401` e execução controlada são gates de
   Preview/teste isolado.
10. Habilitar/confirmar o webhook Clerk para a API Production canônica somente
    depois de Green ativo. Exigir entrega assinada `2xx`, assinatura inválida
    negada e replay do mesmo `svix-id` sem mutação duplicada. Enquanto freeze
    estiver ligado, `503` mantém retry.
11. Desligar `APP_WRITE_FREEZE` por deployment dos mesmos SHAs, manter uploads
    pausados durante a janela crítica e executar smoke autenticado com uma
    gravação controlada + readback Green. Após a primeira escrita relevante,
    voltar ao Blue exige reconciliação; reverter apenas as URLs não é seguro.
    Reativar uploads após encerrar essa janela.
12. Abortar imediatamente em divergência de dados, URL/ref cruzado, auth/role
    incorreta, falha crítica de leitura/escrita, 5xx relevante, quota fora do
    orçamento ou escrita inesperada no Blue. Antes de escritas relevantes Green,
    manter freeze, restaurar envs/deployments anteriores e comprovar Blue.
    Depois, manter Green como fonte; congelar e reconciliar antes de qualquer
    retorno. Não improvisar cópia de Storage.
13. Monitorar erros e quotas por 24 h e manter Blue intacto pelo período
    aprovado. Não limpar, resetar ou desativar Blue nesta operação.

Rollback é deliberadamente mínimo: snapshot T0 cifrado antes da virada; SHAs e
configuração Blue preservados para retorno imediato antes de escritas Green;
freeze até os smokes críticos passarem. Não há promessa de reversão automática
após novas escritas relevantes.
## Checkpoint de execução — restore e QA green

- Backup imediatamente revalidado: AES-GCM íntegro, SHA-256 correspondente,
  444 entradas TOC, 42 tabelas/COPY blocks, 766 linhas, 30 checksums Prisma.
- Restore transacional efetuado exclusivamente no green, com alvo verificado
  pela URI DPAPI, TLS verificado, guard de domínio vazio e falha imediata.
  Senha PostgreSQL somente no ambiente do processo filho; nenhum `.pgpass`
  em texto claro foi criado. Tentativas anteriores falharam e deram rollback.
- `rls_auto_enable` já existia e sua definição era idêntica. Três default ACLs
  de `supabase_admin` foram comparadas e já eram idênticas; o restore omitiu
  somente suas entradas verificadas, pois postgres não administra esse role.
  Grants herdados das tabelas novas foram reconciliados explicitamente com
  a origem, incluindo PUBLIC/anon/authenticated/service_role e defaults.
- Baseline antes de migrations: **766/766 linhas, IDs e hashes iguais**, 66 FKs
  válidas; funções/triggers/event triggers/RLS/policies/publication/ACLs iguais.
- As 16 migrations pendentes foram aplicadas sem replay das 30 anteriores.
  Prisma diff encontrou `ActivityAssignment.activityId` ainda NOT NULL, embora
  o schema novo admita outros targets. A migration adicional
  `20261004210000_assignment_nullable_legacy_activity` remove somente NOT NULL,
  preservando IDs, FK e CHECK de target. Resultado: **47 aplicadas, zero pendente,
  todos os checksums válidos e diff Prisma vazio**.
- Pós-migrations antes de QA: 74 tabelas (73 public + histórico Supabase),
  808 linhas, 42 enums, 126 FKs verificadas com anti-joins, zero violações,
  zero índices inválidos e zero constraints não validadas. RLS nas 73 tabelas.
  736 linhas originais de produto/histórico Supabase verificadas por hash;
  as 30 entradas Prisma originais são verificadas pelo ledger/checksums.
  Acréscimos previstos: 17 entradas Prisma, 5 batches e 20 definições/revisões.
- 99 assets VIDEO mantêm IDs, paths e relações; provider YOUTUBE, 99 IDs externos
  pendentes, zero bytes de vídeo. Endpoint retorna 409 controlado sem tentar
  recuperar vídeos apagados do Storage. Mapping YouTube continua independente.
- Uma identidade Clerk Development preexistente, ausente no snapshot original,
  foi usada para QA green. Nenhum usuário Clerk foi criado ou papel real alterado.
  Fixtures explícitas recebem prefixo QA e são preservadas, sem limpeza.
  Ledger `green-qa-fixtures.dpapi` registra PK hashes e objetos Storage de QA.
  O validador exclui somente essas PKs adicionais; recusa excluir PK da origem
  e continua exigindo igualdade integral dos 736 registros originais.
- QA autenticada local comprovou onboarding, reload, papel MEMBER negado no
  admin e TEACHER/ADMIN permitidos, escrita/readback de preferências, comentário
  idempotente, APIs/busca, Storage privado com bytes idênticos, URL pública e
  traversal negados, RLS de notificações próprias e anon negado no domínio,
  desktop/mobile, logout e persistência em nova sessão.
- Bug real corrigido: `pg_advisory_xact_lock` retornava PostgreSQL void e o
  Prisma Pg adapter falhava ao criar identidade (P2010/500). Cast `::text`
  preserva o lock e permite onboarding; reteste real aprovado.
  Envs opcionais vazias de Resend/Stripe/Cron agora normalizam para undefined,
  permitindo desabilitar provedores no sandbox sem credenciais falsas.
- Clerk Development foi registrado no green após confirmação específica.
  A instância Development recebeu claim `role=authenticated`, mantendo lifetime
  de 60 segundos. Não houve mudança no Clerk Production. Realtime foi comprovado
  com assinatura privada, broadcast real do trigger SQL e canal alheio negado.
- Preview: 38 overrides por projeto, target somente preview e gitBranch exata;
  registros compartilhados Production+Preview não foram editados. Fingerprints
  das envs Production e IDs de deployments Production permaneceram iguais.
  Cron, webhooks, e-mail, pagamentos e observabilidade externos ficam desligados.
  A CLI Vercel criou automaticamente um bypass temporário ao testar a API;
  ele foi revogado e a proteção anterior restaurada. Não reutilizar `vercel curl`
  sem entender essa geração automática. O harness reutiliza apenas acesso já
  existente, envia o header somente à origem Preview e nunca ao Clerk.
- Quota conferida no painel Free após restore: 0,034/0,5 GB de database size,
  egress <1% de 5 GB, cached egress arredondado 0/5 GB; sem quota excedida.
  Métricas atrasam até uma hora; zero exibido não significa zero consumo real.
  Storage de QA ocupa poucos bytes; os 15 objetos antigos (~10,12 MB) não foram
  copiados por decisão explícita de perda aceita. O 402 do blue não deve gerar
  novas tentativas de download.

**Checkpoint anterior à autorização atual.** Naquele momento, cutover ainda não
estava autorizado. A decisão posterior do usuário autoriza executar a virada
quando os gates estiverem provados; o status atual está no início deste
documento. Os 15 objetos antigos são perda aceita e os 99 vídeos sem ID
YouTube ficam deferred/non-blocking. A ausência controlada não deve ser
retestada sem regressão concreta.

### Conferência final desta execução

- Preview app `dpl_Bga3GrvXeDF6UpFqvi7sCs9wcwLU`:
  <https://interprete-area-de-membros-7y2ighkd9-gabrielschuchters-projects.vercel.app>.
  **51/51 verificações funcionais passaram**, sem erro de página e com requests
  Supabase observados exclusivamente no green. Inclui sessão/reload/logout,
  onboarding, papéis, permissões negativas, curso/módulos/aula e conclusão,
  progresso sem conceder entitlement, atividade/submissão/feedback, comunidade,
  voto/bookmark, biblioteca/busca, upload/readback privado e Realtime real.
  As telas protegidas foram verificadas no DOM: `notFound()` em resposta Next
  com streaming pode ter status HTTP 200, portanto status isolado não é prova.
- Preview API `dpl_9EbMWZA5Ecm6C7KJzEvqMnAxeDup`:
  <https://interprete-area-de-membros-8yxr4hl6f-gabrielschuchters-projects.vercel.app>.
  Configuração e deployment estão auditados; o último deep health remoto dessa
  versão não foi verificado após a revogação do bypass. Não ampliar a proteção
  Vercel só para teste. O mesmo código foi testado localmente contra green:
  **8/8 PASS**, incluindo health Prisma, webhook válido/inválido, replay,
  identidade única, metadata pública sem elevar role, Cron negado sem secret e
  worker autenticado. Secrets sandbox existem apenas em memória do processo.
  Isso comprova o handler; não comprova entrega real do Clerk ao endpoint remoto.
- Comparação final feita **após encerrar escritas de QA**: **896 linhas**,
  74 tabelas, **736/736 registros originais por hash** e zero diferenças.
  As 30 migrations originais seguem verificadas separadamente por checksum.
  O baseline pós-migrations era 808 linhas; os **88 acréscimos são QA explícita**,
  incluindo rate-limit, progresso, tracking, feedback e uma conquista real da
  conta de teste. Evento/outbox/notificação desse teste estão no ledger; não
  representam conquista de membro legado. Nenhum dado de QA foi removido.
- Validator nesse checkpoint: **47 migrations / zero pendentes**, 126 FKs sem violações.
  Depois foi aplicada a migration `20261004230000_clerk_webhook_receipts`; o
  estado atual tem **48 migrations / zero pendentes**.
  zero índice inválido, zero constraint não validada, RLS 73/73, grants/policies,
  funções/triggers/event triggers/publication/extensions preservados e revisados.
  Reexecução do runner retornou `migrationDeployExecuted=false`, diff Prisma vazio.
- Auditoria somente leitura das envs/deployments Vercel comparada ao baseline:
  **Production inalterada nos dois projetos**, 38 overrides Preview por branch,
  nenhum bypass adicional na API. URLs únicas Preview foram testadas; aliases
  de Production e aliases antigos da branch não foram promovidos.
- Busca SQL em 410 colunas textuais/JSON: zero referência ao project ref blue.
  Referências no checkout permanecem em histórico/documentos/guards de migração;
  envs locais originais e envs Production continuam blue deliberadamente.
  Dois artefatos locais antigos de rollback em texto claro foram protegidos
  atomicamente por DPAPI, com roundtrip validado e conteúdo integral preservado.
- Free: SQL `pg_database_size` **19.093.171 bytes**; painel aproximadamente
  **0,034/0,5 GB**, detalhe **32,78 MB**; egress **0,008/5 GB**, cached egress
  arredondado **0/5 GB**, Realtime pico **2/200**, mensagens **8/2.000.000**.
  Painel confirmou zero quota excedida; os medidores têm atraso. Esses números
  não substituem contadores de bytes nem significam consumo literalmente zero.
- Storage green contém somente 12 objetos explícitos de QA, 576 bytes e zero
  vídeos. Os 15 objetos antigos não foram copiados e estão fora do escopo de
  cutover; não contar fixtures como arquivos migrados. O painel green de Edge Functions exibiu primeira implantação,
  sem funções implantadas. Vault contém zero secrets; Cron/pg_net não estão
  instalados. O único job de QA está `SUCCEEDED`, sem jobs pendentes.
- Checks finais: `check` (514 arquivos), `typecheck` (16 tasks), `boundaries`,
  `test` (23 utilitários + 8 domínio + 146 app + 9 API) e `build` (8 tasks) PASS.
  Correções reais: lock PostgreSQL void/P2010, drift nullable da assignment,
  configuração opcional vazia; salvaguardas de vídeos/credenciais permanecem.

Relatórios ficam protegidos em `%LOCALAPPDATA%/Codex/migrations/interprete-supabase`:
`green-final-validation.dpapi`, `green-preview-qa-report.dpapi`,
`green-api-qa-report.dpapi`, `green-preview-config-audit.dpapi` e
`green-qa-fixtures.dpapi`. Não imprimir dados privados desses artefatos.

**Status daquele checkpoint:** GO do restore/schema/QA; ainda sem pré-cutover.
Esse status foi substituído pela matriz operacional do início deste documento.
O ponto permanece histórico para explicar as evidências, não para reabrir QA.

Não repetir downloads do Storage blue enquanto a API permanecer em HTTP 402.
Não copiar os 15 objetos nem qualquer MP4/HLS ao green para o cutover. A origem
continua sendo a fonte dos dados até o freeze; como os snapshots mudam, usar um
novo par completo e consistente sob freeze. O guard do restore recusa o green
já populado: reload final não pode ser improvisado como reset nem pode remover
fixtures. A ausência de um procedimento de reload/reversor ensaiado continua
sendo um gate real.

## Registro histórico dos gates de pré-cutover — 04/10/2026

> As classificações e pendências desta seção descrevem um checkpoint anterior.
> Não são o status atual e não devem prevalecer sobre “Estado operacional atual”
> no início deste runbook. A seção foi mantida para rastreabilidade.

### Decisões de produto e segurança da ausência

O usuário autorizou explicitamente **ACCEPTED DATA LOSS / NON-BLOCKING** para
os 15 objetos antigos (~10,12 MB) e **DEFERRED / NON-BLOCKING** para os 99 IDs
de vídeo. Essa decisão não apaga linhas, paths ou metadados do banco e não
autoriza qualquer cópia de vídeo. O HTTP 402 blue não será sondado novamente
até haver evidência de mudança no serviço.

Validação direcionada do código para a ausência:

- `GET /api/member-assets` exige sessão e autorização; path sem acesso ou cujo
  Storage signing não encontra o objeto retorna `404`. O proxy de bytes também
  converte resposta upstream não-success em `404`. A tela mantém conteúdo e
  metadados sem depender do arquivo; avatares usam `AvatarFallback`.
- `GET /api/learning/assets/[assetId]` retorna `404` para asset sem acesso, `409`
  para YouTube sem ID e `409` para asset sem import. Falha de signing retorna
  `503`; falha de leitura upstream retorna `502`. Para ausência normal do
  objeto, esses caminhos são respostas controladas, não `500`.
- `LessonPlayer` mostra “Reprodução pendente” para `mediaProvider=YOUTUBE` sem
  ID válido. A rota API retorna `409` antes de consultar Storage; portanto não
  há fallback dos 99 registros para o Storage blue. O helper valida IDs antes
  de montar a URL do player; `bunx vitest run lib/youtube-video.test.ts` passou
  com **14/14 testes**.
- Capas e anexos são conteúdo opcional. Sua falta não altera cursos, relações,
  autorização, submissões, feed/comentários ou metadados. Imagens diretas que
  não passam pela API podem aparecer como imagem ausente/alt no navegador, sem
  transformar a página em erro de servidor. Não se afirma playback funcional.

Logo, objetos antigos e YouTube não impedem Production. Essa decisão não cobre
novos uploads feitos no green: o blue ainda está em 402 e não pode receber uma
cópia reversa de novos objetos enquanto essa restrição continuar. O plano de
rollback precisa ou suspender uploads durante a janela reversível, ou provar
um rollback que mantenha green como datastore; não declarar RPO zero para novos
arquivos sem resolver esse ponto.

### Observações read-only e ensaio

- `scripts/migration/audit-supabase-writers.mjs` conectou ao blue via Session
  pooler, TLS `verify-full`, transação read-only e guard estrito de projeto. Em
  **20:00:53Z** observou 7 sessões, 0 ativa, 0 em transação aberta, 0 statement
  mutante ativo e 0 sessão com lock de escrita em tabela `public`. Isso é uma
  fotografia pontual, não interrompe nem impede escritores futuros.
- O exportador consistente existente foi cronometrado uma vez: **7,83 s**,
  snapshot PostgreSQL repeatable-read/read-only, 42 tabelas e 765 linhas; TLS e
  roundtrip DPAPI passaram. O artefato foi gerado cifrado fora do checkout e é
  somente um ensaio, não `T0` para cutover.
- A comparação com o snapshot aprovado anterior encontrou mudança real desde
  aquela fotografia: em `Member`, uma linha foi modificada (contagem 5→5); em
  `MutationRateLimit`, duas linhas saíram e uma entrou (18→17). O código apaga
  janelas desse rate limit com mais de 24 h em requisições normais; esse dado é
  transitório. A alteração de `Member` permanece tratada como dado real. O
  próximo cutover deve importar o snapshot inteiro sob freeze, não inferir delta
  por `updatedAt` nem tentar patch parcial.
- Não houve freeze, bloqueio de escritas, alteração blue/Production, reload do
  green nem reversão. A origem não foi escrita. O scan não prova que as escritas
  estão bloqueadas.
- A execução de `pg_restore`/reload/reversão foi deliberadamente limitada: o
  green contém fixtures QA e o runner falha fechado em destino populado; o
  serviço Docker está parado, não existe cluster local isolado em execução e
  o estado de criptografia do volume local não pôde ser confirmado. Não se
  restaurou dado pessoal em um banco local plaintext nem se usou reset no green.
  Portanto, a janela de 30 min **não foi ensaiada integralmente**.

### Matriz histórica dos consumidores e gates

| Dependência / writer | Status | Evidência e ação antes de GO |
| --- | --- | --- |
| Restore, Prisma, dados, RLS, Realtime e QA green aprovados | `PASS` | Checkpoint aprovado anteriormente; não repetir sem regressão objetiva. |
| 15 objetos Storage blue | `ACCEPTED DATA LOSS / NON-BLOCKING` | Ausência controlada: member asset `404`, asset de aprendizagem sem bytes `503`/`502` conforme etapa, sem `500`; não baixar/copiar. Uploads novos no green ainda exigem regra de rollback. |
| 99 vídeos YouTube | `DEFERRED / NON-BLOCKING` | 99 metadados preservados, IDs ausentes; UI `pending`, API `409`, sem fallback Storage. Playback não validado. |
| Vercel app Production Cron `/api/cron/activity-deadlines` | `NEEDS-MANUAL-ACTION` | Schedule diário 12:00 UTC aparece ativo, mas `CRON_SECRET` não apareceu na auditoria de nomes de env. O handler responde `401` sem ele. Criar/configurar o segredo server-side e provar uma chamada autorizada controlada; durante cutover manter um único schedule. |
| Vercel API Production Cron `/cron/keep-alive` | `NEEDS-MANUAL-ACTION` | Schedule diário 01:00 UTC aparece no painel; rota não existe no SHA/source atual e não há execução recente observada. Remover ou reconciliar no painel antes da virada; não clicar Run. |
| Endpoints e Server Actions do app/API | `READY-FOR-CUTOVER` | São writers iniciados por usuários. O checkout não contém maintenance/read-only gate global; preparar e provar manutenção que bloqueia POST/PUT/PATCH/DELETE, Server Actions e GETs com efeito colateral. |
| Clerk Development no green | `PASS` | Issuer `teaching-stinkbug-5249.clerk.accounts.dev`, sessão/claims e Realtime testados em Development. Isso não valida Production. |
| Clerk Production domain/issuer/claims | `BLOCKED-EXTERNAL` | Painel mostra domínio `interprete-area-de-membros.vercel.app` como `Checking`; projeto Vercel app lista `interprete-area-de-membros-app.vercel.app`. `apps/app/proxy.ts` também escolhe o primeiro como canônico e redireciona o segundo. Definir um domínio canônico e alinhar Vercel, Clerk, proxy, FAPI/redirects; depois adicionar issuer real ao green e validar token Production sem mudar Auth principal Clerk. |
| Clerk Production webhook | `BLOCKED-EXTERNAL` | Único endpoint está Disabled, usa hostname de deployment Preview e tem 104 falhas/7 dias. O nome do env existe, mas o segredo mascarado não permite comprovar que corresponde ao endpoint. Reapontar para domínio Production estável da API, confirmar secret, habilitar após GO e provar entrega assinada válida, inválida e replay idempotente com conta controlada. |
| Vercel Git/Deploy | `READY-FOR-CUTOVER` | App e API são projetos separados; Production atual permanece no SHA anterior. Fixar um SHA limpo e verificar deployment imutável de ambos antes da manutenção. |
| Release no checkout | `NEEDS-MANUAL-ACTION` | HEAD `814f2d7008eca3a0a5fac0f2e502b4c774cd1a9c`, branch de release, mas worktree tem 26 paths modificados e scripts/migrations/docs não rastreados. Não há SHA imutável contendo o estado QA aprovado; revisar, fixar e validar release sem incluir `.env`/artefatos DPAPI. |
| GitHub Actions | `PASS` parcial | API pública mostra apenas workflow Dependabot, sem workflow de banco/deploy customizado; nenhum `.github/workflows` local. |
| GitHub Secrets/Environments | `BLOCKED-EXTERNAL` | `gh` não autenticado; não foi possível provar que secrets/schedules remotos não têm outro writer. Disponibilizar leitura autenticada ou confirmação do owner de CI. |
| Tarefas agendadas locais | `PASS` | Windows Task Scheduler não mostrou tarefa Interprete/Supabase/rclone/recordings. |
| Importadores Kiwify/Drive | `PASS` como automação | Scripts são execução manual, não cron; guards existentes impedem destino green nos importadores de vídeo. Desligar Studio/importador manual antes do freeze. |
| Supabase Edge Functions, Vault, `pg_cron`/`pg_net` | `PASS` como inativos | Nenhuma Edge Function listada; Vault vazio; extensões/job scheduler ausentes. Não criar/ativar para o cutover. |
| Resend, pagamentos e webhooks externos | `READY-FOR-CUTOVER` | Resend não tem consumidor de envio localizado. Stripe/Svix são fundações configuradas; manter sem efeitos em Preview e validar qualquer endpoint apenas com sandbox/conta controlada. |
| Writers/automations fora das contas acessíveis | `BLOCKED-EXTERNAL` | GitHub secrets e serviços/schedulers de terceiros não podem ser inventariados daqui. O requisito zero writer desconhecido não está satisfeito; owners precisam atestar endpoints, schedules e clientes diretos. |
| Freeze/snapshot/reload/rollback | `NEEDS-MANUAL-ACTION` | Scanner e export foram ensaiados; manutenção, barreira efetiva, reload do green populado e reconciliação reversa não foram. Necessário rehearsal isolado e seguro antes da janela; não executar em blue/Production agora. |

### Histórico: procedimento Clerk anterior (domínio não estava confirmado)

1. Resolver e comprovar um domínio público canônico no projeto Vercel app e no
   Clerk. A lista atual e o `proxy.ts` divergem; não adivinhar qual URL está
   ativa. Alinhar `NEXT_PUBLIC_APP_URL`, domínio FAPI `/__clerk`, sign-in/up,
   redirects de retorno, allowlists e URL JWKS ao mesmo origin.
2. Com domínio validado, obter o `iss` do token real de uma sessão Clerk
   Production controlada. Configurar esse issuer como Third-party Auth somente
   no green, com os claims exigidos (`sub`, `role=authenticated`, `exp`). Manter
   `sub` igual ao Clerk user ID existente; autorização de professor/admin segue
   em `Member.role`, nunca no claim público.
3. Fazer login controlado em app/API Preview apontados ao green com chave e
   sessão da instância Production sem abrir escrita de produto; provar identidade
   de banco, leitura autorizada, canal Realtime próprio e negação de canal alheio.
   Nenhum issuer Development comprova esse gate.
4. Confirmar a origem Production estável da API em Vercel; atualizar o endpoint
   Clerk para `<API_PRODUCTION_ORIGIN>/webhooks/auth`, nunca hostname de Preview.
   Guardar o signing secret correspondente no helper/cofre e em Vercel API
   Production sem exibir ou copiar para logs. Verificar assinatura válida,
   assinatura inválida, retry e idempotência com usuário de teste preservado.
5. Só habilitar o webhook durante a janela autorizada, após deploy API certo e
   endpoint responder. Conferir entrega `2xx` real no painel; não declarar
   integração funcional só porque o handler local passou.

### Histórico: cutover e rollback — substituído pela sequência operacional acima

**Não executar até GO formal.** O procedimento de virada fica condicionado à
resolução dos gates acima; a ordem segura após autorização é:

1. Fixar SHA limpo app/API, deployment preview correspondente, aliases e
   fingerprints. Pausar deploys concorrentes; confirmar owners de cada writer.
2. Ativar manutenção efetiva app/API no origin atual, bloqueando requests com
   efeitos colaterais e rotas que escrevem via GET. Suspender Vercel Cron da
   app/API, webhooks Clerk e workers/importadores; não aceitar evento externo
   sem persistir ou manter retry. A manutenção ainda precisa ser implementada
   e provada no release; o scan SQL por si só não é barreira.
3. Rodar `node scripts/migration/audit-supabase-writers.mjs`; esperar transações
   e jobs terminarem; exigir zero statement/lock de escrita e nenhum writer
   direto desconhecido. Esta consulta é read-only e não bloqueia novas sessões.
4. Gerar novo par archive/snapshot com
   `node scripts/migration/export-supabase-domain-backup.mjs`; registrar `T0`,
   contagens, hashes e checksums. Export atual levou 7,83 s, mas a janela deve
   incluir manutenção, drenagem, reload, migrations, validação e smoke.
5. Recarregar somente o green usando procedimento específico, transacional e
   ensaiado para Green populado, preservando QA ledger e sem remover dados
   originais. Reaplicar apenas migrations ausentes no SHA fixado; validar hashes,
   FKs, sequences, ACL/RLS/publication e quota. O script atual recusa divergência
   e não atende sozinho ao refresh final.
6. Atualizar Vercel API Production (`DATABASE_URL`, `DIRECT_URL` e aliases
   existentes), depois app (`DATABASE_URL`, `DIRECT_URL`, aliases, `SUPABASE_URL`,
   bucket, publishable/secret keys). Manter secrets server-only. Corrigir Clerk
   domain/issuer/webhook conforme procedimento acima e confirmar pairing das keys.
7. Deploy API e app em manutenção; verificar SHA, domínio, target green, health,
   ausência de chamada blue, sessão Clerk real, leitura/RLS, notificação,
   upload/download de teste se permitido e um write controlado com readback.
8. Reativar webhook com replay idempotente e somente um Cron/worker. Como
   Storage blue está 402, não abrir novos uploads até o ensaio provar um caminho
   de rollback que preserve bytes novos no green; a alternativa conservadora é
   suspender uploads durante a janela reversível.
9. Monitorar 24 h com thresholds, confirmar dados/quotas e só liberar novas
   estruturas após estabilidade. Manter blue preservado 30 dias.

Rollback antes de escrita green: manter manutenção, parar writers green, apontar
app/API e code SHA para blue, validar login/read/health e só então reabrir.
Rollback após writes compatíveis: congelar green, backup completo, reconciliar
delta SQL idempotente, atualizar Vercel URL **e código**, validar. Não prometer
rollback integral de arquivos enquanto blue Storage estiver em 402; preservar
green como fonte ou manter upload bloqueado até existir cópia reversa segura.

**NO-GO daquele checkpoint:** Clerk Production/domain/webhook, GitHub/serviços
externos sem inventário completo, SHA limpo, maintenance/freeze eficaz,
reload/reverse rehearsal e política de rollback para uploads. O status atual é
somente o da matriz no início deste documento; Storage antigo e os 99 vídeos
continuam fora dos blockers por decisão explícita do usuário.

## Histórico anterior — diagnóstico da credencial (já resolvido)

**Autenticação SQL green resolvida:** os probes com senha
bruta confirmaram autenticação tanto no endpoint direto quanto no Session
pooler. O helper SQL agora solicita somente a senha mascarada, constrói a URI
com parâmetros fixos do green e faz percent-encoding uma única vez. Antes da
substituição atômica, verifica a senha após decodificação e os bytes DPAPI lidos
de volta do disco. A substituição usa `NullString.Value`: `$null` era convertido
em caminho vazio pelo PowerShell e causava falha local em `File.Replace`.
O probe passou a consumir a string armazenada sem reserializá-la. Depois da
substituição autorizada, uma conexão usando exclusivamente o arquivo DPAPI
retornou `ok=true`, PostgreSQL 17.11, banco `postgres`, zero tabelas públicas,
TLS verificado e transação somente leitura. Nenhuma senha foi rotacionada.
As referências a falha de autenticação mais abaixo são histórico anterior e
não representam o gate atual. Naquele checkpoint ainda não havia restore; o
restore, migrations e QA foram concluídos depois, conforme o checkpoint atual
no início deste runbook.

**Registro histórico anterior ao restore:** naquela etapa, o banco legado era a
fonte de verdade e não havia alteração SQL em blue/green, objetos Storage,
envs Vercel ou Production. O bucket privado green havia sido criado e lido de
volta com limite de 20 MiB e MIME allowlist sem vídeo; o snapshot era read-only.
O estado atual do restore e QA é descrito no checkpoint do início do runbook.

Os cinco checks locais rodados neste checkout em 04/10/2026 passaram:

- `bun run check` (504 arquivos)
- `bun run typecheck`
- `bun run boundaries` (475 arquivos)
- `bun run test` (21 testes utilitários, mais 8 de member-domain, 146 do app e 9 da API)
- `bun run build` (8 tarefas Turborepo)

Isso validava o checkout/build daquele momento; os E2E autenticados de Preview
green passaram posteriormente e constam no checkpoint atual.

## Histórico anterior — inventário antes do restore

O painel da organização Free da origem continua mostrando **Services
restricted** e excedentes de Egress, Cached Egress e Storage Size. As
capabilities foram testadas separadamente:

- **PostgreSQL blue: leitura e exportação passaram.** A conexão DIRECT_URL
  foi confirmada em PostgreSQL 17.6 com transaction_read_only=on e TLS
  verify-full. pg_dump 17.11 exportou os schemas public e supabase_migrations
  em archive custom de 234.228 bytes; pg_restore --list validou 444 entradas.
  O arquivo usa AES-256-GCM e chave protegida por DPAPI CurrentUser, em
  %LOCALAPPDATA%/Codex/migrations/interprete-supabase. Hashes e contagens
  ficam em manifesto DPAPI separado. Isso prova o caminho PostgreSQL, não
  Storage, Auth, Realtime nem fallback funcional da app.
- **Storage blue: capability de leitura estava bloqueada.** Com Node 24 e
  store de certificados do Windows, um GET autenticado de um objeto de 29.680
  bytes respondeu HTTP 402 e transferiu zero bytes. Nenhum objeto foi alterado.
  O staging cifrado não foi criado. A decisão posterior aceita a perda desses
  15 objetos, portanto não há cópia a preparar e nenhuma nova tentativa é
  necessária.
- **Green Storage: key válida e bucket pronto.** A Secret API key protegida por
  DPAPI autenticou no endpoint de buckets (`HTTP 200`); o green estava vazio.
  Foi criado e relido o bucket privado `learning-assets`, com limite de
  20.971.520 bytes e MIME allowlist contendo os uploads da app, os tipos
  inventariados e sem `video/*`. Nenhum objeto foi copiado.
- **Quotas Free green: folga ampla neste checkpoint.** O painel da organização
  green, que contém somente este projeto, mostra 26/500 MB de database size,
  0/1 GB de File Storage, 0/5 GB de egress e 0/5 GB de cached egress. Edge
  invocations e Realtime messages estão em 0; peak connections em 0/200; MAU
  em 0/50.000; Log Ingestion em 0/1 GB. O endpoint Storage confirma zero
  objetos após a criação do bucket. O painel avisa que métricas podem atrasar
  até uma hora; conferir novamente imediatamente antes de import/cutover.
- **Green PostgreSQL: URI armazenada, autenticação ainda falha.** A URI
  protegida por DPAPI passou o guard local e a validação não sensível mostrou
  usuário `postgres.qffqhilydtnrggbcnogh`, banco `postgres`, porta `5432` e
  host `aws-0-sa-east-1.pooler.supabase.com`, igual ao Session pooler mostrado
  pelo painel green. Três conexões novas pelo Session pooler, separadas por 20
  segundos, falharam com `password authentication failed`. Uma verificação
  diagnóstica única, read-only e não persistida no endpoint direto também
  retornou SQLSTATE `28P01`; a URI armazenada não foi modificada. A evidência
  atual aponta para credencial não aceita pelo PostgreSQL, e não somente cache
  do Supavisor. A orientação oficial distingue esse caso usando uma conexão
  direta: se ela aceitar a senha, retries do shared pooler devem resolver o
  cache; aqui o endpoint direto também rejeitou a senha. [Orientação Supabase
  sobre rotação e cache do Supavisor](https://supabase.com/docs/guides/troubleshooting/supavisor-error-password-authentication-failed-after-password-rotation).
  O bucket e a Secret API key funcionam independentemente disso.
  Nenhuma escrita SQL foi feita em blue/green; Production continua intocada.
- **Green PostgreSQL pelo Dashboard: somente leitura comprovada.** Uma consulta
  `SELECT` no SQL Editor autenticado do projeto green confirmou PostgreSQL
  17.11, `pg_database_size=10.794.675` bytes, zero tabelas públicas, um bucket
  e zero objetos Storage. O painel de quota exibia 26/500 MB de database size;
  essa métrica inclui overhead além de `pg_database_size` e deve ser conferida
  novamente antes do restore. A sessão administrativa do Dashboard comprova
  que o serviço PostgreSQL responde, mas não fornece ao `pg_restore` ou Prisma
  uma rota automatizável de autenticação SQL. Nenhum DDL/DML foi executado.

- **Supabase MCP: configuração adicionada, autenticação não suportada neste
  CLI.** O CLI agora aponta
  somente para `qffqhilydtnrggbcnogh`, com `read_only=true` para SQL e grupos
  docs, database, debugging e development. Foram omitidos branching
  (experimental e indisponível no Free), account (incompatível com
  `project_ref`), functions (não há Edge Function de produto a migrar; o grupo
  inclui deploy) e storage (o grupo inclui alteração de configuração; os
  objetos serão tratados pelo migrador com budgets/checkpoints). `read_only`
  limita SQL, não esses grupos de ação. O login terminou com `No
  authorization support detected`, e `codex mcp list` reporta `Auth
  Unsupported`. O MCP não está autenticado nem validado e nenhuma ferramenta
  MCP foi chamada. Não criar PAT para contornar esse limite: a migração pode
  usar os helpers SQL/Storage preparados. Esse acesso é administrativo ao
  Supabase e independente do Clerk usado pelo produto.

- **Ambientes locais: continuam blue.** A inspeção mascarada confirmou
  `DATABASE_URL` de runtime em 6543 e `DIRECT_URL` em 5432, ambos com usuário
  do projeto blue; app/API também têm `SUPABASE_URL` e chave privada Storage
  blue. Nenhum `DATABASE_URL`, `DIRECT_URL`, URL ou key green foi gravado em
  `.env.local`/`.env`. Não reutilizar valores locais do blue no green.

O destino foi identificado como projeto Supabase independente, na região
sa-east-1, mas a conexão SQL administrativa necessária ao restore não está
disponível nos ambientes locais consultados. Não copiar valores secretos do
projeto blue para green. No Dashboard green, usar **Connect → Session pooler**
e obter a URI PostgreSQL do banco `postgres`, porta 5432, usuário
`postgres.qffqhilydtnrggbcnogh` e senha Database do green. No PowerShell local,
na raiz do checkout, executar
`& .\scripts\migration\set-supabase-green-credential.ps1`; colar a URI no
prompt mascarado. O helper valida projeto/host/porta/banco e armazena a URI
cifrada com Windows DPAPI CurrentUser em
`%LOCALAPPDATA%\Codex\migrations\interprete-supabase`, com ACL do usuário
atual. Ela não entra em `.env`, Git, histórico do shell nem chat. Depois,
avisar somente que a credencial green foi armazenada.

Os gates são por capability, não pelo banner:

- restore/import e SQL green aguardam a URI verde cifrada no perfil Windows;
- cópia de Storage aguarda leitura autenticada real de bytes na origem ou
  cópias offline verificadas; HTTP 402 é a falha concreta desta capability;
- Preview de produto aguarda restore, integrações green e isolamento provados;
- cutover aguarda fallback blue comprovado para os serviços necessários,
  inventário externo fechado, catálogo/quota green e gates funcionais.

Não fazer upgrade para plano pago para contornar estes gates. Não executar
`prisma migrate deploy`, `db push`, seed ou scripts de importação para avançar
enquanto eles estiverem fechados.

O checkout agora impede os três importadores históricos Kiwify de escrever no
project ref green. O player e a rota de assets também tratam `YOUTUBE` sem ID
como associação pendente (`409` na API), sem cair silenciosamente no Storage.
Essas são salvaguardas locais; não configuram nem validam os serviços remotos.

### Revisão dos snippets recebidos

Os quickstarts apresentados são exemplos genéricos, não a arquitetura a ser
copiada. O repositório já usa Prisma 7.10.0, `prisma.config.ts`, schema e
histórico próprios; não executar `npm install prisma`, `prisma init`, gerar um
novo schema ou substituir o `schema.prisma`. `@supabase/supabase-js` já está
instalado e é usado apenas pelo cliente Realtime. `@supabase/ssr`,
`@supabase/server`, helpers de cookies e middleware de renovação de sessão não
são necessários e não foram adicionados. O fluxo `todos` é um exemplo sem
relação com o domínio Interprete.

Clerk continua sendo a autenticação principal. `/api/notifications/realtime-config`
exige Clerk e entrega URL/key pública; `/api/notifications/realtime-token`
obtém e valida o token da sessão Clerk para `realtime.setAuth()`. Não configurar
Supabase Auth, cookies Supabase, `SUPABASE_JWKS_URL` ou JWT secret Supabase para
imitar o quickstart. A publishable key green é a key adequada ao cliente
Realtime. A URL do projeto green e a publishable key fornecida passaram um
health check HTTP 200 no endpoint de Auth do próprio projeto; a key foi usada
somente como header e não foi armazenada em env local. Isso confirma o par
URL/key e a disponibilidade desse endpoint, mas não valida SQL, PostgREST,
Realtime ou permissões da aplicação. A key ainda não está em ambiente
local/Preview. A `SUPABASE_SECRET_KEY` privada está armazenada separadamente
por DPAPI e autenticou operações administrativas de Storage; isso não prova
policies de objeto nem uploads da aplicação. O API app não consome variáveis
Supabase de Storage; seu `.env.example` foi corrigido para removê-las.

A conexão `db.<ref>.supabase.co:5432` com usuário `postgres` não é o caminho
adotado pelo Interprete. Usar o pooler Supavisor: runtime em transaction mode
6543 e migrations em session mode 5432, com usuário namespaced do projeto. O
`prisma.config.ts` local agora força `sslmode=verify-full` e CA verificada para
o Prisma CLI, independentemente de um `sslmode=require` vindo da URL. A chave
publishable não substitui o token Clerk nem credencial de banco/Storage.

## Inventário de referência

### PostgreSQL

O último snapshot auditado da origem era PostgreSQL 17.6, aproximadamente
184.601.747 bytes de banco, com 41 tabelas em `public`, 441 colunas, 41 PKs,
66 FKs, 173 índices, 24 enums e 4 checks. As 66 FKs estavam íntegras; RLS
estava habilitado nas 41 tabelas e não havia constraints não validadas. O
schema `public` ocupava aproximadamente 3,72 MB. A relação física
`storage.objects` ocupava aproximadamente 168.869.888 bytes, que não representa
bytes lógicos de arquivos a importar.

O domínio contém membros/perfis, catálogo de cursos/aulas/assets, grants e
progresso, gravações/importações, atividades e feedback, comunidade,
notificações, encontros, biblioteca, configurações e históricos. Preserve
todas as tabelas e linhas, inclusive vazias, soft deletes, drafts e histórico
administrativo. IDs, UUIDs, timestamps, relações e sequences devem ser
comparados antes/depois. Não descartar `MigrationRecord`, `MigrationStudent`,
`MutationRateLimit` nem históricos por parecerem temporários.

O histórico auditado continha 30 migrations Prisma aplicadas na origem, 46 no
checkout e, portanto, 16 pendentes. Os checksums das 30 aplicadas coincidiam.
O histórico `supabase_migrations` tinha 18 entradas e deve ser preservado
separadamente. Isso não autoriza replay dos SQLs Supabase nem das 30 migrations
Prisma. Não criar baseline artificial.

Snapshot read-only pareado de 04/10/2026 14:25 UTC: 42 tabelas base nos
schemas `public` e `supabase_migrations`, 447 colunas, 766 linhas e
184.601.747 bytes no banco. Os arquivos
`origin-domain-20261004T142528Z.pgdump.aesgcm` e
`source-snapshot-20261004T142529Z.json.dpapi` estão fora do checkout, cifrados
e pareados pelo identificador do snapshot. O verificador autenticou AES-256-GCM,
leu 444 entradas do TOC, decodificou todos os 42 blocos `TABLE DATA`, contou as
766 linhas, comparou contagens com o manifesto e confirmou os 30 checksums
Prisma aplicados; havia exatamente as 16 migrations listadas abaixo. Nenhum
dado de linha é impresso no relatório. Naquele checkpoint o restore ainda não
havia sido executado; sua conclusão atual está documentada no início.

A comparação read-only do banco PostgreSQL blue com o `schema.prisma` final foi
executada por `prisma migrate diff --from-config-datasource` em conexão de
sessão com TLS `verify-full`. Ela produziu 218 instruções DDL para chegar ao
modelo final: 18 enums, 32 tabelas, 70 alterações de tabela, 59 índices e 38
índices únicos, além de um `DROP INDEX`. Não há `DROP TABLE`, `DROP COLUMN`,
`DROP TYPE` ou `DROP SEQUENCE` nessa projeção. O único índice removido é
`ActivityAssignment_activityId_memberId_key`, removido explicitamente pela
migration `20261003160000_unified_learning_assignments` ao substituir o modelo
de assignments; essa migration precisa ser aplicada uma única vez após a
restauração do snapshot real.

A primeira comparação encontrou ainda dois índices que já existem no blue
porque foram criados por migrations aplicadas, mas não estavam declarados no
Prisma: `CommunityPost_isFeatured_status_createdAt_idx` e
`Member_onboardingStatus_idx`. Ambos foram adicionados ao `schema.prisma` com
seus nomes físicos explícitos. Assim a comparação atual deixa somente o drop
intencional acima. Essa reconciliação é apenas do modelo Prisma local: não
altera SQL de migration, checksum, dado ou banco blue. No green, restaurar o
snapshot com esses índices e então aplicar as 16 migrations; ao final, o diff
Prisma deve estar vazio. Não resolver drift executando drops manuais: qualquer
diferença restante deve interromper a etapa e ser comparada com os manifests e
com as migrations aprovadas.

O TOC contém também 43 ACLs, seis `DEFAULT ACL`, 24 tipos enum, uma function,
42 tabelas, 43 constraints de PK/unique, 66 FKs, 132 entradas de índice e uma
policy pública; os quatro CHECKs aparecem na definição das tabelas. Os GRANTs
e default privileges desses schemas estão no dump. `rls_auto_enable()` é a
única function de produto no catálogo legado: `SECURITY DEFINER`, dona de
`postgres`, EXECUTE para `postgres` e `service_role`; o event trigger
`ensure_rls` chama essa function para habilitar RLS em DDL novo. Os outros seis
event triggers são de plataforma/extensões, e não devem ser copiados.

O manifesto e `pg_dump` foram gerados na mesma transação repeatable-read
read-only. O validador posterior calcula novamente hashes canônicos de cada
linha no green e compara identidade/valores com o manifesto; contagem isolada
não será aceite como prova de conteúdo. O catálogo pareado contém 113
constraints, 175 índices, 36 enums, 100 functions, zero views/materialized
views, zero sequences de domínio, cinco extensions, oito triggers ordinários,
sete event triggers, três policies (uma em `public` e duas em
`realtime.messages`), 86 ACLs de relações, nove ACLs de schemas, 24 default
ACLs, 30 roles, 24 memberships e 38 relações gerenciadas com RLS. Dos objetos
do schema `public`: 41 relações, 441 colunas, 111 constraints, 173 índices,
24 enums, uma function e uma policy.

As cinco extensions inventariadas são `pg_stat_statements` 1.11 em
`extensions`, `pgcrypto` 1.3 em `extensions`, `plpgsql` 1.0 em `pg_catalog`,
`supabase_vault` 0.3.1 em `vault` e `uuid-ossp` 1.1 em `extensions`. O dump
não contém entrada TOC para event triggers nem publications (zero de cada);
essas configurações serão reconciliadas separadamente. Não se restauram roles,
schemas gerenciados, objetos de Auth/Storage/Realtime, chaves ou ciphertext do
Vault por meio do dump.

Sequência pendente registrada no checkout:

1. `20261003100000_member_domain_events`
2. `20261003120000_private_notification_realtime_topics`
3. `20261003140000_community_study_groups`
4. `20261003160000_unified_learning_assignments`
5. `20261003180000_lesson_asset_media_provider`
6. `20261003200000_learning_catalog_rails`
7. `20261003220000_community_edit_timestamps`
8. `20261003230000_library_personal_relevance`
9. `20261003240000_editorial_announcements`
10. `20261003260000_exercises`
11. `20261003270000_study_goals_tasks`
12. `20261003280000_badges_profile`
13. `20261003290000_badge_attendance_criteria`
14. `20261003300000_meeting_attendance`
15. `20261004010000_library_read_study_tracking`
16. `20261004100000_library_catalog_metadata`

Revalidar o conjunto no HEAD que será promovido antes de aplicar. Primeiro
restaurar e comparar o estado real; depois aplicar apenas o que estiver
pendente. Não restaurar indiscriminadamente `auth`, `storage`, `realtime`,
roles internos, chaves ou ciphertext Vault sobre o projeto provisionado pelo
Supabase.

### Storage e mídia

O inventário histórico read-only do bucket privado learning-assets encontrou
15 objetos e 10.117.711 bytes lógicos: 9 eram referenciados no snapshot e 6 não
tinham referência encontrada. **Decisão posterior de produto (04/10/2026): os
15 objetos são imagens antigas/não essenciais e a ausência é perda aceita.**
Essa decisão substitui os planos anteriores de cópia integral. Não executar o
migrador de Storage, não repetir GET no blue enquanto houver HTTP 402 e não
incluir paths desses objetos no aceite do green. Manter o manifesto somente
como registro histórico; nenhuma fixture de QA representa objeto migrado.

| Prefixo | Total inventariado (histórico) | Com referência no snapshot | Sem referência encontrada |
| --- | ---: | ---: | ---: |
| kiwify/ | 3 / 3.720.500 bytes | 3 / 3.720.500 bytes | 0 |
| community-assets/ | 5 / 1.812.874 bytes | 4 / 1.776.788 bytes | 1 / 36.086 bytes |
| profile-assets/ | 6 / 4.554.657 bytes | 2 / 2.509.142 bytes | 4 / 2.045.515 bytes |
| kiwify-hls/ | 1 / 29.680 bytes | 0 | 1 / 29.680 bytes |

As rotas de leitura da aplicação tratam objetos ausentes como `404`/ausência
controlada; uploads continuam sujeitos aos seus próprios gates de autorização,
quota e rollback. O inventário não autoriza apagar nada do blue e não deve ser
usado para acionar downloads. Limpeza futura é uma operação separada e não faz
parte desta migração.

Há 99 assets `VIDEO` com `storagePath` antigo, sem objeto correspondente e sem
`externalUrl`. Os MP4s devem permanecer no Google Drive e a entrega deve usar
YouTube. **Não copiar vídeos, segmentos HLS ou MP4s ao Supabase green.** Manter
os IDs internos, relações, permissões e progresso; preencher o ID externo
somente com mapeamento verdadeiro. ID ainda ausente permanece `NULL` e em
estado pendente explícito.

Orçamento operacional green: banco final até 100 MB, objetos lógicos até
500 MB, até 500 MB de egress total reservado para migração/validação e até
100 MB para testes de Storage. Os objetos históricos aceitos como perda não
consomem a quota Storage do green. Manter pelo menos 3 GB livres tanto em Egress quanto em
Cached Egress da organização green. Esses valores precisam ser comparados
novamente ao consumo da organização, aos bytes/hora e às quotas oficiais no
dia da execução. Abortar antes de exceder o orçamento; métricas podem atrasar
até uma hora.

Limites Free verificados no planejamento: database 500 MB/projeto (a página
atual também descreve 1 GB de disk provisionado no Free; entrar em read-only ao
exceder a quota de 500 MB), File
Storage 1 GB, Egress 5 GB/ciclo e Cached Egress 5 GB/ciclo independentes;
Realtime 200 conexões concorrentes e 2 milhões de mensagens/mês; Edge
Functions 500 mil invocações/mês; upload individual até 50 MB. Revalidar
preços/limites oficiais e consumo da organização antes da janela. As páginas
atuais de [billing](https://supabase.com/docs/guides/platform/billing-on-supabase)
e [database size](https://supabase.com/docs/guides/platform/database-size)
distinguem database size da alocação de disk. O teto de uploads da aplicação
será muito menor que o limite global: imagens até 5 MiB, bucket até 20 MiB e
vídeos/HLS bloqueados.

Limites adicionais Free conferidos: o compute Nano permite até 60 conexões
PostgreSQL e 200 clientes de pooler; a app usa pooler de transação e deve
manter poucos sockets por instância Vercel. Realtime permite 200 conexões
simultâneas, 2 milhões de mensagens/mês, 100 eventos/s, 100 joins/s, 20
eventos Presence/s, 100 canais/conexão e 256 KB por broadcast; o teste de
Presence precisa respeitar também 5 chamadas por cliente em 30 segundos. Edge
Functions têm 500 mil invocações/mês, 256 MB, 150 s no Free, 2 s de CPU por
request e até 100 funções. Nenhuma Edge Function foi confirmada no inventário.
O Free não inclui backup automático/PITR e pode pausar projeto com pouca
atividade de banco por 7 dias. Manter export cifrado fora do projeto e
monitorar atividade/avisos de pausa do blue durante os 30 dias de retenção.
Referências atuais: [Nano e conexões](https://supabase.com/docs/guides/platform/compute-and-disk),
[pooling](https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits),
[Realtime limits](https://supabase.com/docs/guides/realtime/limits),
[Edge Function limits](https://supabase.com/docs/guides/functions/limits),
[backups](https://supabase.com/docs/guides/platform/backups) e
[pausa Free](https://supabase.com/docs/guides/platform/free-project-pausing).

## Registros de auditoria necessários

Armazenar fora do Git, cifrados e com acesso restrito:

- fingerprints e definições de catálogo blue/green;
- contagens, conjuntos de PKs e hashes canônicos por tabela no snapshot;
- os dois históricos de migrations e checksums;
- manifesto de cada objeto Storage com bytes, MIME, referência, classificação
  e hash;
- matriz de envs com nome, consumidor, target e procedência, nunca seu valor;
- integração, proprietário, endpoint, credencial cadastrada e teste;
- ledger de cada transformação de dados;
- log da janela, cutover e eventual reconciliação reversa.

Não colocar dumps, dados pessoais, URLs assinadas, tokens ou secrets no Git,
logs de build ou relatório. Consultas de inventário não devem invocar funções
de usuário.

## Ambientes e integrações

| Consumidor | Configuração que precisa acompanhar o cutover | Gate |
| --- | --- | --- |
| Local app/API/Prisma | `DATABASE_URL` runtime via pooler de transação `6543`; `DIRECT_URL` CLI via session pooler `5432`; TLS validado | Usar arquivo/local env isolado; nenhum valor de Production copiado |
| Vercel Preview app e API | Overrides por branch para as URLs e chaves green; confirmar todos os fallbacks `POSTGRES_*` | Preview nunca pode ler/escrever blue; jobs e efeitos externos desligados |
| Vercel Production API | DB URL, DIRECT_URL, aliases existentes e segredo Cron aplicável | Alterar primeiro durante manutenção, depois criar novo deployment |
| Vercel Production app | DB URL, Supabase URL, bucket e chaves server/publishable | Alterar depois da API e só publicar sob manutenção |
| Clerk | Mesma identidade Clerk; vínculo por `Member.id`/`Profile.clerkUserId`, sem remap por e-mail | Configurar integração third-party green; testar claims e webhook; comprovar rotação da chave Production já considerada comprometida |
| Realtime | Membership da publication, policies RLS de realtime.messages e tokens green | Testar notificação própria, canal próprio/alheio, Presence e reconexão |
| Resend | Serviço externo | Não rotacionar por causa da migração; validar envio apenas a endereço controlado |
| Google Drive / YouTube | Permanecem externos | 99 associações sem ID são `DEFERRED / NON-BLOCKING`; não mover mídia nem inventar mapeamento. Playback não é declarado validado |
| Outbox / Vault / Cron | Configuração pertence ao projeto | Outbox/Vault/Cron do Supabase estão inativos; não ativar agora. Se o outbox passar a ser requisito, guardar novo segredo server-side e validar endpoint antes de um único scheduler. O Cron diário da app tem gate separado e usa `CRON_SECRET` da app. |
| GitHub / automações externas | Secrets e schedules fora do banco | GitHub CLI e inventário de escritores externos precisam estar acessíveis; desconhecido bloqueia freeze |
| Edge Functions / database webhooks | Projeto Supabase | Não havia função listada; estado de secrets/integrações não foi verificável. Reabrir inventário antes de configurar green |

Os projetos Vercel app/API já foram identificados, mas qualquer leitura ou
alteração de env deve registrar somente nomes, targets e hashes de presença.
Valores efetivos não entram neste arquivo. Nunca editar env compartilhada
Production+Preview para testar. Toda alteração exige novo deployment/processo.

Busca path-only do ref antigo e do hostname encontrou 29 arquivos: os três
envs locais ignorados (`apps/app/.env.local`, `apps/api/.env.local`,
`packages/database/.env`); templates (`apps/app/.env.example`,
`apps/api/.env.example`); migrations e guards novos; documentação ativa
(`README.md`, `docs/architecture/foundation.md`,
`docs/infrastructure/environment.md`, `docs/implementation/roadmap.md`,
auditorias e este runbook); e manifests/scripts históricos de gravações
(`migration-recordings-*`, `scripts/recordings-drive-migration.mjs`). Os refs
nos scripts novos são guards explícitos de blue/green. Não reescrever
manifests de auditoria nem alterar env local agora; após validação, atualizar
templates/docs ativos e manter referências históricas claramente rotuladas.
Busca foi feita sem imprimir linhas/valores de env. Acessos remotos ainda
pendentes incluem secrets/environments GitHub e consumidores externos fora do
checkout; zero writer externo desconhecido é gate do freeze.

Integrações seguem esta sequência independente do restore: (1) manter Clerk
como fonte de identidade; configurar Third-party Auth green com issuer Clerk e
claims `sub`, `role`, `exp`, sem compartilhar `SUPABASE_JWT_SECRET`; (2) validar
que `Member.id` e `Profile.clerkUserId` continuam iguais ao Clerk user ID, sem
remap por e-mail; (3) apontar webhook Clerk de teste para o Preview da API com
secret Development distinto, exercitar assinatura inválida, retry e idempotência;
(4) manter Resend em sandbox/endereço controlado; (5) manter Stripe/Svix em
sandbox e validar signature/replay sem pagamentos reais; (6) configurar o
endpoint green do outbox/Vault, Cron Vercel e qualquer scheduler externo com
um só worker ativo e `CRON_SECRET` compartilhado apenas com o consumidor;
(7) copiar customização Realtime/publication/policies por DDL validado, mas não
copiar ciphertext Vault nem chaves criptográficas do projeto blue; (8) nenhuma
  Edge Function foi listada; manter essa capability inativa e reabrir apenas se
  nova evidência indicar dependência; (9) Drive/YouTube continuam externos, com
  99 gravações sem IDs finais como pendência funcional não bloqueante. Emails,
  webhooks, importadores e Cron reais ficam desligados em Preview.

No green, conferir e documentar CORS/origins do projeto: incluir somente a
origem do Preview isolado durante os testes e as origens canônicas do app no
cutover, sem wildcard. Storage é chamado pelo servidor e devolve URL assinada
temporária; Realtime conecta no browser e exige origem/claims corretos. Clerk
continua dono dos redirects de signup/login; como `auth.users` blue está vazio,
não criar usuários Supabase nem copiar callbacks do Clerk para Supabase Auth.
Não presumir que CORS, redirect allowlists, webhooks e chaves do projeto blue
tenham migrado automaticamente.

O catálogo blue não tem `pg_cron` nem `pg_net` instalados e o Vault está sem
secrets. `docs/deployment/supabase-outbox-cron.sql` é o setup versionado, mas
não deve ser aplicado no Preview durante esta preparação. Depois do cutover,
se o endpoint exigir recuperação durável via Supabase Cron, habilitar as
extensions disponíveis no green, cadastrar no Vault somente a URL canônica da
API e o `CRON_SECRET` correspondente, validar o SQL/job com scheduler parado e
ativar um único schedule. Enquanto isso, provar processamento com chamada
controlada autenticada a `/cron/outbox`; não iniciar worker duplicado.

**Compatibilidade Supabase atual:** desde 14/07/2026, o schema Realtime
bloqueia criação, alteração e remoção de objetos; policies RLS em
realtime.messages continuam permitidas. As migrations do Interprete colocam
a policy nesse schema, mas criam o trigger e a função de notificação em
public. Não tentar criar objetos customizados dentro do schema gerenciado.
Conferir a membership da publication supabase_realtime como objeto
PostgreSQL separado antes de adicioná-la ao green. Ver [breaking change de
Realtime](https://supabase.com/changelog?types=breaking-change).

No snapshot blue existem exatamente duas policies de produto em
realtime.messages: leitura e escrita do canal privado de Presence. A
publication supabase_realtime inclui public.Notification. Não há policies
customizadas em auth ou storage. Os triggers de Storage e os event triggers
de extensão são gerenciados pela plataforma; não copiá-los. Comparar no green
a policy Presence, a membership de Notification e o estado do event trigger
de RLS; validar RLS em todas as tabelas após as migrations.

O projeto green é um projeto novo. Não presumir exposição automática das
tabelas public pela Data API: confirmar configuração e grants. O app usa
Prisma server-side; não conceder acesso anon/authenticated para “corrigir”
acesso sem consumidor REST comprovado. RLS continua obrigatória.

### Histórico: ambiente e matriz de variáveis antes do restore

Projetos Vercel confirmados: `interprete-area-de-membros-app` (`apps/app`) e
`interprete-area-de-membros-api` (`apps/api`). Production e Preview possuem
`DATABASE_URL` e `DIRECT_URL` nos dois projetos. O app possui URL/bucket
Supabase em Production e Preview e chave privada somente em Production. A
listagem consultada não mostrou targets `Development`, `CRON_SECRET` nem keys
publishable/anon. Localmente, `apps/app/.env.local`, `apps/api/.env.local` e
`packages/database/.env` apontam para blue; app/API usam Clerk Development.
Esses arquivos ignorados permanecem sem alteração. Não imprimir seus valores.

| Variáveis | Consumidor/localização | Preview | Production | Ação e fonte do green |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | App/API e Prisma runtime; `packages/database/keys.ts` aceita `POSTGRES_PRISMA_URL` como fallback | Targets app/API atuais; override exclusivo da branch de migração | Targets app/API atuais; intocados até cutover | URL de runtime Connect → transaction pooler green (porta `6543`, `pgbouncer=true`, limite explícito); trocar também fallback existente ou removê-lo se não usado |
| `DIRECT_URL` | Prisma CLI via `prisma.config.ts` | Override por branch nos consumidores Prisma | Atualizar na janela, junto dos aliases | Session pooler green `5432`; derivar da credencial Database green |
| `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING` | Fallbacks Prisma/runtime se presentes | Inspecionar e sobrescrever/remover na branch | Atualizar junto com URLs principais | Nunca deixar alias apontando para blue após deployment green |
| `DATABASE_CA_CERT`, `DATABASE_CA_CERT_PATH` | TLS `packages/database/ssl.ts` | Path local pode não existir em Vercel; validar CA bundled/fonte | Manter TLS validado | Usar CA compatível com Supabase e `rejectUnauthorized`; não desligar verificação |
| `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_STORAGE_BUCKET` | App: Storage privado, signed URLs e endpoint de configuração Realtime; bucket padrão `learning-assets` | URL/bucket por branch | Trocar somente no cutover | URL do green e mesmo bucket privado; confirmar precedência `SUPABASE_URL` antes da variável pública |
| `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | App server-side para Storage/read, uploads, deletes e signed URLs; ferramenta de cópia usa credencial green separada | Secret green apenas em server environment | Secret green apenas server-side no cutover | Obter Secret API key em Settings → API Keys do projeto green; preferir `SUPABASE_SECRET_KEY`; nunca reutilizar blue ou expor no bundle |
| `SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `/api/notifications/realtime-config`; devolve URL/key somente ao usuário Clerk autenticado | Publishable key green; eliminar alias que prevaleça sobre ela | Publishable key green após validação | Obter em Settings → API Keys; key publicável não substitui JWT Clerk nem policy RLS |
| `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | App/API, proxy e auth package | Par Development ou ambiente de teste isolado | Par Production atual; rotação documentada precisa ser comprovada | Não mudam por trocar Supabase; manter identidade e validar issuer/claims |
| `CLERK_WEBHOOK_SIGNING_SECRET` | API `/webhooks/auth` | Endpoint e secret Development separados | Endpoint canônico e secret Production; sem alteração até GO | Configurar no Clerk Dashboard se o endpoint mudar; assinar, verificar e replay idempotente |
| `CLERK_PROXY_URL`, `NEXT_PUBLIC_CLERK_PROXY_URL`, `CLERK_FAPI`, `NEXT_PUBLIC_CLERK_FAPI`; `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Auth/proxy e callbacks no app | Origins/overrides Preview, sem FAPI Production | Origins canônicos | URLs Supabase não mudam callback Clerk; ajustar allowlist apenas se mudar origin do app |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WEB_URL`, `NEXT_PUBLIC_DOCS_URL` | Links e integração app/API | Origins Preview e API Preview | Origins canônicos atuais | Alterar só a URL do serviço que realmente mudar; novo deployment após qualquer mudança |
| `CRON_SECRET` | App `/api/cron/activity-deadlines`, API `/cron/outbox` | Não listado nos targets Vercel; criar segredo sandbox se habilitar teste | Conferir scheduler/rota e configurar de forma alinhada | Gerar no cofre seguro, compartilhar somente entre scheduler e rota; jobs Preview ficam desligados |
| `RESEND_TOKEN`, `RESEND_FROM` | API/e-mail | Sandbox ou endereço controlado; não enviar a membros | Serviço existente | Não muda por troca do banco; não rotacionar sem causa |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SVIX_TOKEN` | API/payments e validação de webhooks | Chaves sandbox e endpoint de teste, sem efeitos reais | Configuração atual permanece | Atualizar destino somente se URL da API mudar; validar assinatura e idempotência |
| `ARCJET_KEY`, `BETTERSTACK_API_KEY`, `BETTERSTACK_URL`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Segurança, observabilidade, logs e analytics | Preservar target apropriado e dados sintéticos | Sem mudança por migração | Validar logs/alertas sem registrar row data, tokens ou URLs assinadas |
| `VERCEL_*`, `ANALYZE`, `NEXT_RUNTIME`, `SKIP_ENV_VALIDATION`, `SEED_DEVELOPMENT_DATA` | Plataforma/build/seed | Vercel nativas; seeds só opt-in e sem bypass | Sem configuração manual de nativas; não pular validação | Não ativar seeds nem `SKIP_ENV_VALIDATION` como solução de migração |

| Ambiente/serviço | Estado e consumidor | Preparação agora | Ordem da mudança futura |
| --- | --- | --- | --- |
| Local app/API/Prisma/Studio | Local env aponta blue; Clerk Development | Preservar arquivos locais e usar conexão isolada dos scripts | Fazer smoke autenticado com config paralela protegida; parar Studio/writers no freeze |
| Vercel Preview app/API | Targets atuais foram inventariados; valores não são expostos nem alterados | Não trocar até restore+migrations green validados; preparar branch override sem compartilhamento com Production | API: DB+aliases → app: DB/Supabase URL/bucket/keys → Clerk Development e deploy Preview; jobs/e-mail/webhooks reais desligados |
| Vercel Production API | Production blue em SHA anterior | Sem alteração | Sob manutenção: DB/DIRECT/fallbacks → Cron necessário → deployment API |
| Vercel Production app | Production blue em SHA anterior | Sem alteração | Sob manutenção: DB/DIRECT/fallbacks → URL/bucket/keys green → deployment app |

O acesso SQL green está resolvido e o restore já foi executado. A URI Session
pooler protegida por DPAPI passou no probe e nas operações de restore,
migrations e validação. Não repetir o diagnóstico antigo nem rotacionar a
senha sem uma nova evidência objetiva. Nenhuma credencial SQL está faltando.

A cópia de Storage permanece bloqueada separadamente pelo HTTP 402 de leitura
no blue. A Secret API key green já está protegida por DPAPI e válida; o bucket
privado green foi criado. Para Realtime, usar publishable key green
`sb_publishable…` no app Preview; não é gate do restore SQL e não deve ser
confundida com a credencial de banco.

## Fases originais de execução — referência histórica

> O restore e as fases 0–5 foram concluídos depois deste plano inicial. Para o
> estado atual e a sequência de cutover, use as seções operacionais do início.

### 0. Fechar inventário

- Capturar novamente os dois catálogos SQL, quotas, extensions, policies,
  grants/default privileges, funções/event triggers, publication e históricos.
- Confirmar Clerk, webhooks, Vercel env targets, GitHub secrets, workers,
  automações externas e arquivos Drive.
- Aceite: todo consumidor tem owner, config alvo e teste; nenhum escritor
  desconhecido.
- Estado: conexão e export read-only PostgreSQL blue já aprovados; Storage API
  de origem respondeu HTTP 402 à listagem e segue como gate somente de bytes.
- Rollback: nenhuma mudança remota.

### 1. Fixar e preparar

- Fixar SHA exato da app/API e registrar diferenças entre Production e Preview.
- Preparar credenciais green por cofre seguro; conexão SQL deve exigir CA/TLS.
- Criar staging cifrado, manifests e ferramentas com proteção explícita de
  project ref. Dumps não entram no checkout.
- Aceite: um teste de leitura confirma origem/destino; ferramenta aborta se o
  fingerprint/ref não coincidir.
- Rollback: descartar artefatos temporários cifrados; blue continua intacto.

### 2. Configurar green

- Comparar versão Postgres, compute, settings e consumo Free.
- Manter schemas gerenciados provisionados pelo projeto; reproduzir apenas DDL
  customizado e grants revisados. Criar bucket privado e limites pequenos.
- Instalar extensões necessárias; deixar webhooks, cron, worker e jobs inativos.
- Configurar Clerk third-party somente quando issuer, claims e políticas
  estiverem revisados.
- Aceite: catálogo comparável, RLS deny-by-default, sem exposição anon ou
  efeitos externos ativos.
- Rollback: green permanece isolado; não afeta blue.

### 3. Restore inicial e schema

- Reutilizar o export consistente atual para o ensaio inicial; gerar novo
  snapshot cifrado no freeze final.
- Restaurar tabelas/dados no green sem substituir schemas gerenciados,
  preservando IDs, timestamps, sequências e as duas tabelas de histórico.
- Comparar contagens, PKs, hashes, constraints, FKs e ACLs antes de migrations.
- Aplicar, em ordem, somente as migrations pendentes do SHA fixado; registrar
  backfills e verificar índices/constraints após cada etapa.
- Aceite no estado atual: **48 entradas Prisma concluídas** (30 originais,
  16 pendentes originais e 2 migrations corretivas/aplicativas), checksums sem
  divergência, histórico
  Supabase preservado sem replay e zero drift não explicado.
- Rollback: restaurar somente checkpoint green; nunca resetar blue.

### 4. Dados e Storage

- Reconciliar provider de mídia para os 99 vídeos sem inventar YouTube IDs.
- Não copiar os 15 objetos antigos: a perda está explicitamente aceita e a
  ausência controlada passou na API/UI. Não repetir GET no blue enquanto houver
  402. Manter os vídeos externos sem inventar IDs.
- Não copiar MP4s/HLS. Não remover objetos nem linhas da origem.
- Aceite: ledger explica cada diferença; ausência antiga não gera 500; DB ≤100 MB e Storage ≤500 MB para os objetos realmente usados;
  egress/cached egress permanecem dentro das reservas.
- Rollback: green é isolado; retomar pelo checkpoint sem rebaixar a origem.

### 5. Preview e ensaio

- Configurar Preview app/API por branch para green, incluindo aliases DB e
  Supabase usados pelo Storage/Realtime. Manter Production apontada ao estado
  atual e confirmar que Preview não acessa blue.
- Desativar cron, e-mail real, webhook de produção, workers e importadores.
- Testar roles ADMIN/TEACHER/MEMBER, RLS, Clerk, jornadas de produto, Storage,
  Realtime, APIs, outbox e rollback com dados de teste identificados.
- Ensaiar freeze, snapshot final, reload integral e reconciliação reversa; o
  procedimento deve terminar em até 30 min antes de agendar janela de até
  60 min.
- Aceite: checks do monorepo, E2E, integridade, quota e retorno passam.
- Rollback: retirar overrides Preview; Production continua intocada.

### 6. Cutover

Executar somente após GO formal e fallback blue comprovado:

1. Congelar SHA; suspender deploys concorrentes.
2. Colocar app/API em manutenção e interromper cron, workers, Studio,
   importadores e todos os escritores.
3. Pausar entregas Clerk/webhooks com retry durável, sem aceitar e descartar.
4. Ativar uma trava reversível de escrita no blue, aguardar transações e
   comprovar que INSERT/UPDATE/DELETE/TRUNCATE de produto ficam bloqueados.
5. Exportar snapshot final `T0`, contagens e hashes do domínio. Não solicitar
   nem copiar os 15 objetos antigos do Storage; nenhuma operação de bytes no
   blue integra o cutover.
6. Sincronizar o snapshot final T0 no green pelo procedimento upsert-only já
   ensaiado; o estado esperado é **48 migrations aplicadas, zero pendentes**.
   Não reaplicar as 16 migrations históricas. Comparar hashes, FKs, sequences,
   constraints, permissões e quota. Se houver PK no green ausente do T0 e não
   coberta pelo ledger QA, abortar e investigar sem apagar a linha.
7. Configurar envs Production da API (DB/direct/fallbacks/Cron); depois app
   (DB/direct/fallbacks/Supabase URL/bucket/keys). Clerk Production e origins
   permanecem os canônicos, usando a secret rotacionada já comprovada.
8. Fazer novo deployment da API e depois app, ainda em manutenção. Conferir
   SHA, aliases, target, fingerprint green e ausência de requests ao blue.
9. Testar login, leitura autorizada, asset pequeno e uma escrita controlada
   com readback. Abrir somente allowlist de escritas compatíveis.
10. Reativar webhook e exatamente um worker e scheduler; reconciliar backlog.
11. Monitorar por 24 h com uploads novos suspensos. No período de rollback
    imediato, só voltar ao blue antes de qualquer escrita relevante no green;
    depois disso, não reverter ao blue sem congelar e reconciliar as escritas.

Manutenção máxima planejada: 60 min. Se a etapa não couber no ensaio de 30 min,
adiar. Se qualquer gate falhar, manter manutenção e executar rollback antes de
abrir escrita.

### 7. Compatibilidade, rollback e retenção

Rollback é deliberadamente mínimo. Antes de qualquer escrita relevante no
green, manter manutenção, restaurar os deployments/envs anteriores e validar o
blue. Após escrita relevante, não voltar ao blue sem snapshot green, freeze e
reconciliação explícita dos dados criados/modificados. Não criar uma plataforma
de reverse-CDC para esta virada.

Manter uploads suspensos na aplicação durante a janela imediata de rollback,
pois blue Storage permanece em HTTP 402. A UI deve comunicar pausa controlada;
reativar uploads após encerrar formalmente esse ponto de retorno. A ausência
dos 15 objetos antigos foi aceita e não é um gate.

Antes da primeira escrita pública green, rollback tem RPO zero: manutenção,
parar workers, restaurar envs e código anteriores, validar fingerprint blue,
remover a trava e smoke test. Depois de escritas compatíveis, congelar green,
fazer backup, comparar com T0, projetar dados e assets em transação idempotente
para blue, validar, reverter env **e código**, então abrir blue. Não copiar as
48 linhas `_prisma_migrations` green para blue; não descartar estruturas novas
green.

Após 24 h estáveis, mudança sem representação no blue encerra o rollback
genérico. Preferir recuperação no green. Manter blue intacto por pelo menos
30 dias. Qualquer desativação posterior exige auditoria separada e autorização
específica.

## Artefatos e comandos preparados

Arquivos do backup já existentes, cifrados fora do checkout:

```powershell
$migrationDir = Join-Path $env:LOCALAPPDATA 'Codex\migrations\interprete-supabase'
$archive = Join-Path $migrationDir 'origin-domain-20261004T142528Z.pgdump.aesgcm'
$snapshot = Join-Path $migrationDir 'source-snapshot-20261004T142529Z.json.dpapi'
```

O backup da origem passou por autenticação AES-256-GCM, `pg_restore --list`,
inspeção de TOC, 42/42 seções `TABLE DATA`, 766/766 linhas e checksums das 30
migrations aplicadas antes do restore green. Esta sequência é um registro
histórico de preparação; restore, migrations e QA foram concluídos e não devem
ser repetidos sem regressão objetiva. O snapshot de ensaio mais recente tem
765 linhas devido a mudanças posteriores e não substitui o `T0` sob freeze.

1. `node scripts/migration/probe-supabase-green.mjs` — primeiro acesso SQL
   green, read-only, TLS verificado; identifica versão/tamanho/ref e contagem
   de tabelas. Se falhar, manter os artefatos e investigar somente conexão.
2. `node scripts/migration/verify-supabase-domain-backup.mjs $archive` — repetir
   a validação local cifrada antes de qualquer escrita green.
3. Usar o par já exportado para o restore de preparação/Preview; blue continua
   como fonte de verdade e o Preview será explicitamente uma fotografia desse
   instante. Não refazer o export atual sem motivo. No freeze de cutover, gerar
   um par novo e consistente com
   `node scripts/migration/export-supabase-domain-backup.mjs`; importar no green
   exclusivamente o novo archive/manifest desse mesmo instante. Nunca misturar
   um dump e um snapshot diferentes.
4. `bun run scripts/migration/restore-supabase-green.mjs $archive $snapshot` —
   preflight read-only green, versão PostgreSQL 17, schema gerenciado intacto,
   destino sem objetos de domínio, projeção ≤100 MB; então restore SQL em uma
   transação única no green, reconciliador de configuração idempotente e
   validação completa read-only. Em estado já restaurado e idêntico, validar e
   não repetir import. Em estado parcial/divergente, falhar sem limpar.
5. `bun run scripts/migration/apply-supabase-green-migrations.mjs $snapshot` —
   baseline conhecido: 30 aplicadas + 16 pendentes originais e a correção
   nullable adicional. O runner aceita também 46 + correção pendente ou
   48 aplicadas; não reaplica histórico. Validar baseline antes de
   `prisma migrate deploy`; depois exigir 48/48,
   checksums, `prisma migrate diff --exit-code`, backfills e configuração
   Realtime. Estados parciais não recebem `migrate resolve` automático.
6. O mesmo runner reconcilia no green os 99 assets de vídeo existentes para
   `YOUTUBE` sem ID fictício, preserva `storagePath` e IDs e valida tudo numa
   transação green-only. Esse passo não copia mídia e não afirma playback sem
   ID externo verdadeiro.
7. **Obsoleto e proibido para o escopo atual:** não executar
   `migrate-supabase-storage-objects.mjs` para os 15 objetos antigos. A perda é
   aceita e Storage não bloqueia Production. Não copiar vídeos, MP4, playlists
   HLS ou segmentos em hipótese alguma.

Os helpers de credencial aceitam entrada mascarada e salvam DPAPI CurrentUser
com ACL restrita. A URI de banco e a key Storage são artefatos locais separados.
Não apagar nem incluir esses arquivos em commit; não registrar output de envs.

## Matriz de validação e critérios objetivos

| Área | Prova automatizada | Prova Preview / aceite |
| --- | --- | --- |
| Dados | Rows, conjuntos de PK, hash por linha e hash canônico agregados para todas as 42 tabelas; todas as colunas históricas preservadas; ledger dos dois históricos | 100% contagens/IDs/hashes esperados; zero divergência sem entrada no ledger |
| Catálogo | Colunas, PK/FK/unique/check, índices válidos, enums, sequences/estado, functions/hash/ACL, triggers, event triggers, policies, grants e default privileges | 48/48 Prisma; diff Prisma vazio; 126 FKs finais, zero violação, zero constraint não validada/índice inválido; RLS habilitado em 100% das tabelas públicas |
| Identidade | Nenhum usuário Supabase antigo (Clerk é autoridade); IDs Member/Profile comparados | Signup controlado, verificação, login, refresh, logout, recuperação, onboarding e webhook com assinatura/replay; vínculo pelo `userId` Clerk original |
| Papéis/autorização | RLS, grants e policies com revisão read-only | ADMIN, TEACHER de teste e MEMBER; membro sem grant; acesso direto a APIs, `id` alheio e tenant/channel alheio negados; sem autorização por e-mail/metadata pública |
| Cursos e aulas | Integridade IDs/FKs e contagens de Course/Module/Lesson/LessonResource/LessonAsset | Abrir catálogo/aula, recurso, marcar conclusão, retomar progresso após reload; sem gravação fictícia |
| Atividades | Backfill assignment por IDs, batch e submissions; zero duplicata | Teacher cria/atribui, member abre/submete, admin revisa, feedback persiste; notificações corretas |
| Comunidade | Hash de posts/comentários/votos/follows/bookmarks; uniques e soft delete | Criar/editar draft e publicação, comentário, resposta, voto/salvo/grupo privado; membro sem acesso recebe 403/404 sem vazar conteúdo |
| Biblioteca/busca | Rows/hash, metadados e referências polimórficas | Busca real, filtros, abrir item, bookmark/read/study tracking persistidos; verificar acesso permitido/negado |
| Storage/uploads | Confirmar que paths antigos ausentes não causam 500; nenhum MP4/HLS/vídeo reintroduzido | Missing object controlado em `404`/estado vazio; upload/download dos objetos atuais segue allowlist, autorização, limite e quota; os 15 paths antigos não são requisito de aceite |
| Vídeos | 99 IDs internos/relacionamentos preservados; provider compatível; zero MP4/HLS reintroduzidos | ID ausente mostra estado pendente e API `409`, sem fallback para Storage; 99 associações são `DEFERRED / NON-BLOCKING`; playback não declarado |
| Notificações/Realtime | Publication `Notification`, três policies finais, trigger e função `SECURITY DEFINER`/ACL/search_path | Conta recebe só seu canal; membro não pode escutar canal alheio; Presence read/write conforme grupo; refresh/reconnect; nenhum dado aparece ao anon |
| API/webhooks/jobs | Health/readiness, worker/outbox lease/retry/idempotência, auth/signature e cron | Smoke de cada endpoint; e-mail só para endereço controlado; webhooks não descartados; cron autenticado; um scheduler/worker ativo |
| UI/dispositivo | Build e logs sem tokens/URL assinada; sem 4xx inesperado/5xx | Desktop 1440 px e mobile 390/360 px; navegação, formulário, uploads/player, reload e zero overflow horizontal relevante |
| Quota/operabilidade | DB final ≤100.000.000 bytes; Storage ≤500.000.000 bytes; cópia/testes limitados pelos contadores persistidos | Egress e Cached Egress com ≥3 GB de reserva cada; requests abaixo do orçamento; monitorar erro, pool, backlog e quota |

Para `restored-data` e `restored`, usar
`bun run scripts/migration/validate-supabase-green.mjs <stage> $snapshot`;
após migrations, usar o runner de aplicação (que invoca o estágio `migrated`).
Repetir o validador diretamente antes de configurar Preview. Não aceitar build
ou `READY` como substituto de teste de persistência/autorização.

Antes de Previews E2E, configurar somente branch overrides; confirmar no
runtime fingerprint green em app e API e provar ausência de chamadas blue.
Executar os checks locais: `bun run check`, `bun run typecheck`,
`bun run boundaries`, `bun run test`, `bun run build`. O teste de papel TEACHER
usa usuário de teste explicitamente provisionado; blue possui somente dois
ADMIN e três MEMBER, sem TEACHER real. Dados de teste recebem identificador
claro e não são misturados com os 766 registros importados.

**GO de Preview:** checks passam; schema/hashes/FKs/RLS/ACLs/migrations/quota
passam; todos os casos críticos acima têm evidência runtime e readback; nenhuma
API/jobs Preview escrevem em blue nem causam efeitos Production. Playback não é
gate de GO. **NO-GO:** qualquer perda/hash divergente,
acesso indevido, auth/role não provada, erro crítico reproduzível, quota sem
margem, integração/escritor não inventariado ou rollback não ensaiado. Um caso
crítico reproduzível basta mesmo sem volume estatístico.

## GO / NO-GO

**GO** somente com fallback comprovado, inventário externo fechado, backups
cifrados e reload final ensaiado, contagens/IDs/hashes íntegros, FKs válidas,
48 migrations corretas, RLS/grants/Realtime/Clerk/Preview aprovados, ausência
segura dos objetos antigos, vídeos fora do Supabase sem exigir IDs, margens
Free comprovadas, SHA fixado, ensaio de cutover/rollback aprovado e zero
escritor desconhecido. A perda aceita dos 15 objetos e o adiamento dos 99 IDs
não são gates de GO.

**NO-GO para a etapa dependente** se a capability necessária falhar, faltar
credencial do respectivo projeto, faltar margem de quota, identidade/role não
estiver validada, houver divergência não explicada, escritor desconhecido,
deployment concorrente ou gate funcional incompleto. Uma restrição isolada de
Storage não invalida leitura/export PostgreSQL. Build PASS e deployment READY
não substituem esses critérios.

## Sequência histórica anterior (restore já executado)

1. Armazenar localmente a URI do Session pooler green pelo helper mascarado e
   DPAPI descrito acima; não enviar o valor no chat.
2. Testar conexões read-only com os dois bancos e registrar fingerprint,
   versão PostgreSQL, tamanho, catálogo e quota green. O teste e export
   read-only do PostgreSQL blue já passaram.
3. A listagem e um GET autenticado direto do objeto HLS de 29.680 bytes já
   responderam 402; o GET baixou zero bytes. Não repetir. A instrução histórica
   de copiar os 15 objetos foi substituída pela decisão `ACCEPTED DATA LOSS /
   NON-BLOCKING`; não executar o migrador mesmo se o 402 desaparecer. Essa
   decisão não autoriza cópia de vídeos nem remove linhas do domínio.
4. Configurar green isolado, restaurar o backup cifrado, validar paridade,
   reconciliar as migrations, recriar customizações compatíveis com a
   plataforma, integrar Preview e executar os testes.
5. Fechar integrações/escritores externos e comprovar o fallback necessário.
   Cutover permanece fechado até todos os gates próprios dessa etapa passarem.
