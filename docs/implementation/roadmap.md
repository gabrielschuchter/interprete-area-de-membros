# Interprete Product Roadmap

## Final audit checkpoint — 27/09/2026

The official live-first foundation and member experience are now represented in
the current checkout and the official Supabase database. The verified baseline
is 3 Members/Profiles, 2 Courses (1 `ASYNC`, 1 `RECORDING_ARCHIVE`), 15 Modules,
101 Lessons, 102 LessonAssets, 14 ImportedRecordingGroups, 102
ImportedRecordings, 5 Meetings, 5 Activities and 13 CommunityPosts. No assets
were deleted or moved; the private `learning-assets` bucket remains the Storage
boundary. All five legacy demo Meetings are `DRAFT` and are excluded from member
queries while remaining auditable by staff.

The final audit also closes two boundary issues: global search now exposes
authorized historical recordings as `Gravação` and never treats
`RECORDING_ARCHIVE` as asynchronous learning, and tokenized HLS segment requests
re-check the current recording-group assignment so revocation is immediate.

The Vercel member project is `interprete-area-de-membros-app` (project ID
`prj_bwG8vDd4x2flyPaRMq8HEvi7t5Lj`, root `apps/app`) with production on `main`
and the stable aliases documented in `docs/deployment/vercel.md`. The final
audit changes are descendants of `f09e28768eba9505ec87132f068301d22f3471be`;
the exact promoted SHA is checked from the Vercel deployment API after each
push rather than copied into a document that can go stale.

This checkpoint records verified evidence; it does not claim a member-to-member
recording scenario when the official database has no currently assigned
recording groups. That scenario becomes executable as soon as an administrator
creates an explicit assignment.

## Historical live-first migration checkpoint — 26/09/2026

The official PostgreSQL connection was validated and the historical Kiwify
inventory was separated semantically from async learning without destructive
cleanup. See `docs/architecture/live-first-recordings.md` for the canonical
model, authorization boundary and verified before/after counts. This checkpoint
does not mark earlier product phases as complete: each phase still requires its
own persistence, authorization, responsive, check and E2E gates.

Este documento é a fonte de verdade da execução do produto. As fases são sequenciais; uma fase só muda para `DONE` depois de cumprir seus critérios de aceite e os gates técnicos do repositório.

## Reestruturação integrada autorizada — 03/10/2026

Esta sequência controla o trabalho novo solicitado para a área de membros. A
implementação local percorreu as fases em ordem. Nenhuma fase recebe `DONE`
antes de comprovar persistência no ambiente oficial, autorização autenticada,
responsividade, testes funcionais e os cinco checks do monorepo.

### Checkpoint local — 03/10/2026 (antes da rechecagem final)

O schema Prisma valida e o cliente foi regenerado. `bun run check`,
`bun run typecheck`, `bun run boundaries`, `bun run test` e `bun run build`
passaram; a última execução cobriu 134 casos (117 no app, 9 na API e 8 no
domínio compartilhado). As tabelas novas das migrations têm RLS habilitado e não há
policies públicas permissivas; essa auditoria foi local e ainda precisa ser
confirmada no Supabase oficial. Nenhuma migration foi aplicada remotamente e
nenhum deploy foi feito nesta execução.

O Supabase está sujeito à restrição temporária de quota/Fair Use informada pelo
usuário. Persistência oficial, grants, realtime entre contas, RLS remoto e
workers/Cron/Vault seguem pendentes de validação quando o acesso estiver
disponível; respostas 402 não serão tratadas como falha do produto nem usadas
para mudar a arquitetura. Os 99 assets históricos de vídeo ainda precisam dos
links reais para associação e validação do player. Não há evidência E2E
autenticada das novas jornadas nesta execução.

A análise local de bundle do Next.js registrou 1,45 MB comprimidos estimados,
4,13 MB sem compressão e 887 módulos no grafo agregado da rota `/`. Essa visão
inclui dependências carregadas sob demanda. No manifesto do build da rota
autenticada `/`, `rootMainFiles` e polyfills somam aproximadamente 174 KB gzip;
incluindo o chunk listado separadamente no manifesto React Loadable, o total
listado é aproximadamente 178 KB gzip. Esses arquivos não contêm Zod nem suas
localidades. O shim de observabilidade contém referências de carregamento
dinâmico para Sentry e PostHog. Isso é uma medição local do manifesto, não um
resultado Lighthouse ou uma medição de rede em sessão autenticada.

| Fase | Escopo | Status | Evidência |
| --- | --- | --- | --- |
| 1 | Integridade, contratos e eventos/outbox | IN PROGRESS | Contratos, dispatcher e migrations locais validados; consulta Prisma somente de leitura encontrou 46 migrations, 16 pendentes. O painel confirma serviços Supabase sob Fair Use/402; nenhuma alteração remota aplicada. |
| 2 | Notificações duráveis e realtime | IN PROGRESS | Consumidor e cliente realtime implementados; outbox, policy privada e Cron ainda não existem no remoto; sem teste entre contas. |
| 3 | Grupos, membros e convites | IN PROGRESS | Membership, privacidade e convites implementados; persistência e isolamento remoto aguardam as migrations. |
| 4 | Atribuição unificada e acesso específico | IN PROGRESS | Atribuições e grants tipados implementados; backfill remoto e revogação não foram executados. |
| 5 | YouTube e Minhas gravações | IN PROGRESS | Provider/player e navegação implementados; 99 associações aguardam links reais. |
| 6 | Aprender por trilhas horizontais | IN PROGRESS | Rails e gestão reutilizam cursos, aulas e coleções; QA Preview confirma redirect sem sessão, mas não há QA autenticado nem schema remoto. |
| 7 | Comunidade e editor simplificados | IN PROGRESS | Editor, CRUD, avisos, menções e skeleton implementados localmente; mutations e integridade ainda não foram testadas em sessão autenticada. |
| 8 | Biblioteca global e pessoal | IN PROGRESS | 110 referências em 13 categorias (10 enriquecidas e 100 novas); sem duplicatas. O verificador atual encontrou 98 respostas 2xx/3xx, 11 respostas 403 e um timeout da BVS, depois aberta no Edge. Sete URLs 403 tiveram conteúdo confirmado separadamente; quatro seguem inacessíveis neste ambiente. Corrigido o destino das revisões DGAC 2025. Migration/importação remota e QA autenticado pendentes. |
| 9 | Exercícios | IN PROGRESS | Motor, versões imutáveis e correção server-side implementados; schema remoto e jornadas autenticadas pendentes. |
| 10 | Estudo, metas, tarefas e dashboard | IN PROGRESS | Intervalos, metas, tarefas e dashboard implementados; sem reconciliação de dados ou sincronização real entre contas/dispositivos. |
| 11 | Badges e perfil | IN PROGRESS | Critérios versionados, concessão idempotente e perfil implementados; nenhum evento real foi validado no ambiente oficial. |
| 12 | Consolidação, acessibilidade e release | IN PROGRESS | Cinco gates passam com 160 testes. App Preview Ready; auth pública e 16 prefixos protegidos foram testados, sem overflow em 320/375/390/768/1280 px. Produção não foi promovida por 16 migrations pendentes. |

### Expansão editorial da Biblioteca — 04/10/2026

O inventário somente de leitura disponível antes desta expansão encontrou 10
materiais publicados. O catálogo versionado agora contém 110 referências:
preserva e enriquece os 10 materiais de base e prepara 100 novos itens. Nenhum
material existente foi removido e nenhuma importação ou escrita foi feita no
Supabase oficial. A migration `20261004100000_library_catalog_metadata` é
aditiva e local; continua pendente de execução remota enquanto durar a
restrição de quota/Fair Use.

A taxonomia ficou organizada em 13 categorias: Fundamentos e perguntas
clínicas; Busca bibliográfica; Epidemiologia e desenhos de estudo;
Bioestatística e interpretação; Leitura crítica e risco de viés; Revisões
sistemáticas e meta-análises; Certeza da evidência e GRADE; Diretrizes e
decisão clínica; Diagnóstico e prognóstico; Protocolos e registro; Relato
científico; Nutrição baseada em evidências; Ciência aberta e
reprodutibilidade. As categorias antigas foram normalizadas nessas áreas.

A seleção inclui recursos oficiais do Cochrane Handbook, GRADE, JBI,
EQUATOR/PRISMA, PubMed/NCBI, CDC, CONITEC/Ministério da Saúde, USDA NESR e NIH
ODS, além de RoB 2, ROBINS-I, QUADAS, AMSTAR, GRADEpro, PRESS e protocolos de
relato. O Embase aparece como documentação metodológica gratuita; o registro
explica que o acesso à base Embase pode depender de assinatura institucional.
Oito URLs do núcleo legado foram substituídas por destinos oficiais/canônicos;
nenhum recurso foi removido.

O verificador conferiu 110 URLs HTTPS únicas: 99 responderam com sucesso e 11
devolveram 403 de proteção anti-bot. Não houve duplicatas nem outras falhas
HTTP. Essas 11 respostas foram tratadas como inconclusivas, não como links
quebrados; as fontes oficiais foram confirmadas por páginas e resultados de
busca quando disponíveis. A página SQUIRE foi direcionada à entrada oficial da
EQUATOR Network. A revisão também corrigiu um bug de paginação que aplicava o
deslocamento duas vezes e impedia o indicador de próxima página; agora há
sentinela de paginação e teste de regressão. Removido ainda um fetch redundante
de bookmarks. Os formulários editoriais receberam rótulos visíveis para todos
os metadados, e a importação administrativa ganhou limite próprio de taxa.

Os filtros atuais cobrem busca, tipo, categoria, idioma, dificuldade e ordem
por recência/relevância; a composição usa colunas progressivas em telas
pequenas, médias e amplas. A rota autenticada foi aberta em navegador local e
redirecionou corretamente para `/sign-in?redirect_url=…` sem sessão. Isso
confirma o guard, mas não substitui revisão visual autenticada da Biblioteca.

`bun run check`, `bun run typecheck`, `bun run boundaries`, `bun run test`,
`bun run build`, Prisma validate e Prisma generate passaram nesta revisão. A
suíte totalizou 160 testes (143 do app, 9 da API e 8 do domínio compartilhado);
os testes direcionados de catálogo, apresentação, paginação e limite de
mutações também passaram. A verificação HTTP permanece em 99 respostas 2xx/3xx
e 11 respostas 403 de proteção anti-bot, sem outras falhas ou duplicatas.

Permanecem pendentes: aplicar a migration e importar os 110 registros no
Supabase oficial, indisponível sob a restrição de quota/Fair Use; conferir
filtros, salvamento e persistência em sessão autenticada, pois não há credencial
de membro de teste disponível neste ambiente; e confirmar em navegador comum as
11 páginas que recusaram o verificador automatizado. A rota protegida foi
validada apenas quanto ao redirecionamento sem sessão. Não marcar Fase 8 `DONE`
antes dessas evidências remotas/autenticadas.

### Revisão final local — 03/10/2026

A revisão removeu o envio/aceite de `kind` oculto nas publicações e eliminou
as opções, filtros e estilos mortos de tipo. O enum e os valores já persistidos
continuam no banco para preservar compatibilidade histórica. O vermelho de ação
mantém o tom original nos fundos; o texto usa uma variante com contraste
calculado de 4,83:1 no canvas claro e 5,70:1 na superfície branca. Os cards do
Aprender expõem a descrição em bloco no mobile/tablet e por hover/foco em telas
grandes.

Esta revisão também integrou a leitura de itens publicados da biblioteca ao
tempo de estudo, usando uma consulta reduzida que respeita a autorização da
aula vinculada. Wheel e movimento touch renovam a atividade; o scroll gerado
programaticamente não a renova. A janela de 60 segundos de avaliação de badges
agora afeta apenas varreduras completas/de estudo e não atrasa critérios de
exercício ou outros eventos.

Foram reexecutados `check`, `typecheck`, `boundaries`, `test` (134 casos: 117 no
app, 9 na API e 8 no domínio compartilhado) e
`build`; todos passaram. O schema passou `prisma validate`. A auditoria estática
confirmou RLS nas 32 tabelas novas, sem tabela criada sem RLS, e uma policy
restrita ao tópico privado de notificações em `realtime.messages`. As migrations
não removem tabelas/colunas nem apagam linhas; a substituição de índice da
atribuição preserva a unicidade pelo novo lote. Nenhuma migration remota foi
aplicada.

Autenticação local foi diagnosticada na cadeia exata. Sem a CA do sistema, o
endpoint `GET /__clerk/npm/@clerk/clerk-js@6/dist/clerk.browser.js` retorna
`502 proxy_request_failed`; a mensagem aponta falha de verificação TLS do Bun
(`unable to verify the first certificate`), antes de qualquer resposta HTTP do
upstream. Uma chamada direta do Bun ao Frontend API público reproduz a falha e
retorna HTTP 200 ao usar `--use-system-ca`. Os scripts locais de `apps/app` e
`apps/api` agora habilitam a CA confiável do sistema, sem desativar TLS. O
middleware já encaminha `/__clerk` via `frontendApiProxy`, com matcher
correspondente; a implementação atual do Clerk encaminha headers e corpo.

Separadamente, os `.env.local` de app/API carregavam chaves `pk_live_`/`sk_live_`
da Production. Consultas somente de leitura confirmaram que os dois segredos
pertencem à mesma instância Production; o FAPI codificado pela chave pública é
consistente com o domínio Clerk de produção e o proxy publicado responde
`GET /__clerk/v1/environment` com HTTP 200. Clerk rejeita essa instância em
`localhost`, conforme a documentação oficial. O ambiente local também tinha
`NEXT_PUBLIC_CLERK_PROXY_URL` apontando ao host Production; removido de
`apps/app/.env.local`, pois o SDK o usa como fallback quando o provider não
recebe `proxyUrl`. A FAPI Development deste app deve ser direta, portanto o
projeto agora rejeita chaves Production, pares com prefixos de ambiente
diferentes e proxy/FAPI overrides locais junto a `pk_test_`.

O par legado `pk_test_`/`sk_test_` da raiz foi verificado sem expor os valores:
o segredo identifica uma instância Development, seu endpoint de domínio
corresponde ao FAPI codificado na chave pública e ambos os ambientes estão no
mesmo workspace Clerk. O par foi copiado para os `.env.local` específicos de
`apps/app` e `apps/api`. Sem `BUN_OPTIONS`, `apps/app` agora inicia, o navegador
carrega ClerkJS diretamente de `accounts.dev` sem erros de console além do
aviso normal de chaves Development, e `/aprender` redireciona para o sign-in
com o destino de retorno. A rota `/__clerk` não é usada para esta instância.
O middleware não emite log próprio para a falha; o corpo 502 sanitizado é a
evidência server-side disponível e confirma que o TLS falhou antes de resposta
HTTP do upstream.

O formulário de recuperação avançou até a etapa de código. O browser tinha um
identificador previamente preenchido e o clique em “Esqueci minha senha”
disparou `resetPasswordEmailCode.sendCode()`; nenhum código foi submetido e
nenhuma senha foi alterada. Não repetirei a ação usando dados autofillados.
O formulário local ficou preparado com o endereço sintético
`codex-qa-interprete-20261003+clerk_test@example.com`, sem senha. A entrada da
senha e o envio precisam ser feitos pelo usuário no navegador; não compartilhe a
senha com o agente. Para Development, Clerk documenta o endereço de teste
`+clerk_test` e código fixo `424242`. Ainda não há sessão autenticada para
revisar áreas protegidas. O ambiente local tem o par Development configurado;
nenhuma ação no Clerk Dashboard é necessária agora.

O Supabase continua sujeito à restrição temporária de quota/Fair Use. Nenhuma
migration remota, alteração de dados ou deploy foi feito. A rota de outbox
valida `CRON_SECRET` por comparação segura, e o setup idempotente de Cron/Vault
está documentado sem aplicar SQL remoto. As fases permanecem `IN PROGRESS`;
não há evidência de release ou de runtime autenticado nesta revisão.
`bun env:check` reporta `READY` para presença e formato das variáveis, mas não
testa uma conexão real com o PostgreSQL.

Depois que o usuário concluir o cadastro e autenticar, ainda será necessária
validação autenticada das páginas protegidas e jornadas que não dependem do
Supabase. Escritas/leitura persistente, RLS e realtime entre contas continuam
dependentes do Supabase. Os 99 assets históricos continuam aguardando os links
reais de YouTube.

O rollout permanece local até que cada fase passe seus gates. Migrations de
produção e deployment precisam seguir a compatibilidade expandir/backfill/
validar/retirar descrita em `docs/architecture/member-domain-events.md` e não
fazem parte de uma validação de build.

### Rechecagem de execução — 03/10/2026

Esta rechecagem atualiza a evidência remota e local sem repetir a revisão geral
do código nem alterar dados. O endpoint PostgreSQL oficial foi alcançado por
`DIRECT_URL`; `prisma migrate status` terminou sem erros e confirmou 30 de 45
migrations aplicadas, zero migrations falhas/não resolvidas e 15 migrations
pendentes da reestruturação. A consulta é somente de leitura; nenhuma migration,
backfill, seed, alteração de dados ou deploy foi executado.

O Dashboard Supabase mostra todos os serviços restritos por quota/Fair Use,
incluindo Cached Egress, Egress e Storage; endpoints afetados podem responder
HTTP 402. A API local
respondeu `GET /health` com 200 e `GET /health?deep=1` com `database: ok`; essa
checagem executa somente `SELECT 1` e confirma alcance básico do SQL. Ela não
autoriza writes enquanto a organização estiver restrita. No schema remoto
atual, 40/40 tabelas públicas têm RLS habilitado e há uma policy de
`SELECT` restrita ao próprio destinatário em `Notification`; um probe de leitura
com role `authenticated` e um `sub` inexistente retornou zero linhas. Isso
confirma a proteção observada no estado atual, não as policies das migrations
pendentes. As tabelas `OutboxJob`, o tópico/regras privadas de realtime e o job
Cron da reestruturação não existem no remoto neste momento; Vault existe, mas
nenhuma credencial foi criada/alterada.

As 15 migrations pendentes são `20261003100000_member_domain_events`,
`20261003120000_private_notification_realtime_topics`,
`20261003140000_community_study_groups`,
`20261003160000_unified_learning_assignments`,
`20261003180000_lesson_asset_media_provider`,
`20261003200000_learning_catalog_rails`,
`20261003220000_community_edit_timestamps`,
`20261003230000_library_personal_relevance`,
`20261003240000_editorial_announcements`, `20261003260000_exercises`,
`20261003270000_study_goals_tasks`, `20261003280000_badges_profile`,
`20261003290000_badge_attendance_criteria`,
`20261003300000_meeting_attendance` e
`20261004010000_library_read_study_tracking`.

O ambiente local reporta as URLs necessárias como presentes e válidas; conexão
direta e `SELECT 1` confirmam alcance de leitura básica, mas não houve leitura ou
escrita funcional autenticada de produto. O endpoint local `/cron/outbox`
respondeu 503 sem `CRON_SECRET`; Cron/Vault e processamento de jobs não foram
configurados nem executados. Não há Docker Engine nem
PostgreSQL local disponível para montar um Supabase substituto, e outro banco
não é permitido pela arquitetura. Nenhum resultado de 402 foi tratado como bug
da aplicação.

O Clerk Development usa o Frontend API oficial diretamente, sem o proxy
`/__clerk`; `/sign-up` local responde 200 e `/aprender` sem sessão redireciona
para `/sign-in`. A tentativa anterior de executar Next dentro do Bun com
`--use-system-ca` não corrigia a chamada do middleware a
`api.clerk.com/v1/jwks`: o processo continuava falhando na validação TLS. A
correção causal foi confirmada depois, executando o Next em Node com a CA
confiável do sistema; ver a seção “Fechamento da auditoria de autenticação —
04/10/2026” no fim deste roadmap. A cadeia do proxy `/__clerk` permanece intacta
para produção. Nenhum usuário de teste foi criado: o primeiro acesso
autenticado aciona `getOrCreateProfile` e pode gravar `Member`/`Profile` no
Supabase oficial. Não houve envio de código nem alteração de senha.

As fases 1–12 permanecem `IN PROGRESS`. Nesta rechecagem passaram `check`
(481 arquivos), `typecheck` (16 tarefas), `boundaries` (464 arquivos), `test`
(134 testes: 117 app, 9 API, 8 domínio) e `build` (8 tarefas). `prisma validate`
e `prisma generate` passaram; `env:check` reporta `READY`. `prisma migrate status`
conectou em leitura e confirmou 15 pendentes; seu código de saída 1
representa essas migrations ainda não aplicadas, e nenhuma foi aplicada.

A inspeção visual em Playwright cobriu as páginas públicas de autenticação em
1440×1000 e 390×844. A página mobile tem 390 px de largura de documento, sem
overflow horizontal; o formulário mantém rolagem vertical normal. O link “Fale
com o time” foi ajustado para não quebrar em palavras no desktop. Foram
exercitados estados sem sessão: login/cadastro renderizam, recuperação sem
email apresenta validação local, suporte/termos/privacidade respondem 200 e as
rotas de membro/admin testadas redirecionam para sign-in. Console sem erros; o
único warning é o aviso esperado de chaves Clerk Development. Isso não equivale
a E2E autenticado ou QA visual das áreas protegidas.

### Verificação complementar — 04/10/2026

Após a geração do client Prisma, `prisma validate` e `prisma generate` passaram
com Prisma 7.10.0. Nesta conferência final, `check` passou (481 arquivos),
`typecheck` passou (16 tarefas), `boundaries` passou (464 arquivos), `test`
passou (134 testes) e `build` passou (8 tarefas). Uma primeira execução paralela
do typecheck cruzou a regeneração do client iniciada pelo build e reportou tipos
temporariamente incompletos; o typecheck sequencial após a geração terminou sem
erros. `git diff --check` também passou.

O smoke test local final retornou 200 em `/sign-in` e `/sign-up`; `/aprender`
retornou 307 para autenticação, como esperado sem sessão. A busca direcionada
por `TODO`, `FIXME`, `HACK` e `NotImplemented` em código de produto (excluindo
testes e arquivos gerados) não encontrou pendências. Essa evidência não substitui
uma sessão autenticada: nenhuma escrita ou migration remota foi executada, e as
12 fases continuam `IN PROGRESS` até persistência, autorização e jornadas reais
poderem ser validadas com segurança.

### Publicação do candidato e QA remoto seguro — 04/10/2026

O branch `codex/interprete-member-area-release-2026-10-04` foi enviado ao
origin. O commit de código é `31f628c480e12dcc7a3019cc3fa9991978865431`,
descendente do commit integrado `a57c42d`; o segundo commit corrige resolução
de caminhos Windows no runner de CA e mantém verificação TLS ativa. O working
tree não contém alterações de implementação pendentes. Capturas e manifests de
migração são arquivos operacionais locais, agora explicitamente ignorados pelo
Git e pelo Vercel.

O app foi construído em Preview como `dpl_FBBRLT3uJaDCLi1aALkz8kogibd1`,
Ready em `https://interprete-area-de-membros-wepdfn8j4-gabrielschuchters-projects.vercel.app`.
O API Preview `dpl_5ju8ZXJvJFsBeBEeJRQKPi2YRrg6` também está Ready, mas seus
endpoints retornam o SSO de proteção da Vercel quando chamados anonimamente.
O alias oficial resolve para o deployment Production anterior
`dpl_2wYwiRMcVWGdKAdF212zEutZcZeW`, criado em 01/10. Ele não recebeu estes
commits. Não houve merge para `main`, promoção de alias, deploy Production ou
alteração de dados oficiais.

O primeiro Preview do app falhou ao renderizar Clerk porque faltava
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` no escopo Preview. Foram configuradas
variáveis Clerk exclusivamente Development, somente para o Preview deste
branch; nenhum segredo Production foi copiado para esse escopo. Depois do
redeploy, o formulário público carregou e a tentativa com credencial inválida
retornou a mensagem específica de credenciais, sem confundir o estado com erro
de sessão. Cadastro vazio/invalidamente formatado respeitou validação HTML; os
inputs de senha não impõem `minLength`/`maxLength` locais. Recuperação alcançou
a etapa de código com mensagem neutra para conta inexistente/não confirmada;
código inválido não avançou. Nenhum usuário foi criado e nenhuma senha foi
alterada.

Em navegador anônimo, os 16 prefixes protegidos — incluindo início, onboarding,
admin, Aprender, atividades, biblioteca, coleções, comunidade, configurações,
encontros, membros, notificações, perfil, busca, tarefas e exercícios —
redirecionaram para sign-in preservando o destino. `/session-tasks` sem tarefa
pendente retornou ao sign-in mantendo `/perfil?tab=convites`. Sign-in e sign-up
continuaram acessíveis diretamente. As rotas públicas de autenticação foram
revisadas visualmente em desktop e mobile; o fluxo público foi verificado em
320×640, 375×812, 390×844, 768×1024 e 1280×900, sem overflow horizontal. O
teclado alcança o formulário com foco visível e o toggle mostra/oculta a senha.
O console registrou zero erros e somente avisos esperados de chave Clerk
Development; nenhuma chave secreta ou token apareceu em HTML/log de navegador.

GETs anônimos em notificações, token realtime, busca de membros e busca global
retornaram 401 JSON com `Cache-Control: private, no-store`; o asset educacional
protegido redirecionou a autenticação. Nenhum endpoint de mutação foi chamado.
O domínio oficial foi aberto em contexto anônimo: `/` redirecionou a sign-in e
os formulários de autenticação carregaram, mas o produto novo não foi promovido.

`prisma migrate status` foi executado somente para leitura: encontrou 46
migrations e 16 pendentes, de `20261003100000_member_domain_events` a
`20261004100000_library_catalog_metadata`. O código depende do schema aditivo
pendente; promover a aplicação com esse schema antigo não é seguro. A quota/
Fair Use do Supabase segue como bloqueio externo. Nenhuma migration, backfill,
seed, alteração de linhas ou operação destrutiva foi feita.

Após o commit de correção passaram novamente `check` (493 arquivos),
`typecheck` (16 tarefas), `boundaries` (475 arquivos), `test` (160 testes),
`build` (8 tarefas), `prisma validate` e `prisma generate`. Depois de ignorar
artefatos locais de diagnóstico, a última execução passou `check` em 484
arquivos, `typecheck` (16 tarefas), `boundaries` (475 arquivos), `test` (160
testes), `build` (8 tarefas), `prisma validate` e `prisma generate`. O candidato Preview
está disponível para inspeção sem sessão; fluxos autenticados que consultam ou
alteram dados não foram executados contra o banco oficial. Sign-up confirmado,
sessão válida, sign-out, redefinição com código, conta autenticada e páginas de
membro aguardam identidade de teste e banco isolado ou recuperação segura do
Supabase.

O segredo Clerk Production exposto em saída de ferramenta anterior permanece
comprometido: o responsável deve rotacioná-lo em Clerk Dashboard → instância
Production → API Keys e atualizar a variável Production do Vercel. Os 99 vídeos
continuam aguardando seus links reais. Das 110 URLs da Biblioteca, 99 tiveram
resposta 2xx/3xx e 11 retornaram 403 anti-bot; essas 11 permanecem inconclusivas.
As 12 fases continuam `IN PROGRESS` até cumprir seus gates autenticados e de
persistência, e a Fase 12 ainda aguarda rollout compatível com as migrations.

### Continuação da auditoria — 04/10/2026

O estado remoto foi rechecado sem escrita. O comando
`bun run --cwd=packages/database prisma migrate status --schema=prisma/schema.prisma`
confirmou 46 migrations, com as mesmas 16 pendentes. O painel da organização
confirma que os serviços estão restritos por Fair Use e podem responder `402`;
os limites excedidos são egress, cached egress e armazenamento. O ciclo exibido
é 24/09–24/10. Não apliquei migrations, backfills, seeds nem alterações em
dados ou objetos.

O CLI pelo Bun direto tentou baixar um manifest e falhou ao validar o certificado
do registry; usei o binário Prisma já instalado no workspace, com TLS verificado,
para obter o status somente de leitura. O changelog atual do Supabase também foi
revisado. A busca estática no schema e nas migrations versionadas não encontrou
uso de `ltree`, índices `btree_gist`, operadores customizados ou cifra PGP
legada; o estado remoto dessas extensões não foi consultado. Como o serviço
segue restrito, não executei as consultas de detecção remota daquele aviso de
versão.

Após a troca de destino do item “2025 Dietary Guidelines Advisory Committee
systematic reviews”, o verificador automatizado encontrou 110 URLs únicas, sem
duplicatas: 98 com resposta 2xx/3xx, 11 com 403 e a BVS com timeout. O portal BVS
carregou depois no Edge. Europe PMC e Epistemonikos também abriram no Edge apesar
do 403 automatizado; as páginas CDC e NIH ODS tiveram o conteúdo aberto pelo
leitor web. O DOAJ parou numa verificação Cloudflare, e os três links NESR deram
403 no Edge; os resultados oficiais de busca confirmam que os recursos NESR
existem, mas a acessibilidade direta permanece sem prova nesta rede. O destino
do item DGAC agora aponta para a página específica das revisões de 2025, em vez
da home NESR.

A correção editorial é local e não requer migration. O registro nesta seção não
promove as fases: a quota continua bloqueando as migrations e qualquer jornada
que precise persistir no Supabase oficial.

### Publicação Preview e QA de navegador — 04/10/2026

O commit `b5284ff1801f118ac59165a72f24c9ce443e48b4` foi enviado ao branch
`codex/interprete-member-area-release-2026-10-04`. Os deployments Preview dos
projetos Vercel do app e da API chegaram a `READY`, ambos associados ao mesmo
SHA e branch. O alias de Production não foi promovido e continua na implantação
anterior; os 16 schemas pendentes e a restrição Supabase tornam inseguro ativar
este código sobre os dados oficiais.

No navegador isolado sem sessão, `/sign-in` e `/sign-up` carregaram e hidrataram
com Clerk Development (`accounts.dev`) sem erros de console. O cadastro e o
login rejeitaram submissão vazia com validação compreensível; a recuperação
aberta sem endereço pediu e-mail/telefone, sem enviar código. A senha do
cadastro não impõe `minlength`/`maxlength` próprio. Navegação entre login e
cadastro e voltar/avançar preservaram as páginas esperadas. Termos, Privacidade
e Suporte abriram como páginas públicas.

As rotas `/`, `/aprender`, `/biblioteca`, `/biblioteca/pessoal`, `/exercicios`,
`/tarefas`, `/notificacoes`, `/perfil`, `/configuracoes`, `/encontros`,
`/encontros/gravacoes`, `/comunidade` e `/comunidade/meus-topicos` redirecionaram
ao login com seu próprio destino preservado. O login não apresentou overflow
horizontal em viewports de 320, 375, 390, 768 e 1280 px; cadastro foi revisto
visualmente em desktop e mobile e as páginas públicas não tiveram overflow a
390 px.

O Preview da API exige Vercel SSO: a consulta anônima de `/health` recebe `302`
para `/sso-api`, e não houve tentativa de contornar essa proteção. Os nomes das
variáveis Preview necessárias estão configurados e foram conferidos sem ler ou
registrar valores. Não houve conta Clerk criada nem sessão autenticada; além de
não haver endereço/CAPTCHA/código de teste controlados, o Preview compartilha
`DATABASE_URL` de Production, de modo que concluir signup poderia gravar uma
identidade real. Escritas, jornadas autenticadas, RLS, realtime, Cron/Vault e
isolamento por role continuam sem prova funcional.

### Revisão de publicação e QA final — 04/10/2026

O candidato de código validado é o commit
`d68900807a102cc3ba78392cb140a6b785605fac`; a atualização documental final foi
enviada como `c7be8f758f01a3c0c025387c7ee0ffcedc64ed3f` para
`origin/codex/interprete-member-area-release-2026-10-04`. A integração Git da
Vercel construiu os dois Previews como `READY` para `c7be8f7`: app em
`https://interprete-area-de-membros-a2mjt2xlo-gabrielschuchters-projects.vercel.app`
e API em
`https://interprete-area-de-membros-6txn56nb2-gabrielschuchters-projects.vercel.app`.
O alias Production `interprete-area-de-membros.vercel.app` e o alias de projeto
`interprete-area-de-membros-app.vercel.app` continuam no deployment anterior,
do commit `138dd326af633a10286e5faf56b21665769c786b`. Não promovi o novo código:
16 migrations aditivas ainda faltam no Supabase e as rotas de produto dependem
do schema novo.

Na revisão do checkout, não havia diff rastreado. `apps/api/CLAUDE.md` é o único
arquivo não rastreado e foi preservado fora do commit. `.env.local` e os
manifests/checkpoints locais de gravações estão ignorados pelo Git; os artefatos
operacionais também estão excluídos do contexto de deploy pelo `.vercelignore`.
O vínculo local padrão da Vercel é o projeto da API; a inspeção dos dois
projetos foi feita explicitamente pelos nomes registrados em
`docs/deployment/vercel.md`, sem iniciar deploy manual no projeto errado.
Não há arquivo de segredo ou dump rastreado. A inspeção direcionada dos
serviços de atribuição, outbox/notificações, grupos e permissões não encontrou
uma correção local segura adicional. Como nenhum código mudou após os gates
registrados acima, não repeti a suíte nesta revisão.

A validação do Preview permanece limitada a visitante: formulários públicos,
validação de campos vazios, recuperação sem envio de código, navegação e
redirects das rotas protegidas, viewport de 320 a 1280 px e console sem erro
foram exercitados conforme descrito na seção anterior. Nenhuma identidade foi
criada e nenhuma mutação foi enviada ao banco oficial. Não houve promoção ou
operação sobre dados de Production nesta revisão. Signup confirmado, sessão
autenticada e expirada, CRUD, isolamento real por role, leitura/gravação no
Supabase, RLS das migrations novas, realtime entre contas, Cron/Vault e a API
atrás do SSO seguem sem validação funcional segura neste Preview.

Todas as fases 1–12 continuam `IN PROGRESS`; não há evidência suficiente para
marcar qualquer uma como `DONE`. Para retomar o release, primeiro é necessário
que o Supabase saia da restrição de quota/Fair Use e que a sequência de
migrations/backfills seja executada e reconciliada sem perda de dados. A
associação dos 99 vídeos continua aguardando os links reais. A rotação da chave
secreta Clerk Production comprometida ainda é uma ação manual no Dashboard e
deve ocorrer antes de uma promoção Production.

## Matriz da fundação anterior — registro histórico até 03/10/2026

Esta matriz descreve a sequência fundacional anterior à reestruturação integrada
aprovada em 03/10/2026. O checklist vigente é a tabela de fases 1–12 acima;
estados históricos abaixo não substituem seus gates de persistência, autorização,
responsividade e E2E.

| Fase | Escopo | Status | Evidência atual |
| --- | --- | --- | --- |
| 0 | Fundação next-forge, Bun, Prisma, Supabase, Clerk | IMPLEMENTADO | schema/migrations oficiais, Clerk, Storage privado e gates técnicos verificados |
| 1 | Aprender: trilhas, cursos, módulos, aulas, progresso | IMPLEMENTADO | `ASYNC` separado de `RECORDING_ARCHIVE`, `LessonProgress` isolado e guard server-side |
| 2 | Admin/Professor: autoria, editor, preview, publicação | IMPLEMENTADO | rotas protegidas, publicação e preview presentes; staff QA em produção |
| 3 | Atividades e feedback | IMPLEMENTADO | submissão, feedback e filtros de membro presentes no banco oficial |
| 4 | Comunidade | IMPLEMENTADO | posts, comentários, votos, bookmarks, notificações e hardening server-side |
| 5 | Perfis e diretório de membros | IMPLEMENTADO | Profile/Member, avatar privado e diretório presentes |
| 6 | Encontros | IMPLEMENTADO | agenda, preparação, estados reais e vínculo opcional com gravações |
| 7 | Biblioteca | IMPLEMENTADO | curadoria, busca, filtros e acesso publicado |
| 8 | Home inteligente | IMPLEMENTADO | prioridade live-first, estados vazios honestos e retomada por playback |
| 9 | Integração entre domínios | IMPLEMENTADO | links entre encontros, gravações, atividades, comunidade e biblioteca |
| 10 | Responsividade, loading, vazio e erro | VERIFICADO | QA público e staff em larguras mobile/desktop; rotas protegidas sem overflow observado |
| 11 | QA funcional | VERIFICADO | check, typecheck, boundaries, testes, Prisma, build e produção conferidos |
| 12 | Branding/UX final | IMPLEMENTADO | tokens e superfícies Interprete preservados |
| 13 | Hardening | IMPLEMENTADO | autorização centralizada, Storage privado, HLS revogável e busca sem vazamento de gravações |
| 14 | Preparação de deploy | VERIFICADO | projetos/IDs/root/branch e aliases Vercel conferidos; commit publicado deve ser rechecado após cada push |

Limite de evidência desta auditoria: a base oficial tem zero grupos de
gravações atualmente vinculados a um Member. Por isso o fluxo de reprodução de
um aluno atribuído e o teste negativo A/B precisam ser executados depois de uma
atribuição administrativa real; a autorização server-side e os testes de
isolamento do domínio já estão cobertos por código/testes.

## Historical checkpoint — 25/09/2026

- Gates estáticos do checkout atual: `bun install --frozen-lockfile`, check,
  typecheck, boundaries, testes, Prisma validate e Prisma generate passam.
- O build isolado de `apps/app` passa; o build completo falha somente em
  `apps/api` pela ausência de `DATABASE_URL`, e o build remoto do app falha no
  mesmo gate.
- O projeto Supabase oficial `wkclodjbrynerfgufmyb` está `ACTIVE_HEALTHY`, em
  `sa-east-1`, PostgreSQL 17.6, com 16 migrations aplicadas e RLS habilitado
  nas tabelas públicas. A sessão de inspeção disponível é read-only; não prova
  a senha usada pelo Prisma da aplicação.
- O schema remoto contém 1 trilha, 1 curso, 14 módulos e 99 aulas, mas ainda
  não contém membros, perfis, progresso, atividades, comunidade, encontros,
  biblioteca ou objetos no bucket `learning-assets`. A migração de conteúdo não
  é declarada completa por causa desse estado real.
- O Clerk Production foi criado, as chaves Production foram configuradas nos
  projetos Vercel e o webhook `user.created`/`user.updated`/`user.deleted` foi
  registrado no endpoint da API. Isso não substitui a validação de runtime,
  que aguarda o banco.
- Hardening posterior foi enviado para `main`: `5774992` protege progresso e
  atividades por entitlement, `c4090df` sincroniza exclusão de usuário do
  Clerk com o Member interno e `f33998c` aplica o escopo de acesso a encontros.
  Os checks estáticos e o build isolado do app continuam passando.
- Veredito operacional: `FOUNDATION_NOT_READY` / `NOT_READY` até obter a senha
  PostgreSQL oficial (ou autorização do proprietário para uma rotação
  coordenada) e preencher `DATABASE_URL`/`DIRECT_URL` localmente e nos dois
  projetos Vercel.

## Historical Kiwify migration checkpoint

The verified Kiwify hierarchy is now represented in the official Supabase
project through idempotent migration inventory: 1 course, 14 modules, 99
lessons and 16 student-match records. The repository also contains the
server-side access model and private `learning-assets` bucket foundation.
Videos, attachments and student access grants were intentionally not marked as
migrated at that historical checkpoint: the authenticated Kiwify browser did
not expose downloadable media URLs. Current credential/connectivity status and
the remaining 99 YouTube source URLs are recorded in the integrated checkpoint
above. See
`docs/migration/kiwify.md` for the exact resumption point.

> As fases legadas iniciadas abaixo documentam a entrega fundacional e suas
> decisões originais. Suas antigas listas de pendências sobre credenciais ou
> sequência de implementação não são gates atuais; consulte a reestruturação
> integrada autorizada no início deste documento.

## Phase 1 — Learning

Status: IN PROGRESS

### Objetivo

Permitir que um membro encontre conteúdo publicado, navegue por trilhas/cursos/módulos/aulas, consuma uma aula e salve seu progresso real.

### Escopo

- modelo relacional de conteúdo publicado e recursos;
- leitura server-side de trilhas, cursos, módulos e aulas;
- renderização de conteúdo estruturado da aula;
- matrícula/enrollment e progresso por membro;
- marcar aula como concluída sem duplicidade;
- estados de loading, vazio, erro e conteúdo não publicado;
- experiência responsiva nas larguras 375, 768, 1024 e 1440px.

Autoria de cursos, módulos e aulas, edição rich-text e publicação administrativa pertencem à Phase 2. Nesta fase, o conteúdo necessário para validar o consumo pode ser provisionado por seed/dev fixture explicitamente identificada, nunca por dados falsos embutidos no frontend.

### Principais entidades

- `LearningPath`
- `Course`
- `Module`
- `Lesson`
- `LessonResource`
- `Enrollment`
- `LessonProgress`

### Principais rotas

- `/aprender`
- `/aprender/trilhas/[slug]`
- `/aprender/cursos/[slug]`
- `/aprender/cursos/[slug]/[lessonSlug]`

### Critérios de aceite

- membro autenticado vê somente conteúdo publicado e permitido;
- draft/archived não aparece nas consultas de membro;
- curso, módulo e aula possuem ordenação persistida;
- aula suporta documento estruturado e recursos sem assumir que toda aula é vídeo;
- conclusão usa constraint única por membro/aula e sobrevive a reload;
- progresso de um membro não pode ser lido ou alterado por outro;
- queries e mutações sensíveis permanecem server-side;
- testes cobrem publicação, autorização, conclusão idempotente e progresso isolado;
- lint, typecheck, boundaries, testes relevantes e build passam;
- E2E do fluxo membro é executado quando Clerk/Supabase estiverem disponíveis.

### Pendências

- `DATABASE_URL`/`DIRECT_URL` locais com a senha do projeto oficial para validar o Prisma pelo processo da aplicação;
- decisão de provider de vídeo, que permanece fora desta fase;
- autoria/admin e editor reutilizável, reservados para Phase 2.

### Evidência desta execução

- schema Prisma, migration SQL, seed de desenvolvimento e fluxo de leitura/progresso foram implementados;
- `bun run check`, `bun run typecheck`, `bun run boundaries` e `bun run test` passam no checkout atual; `bun run build` é interrompido pela validação de `apps/api` sem `DATABASE_URL`;
- o projeto Supabase oficial `wkclodjbrynerfgufmyb` foi confirmado `ACTIVE_HEALTHY` em `sa-east-1`, PostgreSQL 17.6, com as duas migrations da fundação aplicadas;
- as sete tabelas da aprendizagem existem no Supabase com RLS habilitado e índices de cobertura das FKs;
- Clerk CLI, proxy, login real e acesso autenticado ao shell foram validados; o percurso do membro até `/aprender` chega ao guard e ao carregamento server-side;
- a consulta real da aplicação ainda falha localmente porque `DATABASE_URL` está sendo executada com placeholder e o API não possui essa variável: persistência, conteúdo e conclusão da aula continuam `BLOCKED_BY_CREDENTIALS`;
- a Phase 1 permanece `IN PROGRESS` até validar o processo Prisma da aplicação com credenciais PostgreSQL locais e executar o fluxo completo com seed de desenvolvimento.
- a proteção das páginas de membro usa o mesmo guard server-side da aplicação; sem sessão, `/` e `/aprender` respondem com redirect 307 para o fluxo do Clerk.

## Phase 2 — Teacher/Admin

Status: IN PROGRESS

### Objetivo

Permitir que professor/admin crie, edite, ordene, visualize e publique conteúdo de aprendizagem com autorização server-side.

### Escopo

- guards de papel e autorização centralizada;
- criar/editar curso, módulo e aula;
- ordenação persistida;
- draft, preview e publish;
- rich editor compartilhado, após avaliação de editorcn/Tiptap;
- recursos e storage somente quando houver necessidade validada.

### Principais entidades

- `MemberRole`/fonte de autorização;
- entidades de conteúdo da Phase 1;
- `LessonRevision` ou equivalente, se necessário após decisão de versionamento;
- recursos de conteúdo.

### Principais rotas

- `/admin/learning`
- `/admin/courses`
- `/admin/courses/new`
- `/admin/courses/[id]`
- `/admin/courses/[id]/modules/[moduleId]`
- `/admin/courses/[id]/lessons/[lessonId]`

### Critérios de aceite

- professor só gerencia conteúdo permitido;
- membro não acessa rotas administrativas nem drafts;
- fluxo criar curso → módulo → aula → editar → preview → publicar funciona ponta a ponta;
- publicação é transacional e auditável;
- editor é reutilizável por presets, não quatro implementações isoladas;
- checks e E2E de professor/membro passam.

### Pendências

- validação ponta a ponta depende de uma conexão PostgreSQL válida;
- editor de texto estruturado usa o documento JSON existente e ainda pode receber uma UI rich-text dedicada após validação de necessidade;
- buckets/policies do Supabase Storage permanecem fora do fluxo até existir upload real.

### Evidência desta execução

- `Member.role` foi criado como fonte server-side de autorização;
- professor/admin possui rotas protegidas para conteúdo, preview, publish/archive, atividades, comunidade, encontros e biblioteca;
- o fluxo de criação e publicação está implementado, mas ainda não foi executado com dados persistidos por causa do bloqueio de credenciais.
- o fluxo administrativo agora inclui edição de percurso, curso, módulo e aula, preview com o documento estruturado renderizado e controles de publicar/arquivar;
- novas entidades recebem a próxima posição persistida dentro de transação, evitando colisões da constraint de ordenação ao criar o segundo curso, módulo ou aula;
- as ações administrativas mantêm autorização server-side por `Member.role` e atualizam o responsável por alterações onde o modelo oferece esse campo.

## Phase 3 — Activities

Status: IN PROGRESS

### Objetivo

Permitir prática deliberada, entrega do membro e feedback autorizado do professor.

### Escopo

- atividades publicadas;
- submissions próprias;
- revisão e feedback do professor;
- status simples e auditável.

### Principais entidades

- `Activity`
- `ActivitySubmission`
- `Feedback`

### Principais rotas

- `/atividades`
- `/atividades/[activityId]`
- `/admin/activities`
- `/admin/activities/[activityId]/submissions`

### Critérios de aceite

- membro envia somente a própria submission;
- professor autorizado revisa e fornece feedback;
- estados `DRAFT`, `SUBMITTED` e `REVIEWED` são respeitados;
- persistência, autorização, mobile e E2E passam.

### Pendências

- validação de persistência e E2E depende do PostgreSQL acessível;
- sem anexos ou workflow acadêmico além de `DRAFT`, `SUBMITTED` e `REVIEWED`.

### Evidência desta execução

- criação de atividades aceita prazo opcional validado, e o admin possui publicação/arquivamento;
- submissão própria, feedback staff e estados `DRAFT`/`SUBMITTED`/`REVIEWED` continuam protegidos por ações server-side.

## Phase 4 — Community

Status: IN PROGRESS

### Objetivo

Criar espaços de discussão com posts, comentários threadados e reação positiva simples.

### Escopo

- espaços configuráveis;
- posts rich-text;
- comentários com nesting;
- voto/reação única e reversível;
- rascunho com autosave persistente;
- bookmarks/salvos por membro;
- tags simples e metadados de publicação;
- moderação mínima e soft delete.

### Principais entidades

- `CommunitySpace`
- `CommunityPost`
- `CommunityComment`
- `PostVote`
- `CommentVote`
- `CommunityBookmark`
- `Profile` (vinculado ao `clerkUserId`, enquanto `Member.role` permanece a fonte de autorização)

### Principais rotas

- `/comunidade`
- `/comunidade/novo`
- `/comunidade/meus-topicos`
- `/comunidade/salvos`
- `/comunidade/[spaceSlug]`
- `/comunidade/[spaceSlug]/novo`
- `/comunidade/[spaceSlug]/[postId]`
- `/membros/[username]`

### Critérios de aceite

- membro cria post, comenta e vota conforme autorização;
- constraints impedem voto duplicado;
- rascunho é salvo automaticamente e pode ser retomado após reload;
- membro salva/remove tópico e encontra a publicação em `/comunidade/salvos`;
- threads continuam íntegras após soft delete;
- feed e comentários possuem paginação e funcionam no mobile.

### Pendências

- validação do fluxo entre membros depende do PostgreSQL acessível;
- não há chat, DM, karma, leaderboard ou badges.

### Evidência desta execução

- posts, comentários e votos validam a relação entre espaço, post e comentário antes de mutar;
- feed e discussões têm paginação; a paginação da discussão é por comentários-raiz e inclui toda a descendência carregada, evitando separar uma resposta do seu pai;
- contagens públicas excluem posts/comentários removidos e a moderação permanece em soft delete.
- a migration `profiles_and_rich_topics` foi aplicada ao Supabase oficial e adiciona `Profile`, `contentJson`, `isPinned` e `CommunitySpace.icon`, mantendo RLS deny-by-default;
- o membro autenticado recebe um perfil básico sincronizado com Clerk sem sobrescrever os campos editoriais já preenchidos;
- `/comunidade` agora possui feed plano com busca textual, filtro de espaço, ordenação recente/popular, autor identificável e criação editorial com Tiptap;
- tópicos suportam `DRAFT`, `PUBLISHED` e `ARCHIVED`, edição do autor, soft delete, fixação para professor/admin e consulta em `/comunidade/meus-topicos`;
- respostas são editáveis pelo próprio autor, possuem identidade pública e preservam `parentId` para threading futuro;
- `/perfil` edita username, avatar URL opcional, bio, contexto, links e interesses; `/membros/[username]` omite e-mail e exibe apenas atividade publicada;
- rascunhos são criados no início do composer, salvos por server action com debounce, possuem preview baseado no mesmo renderer publicado e podem receber até cinco tags;
- tópicos publicados recebem slug/metadados de publicação, e `/comunidade/salvos` persiste bookmarks com unique composto;
- lint, typecheck, boundaries, testes e build foram executados após essa evolução; E2E autenticado e persistência via processo Prisma continuam pendentes por credencial local.

## Phase 5 — Meetings

Status: IN PROGRESS

### Objetivo

Exibir próximos e passados encontros com clareza, usando links externos.

### Escopo

- próximos encontros;
- encontros passados;
- link externo e gravação opcional;
- sem videoconferência própria.

### Principais entidades

- `Meeting`

### Principais rotas

- `/encontros`
- `/admin/meetings`

### Critérios de aceite

- próximo encontro é prioritário;
- datas e timezone são exibidos corretamente;
- acesso é autorizado e responsivo;
- nenhum WebRTC ou provider de vídeo é criado.

### Pendências

- links externos são aceitos somente com `http`/`https`;
- não foi criado provider de vídeo nem integração de calendário.

### Evidência desta execução

- timezone informado pelo professor é validado com `Intl.DateTimeFormat` antes de persistir, evitando falha posterior de renderização;
- próximo e passados continuam separados server-side por data e status publicado.

## Phase 6 — Library

Status: IN PROGRESS

### Objetivo

Centralizar recursos curados com busca simples e filtros úteis.

### Escopo

- artigos, PDFs, guias, links e vídeos externos;
- categorias/tags;
- busca por título/descrição/tags;
- filtros pequenos e previsíveis.

### Principais entidades

- `LibraryItem`

### Principais rotas

- `/biblioteca`
- `/admin/library`

### Critérios de aceite

- biblioteca não vira file manager;
- itens respeitam visibilidade e autorização;
- busca e filtros são paginados e funcionam no mobile;
- arquivos privados usam Storage seguro quando aplicável.

### Pendências

- URLs externas estão implementadas; upload/Storage fica pendente até haver necessidade real e policy validada;
- não há busca semântica ou IA.

### Evidência desta execução

- busca e filtros da biblioteca agora retornam páginas de tamanho limitado, preservando query, tipo e categoria nos links de navegação;
- itens publicados continuam sendo a única superfície de membro e URLs são validadas na criação administrativa.

## Phase 7 — Smart Home

Status: IN PROGRESS

### Objetivo

Responder de forma determinística “o que devo fazer agora?” usando dados reais das fases anteriores.

### Escopo

- continuar aula iniciada;
- próxima aula;
- atividade urgente;
- encontro próximo;
- aviso importante quando houver fonte real.

### Principais entidades

- `NextAction` como projeção/regra, não necessariamente tabela;
- dados derivados de progresso, activities, meetings e community.

### Principais rotas

- `/`

### Critérios de aceite

- nenhuma métrica ou conteúdo falso;
- prioridade determinística documentada;
- home não vira dashboard supercarregado;
- recomendações respeitam autorização e não vazam dados personalizados.

### Pendências

- depende da validação dos domínios com dados reais;
- não implementa IA ou recommendation engine.

## Phase 8 — Visual / Branding / UX

Status: IN PROGRESS

### Objetivo

Consolidar a tradução do Design System oficial do Interprete. em todas as superfícies funcionais, preservando a engenharia next-forge e priorizando leitura, escola contemporânea e prática baseada em evidências.

### Evidência desta execução

- tokens, tipografia, superfícies, navegação e padrões editoriais foram centralizados em `@repo/design-system`;
- as rotas funcionais novas usam o canvas Pink Essence, Dark Amaranth estrutural, Classic Crimson como gesto e estados de leitura responsivos;
- a auditoria final de screenshots, autenticação e dados reais ainda depende da conexão operacional.

### Gate

- desktop/mobile, acessibilidade, lint, typecheck, boundaries, testes e build;
- screenshots e navegação real nas rotas principais;
- nenhuma superfície pode voltar a depender de dados demo ou visual SaaS genérico.

### Fechamento da auditoria de autenticação — 04/10/2026

A causa do erro local ficou entre a Frontend API do browser e a verificação
server-side da sessão. O browser carregou a instância Clerk Development e seus
assets pelo domínio `accounts.dev`; os erros `UNABLE_TO_VERIFY_LEAF_SIGNATURE`
vinham depois do middleware tentar buscar `https://api.clerk.com/v1/jwks` para
resolver o handshake. O aviso subsequente do Clerk sobre “infinite redirect
loop” era consequência dessa falha de TLS, não uma divergência de chaves. As
chaves locais seguem sendo do ambiente Development, o FAPI local não tem
override/proxy Production, e o proxy `/__clerk` de produção não foi removido ou
alterado.

O runtime Bun continuou reproduzindo a falha mesmo com `--use-system-ca` e
`NODE_OPTIONS`; o Next executado em Node 24 com `--use-system-ca` funcionou sem
`NODE_OPTIONS`. O runner local agora fixa esse runtime para `dev` e `start`,
propaga `NODE_USE_SYSTEM_CA=1` a processos-filhos e encerra com mensagem clara
se o Node for antigo demais, em vez de iniciar autenticação que falha de forma
ambígua. A validação TLS permanece habilitada. A mudança é estritamente local;
não altera runtime nem configuração de produção.

A inspeção do processo de desenvolvimento também encontrou que o logger padrão
do Next imprimia requisições contendo `__clerk_handshake` com o query string
completo. A configuração oficial `logging.incomingRequests.ignore` agora omite
no terminal de desenvolvimento requisições com parâmetros internos `__clerk_`;
isso não altera respostas e não afeta logs de produção.

Com o novo caminho, a rota protegida `/aprender` redireciona ao formulário
`/sign-in` com o destino `/aprender` preservado; após hidratação do Clerk os
campos aparecem, sem loading preso. A execução de navegador e logs do servidor
não mostraram falha JWKS/TLS, erro de handshake ou aviso de loop. A página
`/sign-up` e o redirect de usuário sem sessão foram exercitados; o detalhe dos
estados autenticados e as mutações de conta ainda dependem de uma identidade de
teste segura, CAPTCHA e confirmação de e-mail.

Nesta auditoria, nenhum usuário Clerk foi finalizado: não foi resolvido CAPTCHA
nem submetido código de verificação, e o primeiro login bem-sucedido também
criaria `Member`/`Profile` no banco Supabase oficial, que está sob restrição
Fair Use/quota. Assim, signin válido, refresh de uma sessão válida, signout,
recuperação com código e alteração real de senha permanecem sem E2E autenticado.
Os fluxos sem credenciais e as regressões de estado/redirect são cobertos por
testes automatizados e pelo smoke local descrito acima; a conclusão desses
cenários exige ambiente de teste isolado do banco oficial.

### Validação complementar do fluxo Clerk local — 04/10/2026

O processo `bun run start` iniciou Next sob Node com a CA do sistema. Requisições
sem sessão para `/sign-in`, `/sign-up` e `/aprender` foram encaminhadas pelo
Clerk Development ao endpoint `/v1/client/handshake`; ao seguir essa etapa com
TLS validado, a Frontend API respondeu com o redirect de volta ao app. O
middleware autenticado carregou os formulários no Edge, e `/aprender` terminou
em `/sign-in` preservando o destino. A rota de tarefa sem sessão também voltou
ao login preservando `/perfil` e sua query interna. Navegação por link e
voltar/avançar alternou entre login e cadastro sem ciclo.

O cadastro renderizou no viewport mobile de 390 px; a página não teve overflow
horizontal (375 px de largura útil e de conteúdo). Os campos não impõem
`minlength`/`maxlength` próprios; o toggle de senha funcionou. O formulário de
login também hidratou no mobile. A tela de cadastro mostrou o fallback de
carregamento durante a inicialização do SDK, depois carregou os campos; existe
fallback acessível com ação de retry após 15 s, coberto por teste com relógio
controlado. O teste de credencial inválida e a mensagem neutra de recuperação
estão documentados na validação anterior. Nada foi submetido com a credencial
salva/autopreenchida pelo navegador.

Nos logs do servidor não reapareceram query parameters internos `__clerk_`,
erros de TLS/JWKS ou avisos de redirect loop. O console do navegador apresentou
somente o aviso esperado de uso de chaves Development. Durante uma execução de
diagnóstico anterior, o logger padrão do Next chegou a imprimir uma URL de
handshake Development efêmera antes da regra de filtro ser adicionada; não havia
uma sessão autenticada. Esse valor não foi persistido no repositório nem
reproduzido neste documento. A chave secreta Production tratada como
comprometida continua exigindo rotação manual descrita abaixo.

Ainda não houve signup verificado, signin válido, refresh/revogação de sessão,
signout ou alteração de credenciais: não foi usado um endereço de teste
controlado, não foi concluído CAPTCHA/código, e a primeira autenticação da app
pode escrever identidade no Supabase oficial sob restrição de quota. Essas
restrições não foram contornadas.

Uma chave secreta Clerk Production apareceu em saída de ferramenta anterior e
é considerada comprometida. É necessária rotação manual no Dashboard da
instância Production e atualização do segredo no gerenciador de ambiente de
deploy; nenhum valor foi repetido nem alterado durante a auditoria.

### Iniciativa permanente de performance — 06/10/2026

Performance passa a ser um gate contínuo de arquitetura, desenvolvimento,
design e UX, detalhado em `docs/architecture/performance.md`,
`packages/design-system/PERFORMANCE.md` e no `AGENTS.md`.
Cada mudança declara caminho crítico, orçamento, dados mínimos, paginação,
cache/invalidação, feedback imediato, fronteira de persistência, autorização e
evidência mobile. A fase 10 continua `IN PROGRESS`; esta diretriz não conclui
nenhuma outra fase.

Os objetivos de aceite são: feedback visual em até 100 ms; conteúdo de seção
antecipada em p95 ≤ 300 ms e primeira visita em p95 ≤ 1 s; mutação pequena
persistida em p95 ≤ 500 ms; área autenticada após sessão estabelecida em até
1 s; LCP ≤ 2,5 s, INP ≤ 200 ms e CLS ≤ 0,1 no p75. Skeleton visível não conta
como conteúdo utilizável. A prova deve separar papéis, rota, cache frio/aquecido,
prefetch, desktop e Android intermediário em 4G.

O baseline disponível encontrou execução efetiva do app em `iad1` e GREEN/API
em `gru1`; a configuração versionada do app pede `gru1`. Dois app Previews
retornaram HTTP 200 em `/health`, com banco disponível: o deployment explícito
com `--regions gru1` respondeu `X-Vercel-Id: gru1::gru1`; o deployment a partir
da raiz do repositório, sem a flag, respondeu `gru1::iad1` (região da requisição
e execução da função, respectivamente). O default remoto do projeto ainda é
`iad1`, portanto a configuração versionada não está comprovada no caminho de
deploy sem a flag. A tentativa de alterar o default foi bloqueada pela política
automática da ferramenta; Production não foi alterada. Cinco trocas
autenticadas variaram de 1,43 s a 3,82 s com overhead de automação/DOM; não são
INP nem percentis de produção. SQL simples mediu 13–15 ms no sample disponível;
nenhum episódio de dez segundos foi reproduzido e não há percentis históricos
da Vercel nesta evidência.

O código local consolidou o snapshot do membro para onboarding/papel, retirou a
chamada Clerk `currentUser()` de perfis provisionados, substituiu a árvore do
menu Aprender por consulta de existência condicionada ao acesso, carregou na
Home somente blocos habilitados, reduziu a busca de retomada de gravações para
até seis resultados filtrados no banco, limitou prefetch, fez o histórico de
Exercícios buscar no banco as seis sessões que a tela exibe e removeu a animação
que ocultava o conteúdo resolvido. Respostas de Exercícios agora devolvem à
tela um DTO de correção somente depois do commit, sem exigir redirect e nova
leitura integral. O budget inicial de JavaScript por rota está ativo em 225 KiB
gzip; os cinco percursos mediram 188,8–192,7 KiB nos Previews. Isso comprova o
limite do artefato analisado, não o desempenho de runtime. Percentis, hidratação
mobile, worker durável e jornadas autenticadas permanecem gates de
homologação; notificações continuam no despacho atual até a recuperação
durável estar comprovada. Uma Preview exploratória criada por engano no projeto
da API foi removida; nenhum deployment de produção ou alias foi afetado.

### Continuação: streaming, feedback e região efetiva — 06/10/2026

O trabalho continuou depois da primeira tranche. Aprender agora inicia a busca
de progresso assim que cursos/trilhas identificam os IDs necessários, em
paralelo às atribuições e aos dados de retomada. Comunidade separa feed,
compositor e coluna lateral em boundaries de streaming; Biblioteca exibe
estrutura e filtros sem esperar a lista completa; Gestão separa o shell do
resumo carregado. Filtros, formulários de tarefas e abertura de materiais
mostram estado pendente durante a espera. A capa de gravação já atualizava o
preview local com o resultado persistido da API, portanto removi a releitura
integral da página administrativa. A busca continua com onze projeções
autorizadas; sem SQL real, `EXPLAIN` e amostra representativa, não adicionei
índices nem consolidei esses filtros heterogêneos às cegas.

A região foi confirmada no Preview final
`dpl_8HoLnYVJyujisiYhUG7KrvFR7yuj`: o CLI lista as funções Next em `gru1` e
`/health` retorna `200`, `X-Vercel-Id: gru1::gru1`. A publicação reproduzível
é `vercel deploy --local-config apps/app/vercel.json --yes`, sem flag regional;
a configuração local define `gru1`. O default remoto do projeto continua
`iad1`; uma publicação por outro caminho continua sujeita à configuração
remota. A alteração direta do default remoto foi bloqueada pela política
automática da ferramenta. A máquina de build continua em `iad1`, distinta da
região de runtime.

O Preview atual mediu 188,8–192,7 KiB gzip nos cinco percursos do budget de
225 KiB; o build local mediu 186,5–190,2 KiB. Os gates locais passaram após as
mudanças, incluindo build completo; o Preview repetiu os 250 testes da app e
compilou as 24 rotas. Esses números verificam artefato e compilação, não
velocidade real. A amostra autenticada disponível (1,43–3,82 s com overhead de
automação/DOM) é da Production anterior a estas mudanças. O Preview usa Clerk
Development; sem uma sessão QA nele, não foi possível medir navegações
autenticadas, persistência, papéis, rollback, mobile/4G ou percentis antes e
depois. O health check confirma conectividade básica ao banco, mas a consulta
read-only de planos SQL segue bloqueada por divergência do projeto local e pela
limitação de acesso Vercel aos segredos. Sentry não criou release nem enviou
sourcemaps por falta de `SENTRY_AUTH_TOKEN`.

A fase 10 e a iniciativa de performance continuam `IN PROGRESS`. A próxima
prova necessária é executar o Preview com contas QA autenticadas `MEMBER`,
`TEACHER` e `ADMIN`, coletar clique → feedback/estrutura/conteúdo utilizável e
submits → persistência, e então comparar com as rotas Production medidas antes
da mudança. Nenhum alias ou deployment Production foi alterado.

Na preparação da medição, a Busca global passou a emitir spans sanitizadas por
cada uma das onze projeções, aninhadas à span total de fan-out. O Preview tem
`NEXT_PUBLIC_SENTRY_DSN` configurada, mas a ingestão ainda depende de executar
uma busca autenticada e consultar a trace. Os nomes são fixos e não incluem
membro, termo ou conteúdo; filtros, autorização, resultados e limites não
mudaram. Isso permite localizar o ramo lento antes de consolidar SQL ou criar
índices.

### Continuação: região Production e comparação autenticada — 06/10/2026

O usuário alterou manualmente no dashboard da Vercel o default de Functions do
app para `gru1`. Um `vercel redeploy` da implantação anterior manteve as
funções em `iad1`; um build Production novo, do mesmo commit `523ff17` e de um
worktree limpo, aplicou o manifesto `apps/app/vercel.json` e criou
`dpl_H3q2X7appwqC3iiczKRrzxu85nAZ`. O inspect lista as funções de página e API
em `gru1`. A implantação inicialmente atualizou o alias automático
`interprete-area-de-membros-app.vercel.app`, mas o middleware o redireciona ao
host canônico `interprete-area-de-membros.vercel.app`, que ainda apontava para
o deployment antigo. O alias canônico foi então atribuído ao deployment novo.
`/health` no deployment e no host canônico respondeu 200 com
`X-Vercel-Id: gru1::gru1`, confirmando a região efetiva da função ao vivo.

Na mesma sessão autenticada `TEACHER`, host canônico e rotina de DOM, o baseline
disponível tinha uma amostra por fluxo; foram coletadas cinco amostras pós-
região por fluxo. As medianas pós-região (faixas) de conteúdo utilizável foram:
Comunidade 705 ms (553–992), Biblioteca 711 ms (666–944), Gestão 639 ms
(556–1.401) e Busca por “causalidade” 534 ms (397–624), com um resultado em
todas as buscas. Frente ao baseline único de 3.730 ms, 3.805 ms, 2.131 ms e
3.005 ms, respectivamente, as reduções direcionais são de 70% a 82%. O input
de busca respondeu em mediana de 18 ms (17–42). Também foram medidos Início em
867 ms, Exercícios em 802 ms e Aprender em 573 ms após visita anterior. Em
viewport responsivo 390 × 844, Comunidade, Biblioteca e Início chegaram a
conteúdo utilizável em 1.048 ms, 647 ms e 703 ms, sem largura de documento
acima do viewport. Isso é emulação no Edge desktop, sem throttling de rede e
sem aparelho Android físico. O submenu do professor quebra em várias linhas
nessa largura; uma navegação móvel mais compacta merece validação de usabilidade
separada. `/health` respondeu `gru1::gru1` em sete chamadas; a primeira levou
393 ms e as
seis aquecidas 117–127 ms, mediana 121 ms, contra 312 ms da amostra aquecida
anterior. Os tempos incluem overhead de automação/DOM e não são INP nem
percentis; n=5 após a mudança não permite comparar distribuições completas
com o baseline n=1.

O workspace corrigiu o indicador de navegação para iniciar durante a captura,
antes de o roteador Next chamar `preventDefault` no link interno, e adicionou
testes de regressão; todos os cinco gates obrigatórios passaram. A medição
aquecida nem sempre observou a região `aria-live` no retorno da automação; o
budget de 100 ms ainda não está demonstrado. Não houve habilitação ou compra do
Observability Plus. Percentis Production, sessão `MEMBER` e `ADMIN`, Android
físico/4G, hidratação/INP, persistência de mutações, worker durável e as
alterações locais de performance seguem pendentes. Fase 10 e iniciativa
permanecem `IN PROGRESS`; a troca regional não conclui os gates.
