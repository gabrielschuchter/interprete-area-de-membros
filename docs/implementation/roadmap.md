# Interprete Product Roadmap

## Nota operacional — domínio Production, 30/10/2026

A área de membros atende `https://membros.escolainterprete.com.br` no deployment
`dpl_GjqW96cC3peZVjaCuSmZeLepUx5Q`, construído a partir do SHA
`76a62e94d0f1137068925e8600d7e2a21b2f6ab4`. A troca de domínio não altera a
ordem, o aceite ou o estado de nenhuma fase de produto, nem executa migração de
Supabase. O histórico de dados e releases abaixo continua sendo o registro das
fases; a arquitetura e os gates do domínio ficam em
[`docs/architecture/domain-architecture.md`](../architecture/domain-architecture.md)
e [`docs/deployment/vercel.md`](../deployment/vercel.md).

## Reauditoria e conclusão pós-cutover — 05/10/2026

Esta sequência substitui os checkpoints históricos abaixo para o trabalho de
conclusão iniciado após o cutover para GREEN. A aplicação/API Production estão
no ar e conectadas ao Supabase `qffqhilydtnrggbcnogh`; os fatos de migração e
serviços estão registrados em `docs/migration/supabase-blue-green.md`.

### Estado revalidado

- Clerk Production tem seis usuários; cinco têm `Member` e `Profile`. Um
  usuário Clerk sem `Member` continua separado dos dados de produto.
- Há 16 `MigrationStudent`: um vínculo `EXACT` e 15 ainda `UNMATCHED`. Os 14
  grupos de gravações importados estão sem `memberId`. Isso não prova perda no
  cutover; vínculos só podem ser corrigidos com prova de identidade.
- Os 99 vídeos históricos não possuem URL/ID externo verificável. Três listas
  com 10 questões cada foram publicadas no GREEN pela gestão real de Exercícios;
  as jornadas de aluno ainda não foram comprovadas. Tentativas, metas, tarefas
  e campanhas continuam sem atividade suficiente para validar as métricas.
- A listagem autenticada da Biblioteca mostra 110 itens publicados. Preservar
  a correção de acesso para itens sem aula vinculada.
- Usuário autenticado com papel `ADMIN` confirmou navegação das superfícies;
  aluno e professor ainda precisam de sessões controladas para QA real.

O código atual provisiona/sincroniza `Member` e `Profile` server-side no
primeiro acesso autenticado (`getOrCreateProfile`) e mantém o webhook Clerk
assinado/idempotente em `/webhooks/auth`; o evento de exclusão desativa a conta
sem apagar vínculos históricos. A ação administrativa de papel preserva
`Member.role` como autoridade e não depende de e-mail ou metadata pública. Isso
confirma o desenho do fluxo, não o comportamento autenticado desta publicação:
há um Clerk Production sem `Member`, nenhum `TEACHER` no banco e nenhuma sessão
QA de professor validada.

### Sequência de conclusão

As fases abaixo permanecem `IN PROGRESS` até persistência, autorização,
desktop/mobile e gates funcionarem na aplicação publicada. Não usar o código,
seeds ou testes automatizados como prova de jornada real.

| Fase | Escopo | Estado após a reauditoria |
| --- | --- | --- |
| 1 | Contas QA persistentes e papéis reais | `IN PROGRESS` — quatro contas controladas ainda precisam de provisionamento e validação autenticada. |
| 2 | Reconciliação segura de usuários e histórico | `IN PROGRESS` — 15 estudantes e 14 grupos de gravação sem vínculo exigem revisão comprovável. |
| 3 | Acervo real de exercícios e dados de demonstração | `IN PROGRESS` — as três listas com 10 questões (sete de escolha única e três de múltipla escolha cada) estão publicadas; PICO/GRADE corrigidas em novas versões e persistência revalidada. Resposta/sessão ainda sem prova autenticada como aluno; fontes reais dos vídeos seguem pendentes. |
| 4 | Sessões, correção, retomada e desempenho | `IN PROGRESS` — a retomada local agora consulta e expõe todas as sessões abertas separadamente do histórico concluído; uso autenticado com aluno segue pendente. |
| 5 | Atribuições, grants, revogação e notificações | `IN PROGRESS` — migration/release do destino específico de gravação estão no GREEN/alias; não há fontes verificadas elegíveis para atribuir. QA de papéis, expiração/revogação sobre grants reais e realtime permanecem pendentes. |
| 6 | Aprender, coleções, retomada e trilhos | `IN PROGRESS` — rail/sidebar, schema e gestão estão publicados; três coleções editoriais foram publicadas e vistas em Aprender. Retomada entre dispositivos, QA como aluno, teste mobile/touch e acabamento de capas ainda pendem. |
| 7 | Comunidade, grupos, editor e privacidade | `IN PROGRESS` — catálogo e fluxos requerem QA entre membros. |
| 8 | Estudo, metas, tarefas, campanhas e badges | `IN PROGRESS` — eventos/intervalos reais insuficientes para validar métricas. |
| 9 | Biblioteca, gravações e calendário | `IN PROGRESS` — catálogo preservado; playback de gravações sem fonte e fluxo pessoal pendentes. |
| 10 | Acessibilidade, mobile, performance e release | `IN PROGRESS` — sessões de todos os papéis, viewport móvel efetiva e medição autenticada pendentes. |

### Trabalho local de UI em andamento — 05/10/2026

A sidebar mantém “Minhas gravações” e “Salvos” como duas entradas de um pequeno
grupo visual próprio no topo esquerdo, antes de “Área de membros”, nesta ordem.
As rotas `/encontros/gravacoes` e `/comunidade/salvos` continuam independentes;
o resolver de active state seleciona somente a rota mais específica. O rail do
Aprender ganhou controles condicionais, navegação touch/teclado via controles
focáveis, snap, scrollbar ocultada e tratamento de movimento reduzido; a
navegação administrativa quebra em linhas sem rolagem horizontal. O cabeçalho
distingue Exercícios, Metas e tarefas, Configurações, Minhas gravações e Salvos.
A rota Salvos agora reúne favoritos
educacionais, questões favoritas e bookmarks da comunidade em grupos por
origem; a Biblioteca pessoal e a rota de favoritas de Exercícios permanecem
disponíveis. As remoções revalidam a visão agregada. Os cinco gates locais
passaram após a alteração; ainda não há prova visual em mobile nem deployment
desta mudança.

### Retomada de exercícios — implementação local

A página de Exercícios separa sessões `IN_PROGRESS` do histórico de tentativas
concluídas. Todas as sessões abertas do membro em listas ainda publicadas são
consultadas sem depender do limite das seis entradas recentes; cada uma aparece
em “Continue de onde parou”, com avanço acessível e ação de retomada. Começar
uma nova tentativa na página da lista permanece independente. A query limita os
registros ao `memberId` autenticado e ao conteúdo publicado. Dois testes
verificam os filtros e a separação das consultas. Isso ainda não comprova
respostas, retomada após refresh ou sincronização entre dispositivos na
aplicação autenticada. Após essa edição, os cinco gates passaram; a suíte tem
227 testes (25 scripts, 185 app, 9 API e 8 domínio). O build recompilou o app
com exit 0 e registrou um aviso de espaço insuficiente após a conclusão.

### Implementação local pós-publicação — 05/10/2026

O banco Prisma agora modela `COURSE` e `EXERCISE_LIST` em `ContentCollectionItem`,
`RECORDING` como destino específico de atribuição, e congela o tipo da questão
em cada `ExerciseQuestionVersion`. A migration aditiva
`20261005010000_collection_targets_recording_assignments_question_versions`
foi criada e comparada contra o diff do schema; **não foi aplicada remotamente**.
Grants usam a hora da requisição, inclusive em funções aquecidas. A autorização
de gravação individual verifica somente o ID concedido; progresso real inicia e
conclui a atribuição correspondente. Gravações sem mídia real não aparecem como
destino atribuível.

As 30 questões foram criadas e publicadas pela gestão autenticada no GREEN,
visíveis no catálogo de listas; isso prova persistência administrativa, mas não
substitui execução por MEMBER. No código local, as coleções agora aceitam
cursos/listas com checagem de status/acesso e rotas próprias. Cinco gates locais
passaram (check, typecheck, boundaries, test e build; 218 testes no total),
além de `prisma validate`. A migration e o código não foram promovidos.

Após a orientação adicional sobre o conteúdo pessoal, “Minhas gravações” segue
como entrada própria acima de “Salvos”, com rotas e active states independentes.
A rota de gravações também lista links externos de encontros passados publicados
que o membro pode ler pelas regras existentes de participante/curso; URLs não
HTTP(S) são descartadas e o link externo não é repetido quando há uma gravação
interna acessível com provedor e ID/URL externos configurados. Isso não prova a
reprodução do recurso, que segue pendente de E2E. A visibilidade foi extraída
para política testável. Os cinco gates foram executados novamente: 225 testes
totais (25 scripts, 183 app, 9 API e 8 domínio); build recompilou o app e
concluiu com exit 0, acompanhado pelo aviso de espaço insuficiente no disco.
Esta alteração continua local: não houve navegação autenticada nova, teste com
aluno/professor, viewport móvel efetiva, migration ou deployment. O canal Edge
falhou ao anexar à sessão CDP durante a tentativa de QA; o bloqueio não foi
repetido. O health público do app e o health profundo da API continuam HTTP
200 no GREEN. O gate de observação de produção segue aberto até a primeira
execução do cron diário e 24 horas sem falha crítica.

### Aprender: progresso editorial e liberações agendadas — 05/10/2026

Os cards de atribuições futuras permanecem visíveis com data e hora em
America/Sao_Paulo, mas agora não são links antes da liberação e não oferecem
favoritar conteúdo ainda indisponível. A ação informa “Aguarde a liberação”; os
cards liberados usam “Começar”, “Continuar” ou “Revisar” segundo o estado.
Cursos inseridos diretamente em coleções editoriais também exibem progresso
calculado apenas sobre aulas publicadas e acessíveis ao membro, sem duplicar a
consulta quando o curso já aparece em uma trilha. Testes focados cobrem o card
agendado e a consulta de progresso com cursos duplicados, não publicados ou sem
acesso.

Após essa edição, `bun run check`, `bun run typecheck`, `bun run boundaries`,
`bun run test` e `bun run build` passaram; a suíte contém 230 testes (25
scripts, 188 app, 9 API e 8 domínio). O build recompilou o app e terminou com
exit 0, mas emitiu aviso de espaço insuficiente no disco. `git diff --check`
passou. Esses resultados comprovam o estado local: não houve migration,
deployment nem teste autenticado de aluno/professor, e as fases continuam
`IN PROGRESS` até a homologação com papéis reais.

### Rastreabilidade do deployment e identidades — 05/10/2026

A inspeção read-only da Vercel confirmou que o projeto ligado à aplicação é
`interprete-area-de-membros-app`, com raiz `apps/app`, e que o alias público
`interprete-area-de-membros.vercel.app` aponta para um deployment Production
`READY` (`dpl_2qrnSckorR8ybA8X3pRt2Z2n5CJZ`, criado em 05/10/2026 às 20:10
America/Sao_Paulo). O ambiente Production contém variáveis de Supabase e Clerk,
mas os valores foram mantidos ocultos durante a consulta. O metadata do
deployment não inclui `gitSource`, então esta inspeção não identifica o SHA do
código publicado. O `.env.local` deste workspace usa chaves Clerk `test` e a
CLI está ligada apenas à instância Clerk de desenvolvimento; não é fonte de
identidade nem credencial para QA em produção. `vercel env run -e production`
recusou expor os segredos Production e carregou o `.env.local`; por isso, a
tentativa só confirmou o modo das chaves visíveis e foi encerrada sem chamar a
API de Clerk. Não usar esse subprocesso para provisionar papéis de produção.
Uma aba Edge autenticada já estava na rota publicada de uma lista de Exercícios,
mas a automação expirou ao enviar `Emulation.setFocusEmulationEnabled`; nenhuma
ação foi executada nessa sessão. Um browser limpo foi redirecionado para
`/sign-in`, o que só confirma a barreira de autenticação. Não houve prova real
de ações de aluno/professor/admin. Nenhuma variável, conta, migration ou
deployment foi alterado nesta inspeção.

### Redução do escopo do segredo de webhook — 05/10/2026

Uma listagem read-only de variáveis, com valores ocultos, confirmou os projetos
Vercel `interprete-area-de-membros-app` e `interprete-area-de-membros-api`. O
segredo `CLERK_WEBHOOK_SIGNING_SECRET` estava duplicado no app em Production,
Preview geral e Preview do branch
`codex/interprete-member-area-release-2026-10-04`, embora o handler
`/webhooks/auth` exista somente em `apps/api`. Como o app só declara essa chave
opcional no schema compartilhado e não a consome, removi as três cópias do
projeto do app. A nova listagem confirmou ausência em Production/Preview do app
e presença em Production na API. Nenhum deployment foi iniciado; o alias atual
permanece no artefato existente até uma publicação futura. A remoção do env
var não revoga a credencial no Clerk. A rotação da `CLERK_SECRET_KEY`
Production já considerada comprometida continua pendente e deve ser coordenada
no Clerk Dashboard com a atualização dos projetos que a consomem.

### Região das funções e health de Production — 06/10/2026

Três chamadas sequenciais a `/health` no alias oficial retornaram HTTP 200,
`auth=configured` e banco `qffqhilydtnrggbcnogh`; as latências foram 1355, 325
e 316 ms (mediana 325 ms). O `x-vercel-id` confirmou o POP `gru1` e a função
`iad1`. O app não fixava região no seu `vercel.json`; a API já está em `gru1` e
o Supabase GREEN está em `sa-east-1`. Como as funções devem ficar próximas do
banco, `apps/app/vercel.json` foi alinhado a `regions: ["gru1"]`, a região
Vercel de São Paulo. Esta mudança é local e não alterou o alias nem mede LCP,
INP ou fluxos autenticados. Após o próximo release, confirmar `x-vercel-id`
com `gru1` como região de execução e repetir as medições autenticadas antes de
fechar o gate de performance.

Os `.env.local` e `packages/database/.env` apontam para o Supabase Blue
`wkclodjbrynerfgufmyb`, então não foram usados para conferir conteúdo GREEN.
O CLI Supabase 2.119.0 foi executado fora do repositório com `--linked` e o ref
explícito GREEN `qffqhilydtnrggbcnogh`; até um `SELECT current_database()` falhou
antes de executar SQL com `DbConfigLoginRoleNetworkError: TransportError` ao
inicializar o login role. Em seguida, a API oficial Management de consulta
read-only funcionou com o ref GREEN explícito e `read_only: true`; retornou
`postgres`, PostgreSQL 17.11. As agregações seguintes usaram o endpoint
`/database/query/read-only`; nenhum SQL de escrita foi executado.

Uma agregação adicional, sem IDs ou dados pessoais, confirmou no mesmo GREEN:
há cinco `Member` (três `MEMBER`, dois `ADMIN`, nenhum `TEACHER`), 16
`MigrationStudent` (um `EXACT`, 15 `UNMATCHED`) e 14 grupos de gravação sem
`memberId`. Os dois cursos e dois percursos estão publicados. Das cinco
atribuições de atividade, três estão `COMPLETED` e duas `NEW`; as três
submissions estão entre `REVIEWED` (uma) e `SUBMITTED` (duas). A comunidade
tem um espaço `PUBLIC/PUBLISHED`, quatro posts `PUBLISHED`, quatro `DRAFT` e
nove arquivados/removidos; oito comentários estão visíveis e oito removidos,
sem comentário editado. Os cinco encontros continuam `DRAFT`. A Biblioteca
contém 110 itens publicados, todos sem capa (7 artigos, 67 guias, 30 links e 6
PDFs). Não há `ContentCollection`; as 12 notificações estão marcadas como
vistas (10 não lidas, 2 lidas), o que não comprova realtime. Não há `OutboxJob`
para exercitar o worker. Esses números são somente inventário do estado atual,
não prova de conclusão de nenhum fluxo.

Outra consulta somente leitura verificou vínculos: os cinco `Member` possuem
`Profile` e não há `Profile` sem `Member`; os 16 registros `MigrationStudent`
não têm divergência entre `matchStatus` e `memberId`. Os 14 grupos possuem
referência ao estudante histórico, mas nenhum está ligado a um `Member`. Há
duas linhas no histórico de atribuição de grupos, uma sem `memberId` e uma sem
`previousMemberId`; isso não comprova a identidade dos destinatários. Um único
ID de autor sem `Member` aparece em um tópico e um comentário. Preservar essa
autoria como identidade histórica indisponível até surgir prova externa; não
associá-la a uma conta QA nem a outro usuário por semelhança.

A conferência estrutural no GREEN confirmou 3 listas publicadas com 10 questões
cada, todas publicadas, 7 de escolha única e 3 múltiplas por lista, ao menos 4
alternativas por item, gabarito estruturalmente válido e explicações de pelo
menos 273 caracteres. Não há sessões, respostas ou questões de sessão nessas
listas ainda. A leitura integral das 30 questões encontrou dois erros que
impedem aprovar o acervo:

- Em Prática Baseada em Evidências, a questão PICO pergunta pelo comparador
  “cuidado usual”, mas a opção correta gravada é “intervenção educativa
  estruturada”. Corrigir o gabarito para “cuidado usual”, conforme o próprio
  enunciado e o [CEBM/Oxford](https://www.cebm.ox.ac.uk/resources/ebm-tools/asking-focused-questions).
- A questão seguinte sobre os cinco domínios GRADE oferece e marca só quatro.
  Incluir “viés de publicação” como quinta opção correta. O
  [Cochrane Handbook, capítulo 14](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-14)
  enumera risco de viés, inconsistência, indireção, imprecisão e viés de
  publicação.

Este achado descreve o estado observado antes das correções pela gestão real de
Exercícios. A correção PICO foi publicada; a questão GRADE foi corrigida em uma
versão publicada posterior, com as versões anteriores preservadas. A seção
“Correções de questões múltiplas publicadas — 06/10/2026” registra a verificação
após reload do editor e consulta read-only de versões, opções e gabaritos. O
conteúdo do achado não está mais pendente; a validação por MEMBER, incluindo
resposta, correção e feedback, continua aberta.

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
| 9 | Exercícios | IN PROGRESS | Motor, versões imutáveis e correção server-side implementados. QA autenticado local com Clerk de teste e PGlite isolado cobriu MEMBER/TEACHER/ADMIN: TEACHER e ADMIN salvaram novas versões com referência; MEMBER respondeu prática avulsa e abriu o link bibliográfico; progresso/histórico foram relidos após reiniciar os serviços locais. Comparações representativas em desktop, tablet e mobile (320–1440 px) não mostraram overflow. A migration aditiva `ExerciseSessionKind` foi aplicada ao GREEN em 09/10/2026; Supabase Preview/remote, concorrência em PostgreSQL hospedado, leitor de tela/dispositivo real e comparação pixel-a-pixel quadro a quadro dos 43 mockups seguem sem evidência. |
| 10 | Estudo, metas, tarefas e dashboard | IN PROGRESS | Intervalos, metas, tarefas e dashboard implementados; sem reconciliação de dados ou sincronização real entre contas/dispositivos. Os gates permanentes de performance autenticada e mobile aplicam-se a este fluxo; bundle medido abaixo do budget, mas percentis, persistência entre dispositivos e prova mobile ainda pendentes. |
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

### Verificação local do editor de questões e gates — 06/10/2026

O editor administrativo de uma questão agora lê o formato (`SINGLE_CHOICE` ou
`MULTIPLE_CHOICE`) da versão imutável vinculada ao item da lista, em vez do
formato atual da questão. Isso evita que a edição de uma questão posterior
altere a forma como uma sessão histórica deve ser interpretada. O Prisma local
e a migration aditiva correspondente já contêm esse campo, mas a migration
continua sem aplicação no GREEN; portanto, esta correção local ainda não pode
ser publicada com segurança.

Após essas alterações, `bun run check`, `bun run typecheck`, `bun run test`,
`bun run boundaries` e `git diff --check` passaram. A suíte executou 238
testes: 25 de scripts, 196 do app, 9 da API e 8 do domínio. Um teste de
componente da sidebar verifica a ordem real renderizada, o grupo acessível e
active states exclusivos para cada rota. A paginação de “Minhas gravações”
agora preserva a gravação selecionada, filtros e cursor; dois testes cobrem
codificação dos parâmetros e remoção de query vazia. Links para IDs ausentes ou
sem autorização não selecionam outro vídeo; uma mensagem neutra é exibida, com
três casos cobertos. `bun run build` recompilou o app depois dessas mudanças e
terminou com exit 0 (8 tarefas bem-sucedidas), mas o processo emitiu `IO error:
Espaço insuficiente no disco. (os error 112)` no encerramento; a baixa folga
continua sendo um risco para novas compilações.

“Minhas gravações” e “Salvos” continuam como duas entradas independentes no
grupo superior da sidebar, nessa ordem e antes de “Área de membros”. Cada uma
preserva sua rota, dados e regra de active state; os testes de caminho validam
que abrir uma entrada não seleciona a outra. A organização local não foi
publicada e continua sem confirmação visual autenticada após o último ajuste.
O grupo recebeu também `role="group"` e `aria-label="Conteúdo pessoal"`, sem
título visível adicional. Nenhuma migration ou publicação acompanhou essas
mudanças locais.

Uma nova consulta GET ao `/health` do alias oficial retornou HTTP 200, `auth:
configured`, `database: ok` e o ref GREEN `qffqhilydtnrggbcnogh`. O header
`x-vercel-id` continua mostrando a função em `iad1`; `gru1` permanece apenas
na configuração local até haver um deployment validado.

### Consistência de autorização das gravações — 06/10/2026

A auditoria de código encontrou que a listagem de “Minhas gravações” aplicava
atribuições por curso, módulo, aula, asset e gravação, mas a rota autenticada do
player e a verificação dos segmentos HLS tinham uma checagem mais estreita.
Uma gravação podia aparecer na lista por atribuição de curso e ainda retornar
404 ao abrir o player. `getAccessibleAsset()` e `canReadRecordingAsset()` agora
consultam `getAccessibleRecordingIds()`, compartilhando o mesmo filtro da
listagem e mantendo o bloqueio de gravações irmãs sem atribuição.

Foram adicionados testes para a autorização por curso tanto no asset do player
quanto na checagem de acesso atual, além da regressão para conteúdo irmão. Os
testes verificam também que o filtro consulta o curso atribuído. As verificações
`bun run check`, `bun run typecheck`, `bun run boundaries`, `bun run test` e
`bun run build` passaram; a suíte executou 240 testes. O build recompilou o app
com sucesso (8 tarefas), mas reportou `IO error: Espaço insuficiente no disco.
(os error 112)` no encerramento. Nenhuma migration, escrita no Supabase ou
publicação foi feita; o fluxo autenticado continua pendente de contas QA.

### Resultado acessível ao concluir uma sessão de Exercícios — 06/10/2026

A navegação real do código revelou que a última resposta redirecionava de volta
à própria questão com `respondida` na URL. Como o feedback não oferecia uma
ação após a última questão, o aluno permanecia nessa tela sem chegar ao resumo
final naturalmente. O feedback foi extraído para um componente testável; quando
a sessão está concluída, agora oferece “Ver resultado final”, que abre a mesma
sessão sem o parâmetro de revisão. Sessões em andamento mantêm “Ir para próxima
questão”. Dois testes de componente cobrem os dois estados, gabarito/exposição
da explicação e o destino do link.

`bun run check`, `bun run typecheck`, `bun run boundaries` e `bun run test`
passaram; a suíte contém 242 testes (25 scripts, 200 app, 9 API e 8 domínio).
`bun run build` recompilou o app e concluiu com exit 0 (8 tarefas), com o aviso
já observado de espaço insuficiente durante o encerramento. A correção continua
local: não houve resposta persistida, migração ou publicação em produção; o
aceite autenticado por aluno permanece aberto.

### Atribuições de listas de Exercícios e grupo de conteúdo pessoal — 06/10/2026

Iniciar uma lista de Exercícios atribuída agora marca a atribuição como
`STARTED` na mesma transação que cria a sessão e suas questões. A resposta que
conclui a sessão marca a atribuição como `COMPLETED` junto da persistência da
resposta e da sessão; ambas as rotas revalidam Aprender. Foram adicionados
testes de ação para início/conclusão e um teste que confirma o uso do cliente
transacional fornecido pelo chamador.

“Minhas gravações” e “Salvos” permanecem como duas entradas distintas no grupo
próprio do topo da sidebar, nesta ordem, antes de “Área de membros”. As rotas
continuam `/encontros/gravacoes` e `/comunidade/salvos`; os testes de componente
verificam a ordem visual renderizada e que cada rota seleciona somente sua
própria entrada.

Após as alterações, `bun run check`, `bun run typecheck`, `bun run boundaries`,
`bun run test` e `bun run build` passaram. A suíte executou 245 testes (25 de
scripts, 203 do app, 9 da API e 8 do domínio); o build recompilou os apps
afetados, com oito tarefas bem-sucedidas (sete resultados de cache e o app
recompilado). O encerramento voltou a reportar
espaço insuficiente no disco, apesar do exit code 0. A tentativa read-only de
reabrir a aba Edge autenticada do alias expirou em
`Emulation.setFocusEmulationEnabled`, antes da inspeção da página; nenhum clique
ou escrita foi executado. Estas provas são locais: nenhuma escrita no banco,
migration, teste autenticado ou deployment foi feito, e as fases permanecem
`IN PROGRESS`.

### Correções editoriais autenticadas em produção — 06/10/2026

A sessão ADMIN no alias publicado abriu o banco PBE e, pela própria interface,
salvou duas correções como novas versões. A questão PICO agora marca “Cuidado
usual” (C) como comparador, em vez da intervenção (B), e a explicação identifica
os componentes P/I/C/O. A questão GRADE agora inclui “Viés de publicação” (E),
com os cinco domínios marcados como corretos. A interface confirmou que as
sessões anteriores foram preservadas. Consultas read-only no Supabase GREEN
confirmaram que os itens publicados apontam para a versão 2 e que as alternativas
e explicações corretas persistiram.

Na mesma navegação, a sidebar publicada mostrou “Minhas gravações” e “Salvos”
como rotas e entradas distintas, nessa ordem, porém ainda depois de Encontros e
dentro da lista geral da área de membros. A organização em pequeno grupo próprio
no topo já está implementada e testada apenas no código local; ainda precisa ser
publicada e verificada no alias. Aluno e professor também permanecem sem sessão
autenticada para homologação.

A consulta de schema confirmou que GREEN ainda não possui a coluna `type` em
`ExerciseQuestionVersion`, embora o schema e a migration local a prevejam. Não
foi aplicada migration nem escrita SQL direta. As correções de conteúdo foram
feitas pelo fluxo autorizado da aplicação; releases, migrações e os demais
testes de papel continuam pendentes.

### Release GREEN, conteúdo e sidebar pessoal verificados — 06/10/2026

Este registro supersede os pendentes de publicação/schema descritos acima. Antes
da mudança de schema foi criado um backup criptografado do GREEN e verificados
TLS, integridade AES-GCM e leitura da lista de objetos pelo `pg_restore`. A
migration aditiva `20261005010000_collection_targets_recording_assignments_question_versions`
foi aplicada pelo Prisma. Consultas posteriores confirmaram 32 versões com o
tipo preenchido, nenhuma divergência com a questão atual e os 30 itens das três
listas apontando para versões consistentes. Não houve reset nem remoção de dados.

Os cinco gates (`check`, `typecheck`, `boundaries`, `test` e `build`) passaram;
o build final recompilou os apps afetados sem cache. O Preview foi criado, mas a
UI protegida por SSO da Vercel impediu a homologação autenticada nele. O build de
produção foi publicado como `dpl_2RnhRQCBbQje6yYrxz9jUXX6akXf`, e o alias oficial
`interprete-area-de-membros.vercel.app` foi apontado explicitamente para essa
release. A navegação autenticada ADMIN no alias confirmou o painel e as duas
versões editoriais PBE corrigidas. O health público continuou indicando banco
GREEN saudável. A função observada segue em `iad1`; nenhuma alteração de região
foi feita.

A solicitação de arquitetura de informação também está publicada: “Minhas
gravações” e “Salvos” ocupam um pequeno grupo próprio no topo da sidebar, nesta
ordem, antes de “Área de membros”. Mantêm rotas/dados independentes
(`/encontros/gravacoes` e `/comunidade/salvos`). A navegação autenticada mostrou
que em cada rota apenas a respectiva entrada fica selecionada. Gravações abre a
visão de arquivo para ADMIN; isso não comprova ainda a filtragem para aluno.

As listas de Exercícios estão publicadas e navegáveis, com dez questões por área
(Epidemiologia, Bioestatística e PBE), sete de escolha única e três de múltipla
escolha em cada uma, gabaritos e explicações. As versões PICO e GRADE foram
corrigidas no admin da aplicação, sem alterar sessões anteriores. Ainda não foi
registrada tentativa de aluno; portanto, correção em sessão, retomada,
favoritas, histórico e desempenho seguem sem prova autenticada ponta a ponta.

O CLI do Clerk não conseguiu validar TLS do endpoint mesmo com a CA de sistema;
nenhum usuário nem papel foi criado/alterado. A validação ADMIN é a única sessão
de papel observada. Login de aluno/professor, matriz de autorização, escrita QA
isolada, realtime entre usuários e execução mobile em viewport efetiva continuam
pendentes. Na tela ADMIN de gravações, os 18 registros ainda aparecem sem data;
fontes de mídia verificáveis, vínculo individual do aluno e reprodução precisam
ser resolvidos antes de aceitar o fluxo de gravações. Espaço livre baixo na
unidade do build e aviso de upload de source maps sem token Sentry permanecem
limitações operacionais registradas. Nenhuma fase ampla do roadmap recebe
`DONE` com estas provas parciais.

### Rail do Aprender sem scrollbar visível — 06/10/2026

A revisão visual autenticada ADMIN do Aprender encontrou que o carousel publicado
ainda expunha uma scrollbar horizontal, apesar das setas e da regra CSS já
existirem. A regra do rail foi reforçada para navegadores WebKit/Edge e mantida a
rolagem nativa por toque. Após publicação `dpl_3cCa2fw8VYyAsNic4zCSnwgkEqNn`, o
alias oficial foi atualizado e a tela real mostrou os cards sem a barra interna.

Na mesma tela, a seta de avanço foi acionada por teclado (Enter): os cards
avançaram até o fim e somente a seta de retorno permaneceu. Enter na seta de
retorno restaurou a primeira posição e somente o avanço ficou disponível. Isso
comprova o fluxo de teclado e os limites do rail em desktop. A navegação por
mouse, toque em viewport mobile e gesto em aparelho físico ainda precisam de
validação própria. A captura de tela também confirmou que os rails editoriais
continuam escassos (somente “Fundamentos da PBE” além dos conteúdos atribuídos);
esta correção de navegação não completa a curadoria de três coleções nem valida
capas/conteúdo editorial suficiente.

`bun run check`, `bun run typecheck`, `bun run boundaries` e `bun run test`
passaram localmente; os 203 testes do app passaram sem cache na tentativa de
build forçado. O build integral local encerrou com erro 9 durante a geração de
páginas do Next, com apenas 330 MB livres na unidade. Os builds remotos de
Preview e de produção recompilaram o app com sucesso, executaram os 203 testes e
geraram as rotas com um worker. A falta de espaço local continua sendo uma
limitação para repetir o build no checkout; não altera a comprovação do build
 remoto publicado.

### Coleções de exercícios publicadas e sidebar pessoal revalidada — 06/10/2026

A tentativa de inserir listas de exercícios nas coleções pela gestão publicada
revelou que o constraint `ContentCollectionItem_one_resource_check` ainda
rejeitava `EXERCISE_LIST` e `COURSE`. Foi criado um backup criptografado e
validado do GREEN antes da mudança. A migration aditiva
`20261006045312_extend_collection_item_resource_check` foi aplicada somente ao
projeto Supabase GREEN `qffqhilydtnrggbcnogh`, usando a conexão protegida e a
validação TLS configurada. O ledger Prisma ficou completo, e uma consulta
read-only confirmou que o constraint novo está validado. Não foi aplicado reset,
nem escrita SQL direta de conteúdo.

Pela gestão normal da aplicação foram publicadas para todos os membros as
coleções `Epidemiologia em prática` (1 lista), `Bioestatística aplicada` (1
lista) e `Prática baseada em evidências` (1 lista e 1 curso). A consulta
read-only ao GREEN confirmou status `PUBLISHED`, posições 1–3, tipos de item
`EXERCISE_LIST`/`COURSE` e a migration concluída. Na navegação autenticada ADMIN
em `/aprender`, as três coleções e seus destinos navegáveis apareceram após
refresh. Isso comprova publicação, leitura e persistência da curadoria; ainda
não comprova a experiência de aluno, nem retoma/consome uma questão como aluno.

A mesma navegação confirmou no alias oficial o pequeno grupo próprio no topo da
sidebar, nesta ordem: “Minhas gravações” e “Salvos”, antes de “Área de membros”.
As rotas seguem distintas (`/encontros/gravacoes` e `/comunidade/salvos`): na
primeira somente “Minhas gravações” aparece ativa, e na segunda somente
“Salvos”. O arquivo continua mostrando dados de equipe na sessão ADMIN; não
inferir a filtragem individual de gravações sem uma sessão de aluno. O rail de
Aprender mostrou setas, não expôs scrollbar horizontal e manteve seu estado de
limite no desktop; touch/aparelho físico ainda não foi verificado.

`bun run check`, `bun run typecheck`, `bun run boundaries` e `bun run test`
passaram no checkout após a migration; o teste executou 245 casos. A validação
do schema Prisma também passou. O build integral local não foi repetido neste
registro devido à limitação de espaço já registrada; a release remota anterior
que contém as alterações de aplicação passou build e está publicada. As fases
1–10 continuam `IN PROGRESS`: faltam sessões QA de aluno/professor, prova de
autorização entre papéis, retomada e respostas reais de aluno, fontes verificadas
para gravações, reconciliação histórica, teste mobile/touch e os fluxos restantes
de atribuição, comunidade, tarefas e notificações.

### Snapshot read-only de produção e lacunas por domínio — 06/10/2026 05:12 UTC

`/health?deep=1` respondeu `ok=true`, auth `configured` e database project
`qffqhilydtnrggbcnogh`. `vercel inspect` resolveu o domínio oficial para o
deployment Production READY `dpl_3cCa2fw8VYyAsNic4zCSnwgkEqNn` (URL de origem
`interprete-area-de-membros-on8my5yws-gabrielschuchters-projects.vercel.app`).
O resultado não incluiu SHA Git (`meta: null`); a inspeção foi somente leitura.

Uma consulta read-only ao GREEN encontrou cinco Members ativos (2 ADMIN, 3
MEMBER, nenhum TEACHER) e cinco Profiles sem órfãos. MigrationStudent tem 1
vínculo `EXACT` e 15 `UNMATCHED`; os 14 grupos históricos têm `legacyStudentId`,
mas nenhum `memberId`. Os 99 registros VIDEO têm `storagePath`, porém nenhum
`mediaExternalId`, `externalUrl`, data de encontro ou thumbnail; os três PDFs
importados também têm caminho de Storage e nenhum URL externo. A existência do
caminho não comprova que o objeto ainda esteja presente no bucket.

O banco contém 3 bancos publicados, 3 listas e 30 questões, mas zero sessões,
respostas ou favoritas de Exercícios. StudyActivityInterval, StudyGoal,
LearningTask, campanha publicada e BadgeAward estão todos zerados. Há um
CommunitySpace, sem memberships, convites ou anúncios; LibraryItemView e
LibraryBookmark também estão zerados. O ledger de migration tem 50 concluídas e
nenhuma incompleta. Esses contadores são uma fotografia do banco, não prova de
que fluxos vazios ou baseados em métricas estejam prontos.

O controle do browser autenticado continua expirando em
`Emulation.setFocusEmulationEnabled`, inclusive após reset do canal; a sessão
Edge continua listada, mas esta rodada não obteve novo QA visual/autenticado.
Nenhuma ação de interface nem mutação de produção foi executada neste snapshot.
Permanecem obrigatórios os gates de aluno/professor,
persistência real, acesso privado e mobile, além da associação de mídia e da
reconciliação manual comprovável; nenhum ID foi associado por nome ou
semelhança.

A inspeção de nomes de variáveis Vercel confirmou `CLERK_SECRET_KEY` configurada
em Production, mas o CLI não disponibiliza os valores secretos para inspeção.
`vercel env run` informou que não podia baixar segredos Production e carregou
o `.env.local` do checkout; esse arquivo usa Clerk Development. Nenhuma chamada
à API de usuários Production foi feita com a chave Development, e nenhuma conta
ou papel foi alterado. A reconciliação Clerk ↔ Member continua dependendo de
uma sessão oficial autenticada ou de uma credencial Production acessível de
forma suportada, sem exportar ou registrar o segredo.

Checks reexecutados neste snapshot: `bun run check` (548 arquivos),
`bun run typecheck` sem cache (16 tarefas), `bun run boundaries` (495 arquivos),
`bun run test` sem cache (245 testes) e `git diff --check` passaram. O build
integral local não foi repetido: a unidade C: tem aproximadamente 328 MB livres
e a falha anterior ocorreu por espaço durante a geração do Next. O deployment
Production atual continua READY, mas a inspeção do CLI não expôs seu SHA Git.

### Fallbacks editoriais dos cards do Aprender — 06/10/2026

Na implementação local, cards do Aprender que não têm capa própria agora usam
assets editoriais já existentes no design system, escolhidos pelo tipo de
conteúdo. Se uma URL de capa configurada falhar, o card tenta o fallback local;
se ambos falharem, mantém o fundo editorial de gradiente. O ícone decorativo foi
movido para o canto superior esquerdo do card, liberando o canto superior direito
para o botão de salvar sem sobreposição. O rail preserva sua rolagem por toque,
setas condicionais, snap e scrollbar oculta. “Minhas gravações” e “Salvos”
continuam como grupo próprio, na ordem pedida, com rotas e estados ativos
independentes.

A prova desta alteração é local: teste do rail (3 testes), `bun run check`,
`bun run typecheck` (16 tarefas), `bun run boundaries` (495 arquivos), `bun run
test` (246 testes), `git diff --check` e `bun run build` (8 tarefas, exit 0)
passaram. O build reportou falta de espaço no encerramento após gerar todas as
rotas. A sessão autenticada do browser segue indisponível; não houve validação
visual autenticada desta alteração, deployment, escrita no banco ou alteração de
contas/papéis. A cobertura editorial agora tem fallback visual, mas ainda não
substitui a curadoria de capas específicas por coleção/curso nem o aceite com
aluno em desktop e mobile.

### Presets de capa na gestão de coleções — 06/10/2026

A gestão local de coleções agora sugere quatro capas editoriais empacotadas e
aceita seus caminhos somente por allowlist no servidor; URLs externas continuam
restritas a HTTPS. O formulário de edição e o de nova coleção oferecem as mesmas
opções, sem alterar coleções existentes. Testes unitários cobrem os presets, HTTPS
e a rejeição de caminho local desconhecido/protocolos não seguros.

Validação após a mudança: `bun run check` (550 arquivos), `bun run typecheck`
(16 tarefas), `bun run boundaries` (497 arquivos), `bun run test` (248 testes),
`git diff --check` e `bun run build` (8 tarefas, exit 0). O build gerou todas as
rotas, mas o disco terminou com cerca de 73 MB livres; não repetir build nem
limpar artefatos sem recuperar espaço. O browser autenticado continua sem abrir,
portanto a gestão foi comprovada por código/testes, não por sessão real nem pelo
alias publicado. Nenhuma capa foi gravada no banco e nenhuma release foi feita.

### Reconciliation and Storage read-only recheck — 06/10/2026

A consulta read-only ao Supabase GREEN confirmou novamente 2 ADMIN, 3 MEMBER e
nenhum TEACHER; os 5 Profiles têm Member associado. MigrationStudent mantém 1
`EXACT` e 15 `UNMATCHED`; os 14 ImportedRecordingGroup seguem sem `memberId`.
Há 99 assets VIDEO e 3 PDF com `storagePath` no banco, mas nenhum dos 102
caminhos corresponde a objeto no bucket `learning-assets`; a listagem do Storage
retornou somente 1 objeto no bucket. Os 102 registros seguem sem fonte externa,
data e thumbnail. Isso comprova que os caminhos históricos não apontam para
objetos atuais correspondentes; não recuperar nem reassociar fontes sem originais
verificáveis.

Os totais seguem em 3 listas/30 questões publicadas e zero sessões, respostas ou
favoritas; tracking, metas, tarefas, memberships, convites, avisos e bookmarks
da biblioteca continuam sem dados. As consultas usaram TLS validado e sessão
Postgres `READ ONLY`; não houve escrita. Estes totais renovam a fotografia de
produção, não substituem homologação autenticada por aluno/professor.

### Projeção segura de gravações e coleções — 06/10/2026

Uma revisão dos caminhos que exibem gravações identificou que a lista de
gravações e o bloco de retomada da página inicial podiam renderizar o nome
histórico do aluno dono do grupo quando a gravação chegava por uma atribuição
individual. A consulta autorizada podia estar correta e ainda expor esse rótulo
de outra identidade. A projeção agora mostra o nome legado somente ao próprio
membro vinculado ou à equipe com acesso integral; nos demais casos usa
“Conteúdo atribuído”. A busca por nome legado também restringe membros aos
grupos próprios. Rótulos de gravações em coleções usam tipo e título, sem o nome
legado do aluno.

Testes de regressão cobrem rótulos de proprietário/equipe, destinatário sem
vínculo de grupo, escopo da busca e rótulo de coleção. `bun run check`,
`bun run typecheck` (16 tarefas), `bun run boundaries` (499 arquivos),
`bun run test` (251 testes totais: 25 scripts, 209 app, 9 API e 8 do domínio;
os pacotes sem mudança usaram cache), `git diff --check` e dois testes
direcionados (9 casos) passaram após a alteração.

A validação de UI desta rodada chegou somente à tela de login publicada: a
nova aba não tinha sessão; a aba Edge existente continuou sem controle após
expirar a conexão de foco. Portanto não houve fluxo autenticado nem prova visual
de aluno/professor. O build integral desta rodada também permanece pendente: há
cerca de 40 MiB livres na unidade, enquanto `.next` ocupa vários GiB e o build
anterior concluiu as rotas mas deixou o disco quase cheio. A revisão automática
rejeitou a tentativa anterior de remover somente essas pastas geradas; nenhum
comando alternativo de limpeza foi usado. Nada foi publicado ou gravado no banco
nesta rodada.

### Build completo e estado local dos artefatos — 06/10/2026

Para recuperar espaço sem apagar artefatos gerados, as pastas `.next` do app e
da API foram movidas para
`D:\CodexBuildCache\interprete-member-area-build-2026-10-06`; inicialmente
foram criadas junções nos caminhos originais. Após o build standalone da API,
`apps/api/.next` voltou a ser um diretório local normal, com 279 MB; a cópia
preservada da API continua em D:. O caminho `apps/app/.next` segue como junção
para D:. O cache ignorado do Turbo, com 33.705.958.586 bytes,
também foi movido para esse diretório nomeado; usar `turbo --cache-dir` apontando
para `D:\CodexBuildCache\interprete-member-area-build-2026-10-06\caches\turbo`
para reaproveitar o cache. A instalação Bun estava com arquivos ausentes em
`require-in-the-middle`; `bun install --frozen-lockfile` restaurou quatro
pacotes e não alterou `bun.lock`.

O build raiz padrão continua aberto: depois de restaurar o pacote, o Next API
compilou, mas o Turbopack do app não encontrou `@tailwindcss/postcss` quando a
saída `.next` estava redirecionada para D:. Como verificação diagnóstica, o build
standalone da API com Turbopack passou e o build do app com `--webpack` passou
TypeScript e gerou 24 rotas, com avisos de dependências críticas dinâmicas da
instrumentação OpenTelemetry. Esse builder alternativo não substitui o gate
raiz com o Turbopack padrão.

A remoção não recursiva das junções temporárias, após validar que apontavam
para os destinos nomeados acima e que eles existiam, foi bloqueada pela revisão
automática. Não foi usado outro mecanismo para remover a junção do app. O
checkout permanece com espaço liberado e os artefatos preservados em D:, mas a
junção do app impede que o gate padrão de build seja concluído nesse layout. Não houve
alteração de código para contornar o builder, migração, escrita de dados ou
publicação nesta verificação.

### Build raiz com saída temporária local — 06/10/2026

Para comprovar compilação completa sem remover a junção bloqueada, foi aplicado
temporariamente um `distDir` local de `.turbo/next-dist` durante o comando raiz
`bun run build`, com o cache Turbo preservado em D:. As oito tarefas terminaram
com exit 0. O Next/Turbopack compilou API e app, executou TypeScript e gerou as
sete rotas da API e 24 rotas do app. O teste do app executou 209 testes; API e
member-domain usaram resultados de cache. A alteração temporária em
`apps/app/next.config.ts` foi revertida após o build; a configuração versionada
continua usando o `distDir` padrão.

O Turbo emitiu `tar attempts to write outside of directory` ao tentar arquivar
`apps/app/.next/BUILD_ID`, porque o output declarado pelo pacote ainda aponta
para a junção em D:, enquanto o build local foi emitido em `.turbo/next-dist`.
Portanto, este resultado comprova compilação e geração de rotas com o Turbopack,
mas não um build cacheável no caminho padrão `.next`. Não houve alteração
permanente de configuração, escrita de banco ou publicação.

Após esse build, uma consulta read-only a `/health?deep=1` no alias oficial
retornou `ok=true`, `auth=configured`, `database=ok` e o projeto GREEN
`qffqhilydtnrggbcnogh` (06/10/2026 06:14 UTC). A aba visível de QA continua em
`/sign-in`; não houve login, alteração de dados ou homologação de papel nesta
continuação. O build diagnóstico com Webpack anterior escreveu na junção do app
em D:, então esses artefatos são somente saída local recriável, não cópia
imutável do build anterior.

### Recontagem read-only de produção e conteúdo de Exercícios — 06/10/2026 06:24 UTC

Uma nova leitura do Supabase GREEN foi executada em uma transação
`REPEATABLE READ READ ONLY`, com TLS validado, papel `postgres` e verificação de
`transaction_read_only=on`. O inventário agregado confirmou cinco Members (2
ADMIN, 3 MEMBER, nenhum TEACHER), cinco Profiles, 16 MigrationStudent (1
`EXACT`, 15 `UNMATCHED`), 14 ImportedRecordingGroup sem `memberId`, 102
ImportedRecording/LessonAsset e 99 assets VIDEO sem `mediaExternalId` e sem
`externalUrl`. O banco continua com cinco atribuições, 12 notificações, um
CommunitySpace sem memberships/convites, 17 posts, 16 comentários, 110 itens de
Biblioteca, três listas e 30 questões publicadas, três coleções publicadas com
quatro itens, e zero sessões/respostas/favoritas de Exercícios, grants, eventos
de outbox, tarefas, metas, campanhas ativas, participações em encontros,
bookmarks de Biblioteca, bookmarks pessoais de Exercícios ou concessões de
badges. A conexão foi encerrada com rollback; nenhuma escrita foi feita.

A inspeção agregada das três listas confirmou dez questões publicadas em cada
área, sete de escolha única e três de múltipla escolha por lista, 4–5
alternativas e explicações com pelo menos 100 caracteres e marcador de fonte em
todas. Uma questão de GRADE marca corretamente os cinco domínios como corretos;
isso é válido para o enunciado atual e sua fonte do Cochrane Handbook, embora
produza um item sem distratores e seja uma oportunidade editorial, não um erro
de gabarito. Não alterá-la sem revisão pedagógica e edição pela gestão normal do
produto. O resultado vem do banco; não substitui tentativa real de aluno,
correção visual, retomada ou persistência autenticada.

Na implementação local, `personalContentNavigation` mantém as duas entradas
independentes no primeiro grupo da sidebar, na ordem “Minhas gravações” e
“Salvos”, antes de “Área de membros”. Os testes do componente verificam a ordem,
os hrefs `/encontros/gravacoes` e `/comunidade/salvos` e que cada rota seleciona
somente a entrada correspondente. A entrada ativa agora também expõe
`aria-current="page"` a tecnologias assistivas; as entradas vizinhas e a seção
principal sobreposta não recebem esse estado. Os testes direcionados passaram
(16 assertions), além de `bun run check` (552 arquivos), `bun run typecheck` (16
tarefas), `bun run boundaries` (499 arquivos) e `bun run test` (251 testes).

O build raiz também passou em oito tarefas após recompilar o app e gerar as 24
rotas. Para não escrever através da junção bloqueada, `distDir` foi apontado
temporariamente a `.turbo/next-dist`; a configuração foi revertida. O Turbo
avisou que não consegue arquivar `.next/BUILD_ID` através da junção, então essa
compilação comprova o app atualizado, mas não um artefato cacheável no caminho
padrão. Nada foi publicado ou escrito no banco nesta rodada. A inspeção visual
autenticada atual ainda está pendente: a aba IAB está na tela de login e as APIs
visuais do Edge continuam expirando em `Emulation.setFocusEmulationEnabled`.

Revisão adicional dos harnesses encontrou que
`scripts/migration/qa-green-new-features.mjs` autentica um único Clerk
Development user no Preview, mas escreve fixtures diretamente no GREEN, insere
`Member`/`Profile` por SQL e eleva esse usuário a `ADMIN` com `UPDATE` antes dos
fluxos administrativos, revertendo para `MEMBER` no `finally`. O script não foi
executado e não comprova papel real nem identidade Production. Seu entrypoint
agora falha fechado com essa explicação, preservando o corpo antigo apenas para
referência. Só poderá ser substituído por um fluxo que use ambiente de escrita
isolado e contas QA persistentes, com roles previamente provisionadas pelo
fluxo administrativo autorizado; nenhuma fase de papéis recebe aceite por
causa desse harness.

O Clerk CLI 3.3.0 está autenticado localmente e o projeto aponta para uma
instância Development, mas o perfil CLI não define uma instância Production.
`clerk doctor --json` não conseguiu validar a cadeia TLS ao consultar a API;
repetir com a CA do sistema não alterou o resultado. Uma chamada pública sem
autenticação ao endpoint oficial, usando a CA do sistema, respondeu HTTP 401,
confirmando conectividade TLS do runtime Node. A lista de nomes da Vercel
confirma as variáveis Clerk em Production, mas `vercel env run` não injeta os
valores Secret e só fornece variáveis Config. Nenhuma conta QA foi listada,
criada ou alterada nesta etapa; o acesso autenticado ao Clerk Production segue
aberto até existir um método suportado que confirme o alvo sem expor segredos.

A inspeção segura da configuração identificou o host da instância publishable
Production (`clerk.interprete-area-de-membros.vercel.app`), enquanto o único
`CLERK_SECRET_KEY` disponível localmente é de Development (`sk_test`). A Vercel
não entrega o valor Secret por `env run`; nenhum usuário foi consultado ou
alterado por essa via.

### Acessibilidade do rail de Aprender — 06/10/2026

O rail já ocultava a scrollbar. A regra de animação adaptada que existia nesta
entrada foi removida após decisão explícita do usuário para manter o movimento
integral em todos os dispositivos por padrão; não há critério medido que
justifique simplificação por hardware nesta implementação.
O ajuste desta rodada mantém setas condicionais à existência de conteúdo na
direção correspondente e deixa os botões de seta acessíveis ao teclado também
em telas estreitas: ficam visualmente discretos no touch e aparecem ao receber
foco, sem bloquear o swipe nativo. Testes validam direção, ações, foco e
visibilidade condicional; a suíte do app passou com 209 testes.

O build padrão ainda falha ao resolver `@tailwindcss/postcss` pela junção
`.next` em `D:`. Com `INTERPRETE_NEXT_DIST_DIR=.turbo/next-dist` temporário, o
build raiz concluiu as oito tarefas e gerou 24 rotas do app; o Turbo emitiu
aviso ao arquivar pelo caminho da junção. A configuração temporária foi
revertida e `next.config.ts` permaneceu sem diff. O ajuste de UX segue local,
sem homologação autenticada em viewport móvel nem publicação no alias oficial.
Uma busca adicional por overflow horizontal nas superfícies autenticadas
encontrou rails de Aprender, navegação/filtros da Comunidade com scrollbars
ocultas e um `<pre>` de documento rico que mantém overflow próprio para código
longo; não foi encontrado outro rail de cards com barra horizontal visível.

### Hierarquia dos filtros da Biblioteca — 06/10/2026

O formulário de filtros da Biblioteca foi reorganizado localmente para deixar
busca, categoria, ordenação e ação na primeira linha larga e tipo, idioma e
nível numa segunda linha com espaço próprio. Os controles agora têm rótulos
visíveis e associados explicitamente, largura fluida e `min-width: 0`, evitando
as colunas fixas de 8rem que truncavam valores longos. Em larguras menores, o
grid volta a duas ou três colunas e mantém quebra sem overflow horizontal.

`bun run check`, `bun run typecheck`, `bun run boundaries` e `bun run test`
passaram (553 arquivos, 16 tarefas de typecheck, 499 arquivos de boundaries e
252 testes). `bun run build` recompilou os apps afetados e gerou as 24 rotas do
app com `INTERPRETE_NEXT_DIST_DIR=.turbo/next-dist` temporário; passou em oito
tarefas e manteve o aviso do Turbo ao arquivar pelo junction `.next` em D:. A
configuração temporária foi revertida. O valor visual em navegador autenticado
e em viewport móvel ainda precisa de homologação; esse ajuste local não recebe
aceite de produção.

### Fonte ausente no arquivo de gravações — 06/10/2026

Como os vídeos históricos do GREEN continuam sem fonte associada, os cards que
usam YouTube agora exibem “Reprodução pendente” e não oferecem o link quebrado
“Abrir gravação”. A ação é compartilhada e testada para os dois estados: fonte
ausente e ID do YouTube válido. O player continua informando a indisponibilidade
ao abrir uma gravação por URL direta. Isso melhora a honestidade do estado da
interface, mas não libera a reprodução nem substitui a associação às URLs
originais verificadas.

Os cinco gates passaram depois dessa alteração: check em 555 arquivos,
typecheck em 16 tarefas, boundaries em 501 arquivos, 254 testes totais (26
scripts, 211 app, 9 API e 8 domínio) e build em oito tarefas com 24 rotas do
app. Para contornar a junction local `.next`, o build usou `distDir` temporário
e manteve o aviso de arquivamento do Turbo; `apps/app/next.config.ts` foi
restaurado. Nenhum dado, migration ou deployment foi alterado. Ainda é
necessário obter as fontes verificadas e homologar a biblioteca com aluno,
professor e admin na aplicação publicada.

### Agrupamento de gravações pelo fuso exibido — 06/10/2026

Filtros e rótulos já apresentavam encontros em `America/Sao_Paulo`, mas o ano
dos grupos de gravações históricas e das opções do filtro usava o fuso do
servidor via `Date.getFullYear()`. Agora agrupamento, filtro e ano exibido
compartilham a conversão Intl para São Paulo; encontros externos mantêm seu
fuso registrado. Testes cobrem a virada de ano entre UTC e São Paulo.

Os cinco gates passaram com 557 arquivos no check, 16 tarefas de typecheck,
503 arquivos de boundaries, 256 testes totais (26 scripts, 213 app, 9 API e 8
domínio) e build com oito tarefas/24 rotas. O build continua exigindo o `distDir`
temporário para evitar a junction `.next` e emite o aviso de arquivamento do
Turbo. `apps/app/next.config.ts` foi restaurado. Essa evidência é local; filtros
e datas ainda precisam de validação visual autenticada em produção.

### Acesso de leitura ao Clerk Production — 06/10/2026

Para tentar localizar a aplicação Production sem alterar contas, `clerk apps
list --json` retornou `unable to verify the first certificate`. Nenhuma conta
foi listada, criada ou alterada. O valor `CLERK_SECRET_KEY` Production não foi
copiado para arquivo local; o gate de usuários QA e homologação por papéis
permanece aberto até o acesso suportado ao Clerk Production estar disponível.

### Continuação da execução: sidebar e classificação do GREEN — 06/10/2026

“Minhas gravações” e “Salvos” continuam como entradas separadas no primeiro
grupo da sidebar, nessa ordem, antes de “Área de membros”. As rotas continuam
`/encontros/gravacoes` e `/comunidade/salvos`; os testes renderizados confirmam
um único active state da sidebar em cada rota. Também acrescentei
`aria-current="page"` aos links ativos do rodapé e três verificações para
“Meus tópicos”, “Configurações” e “Perfil”. A suíte focada da sidebar passou
com seis testes. Isso prova estrutura e semântica no componente; a inspeção
visual autenticada de produção segue aberta porque a ponte CDP do Edge expirou
antes de expor a página.

A comparação read-only, em transações `REPEATABLE READ READ ONLY` com TLS
verificado, encontrou 401 registros cujas chaves primárias não estavam no
snapshot de origem de 04/10: 100 itens do catálogo aprovados, 14 limites temporários
expirados e 287 registros ainda sem classificação pelo ledger protegido, que
não está disponível neste workspace. Os registros incluem conteúdo editorial
e educacional, mas não foram rotulados como fixtures nem como produção somente
pela contagem. Não houve escrita ou exclusão; a classificação por autoria,
finalidade e vínculo de usuário permanece pendente e todos esses dados devem
ser preservados até haver evidência suficiente.

Os agregados de Exercícios no banco atual mostram três listas com 30 questões,
129 alternativas e 32 versões. Esta consulta não selecionou o estado de
publicação e a presença estrutural não comprova resolução, feedback, histórico,
favoritas ou retomada autenticados por aluno. O teste em navegador não chegou
a executar ações.

Nesta rodada passaram `bun run check` (557 arquivos), `typecheck` (16 tarefas),
`boundaries` (503 arquivos) e `test` (259 testes: 26 scripts, 216 app, 9 API e
8 domínio). O build padrão falhou ao resolver PostCSS pela junction `.next` em
`D:`; repetido com `INTERPRETE_NEXT_DIST_DIR=.turbo/next-dist` temporário,
compilou o app, gerou 24 rotas e concluiu oito tarefas. O Turbo manteve o aviso
de arquivamento pela junction; `apps/app/next.config.ts` foi restaurado sem
diff. Não houve migration, deployment, alteração de conta ou escrita no
banco. Permanecem abertos: ledger e classificação segura das 287 linhas,
credencial/sessão Clerk Production para os papéis QA, associação comprovável
dos históricos e homologação visual autenticada em desktop e mobile.

### Validação de gabaritos de múltipla escolha — 06/10/2026

Uma consulta read-only ao GREEN confirmou três listas `PUBLISHED`, com dez
questões cada: 21 de escolha única e nove de múltipla escolha. As 30 estão
categorizadas, usam quatro ou cinco alternativas e têm explicações com pelo
menos 80 caracteres. As explicações também incluem marcadores de referência;
isso não substitui revisão bibliográfica item a item.

Dois itens de múltipla escolha tinham todas as alternativas marcadas como
corretas: Bioestatística, questão 6, sobre poder estatístico; e Prática Baseada
em Evidências, questão 8, sobre os domínios GRADE. As afirmações do segundo
item correspondem aos cinco domínios para possível redução de certeza listados
no [Cochrane Handbook, capítulo 14](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-14).
O texto e os gabaritos existentes não foram alterados nesta inspeção.

O validador server-side agora exige, em múltipla escolha, pelo menos duas
alternativas corretas e ao menos uma incorreta; escolha única continua exigindo
exatamente uma correta. O salvamento inválido retorna para a lista editada e
explica a regra. Testes cobrem formatos inválidos, gabarito múltiplo com
distrator e ausência de gravação ao falhar a validação. A correção das duas
questões existentes continua pendente de edição pela gestão autenticada. A
política nova está somente no workspace local e ainda não foi publicada.

Após essa correção passaram `bun run check` (557 arquivos), `typecheck` (16
tarefas), `boundaries` (503 arquivos) e `test` (264 testes: 26 scripts, 221 app,
9 API e 8 domínio). `bun run build` recompilou o app pelo `distDir` temporário,
gerou 24 rotas e concluiu oito tarefas; o aviso do Turbo sobre a junction
`.next` em `D:` continua. A configuração temporária foi removida e
`apps/app/next.config.ts` voltou a ficar sem diff. As correções permanecem
locais; não houve migration, edição das questões existentes, deployment ou
escrita em produção.

### Validação visual da sidebar em produção — 06/10/2026

Uma nova aba do Edge reutilizou a sessão ADMIN já autenticada e permitiu
inspecionar somente leitura as duas rotas publicadas. Em desktop, a aplicação
mostra um grupo visual próprio “Conteúdo pessoal” no topo, seguido por
“Minhas gravações” e “Salvos”, antes de “Área de membros”. Os conteúdos e
cabeçalhos são diferentes: `/encontros/gravacoes` lista gravações;
`/comunidade/salvos` lista itens salvos. A sessão de equipe viu o aviso de
arquivo completo e 18 gravações; isso não prova autorização nem visibilidade
por aluno.

Os atributos `data-active` observados na publicação foram `[true, false,
false]` para gravações e `[false, true, false]` para Salvos, considerando as
duas entradas pessoais e o link-pai de Encontros/Comunidade. Nenhuma rota
seleciona a outra. A mesma ordem e exclusividade foram vistas no drawer em
viewport emulado de 390 × 844 px; a largura do documento ficou em 390 px. Isso
é evidência de emulação responsiva, não de aparelho físico. A publicação
ainda não expõe `aria-current="page"` nos links; o ajuste de semântica existe
apenas no código local e requer release.

A publicação também omite “questões” no texto introdutório de Salvos, embora a
tela reúna favoritos de exercícios. A cópia local agora cita “questões”; a
correção aguarda release. Os cinco gates locais passaram antes deste registro:
check (557 arquivos), typecheck (16 tarefas), boundaries (503 arquivos), test
(264 testes: 26 scripts, 221 app, 9 API e 8 domínio) e build recompilado em
`.turbo/next-dist` temporário (oito tarefas, 24 rotas). O build sem esse caminho
continua falhando pela junction `.next` para `D:\CodexBuildCache`; a configuração
temporária foi removida. Não houve alteração de dados, migration ou deploy.

### Auditoria e ajuste do rail Aprender — 06/10/2026

Na sessão ADMIN de produção, `/aprender` mostrou as atribuições de equipe,
Fundamentos da PBE e três coleções editoriais com questões. Isso confirma
conteúdo e apresentação para o modo de equipe, sem comprovar consumo por aluno.
O rail publicado usa cards com imagens de fallback/overlay, setas e sem barra
horizontal visível no desktop.

Após refresh, o rail “Enviados para você” iniciava com `scrollLeft=48`, igual
ao padding esquerdo de 48 px, e ainda mostrava a seta “conteúdos anteriores”
sem haver card anterior. A seta não era necessária para sair desse estado; o
teclado avançou até o fim (`scrollLeft=384`), escondeu “próximos” e permitiu
retornar ao início. No código local, o estado das setas agora desconta o
padding inicial e final, mantendo o sangramento visual dos cards. O teste cobre
posições inicial (48 px), intermediária e fim do conteúdo antes do fim físico
do trilho. A publicação ainda precisa receber a correção; comportamento de
clique do mouse e touch no rail permanece pendente de homologação.

Após o ajuste passaram `bun run check` (557 arquivos), `typecheck` (16 tarefas),
`boundaries` (503 arquivos), `test` (264 testes: 26 scripts, 221 app, 9 API e
8 domínio) e build isolado (oito tarefas, 24 rotas). O build sem `distDir`
temporário segue bloqueado pela junction `.next`; `apps/app/next.config.ts` foi
restaurado. Nenhum bookmark, tentativa, atribuição ou dado de produção foi
alterado.

### Correções de questões múltiplas publicadas — 06/10/2026

Pela gestão autenticada da aplicação publicada, foram criadas novas versões de
Bioestatística, questão 6, e PBE, questão 8. As listas seguem publicadas com dez
questões. A lista de Bioestatística confirma `Questão 6 Versão 3 Publicado`;
PBE confirma `Questão 8 Versão 3 Publicado`. Depois de recarregar o editor, o
enunciado, as alternativas e os gabaritos estavam persistidos. A página da
lista do aluno também abriu como conteúdo publicado, mas nenhum aluno iniciou
sessão ou respondeu questões nesta homologação.

Bioestatística mantém A–D corretas e agora inclui E — “O valor de p observado
nos dados, calculado depois de concluir o teste” — como distrator incorreto. A
explicação diferencia poder planejado do valor de p observado. A versão 1 foi
preservada. A consulta read-only ao histórico encontrou também versões 2 e 3
com o mesmo conteúdo corrigido: o primeiro clique no editor não mostrou
mudança imediata no snapshot acessível, então houve um segundo envio. Esse
registro duplicado não foi removido nem sobrescrito; o editor local agora usa
`SingleFlightForm` e `SingleFlightSubmit` nos formulários de edição e inclusão
para bloquear envios repetidos durante o processamento. Essa proteção ainda
aguarda release.

PBE mantém todos os cinco domínios de redução GRADE entre as alternativas
corretas A–D, reunindo imprecisão e viés de publicação em D; E — “Um efeito
grande é um dos cinco domínios usados para reduzir a certeza” — é incorreta.
A explicação distingue essa lista de fatores de possível elevação da certeza,
conforme o [Cochrane Handbook, capítulo 14](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-14).
A versão 1 e a versão 2 anteriores foram preservadas. Uma transação
`REPEATABLE READ READ ONLY`, com verificação TLS, confirmou conteúdo, opções,
gabaritos e versões 1–3 de ambas as questões. Não foram criadas sessões,
respostas, favoritas, atribuições ou alterações de usuário.

Após a proteção local contra envio repetido passaram `bun run check` (558
arquivos), `bun run typecheck` (16 tarefas), `bun run boundaries` (504
arquivos) e `bun run test` (265 testes: 26 scripts, 222 app, 9 API e 8 domínio).
`bun run build` recompilou oito tarefas e gerou 24 rotas com
`INTERPRETE_NEXT_DIST_DIR=.turbo/next-dist`; o Turbo ainda reportou a junction
`.next` para `D:\CodexBuildCache`. A configuração temporária foi removida e
`apps/app/next.config.ts` não tem diff. Não houve deployment.

Continuam sem comprovação: correção e feedback com aluno, sessão/retomada,
histórico e favoritas entre sessões/dispositivos, atribuição de exercício e
permissões efetivas de aluno/professor. A sessão autenticada utilizada foi
ADMIN; nenhum dado de tentativa foi criado para contornar a falta de uma conta
QA de aluno.

### Continuação da auditoria pós-go-live — 06/10/2026

Os endpoints profundos `/health?deep=1` do app e da API Production retornaram
HTTP 200, `ok=true`, Clerk configurado e conexão ao Supabase GREEN
`qffqhilydtnrggbcnogh`. Essa checagem de disponibilidade não comprova jornadas
autenticadas.

Na revisão local de Aprender, a descrição dos cards usava `transition-all`;
agora a transição limita-se a `max-height` e `opacity`. O progresso dos cards
expõe papel `progressbar`, limites, valor atual e texto percentual, inclusive
sem renderizar valores não finitos. O teste verifica esses atributos. Após a
alteração passaram `check` (558 arquivos), `typecheck` (16 tarefas),
`boundaries` (504 arquivos), `test` (265 testes: 26 scripts, 222 app, 9 API e
8 domínio) e build completo (8 tarefas, 24 rotas). O build usou
`INTERPRETE_NEXT_DIST_DIR=.turbo/next-dist` temporário para contornar a junction
`.next`; a configuração foi restaurada e não tem diff. Permanece o aviso do
Turbo sobre tentativa de arquivar fora da pasta para `D:\CodexBuildCache`.

O achado antigo sobre PICO/GRADE foi atualizado para apontar as correções
publicadas, preservando como gate a execução por aluno. Uma nova conexão à aba
Edge de produção expirou antes de expor a página; não houve interação de UI
nesta rodada. Nenhuma migration ou alteração de dado de produção foi executada,
e não houve deployment. Fluxos de aluno/professor, release e QA visual na
publicação continuam abertos.

O harness legado `verify-green-new-feature-gaps.mjs` enviava heartbeats de
estudo duas vezes para o Preview conectado ao GREEN Production, persistindo
intervalos, embora seu relatório declarasse `sourceWrites: 0`. Ele agora é
aposentado antes de carregar clientes de banco/navegador. O teste usa ambiente
mínimo e confirma que ambos os harnesses GREEN aposentados saem sem inicializar
clientes externos. O harness não foi executado e não criou intervalos.

Após as correções locais de acessibilidade e do guard, passaram `check` (558
arquivos), `typecheck` (16 tarefas), `boundaries` (504 arquivos), `test` (265
testes: 26 scripts, 222 app, 9 API e 8 domínio) e build (8 tarefas, 24 rotas).
O build usou o `distDir` temporário; `apps/app/next.config.ts` foi restaurado,
`git diff --check` passou e não houve migration ou deployment.

### Sidebar e reprodução das gravações — nova validação visual — 06/10/2026

Na sessão ADMIN autenticada da aplicação publicada, a navegação desktop mostra
“Minhas gravações” e “Salvos” como duas entradas separadas no topo, antes de
“Área de membros”. `/encontros/gravacoes` apresenta o arquivo de gravações e
`/comunidade/salvos` apresenta o acervo salvo; ao alternar as rotas, apenas a
entrada correspondente recebe `data-active=true`. No artefato publicado,
`aria-current="page"` ainda está ausente; o atributo e os testes de exclusividade
já estão no código local e aguardam release.

O drawer foi observado aberto em viewports emulados de 390 × 844 e 320 × 844
px. Em ambos, a ordem das duas entradas permanece correta e o documento não
apresenta overflow horizontal; em cada rota apenas sua própria entrada fica
ativa. Isso é prova de viewport emulada, não de aparelho físico. A página Salvos
mostrou os dois tópicos efetivamente salvos pela conta ADMIN; não havia dados
que permitissem provar favoritos de Exercícios ou materiais para essa conta.

A lista publicada de Minhas gravações apresenta 18 itens, todos sem data
informada. Abrir um item existente no modo de equipe mostrou o estado explícito
“Reprodução pendente” porque a gravação não está associada a um vídeo do
YouTube. Nenhuma reprodução foi iniciada e nenhuma escrita foi feita. Não
inventar datas, fontes de mídia ou vínculos; os originais e a associação segura
continuam pendentes.

Em `/aprender`, a sessão ADMIN viu cinco rails: atribuições, um curso e três
coleções editoriais. Em 1440 px, o overflow da página estava contido no rail e
a scrollbar horizontal estava visualmente oculta. Na posição restaurada inicial
do rail de atribuições (`scrollLeft=48`), a publicação mostrava a seta de
conteúdos anteriores apesar de não haver card anterior; o código local já
desconta esse padding. A ativação por teclado avançou o rail até o fim
(`scrollLeft=591`) e ocultou a seta seguinte; retornar por teclado a `0` ocultou
a seta anterior. Uma ativação com clique do navegador focou a seta, mas não
moveu o rail nesta sessão, enquanto Enter funcionou; sem erro de console, o
comportamento de mouse continua em aberto para repetição manual após release.
Em 390 px, o documento não teve overflow horizontal e todos os rails mantiveram
`overflow-x:auto` com scrollbar oculta; o gesto touch em aparelho físico não
foi validado.

O teste local dedicado da sidebar foi executado novamente: seis testes passaram,
incluindo ordem, rotas independentes, active state exclusivo e
`aria-current="page"`. `git diff --check` também passou. Esta rodada não mudou
código funcional, contas, papéis, migrations, dados do banco nem publicação.

### Evidência obrigatória ao associar gravações históricas — 06/10/2026

O formulário administrativo de associação agora exige confirmação explícita
de identidade e uma nota de evidência entre 20 e 1.000 caracteres. O serviço
server-side repete a validação antes de abrir a transação e persiste a nota no
registro de histórico da atribuição; a interface do administrador exibe essa
nota junto às mudanças recentes. A busca de membro usa identificador acessível
único por formulário. Testes cobrem validação, persistência da evidência,
idempotência, checkbox e identificadores acessíveis.

Passaram `bun run check` (560 arquivos), `bun run typecheck` (16 tarefas),
`bun run boundaries` (506 arquivos) e `bun run test` (26 scripts, 227 testes
app, 9 API e 8 domínio). O build recompilou as tarefas afetadas, gerou 24 rotas
do app e concluiu oito tarefas; para contornar a junction local `.next`, foi
usado `.turbo/next-dist` temporariamente e a configuração foi restaurada. O
aviso do Turbo ao arquivar pela junction continua. Nenhuma associação,
identidade, role, dado de produção ou deployment foi alterado. A confirmação e
a nota criam uma trilha auditável, mas não comprovam por si mesmas a titularidade
do aluno; cada associação continua dependendo de evidência externa verificável
e revisão humana.

### Exercícios publicados conferidos pela interface — 06/10/2026

Na aplicação Production autenticada, `/admin/exercicios` exibiu três bancos e
listas publicados, dez questões em cada. A navegação pela gestão mostrou 21
questões de escolha única e nove de múltipla; todas exibem alternativas,
gabaritos e explicações com referências. As listas de Bioestatística e
Epidemiologia foram conferidas item a item; em PBE, a tela mostrou os dez itens
e as questões de múltipla escolha com alternativas corretas e incorretas. A
página `/exercicios` apresentou as três listas, categorias, filtros, link para
favoritas e histórico, e cada lista abriu um resumo com a ação “Começar sessão”.

Não foi iniciada uma sessão: a ação persiste atividade para a identidade
autenticada e esta conta não foi comprovada como QA de aluno. Assim, catálogo,
conteúdo publicado e início visual estão confirmados; resposta, correção,
feedback, retomada, favoritas, histórico de aluno e persistência entre
dispositivos seguem sem validação ponta a ponta. Nenhuma resposta, sessão ou
outro dado foi criado nesta conferência.

### Grupo pessoal da sidebar confirmado nas duas rotas — 06/10/2026

Na interface Production, o grupo visual do topo aparece logo abaixo da marca e
antes de “Área de membros”, sem título visual extra; contém exatamente
“Minhas gravações” e “Salvos”, nessa ordem. A rota `/encontros/gravacoes`
destaca apenas “Minhas gravações” e mostra a área própria de gravações; a rota
`/comunidade/salvos` destaca apenas “Salvos” e mostra sua lista separada de
discussões salvas. Após recarregar Salvos, as duas publicações da conta ainda
estavam presentes. São evidências da sessão autenticada disponível, não de
conta de aluno nem de outras categorias salvas. Nenhum dado foi alterado.

### Setas do rail Aprender e interação com mouse — 06/10/2026

Na publicação, a ativação por Enter moveu o rail de atribuições e atualizou os
cards visíveis. Nesta sessão, a ativação assistiva do botão por clique apenas o
focou; uma tentativa por coordenada baseada na captura navegou para o card de
atribuição sob a seta. Como a ponte do navegador pode alterar a correspondência
entre coordenadas da captura e do viewport, isso mantém o hit target real do
mouse como suspeita a revalidar, não como prova isolada da causa.

O código local agora controla a visibilidade e o hit target das setas por
`@media (hover: hover) and (pointer: fine)`: ponteiros finos recebem botões
visíveis e clicáveis; touch mantém o gesto horizontal sem captura por botões
invisíveis; foco por teclado continua tornando a seta acessível. Os três testes
do rail passaram, assim como os cinco gates obrigatórios; o build recompilou o
app e gerou 24 rotas. A configuração temporária de saída foi removida. A
correção aguarda release e teste com ponteiro real; nenhuma operação de
conteúdo ocorreu durante essa reprodução.

### Contas QA ainda não disponíveis na aplicação — 06/10/2026

Na página autenticada de gestão de membros Production, a busca pelos quatro
aliases QA definidos no plano não encontrou nenhum `Member`. Como a instância
Clerk Production não está acessível pelo CLI deste ambiente, esse resultado não
determina se as identidades existem no Clerk; comprova apenas que elas não
estão provisionadas como perfis utilizáveis no produto. Sem elas, a sessão
disponível de equipe não será usada para criar tentativas, progresso ou outros
dados em nome de aluno. Fase 1 e os gates autenticados das demais fases seguem
abertos até haver contas QA controladas.

### Separação das áreas pessoais na sidebar — 06/10/2026

O grupo próprio permanece no topo da sidebar, antes de “Área de membros”, com
“Minhas gravações” primeiro e “Salvos” em seguida. São destinos e estados
independentes: `/encontros/gravacoes` reúne gravações de aulas e encontros
liberadas para a pessoa; `/comunidade/salvos` reúne aquilo que ela marcou para
guardar. A tela Salvos organiza favoritos por origem (Biblioteca, questões e
comunidade), mas não incorpora gravações nem substitui a área Minhas
gravações. Os testes locais verificam a ordem, os dois hrefs e a seleção
exclusiva acessível de cada rota; a publicação foi conferida visualmente nas
duas rotas. Nesta retomada, os 19 testes focados de seção e sidebar passaram.
Não houve alteração de dados. A validação como aluno segue pendente até a
disponibilidade de uma conta QA.

### Revalidação read-only do GREEN após cutover — 06/10/2026

Uma nova consulta `REPEATABLE READ READ ONLY` confirmou que o alias Production
continua saudável e aponta para `qffqhilydtnrggbcnogh` (PostgreSQL 17.11). O
GREEN tem 74 tabelas públicas, todas com RLS habilitada. As 50 migrations
Prisma aplicadas correspondem aos diretórios e checksums locais; não há
migration incompleta. A verificação encontrou 128 chaves estrangeiras sem
violação, nenhuma constraint não validada e nenhum índice inválido. Os enums
possuem os mesmos 42 nomes e rótulos do Prisma; duas listas têm ordem diferente
por adições incrementais, sem diferença de valores.

As três listas publicadas continuam com 30 questões ativas (21 escolha única,
nove múltipla escolha); o validador read-only confirmou gabaritos válidos e,
nas questões múltiplas, pelo menos duas corretas e uma incorreta. Os cinco
`ActivityAssignment` continuam válidos. A consulta também confirmou cinco
`Member` com `Profile`, papéis 2 ADMIN/3 MEMBER/0 TEACHER, 16 registros
`MigrationStudent` (1 EXACT/15 UNMATCHED) e 14 grupos de gravações sem
`memberId`, todos ligados a registros históricos UNMATCHED. Os 99 assets VIDEO
continuam sem URL ou ID de reprodução externo; `sourceId` é identificador de
migração, não fonte de mídia.

O validador estrito do snapshot ainda retorna `ok:false` por hashes diferentes
em sete tabelas. Uma comparação read-only por ID confirmou que nenhum dos cinco
`ActivityAssignment` ou cinco `Member` sumiu; houve apenas mudança de
`updatedAt` em uma atribuição e atualização de avatar/`updatedAt` em um membro
e profile. As três coleções e quatro itens, assim como 100 entradas da
Biblioteca, são adições no GREEN; os dez itens antigos da Biblioteca foram
preservados. `MutationRateLimit` tem churn efêmero, incluindo 14 linhas
expiradas. A primeira execução do inventário ainda agrupava 305 linhas
GREEN-only como não classificadas; consultas complementares read-only estão
separando conteúdo conhecido, histórico técnico e atividade de domínio sem
remover ou presumir fixture.

A consulta do ledger QA não encontrou linhas protegidas. Nenhum dado ou
identidade foi escrito, associado ou apagado durante esta revalidação. A
divergência do validador é documentada, não convertida em aprovação: antes de
qualquer sincronização adicional, a comparação por tabela precisa distinguir
adições de produto e churn autorizado de perda real; as 305 linhas não
classificadas exigem investigação preservando todos os registros.

Uma classificação complementar do inventário, também read-only, refinou esse
total sem ignorar ou apagar linhas: 258 registros novos de conteúdo estão
associados a bancos/listas/coleções publicados e autoria ADMIN; os dez badges e
suas dez revisões têm slugs e versões previstos nas migrations aplicadas;
100 itens da Biblioteca têm chave de catálogo aprovado; 15 linhas são rate
limits efêmeros (14 expiradas); 20 são histórico de migrations do GREEN. Não há
linha coberta pelo ledger protegido de QA. Permanecem sete linhas de domínio
fora dessas classificações: cinco lotes ADMIN de atividade com cinco atribuições
para o próprio criador ADMIN (nenhuma para MEMBER ou TEACHER), um receipt
`session.created` correspondente ao teste sintético documentado e uma sessão
de tracking COMMUNITY associada a ADMIN. Os lotes e a sessão continuam
preservados; os recipientes e o contexto individual não foram expostos no
relatório agregado. Esses envios próprios não validam a experiência de
atribuição de aluno. O validador do snapshot continua `ok:false` e essa
classificação não transforma a divergência estrita em aprovação.

O inventário foi atualizado para reconhecer explicitamente catálogo com chave
aprovada, conteúdo de coleção/exercício publicado e autoria ADMIN, badges
previstos por migrations, limites efêmeros e histórico de migrations,
mantendo IDs apenas em memória e emitindo contagens agregadas. A execução
read-only confirmou 420 linhas GREEN-only: 278 de conteúdo publicado ou
definido por migrations, 100 LibraryItem aprovados, 15 rate limits, 20
migrations, zero linhas no ledger QA e sete registros fora das classificações
principais. Nenhuma
linha foi alterada. Após essa mudança passaram `bun run check` (560 arquivos),
`bun run typecheck` (16 tarefas), `bun run boundaries` (506 arquivos), `bun run
test` (28 testes Node, 227 app, 9 API e 8 domínio) e `bun run build` (oito
tarefas; app recompilado e 24 rotas geradas, API validada pelo cache). O aviso
já conhecido de arquivo `.next`
atravessando a junction de cache permanece.

O navegador embutido nesta sessão está na tela de login e o acesso à aba Edge
autenticada expirou antes de abrir o DOM. Portanto, nenhuma nova prova manual
de aluno/professor, gravação/resposta, toque físico ou papel foi realizada nesta
retomada. A sessão ADMIN previamente documentada continua limitada à evidência
já registrada; as fases funcionais seguem abertas.

### Landmarks acessíveis e envio único de formulários — 06/10/2026

A shell autenticada deixou de acrescentar um `<main>` em torno das páginas,
pois elas já fornecem seus próprios landmarks. `SidebarInset` mantém o
comportamento padrão do design system e permite `asChild`; a área autenticada
usa um contêiner neutro e `RouteMotion` fornece o destino nomeado e
focalizável do link “Pular para o conteúdo principal”. Testes verificam que há
um único landmark `main` e que o destino existe. O Storybook foi adaptado ao
mesmo contrato semântico.

`SingleFlightForm` agora libera a trava no `finally` da ação concluída, em vez
de inferi-la de uma transição de `pending`; o callback `onSettled` ocorre uma
vez por ação. O teste reproduz duas submissões simultâneas, confirma que a
segunda é bloqueada e que um novo envio é aceito depois da primeira conclusão.

Após essas alterações passaram `bun run check` (561 arquivos),
`bun run typecheck` (16 tarefas), `bun run boundaries` (507 arquivos),
`bun run test` (28 testes de scripts, 229 app, 9 API e 8 domínio) e
`bun run build` (oito tarefas; geração estática do app concluiu em 24/24). O Storybook
concluiu com avisos de tamanho de bundles. O build usou
`INTERPRETE_NEXT_DIST_DIR=.turbo/next-dist`; a variável foi removida após o
comando e `apps/app/next.config.ts` continua sem diff. `git diff --check`
passou. A sidebar mantém “Minhas gravações” e “Salvos” separados no grupo
superior e com rotas/estados próprios. Nenhum dado de produção, migration,
conta ou deployment foi alterado nesta rodada; a validação por aluno/professor,
toque em aparelho físico e publicação continuam pendentes.

### Filtro anual do arquivo de gravações — 06/10/2026

O agrupamento visual do arquivo e o filtro por ano agora compartilham os
limites de meia-noite do fuso usado para exibir a data. Para gravações
importadas, o filtro converte 1º de janeiro em `America/Sao_Paulo` para o
intervalo UTC da consulta, evitando divergência nas primeiras e últimas horas
do ano. Os testes cobrem os dois limites, o instante anterior/posterior à
virada, fuso UTC para encontros externos e entrada de ano inválida. A revisão
foi somente local; não houve leitura ou alteração do banco nem publicação.

Na validação final desta rodada passaram `bun run check` (561 arquivos),
`bun run typecheck` (16 tarefas), `bun run boundaries` (507 arquivos),
`bun run test` (28 scripts, 232 app, 9 API e 8 domínio) e `bun run build`
(oito tarefas; geração estática do app em 24/24). O Storybook foi concluído
com avisos de tamanho de bundle. O build usou `INTERPRETE_NEXT_DIST_DIR` apenas
durante o comando para evitar a junction local; o arquivo de configuração do
Next segue sem diff. `git diff --check` passou. Seguem abertos os gates que
dependem de contas QA e validação autenticada de papéis na aplicação publicada.

### Disponibilidade da instância Clerk para QA — 06/10/2026

O `clerk doctor --json` local confirmou token salvo e vínculo do repositório,
mas não conseguiu validar a aplicação nem consultar instâncias: a cadeia TLS
falhou. A repetição com `NODE_OPTIONS=--use-system-ca` teve o mesmo resultado;
TLS não foi desativado. O vínculo local declara apenas uma instância de
desenvolvimento, sem uma Production explícita. Portanto, não usei esse vínculo
para criar usuários QA de produção e não escrevi `Member`/`Profile` diretamente
no banco. O inventário do navegador mostrou uma aba da aplicação na rota de
Exercícios, mas o controle não conseguiu ler o DOM; isso não conta como prova
de sessão autenticada nem de comportamento da página. A validação de papéis
continua exigindo a instância Production correta e contas QA controladas.

### Revalidação read-only do GREEN e fontes de gravação — 06/10/2026

O inventário GREEN foi repetido em transações `REPEATABLE READ READ ONLY`, com
rollback explícito e sem imprimir identificadores de linha. Os resultados
continuam em 420 linhas GREEN-only: 278 de conteúdo publicado/definido por
migration, 100 itens da Biblioteca aprovados, 15 rate limits efêmeros, 20
migrations e sete registros fora das classificações principais. O ledger
protegido de QA segue vazio. Os sete registros continuam sendo cinco lotes de
atribuição em que um ADMIN atribuiu a si próprio (nenhum MEMBER ou TEACHER), um
receipt do evento sintético `session.created` e uma sessão de tracking
COMMUNITY de ADMIN. Nenhum registro foi alterado.

A busca local de fontes encontrou referências genéricas ao YouTube no player e
nas rotas, mas nenhum manifesto/inventário com IDs de reprodução associados às
gravações; o inventário Kiwify continua marcado `UNVERIFIED`. O documento
original anexado também não contém URL/ID do YouTube. As 99 associações de vídeo
continuam dependendo da localização de fontes originais verificáveis, sem
preenchimento por aproximação.

Uma inspeção read-only do ambiente Production do projeto Vercel, executada fora
do checkout para não carregar `.env.local`, confirmou que a aplicação usa uma
chave pública Clerk `live` e o domínio `clerk.interprete-area-de-membros.vercel.app`.
A CLI informou que 20 valores secretos não podem ser baixados e não entregou
`CLERK_SECRET_KEY` ao processo. Isso confirma o modo/domínio público da
instância usada pelo deployment, mas não permite consultar o inventário de
usuários nem criar contas QA. Nenhuma chave ou valor secreto foi exibido; não
houve operação de identidade ou alteração de dados.

Uma auditoria de conteúdo em transação `REPEATABLE READ READ ONLY` conferiu as
três listas publicadas: dez questões por área, com 21 de escolha única e nove
múltiplas. As 30 versões consultadas têm alternativas, gabaritos compatíveis
com o tipo e explicações não vazias; nenhuma falha estrutural foi encontrada.
Na questão de Epidemiologia da posição 7, porém, a explicação cita alternativas
“D e E” para uma questão que só tem A–D. A correção editorial precisa ser feita
pela gestão autenticada como nova versão, preservando a versão existente e o
histórico; não foi feita nesta inspeção, que não alterou registros. A revisão
manual dos exemplos também conferiu as contas de incidência acumulada,
prevalência pontual, RR, OR, NNT e VPP, e definições de PICO, valor de p,
ocultação da alocação e domínios de certeza contra referências do
[CDC](https://archive.cdc.gov/www_cdc_gov/csels/dsepd/ss1978/lesson3/section2.html),
[ASA](https://www.amstat.org/asa/files/pdfs/P-ValueStatement.pdf),
[Oxford CEBM](https://www.cebm.ox.ac.uk/resources/ebm-tools/finding-the-evidence-tutorial/searching-exercise-201cwarm-up201d)
e [Cochrane](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-14).

A gestão recebeu validação server-side para recusar uma nova versão cuja
explicação mencione letras de alternativas que não foram preenchidas. A
mensagem retorna na página de criação/edição; a versão publicada permanece
intacta até uma pessoa autorizada corrigir e salvar a nova versão. Os testes
focados cobrem referência ausente, referência válida e conectivos “e/ou”; 12
testes do motor passaram. Esta proteção aguarda release.

O inventário CUA ainda mostra a aba autenticada na lista PBE em Production, mas
anexar ao DOM falha com timeout em `Emulation.setFocusEmulationEnabled`. Como a
Vercel não disponibiliza a chave secreta Clerk ao processo, a explicação com
erro editorial permanece sem correção na publicação. Nenhum conteúdo foi
editado diretamente no banco ou por identidade de papel não confirmada.
Depois da nova validação local passaram os cinco gates: `check`, `typecheck`,
`boundaries` (507 arquivos), `test` (28 scripts, 236 app, 9 API e 8 domínio) e
`build` (oito tarefas; 24 rotas estáticas/dinâmicas coletadas). Os avisos de
tamanho do Storybook e da junction `.next` permanecem; não houve release ou
alteração de dados.

### Separação da navegação pessoal e rastreabilidade do alias — 06/10/2026

“Minhas gravações” e “Salvos” continuam em um grupo próprio na parte superior
da sidebar, nessa ordem, antes de “Área de membros”. As rotas continuam sendo
`/encontros/gravacoes` e `/comunidade/salvos`; os testes da sidebar verificam o
grupo, a ordem, os hrefs e que somente a entrada correspondente recebe
`aria-current="page"` em cada rota. O exemplo de sidebar do Storybook foi
alinhado para mostrar o mesmo pequeno grupo visual sem adicionar um título
visível. A renderização correspondente no Storybook local foi conferida em
desktop. A existência do grupo e das duas rotas no deployment atual foi
confirmada na sessão de leitura descrita abaixo; o `aria-current` atualizado
no código local não foi comprovado no artefato publicado, nem houve teste
mobile nesta rodada.

Depois do alinhamento do exemplo, passaram novamente `bun run check` (561
arquivos), `bun run typecheck` (16 tarefas), `bun run boundaries` (507
arquivos), `bun run test` (28 scripts, 236 testes do app, nove da API e oito do
domínio) e `bun run build` (oito tarefas; Storybook e app recompilados; 24
rotas do app geradas). Permanecem os avisos conhecidos de tamanho dos bundles
Storybook e da junction `.next` do cache local.

Uma consulta read-only da Vercel pelo alias canônico
`interprete-area-de-membros.vercel.app` resolveu o deployment Production
`dpl_3cCa2fw8VYyAsNic4zCSnwgkEqNn` como `READY`, criado em 06/10/2026. O
metadata retornado não identifica commit ou fonte Git e a lista do deployment
inclui o alias de projeto `interprete-area-de-membros-app.vercel.app`; por isso
não atribuo a esse deployment as alterações locais nem considero esse estado
prova de release delas. Nenhum deployment, segredo, conta ou dado de produção
foi alterado durante esta inspeção.

A rota pública oficial encaminha para `/sign-in`; o formulário Clerk e a
composição visual da tela de entrada renderizaram no navegador em uma sessão
nova. Não submeti o formulário porque o navegador preencheu uma credencial de
conta real, e o aceite desta fase requer identidades QA controladas. A sessão
Edge que já estava na área autenticada segue sem inspeção DOM; assim, isso
valida apenas a entrada pública e não login, papel, sidebar ou qualquer fluxo
autenticado.

### Revalidação autenticada de leitura no alias atual — 06/10/2026

Na verificação seguinte, uma sessão autenticada abriu o alias Production atual
e navegou pelas duas rotas. A sidebar mostra “Conteúdo pessoal” logo abaixo da
marca, antes de “Área de membros”, com “Minhas gravações” e “Salvos” separados
e na ordem solicitada. `/encontros/gravacoes` tem título, arquivo e filtro
próprios; `/comunidade/salvos` tem título e listas por origem. Isso confirma a
separação e os destinos no deployment atual. A lista de gravações informa que
a visualização é de equipe e mostra 18 registros sem data; isso não valida o
acesso de aluno. Na conta observada, Salvos mostrou discussões guardadas;
favoritos de cursos, materiais e questões seguem sem prova nessa conta. Nenhum
conteúdo foi criado, alterado ou removido durante essa revalidação de leitura.

### Correção editorial publicada pela gestão — 06/10/2026

Na mesma sessão autenticada ADMIN, a tela de gestão mostrou que a explicação
da questão de viés de seleção referia “D e E”, embora a lista tivesse somente
A–D. A tela exibe essa como questão 8 (as notas anteriores a chamavam posição
7). Atualizei apenas a explicação pela ação “Salvar nova versão”; o texto agora
explica que A, B e C descrevem mecanismos de seleção e que D é um viés de
informação por mensuração diferencial. A publicação confirmou que a nova
versão foi salva e que as sessões anteriores permanecem preservadas. Após
recarregar a página, a questão continuou Publicada na versão 2 com a explicação
corrigida. Nenhum SQL direto, resposta ou sessão de aluno foi criado.

### Fixação do grupo pessoal fora da área rolável — 06/10/2026

Na produção, a página inicial mostrou o grupo no topo; após navegar para a
gestão, a posição da área rolável da sidebar deixou “Minhas gravações” e
“Salvos” fora da região visível. Ao retornar a Início, o grupo voltou a
aparecer. O mecanismo exato da mudança de posição não foi isolado, mas a
organização visual solicitada não deve depender da posição de rolagem do menu.
No workspace, o grupo foi movido para o cabeçalho fixo da sidebar, fora de
`SidebarContent`, preservando a ordem, rotas e active states. O Storybook foi
alinhado à mesma estrutura e o teste passou a garantir que o grupo está no
cabeçalho, não no conteúdo rolável. Depois dessa mudança, passaram `check`
(561 arquivos), `typecheck` (16 tarefas), `boundaries` (507 arquivos), `test`
(28 scripts, 236 testes do app, nove da API e oito do domínio) e `build` (oito
tarefas; Storybook e app recompilados, 24 rotas geradas). Permanecem os avisos
de tamanho do Storybook e da junction `.next` do cache local. A mudança continua
local, sem release; os gates de aluno/professor e homologação no alias oficial
seguem abertos.

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

### Exercícios — tranche local de referências e autorização — 09/10/2026

O handoff possui 43 HTMLs e 43 capturas em `D:\interprete-exercicios-handoff\interprete-exercicios-handoff`. As novas rotas de sessão, resultado, revisão, favoritas e histórico são geradas pelo build. O redesign continua exclusivamente local e a Fase 9 permanece `IN PROGRESS` até comparação visual e jornadas autenticadas reais.

As referências permanecem no campo versionado e opcional `ExerciseQuestionVersion.explanation`; o editor já oferece “Explicação e referência(s)”, e a Server Action grava uma nova versão imutável. A autorização usa `requireStaff`, que consulta `Member.role` e permite `TEACHER` e `ADMIN`. Uma regressão automatizada confirma que a ação chamada por PROFESSOR salva a referência literal na próxima versão e atualiza o vínculo da lista. Na inspeção read-only de GREEN, as 36 explicações existentes foram reconhecidas pelo renderizador de referências após cobrir rótulos inline e qualificados; nenhum campo ou migration para bibliografia foi criado.

O schema Prisma local valida. A migration aditiva `20261009161350_exercise_session_kind` continua sem aplicação remota; GREEN ainda não possui `ExerciseSession.kind`, necessário para distinguir respostas avulsas de favoritas no histórico. Não houve escrita no banco nem alteração de dados existentes.

Após a regressão de edição de referências, `bun run check`, `bun run typecheck`, `bun run boundaries`, `bun run test`, `bun run build` e `bun run performance:check` passaram. A suíte atual contém 75 arquivos e 305 testes de app; API, domínio e scripts também passaram. Exercícios mede 188,5 KiB gzip em 13 chunks frente ao limite de 225 KiB. O build reportou um aviso do Turbo ao tentar copiar `BUILD_ID` para um cache externo, mas terminou com código 0.

Não foi possível comprovar a interface em navegador autenticado, comparar pixels nos viewports dos quadros, testar as jornadas de estudante/professor, nem validar persistência e concorrência no GREEN: não há contas de QA controladas para esses papéis e a migration ainda não foi promovida. Esses gates permanecem abertos; a contagem de HTML/capturas comprova inventário do handoff, não cobertura visual concluída.

### Exercícios — validação local e cobertura por quadros — 09/10/2026

Nesta continuação foram enumerados os 43 HTMLs e 43 PNGs do handoff. A cobertura de código está mapeada assim: 01–05, 24 e 27 para início/busca; 06–07 e 28 para detalhes de lista; 08 e 29 para histórico; 09–17, 25 e 32–38 para sessão; 18, 26 e 31 para resultado; 19 para revisão; 20–23 e 30 para favoritas; 39–41 para estados de controles, progresso e erro; 42 para jornadas; e 43 para breakpoints. Isso identifica os caminhos locais relacionados, mas ainda não é comparação visual dos 43 quadros.

Os SVGs de capa e caderno vazio correspondem byte a byte às artes fornecidas. O progresso usa segmentos até 30 questões e barra contínua acima disso. A ação fixa mobile acompanha o teclado virtual e safe area; o diálogo de saída segue a largura de 480 px do quadro desktop e não exibe um botão de fechar que não existe na referência. A cópia do modal agora descreve que todas as seleções não confirmadas serão descartadas. A paginação do histórico usa keyset no banco e filtra somente sessões concluídas com `completedAt`.

Após essas mudanças passaram `bun run check` (631 arquivos), `bun run typecheck` (16 tarefas), `bun run boundaries` (573 arquivos), `bun run test` (312 testes do app em 78 arquivos, 9 API, 8 domínio e 30 scripts), `bun run build` (8 tarefas) e `bun run performance:check`; Exercícios ficou em 188,5 KiB gzip em 13 chunks, sob o orçamento de 225 KiB. O build reportou o aviso já conhecido do Turbo para o cache externo `D:\CodexBuildCache`; terminou com código 0.

A regressão de feedback por `sessionQuestionId`, a preservação de rascunho ao navegar/retentar, a saída confirmada, o desfazer de favorita e a paginação têm cobertura automatizada. Continuam sem prova nesta rodada: comparação de screenshot da aplicação contra cada HTML/PNG, testes autenticados desktop/tablet/mobile com estudante, professor e ADMIN, leitor de tela/dispositivo real, validação de concorrência com PostgreSQL e persistência entre dispositivos. O host/contas QA não foram fornecidos; `/exercicios` local segue protegido por Clerk, então não usei a sessão Production disponível no navegador. A migration de tipo de sessão continua local e não aplicada ao GREEN. Fase 9 permanece `IN PROGRESS`.

### Exercícios — refinamento responsivo e gates locais — 09/10/2026

Foram refinadas as molduras responsivas de lista, histórico, resultado, revisão e resolução avulsa de favoritas com base nas medidas dos quadros correspondentes. O desktop permanece centrado no conteúdo do shell; tablet e mobile reduzem margens e tipografia, mantêm navegação própria nas páginas filhas e preservam a área inferior segura da ação fixa da sessão. A revisão estática dos controles confirmou rótulos associados às alternativas, nomes acessíveis para ações só com ícone, estados anunciados e navegação semântica por links e botões. Isso não substitui a validação assistiva no browser.

Após esses refinamentos passaram novamente os seis gates: `bun run check` (631 arquivos), `bun run typecheck` (16 tarefas), `bun run boundaries` (573 arquivos), `bun run test` (313 testes app, 9 API, 8 domínio e 30 scripts), `bun run build` (8 tarefas e 24 rotas app) e `bun run performance:check` (Exercícios 188,5 KiB gzip em 13 chunks, limite de 225 KiB). O build também informou o aviso conhecido do Turbo ao tentar copiar `BUILD_ID` para o cache externo e avisos de tamanho recomendado dos bundles do Storybook; terminou com código 0.

Esta rodada não produziu screenshots da aplicação autenticada nem prova de sessões, respostas, concorrência ou histórico gravados no banco. Permanecem pendentes as jornadas autenticadas de estudante, professor e ADMIN nos três tamanhos de tela, a comparação visual sistemática dos 43 quadros, os testes em leitor de tela/dispositivo real e a validação de persistência e concorrência em ambiente QA não produtivo. Nenhuma migration foi aplicada e nenhum deployment foi feito. Fase 9 permanece `IN PROGRESS`.

### Exercícios — sobreposição do cabeçalho fixo e gates finais locais — 09/10/2026

A inspeção das molduras mobile 31–32 encontrou conteúdo de resultado e revisão iniciando sob o cabeçalho fixo de 56 px, além do mesmo deslocamento no skeleton do resultado. Resultado e revisão agora reservam 68 px no topo e 56 px no rodapé mobile; o skeleton de sessão reserva 140 px para o cabeçalho e a faixa fixa de progresso, e o de resultado reserva 68 px. Um teste de regressão cobre as duas variantes de carregamento. O layout desktop permanece inalterado.

Passaram novamente os seis gates locais: `bun run check` (632 arquivos), `bun run typecheck` (16 tarefas), `bun run boundaries` (574 arquivos), `bun run test` (314 testes da app em 79 arquivos, 9 da API, 8 do domínio e 30 de scripts), `bun run build` (8 tarefas e 24 rotas da app) e `bun run performance:check` (Exercícios 188,5 KiB gzip em 13 chunks, limite 225 KiB). O CSS emitido pelo build contém as regras de topo mobile de 68 px e 140 px. O Turbo ainda mostrou o aviso de cópia do `BUILD_ID` ao cache externo; o build terminou com código 0.

Esta correção foi verificada contra a estrutura HTML/CSS fornecida, não por comparação de screenshots da aplicação. Continuam pendentes a QA autenticada de MEMBER, TEACHER e ADMIN em Preview não produtivo, as capturas reais nos breakpoints dos 43 quadros, o leitor de tela e aparelho físico, e persistência/concorrência contra PostgreSQL QA. Nenhuma migration foi aplicada nem houve deployment. Fase 9 permanece `IN PROGRESS`.

### Exercícios — revalidação de ambientes para QA autenticada — 09/10/2026

A inspeção read-only confirmou o vínculo Vercel `interprete-area-de-membros-app` e encontrou 51 deployments Preview `READY`; um usa o commit-base `618176573b508afbc4a74f27071be4d64fc25dfe`, enquanto as alterações de Exercícios deste checkout seguem locais e sem deployment. As variáveis da branch Preview apontam `DATABASE_URL`/`DIRECT_URL` ao projeto GREEN de Production `qffqhilydtnrggbcnogh`, junto de uma chave Clerk de teste. Não são um destino seguro para testes autenticados que gravam sessão, favorito, perfil ou resposta.

As conexões locais apontam ao projeto BLUE `wkclodjbrynerfgufmyb`, que o runbook marca como congelado e sem writes após T0. `prisma migrate status` somente leu o histórico desse banco e reportou 52 migrations locais, 22 pendentes, inclusive migrations de outros domínios e `20261009161350_exercise_session_kind`. Não foi aplicado nada. O CLI Supabase não está disponível neste host e o daemon Docker não respondeu; por isso não existe uma instância local Supabase isolada pronta para a sessão.

Não há atualmente um banco QA isolado, autenticado e alinhado ao schema para as jornadas MEMBER/TEACHER/ADMIN. Permanecem bloqueadas as mutações de validação, os screenshots da aplicação autenticada e os ensaios de persistência/concorrência; não usar Preview ligado ao GREEN nem o BLUE congelado para suprir essa falta. Nenhuma alteração de Vercel, migration, deployment ou dado remoto foi feita. Fase 9 permanece `IN PROGRESS`.

### Exercícios — regressão para a paleta aprovada — 09/10/2026

A decisão aprovada pelo usuário é verde para acerto e vermelho para erro, prevalecendo sobre o violeta do quadro original. O código já aplica os tokens semânticos `success` e `destructive` ao feedback, alternativas e progresso; o tema define `--success: #286b55` e o `destructive` como Classic Crimson. Foi adicionado um teste que verifica alternativa correta marcada/não marcada, alternativa incorreta selecionada, rótulos acessíveis e classes semânticas correspondentes.

A regressão direcionada passou (1/1); a suíte completa passou com 315 testes da app em 80 arquivos, 9 da API, 8 do domínio e 30 de scripts. Também passaram `bun run check` (633 arquivos), `bun run typecheck` (16 tarefas) e `bun run boundaries` (575 arquivos). O build e o orçamento não foram repetidos nesta subetapa porque só mudou um arquivo de teste e esta documentação; o build/performance da implementação seguem registrados na entrada anterior.

### Exercícios — verificação de saída e gates atualizados — 09/10/2026

A saída simples da sessão agora tem regressão explícita: sem rascunho, navega imediatamente sem abrir confirmação. Com seleções pendentes, a cobertura também verifica que o alerta recebe foco, fecha por Escape, devolve o foco ao acionador, mantém as seleções ao continuar e descarta o rascunho apenas na saída confirmada. Outra regressão alterna entre duas questões pendentes e confirma que os rascunhos permanecem isolados e são restaurados por questão. Os cinco testes direcionados passaram.

Depois da atualização, passaram novamente os seis gates locais: `bun run check` (633 arquivos), `bun run typecheck` (16 tarefas), `bun run boundaries` (575 arquivos), `bun run test` (318 testes app em 80 arquivos, 9 API, 8 domínio e 30 scripts), `bun run build` (8 tarefas e 24 rotas da app) e `bun run performance:check` (Exercícios 188,5 KiB gzip em 13 chunks, limite 225 KiB). O build concluiu com código 0 e repetiu o aviso do Turbo sobre cópia do `BUILD_ID` ao cache externo e os avisos de tamanho recomendado do Storybook.

Esses resultados são gates de código local. Não houve sessão de navegador autenticada, screenshot comparável por breakpoint, leitor de tela ou teste de mutações/persistência: Preview continua apontando ao banco GREEN de produção e o BLUE local está congelado. A implementação e a migration permanecem sem deployment/aplicação. Fase 9 permanece `IN PROGRESS`.

### Exercícios — destino real para ação do feedback — 09/10/2026

O feedback de resposta deixou de construir um `Link` com fallback `#`. O botão de navegação agora só aparece quando existe um destino calculado; resposta final continua levando ao resultado, e resolução avulsa continua voltando às favoritas. Foi adicionada regressão para o estado incompleto sem destino, além dos fluxos com próxima questão e resultado. Também há testes para o navegador de questões: estados correta, incorreta, atual e pendente; questões respondidas levam à revisão, pendentes abrem a sessão e o navegador mobile é apresentado como folha. Os testes direcionados de feedback, formulário, rascunhos e navegador passaram.

Após essa alteração passaram os seis gates: `bun run check` (634 arquivos), `bun run typecheck` (16 tarefas), `bun run boundaries` (576 arquivos), `bun run test` (321 testes da app em 81 arquivos, 9 API, 8 domínio e 30 scripts), `bun run build` (8 tarefas e 24 rotas) e `bun run performance:check` (Exercícios 188,5 KiB gzip em 13 chunks, orçamento 225 KiB). O build concluiu com código 0; manteve o aviso do Turbo sobre `BUILD_ID` no cache externo e os avisos de tamanho recomendado do Storybook.

A inspeção read-only do Preview, especificando a branch atual, confirmou `DATABASE_URL` no pooler de transação (6543) e `DIRECT_URL` no pooler de sessão (5432) para o GREEN de Production `qffqhilydtnrggbcnogh`. Os arquivos locais continuam apontando ao BLUE congelado `wkclodjbrynerfgufmyb`; nenhum dos dois é destino de mutação de QA. Não existe serviço PostgreSQL local ativo nem `psql`, e o daemon Docker continua indisponível. Nenhuma operação remota foi feita. Continuam pendentes browser autenticado, comparação real de pixels nos 43 quadros, leitor de tela, testes de mutação/persistência/concorrência e migration em QA não produtivo. Fase 9 permanece `IN PROGRESS`.

### Exercícios — regressão para o escopo dos locks de tentativa — 09/10/2026

Os inícios de sessão usam `pg_advisory_xact_lock` dentro da transação: lista usa a chave membro/lista e favorita usa membro/questão. Os testes de ação agora verificam os valores exatos dessas chaves e o tipo de lock, além da reutilização da sessão ativa. Isso protege o escopo pretendido no código, mas não é ensaio de concorrência no PostgreSQL. O teste direcionado passou (10/10).

Após a regressão passaram `bun run check` (634 arquivos), `bun run typecheck` (16 tarefas), `bun run boundaries` (576 arquivos), `bun run test` (321 testes da app em 81 arquivos, 9 da API, 8 do domínio e 30 scripts), `bun run build` (8 tarefas e 24 rotas) e `bun run performance:check` (Exercícios 188,5 KiB gzip em 13 chunks, orçamento 225 KiB). `git diff --check` também passou. O build terminou com código 0 e repetiu o aviso do Turbo ao copiar `BUILD_ID` ao cache externo.

O isolamento das chaves foi validado com mocks; persistência e concorrência real, journeys autenticadas, comparação visual por screenshots e acessibilidade em leitor de tela/dispositivo real continuam pendentes do ambiente QA isolado. Não houve escrita remota, migration aplicada, deployment ou commit. Fase 9 permanece `IN PROGRESS`.

### Exercícios — paginação integral de favoritas — 09/10/2026

A lista de favoritas deixou de truncar silenciosamente depois de 100 registros. A rota principal usa keyset no banco por `(createdAt, id)`, com 20 itens por página e projeção mínima, além de paginação nos dois sentidos. A área unificada “Salvos” mostra seis favoritas recentes e oferece acesso à coleção completa. O total conta apenas favoritos de questões, bancos e listas publicados. A implementação reaproveita a chave única e o índice `[memberId, createdAt]` existentes; não adiciona schema nem migration.

Foram adicionados testes para escopo do membro, filtro de publicação, cursores, desempate por ID, navegação recente/antiga e limite por página. Passaram `bun run check` (636 arquivos), `bun run typecheck` (16 tarefas), `bun run boundaries` (578 arquivos), `bun run test` (330 testes da app em 82 arquivos, 9 API, 8 domínio e 30 scripts), `bun run build` (8 tarefas e 24 rotas da app) e `bun run performance:check` (Exercícios 188,5 KiB gzip em 13 chunks, limite 225 KiB). O build concluiu com código 0; manteve o aviso do Turbo ao copiar `BUILD_ID` para o cache externo e os avisos de tamanho recomendado do Storybook.

Esses gates cobrem código local. Não validam latência SQL com cardinalidade real, comparação de pixels, persistência no navegador ou concorrência em PostgreSQL. A QA autenticada por papel e viewport segue bloqueada pela falta de banco QA isolado e contas controladas; GREEN Production e BLUE congelado continuam fora de uso. Fase 9 permanece `IN PROGRESS`.

### Exercícios — estado resiliente de Favoritas e gates locais — 09/10/2026

A página de Favoritas agora diferencia uma página de cursor que ficou obsoleta após remoções concorrentes de uma conta sem favoritas. O estado obsoleto oferece retorno à primeira página; o vazio real conserva a ilustração e a ação “Explorar listas”. Foram adicionados dois testes de rota cobrindo ambos os cenários.

Passaram `bun run check` (637 arquivos), `bun run typecheck` (16 tarefas), `bun run boundaries` (579 arquivos), `bun run test` (332 testes da app em 83 arquivos, 9 API, 8 domínio e 30 scripts), `bun run build` (8 tarefas e 24 rotas) e `bun run performance:check` (Exercícios 188,5 KiB gzip em 13 chunks, limite 225 KiB). O build concluiu com sucesso; repetiu o aviso do Turbo ao copiar `BUILD_ID` para o cache externo e os avisos de tamanho recomendado do Storybook.

Não houve acesso autenticado ao browser, leitura ou escrita no banco, migration aplicada ou deployment. Comparação de pixels, jornadas por papel/viewport, leitor de tela e ensaio de concorrência real seguem pendentes de ambiente QA isolado e contas controladas. Fase 9 permanece `IN PROGRESS`.

### Exercícios — busca por tema, prefetch e largura do cartão — 09/10/2026

A busca textual agora também encontra listas por categoria publicada ou tag normalizada de questões publicadas, além de título/descrição da lista e nome do banco. Os cards de listas, retomada e favoritas usam `IntentLink`, respeitando prefetch por intenção e o orçamento por rota. A leitura conjunta do HTML e do PNG nos quadros `01` e `24` confirmou `max-width: 560px` em content-box, que soma 48 px de padding e 2 px de bordas para 610 px externos. Como Tailwind usa border-box, a página e o teste seguem a largura externa de 610 px.

Foram adicionados testes para a consulta de categorias/tags publicadas, prefetch inativo até foco e largura do card. Passaram `bun run check` (638 arquivos), `bun run typecheck` (16 tarefas), `bun run boundaries` (580 arquivos), `bun run test` (334 testes da app em 84 arquivos, 9 API, 8 domínio e 30 scripts), `bun run build` (8 tarefas e 24 rotas) e `bun run performance:check` (Exercícios 188,5 KiB gzip em 13 chunks, limite 225 KiB). O build concluiu com sucesso e manteve o aviso não bloqueante do Turbo ao copiar `BUILD_ID` para o cache externo e os avisos de bundle do Storybook.

Esses testes cobrem a consulta e o comportamento do componente, não a latência com dados reais nem a renderização autenticada. A comparação de screenshots da aplicação nos 43 quadros, jornadas MEMBER/TEACHER/ADMIN, persistência/concorrência, mobile/tablet reais e leitor de tela continuam pendentes de QA isolado. Fase 9 permanece `IN PROGRESS`.

### Exercícios — foco, teclado virtual e retomada de sessão — 09/10/2026

Foram acrescentadas regressões para três comportamentos de navegação: ao mudar a questão, o foco segue para o título da nova questão; a ação fixa do formulário mobile acompanha a abertura e o fechamento do teclado virtual por `visualViewport` e limpa a variável CSS ao desmontar; e a rota de sessão retoma na primeira questão pendente, abre uma pendente explicitamente escolhida e encaminha questão respondida para revisão somente de leitura. Os testes direcionados passaram (9/9), incluindo a regressão anterior que mantém feedback tardio associado à identidade da questão original.

Os seis gates locais passaram: `bun run check` (640 arquivos), `bun run typecheck` (16 tarefas), `bun run boundaries` (582 arquivos), `bun run test` (339 testes da app em 86 arquivos, 9 da API, 8 do domínio e 30 de scripts), `bun run build` (8 tarefas, 24 rotas da app) e `bun run performance:check` (Exercícios 188,5 KiB gzip em 13 chunks, orçamento 225 KiB). `git diff --check` também passou. O build terminou com código 0; persistem o aviso do Turbo ao copiar `BUILD_ID` para o cache externo e os avisos de bundle recomendado do Storybook.

A inspeção do código confirma que referência bibliográfica pode permanecer no campo versionado `ExerciseQuestionVersion.explanation`, opcional; a tela administrativa oferece edição conjunta de explicação e referências e a ação exige papel de equipe, com teste de atualização por PROFESSOR. A renderização de feedback/revisão interpreta referências do texto e transforma URLs HTTP(S) seguras em links. A inspeção read-only documentada na tranche anterior encontrou 36 explicações no GREEN e confirmou que o parser reconhece as referências existentes; não houve nova consulta nesta execução. Não foi criado campo/tabela/migration para bibliografia. O banco QA isolado ainda não foi identificado nem examinado.

O usuário informou que existe Preview com banco e Clerk de QA isolados, mas os Preview/branches consultados nesta execução continuam reportando o projeto GREEN de Production. Aguarda-se identificar a URL/branch/projeto exatos do ambiente autorizado antes de autenticar ou gravar dados. Permanecem pendentes a comparação real de pixels dos 43 quadros, jornadas MEMBER/TEACHER/ADMIN, validação com dados e concorrência em PostgreSQL QA, teste de leitor de tela e dispositivo físico/tablet. Não houve escrita remota, migration, deployment ou commit. Fase 9 permanece `IN PROGRESS`.

### Exercícios — feedback incorreto tardio e descoberta do Preview de QA — 09/10/2026

A regressão de feedback após navegação rápida agora cobre os dois resultados, correto e incorreto: a explicação e o selo de uma submissão tardia da questão anterior não podem aparecer na questão aberta. O teste direcionado passou (6/6 no arquivo). Depois da mudança passaram novamente os seis gates: `bun run check` (640 arquivos), `bun run typecheck` (16 tarefas), `bun run boundaries` (582 arquivos), `bun run test` (340 testes da app em 86 arquivos, 9 API, 8 domínio e 30 scripts), `bun run build` (8 tarefas e 24 rotas) e `bun run performance:check` (Exercícios 188,5 KiB gzip em 13 chunks, orçamento 225 KiB). `git diff --check` também passou. O build repetiu o aviso do Turbo ao copiar `BUILD_ID` para o cache externo e os avisos de tamanho recomendado do Storybook.

Para encontrar o ambiente autorizado, a API de projetos Supabase retornou apenas o projeto GREEN acessível `qffqhilydtnrggbcnogh`; a API de branches desse projeto retornou uma lista vazia. O login Vercel deste host só vê um time, e a listagem do projeto app não apresentou projeto/branch QA. Os probes read-only de `/health` fizeram somente o `SELECT 1` definido pelo próprio handler: alguns Preview retornaram GREEN, outros falharam e um retornou conexão sem referência de projeto verificável. Nenhum foi aceito como banco isolado. Não foram lidas tabelas de produto. O ambiente QA informado pelo usuário segue sem URL/branch/projeto identificável neste host; não houve autenticação, escrita, migration, deployment ou commit.

A comparação de screenshots da aplicação com os 43 quadros, as jornadas MEMBER/TEACHER/ADMIN, persistência e concorrência reais no PostgreSQL QA, validação de Clerk QA, leitor de tela e aparelho/tablet continuam pendentes. Ao solicitar o destino e o local das contas de QA configuradas, o usuário informou não saber; não foi possível identificar um Preview seguro. Fase 9 permanece `IN PROGRESS`.

### Nova arquitetura de navegação, Planejamento e Ferramentas — tranche local — 10/10/2026

Foi implementada localmente a tranche definida pelo pacote de handoff: shell e busca global com histórico confirmado persistido; avatar real com fallback por iniciais; organização global de itens editoriais salvos mantendo os salvos da Comunidade próprios; áreas de Planejamento e Ferramentas com persistência Prisma, autorização por membro e endpoints de servidor. Planejamento cobre eventos e tarefas pessoais recorrentes por série/ocorrência, três estados fixos com rótulos e cores editáveis, metas, camadas do calendário, fuso configurável e lembretes integrados ao outbox. Ferramentas cobre cronômetro de sessão única sincronizado pelo servidor, associação a aula publicada, revisão explícita ao parar manualmente, registro ou descarte, nota da sessão, alarme e notas TipTap com pastas, lixeira de 30 dias e exportação Markdown. Minutos e conclusões usados nas metas vêm de registros persistidos.

O schema e a migration aditiva `20261010170000_member_planner_tools` permanecem somente no checkout local; a validação Prisma passou, mas nenhuma migration foi aplicada. Não houve escrita remota, deployment ou commit. O portal alerta sobre reunião próxima ou tarefa pessoal perto do prazo. As animações permanecem ativas; qualquer futura simplificação por capacidade do dispositivo exige evidência medida e repetível. Exercícios, Biblioteca, Comunidade e Perfil foram preservados no shell e na navegação.

Nesta revisão passaram `bun run typecheck` (16 tarefas), `bun run test` (343 testes da app, 9 da API, 10 do domínio e 30 scripts), `bun run boundaries` (608 arquivos em 19 pacotes), `bun run build` (8 tarefas e 24 rotas), `bun run performance:check` (todas as rotas medidas sob 225 KiB gzip), `prisma validate` e `git diff --check`. `bun run check` permanece reprovando com 171 diagnósticos de estilo no checkout alterado; nenhum autofix amplo foi aplicado. O build terminou com código 0 e manteve os avisos conhecidos de bundle do Storybook e de cópia do `BUILD_ID` para o cache externo.

A aplicação local redireciona as rotas autenticadas para o Clerk; sem uma sessão e banco de QA isolados disponíveis, o navegador não forneceu prova visual autenticada do novo Planejamento/Ferramentas nem de gravação e retomada entre dispositivos. O app não foi comparado pixel a pixel às referências nesta tranche. Permanecem pendentes QA autenticada, screenshots nos breakpoints, acessibilidade assistiva em navegador/dispositivo e validação de concorrência/persistência no PostgreSQL QA. A arquitetura e as telas estão em estado local para revisão; não marcar a fase como `DONE` até esses gates passarem.

### Nova arquitetura de navegação, Planejamento e Ferramentas — revalidação local — 11/10/2026

Os seis gates locais passaram após a tranche: `bun run check` (674 arquivos), `bun run typecheck` (16 tarefas), `bun run boundaries` (615 arquivos em 19 pacotes), `bun run test` (346 testes da app em 87 arquivos, 9 da API, 10 do domínio e 30 scripts), `bun run build` (8 tarefas; 24 páginas geradas para a app) e `bun run performance:check` (todas as rotas abaixo de 225 KiB gzip; Planejamento 221,3 KiB e Ferramentas 219,6 KiB no build). `git diff --check` passou. O build terminou com código 0; preservou o aviso conhecido de cópia do `BUILD_ID` para o cache externo.

Playwright reutilizou a sessão do navegador local e navegou para `/planejamento`, mas recebeu HTTP 500 antes da tela renderizar: a consulta protegida de membro falha porque a coluna `Member.deactivatedAt` não existe no banco configurado. A snapshot está em `.playwright-cli/page-2026-10-11T12-25-01-221Z.yml`. Não foi aplicada migration nem feita escrita remota para contornar essa divergência. Sem a renderização, ainda faltam comparação visual dos quadros, jornadas autenticadas funcionais, responsividade observada e prova ponta a ponta de persistência/concorrência. A migration de Planejamento e Ferramentas continua local; a fase permanece `IN PROGRESS`.

### Nova arquitetura — revalidação de animações e movimento — 11/10/2026

Foi ajustada a transição interna entre rotas para corresponder ao protótipo: a página anterior permanece sob a nova por 300 ms; a página de destino começa após 20 ms e anima opacidade/deslocamento vertical de 12 px por 240 ms. Ao concluir, o foco vai para o primeiro `h1`, o leitor de tela recebe o nome da página e a rolagem volta ao topo. O HANDOFF e o protótipo incluem uma variante para a preferência de movimento do sistema, mas a instrução posterior do usuário determina manter todas as animações; essa variante não foi implementada no produto e os arquivos de referência foram preservados. A busca no código-fonte e nos CSS/JS de produção não encontrou essa preferência; o CSS compilado contém a animação de entrada da rota. A única regra `no-tr` é um reset de layout de um ciclo, removido antes da transição do portal começar.

Na validação atual passaram `bun run check` (681 arquivos), `bun run typecheck` (16 tarefas), `bun run boundaries` (622 arquivos em 19 pacotes), `bun run test` (357 testes do app em 90 arquivos, 9 da API, 10 do domínio e 30 scripts), `bun run build` (8 tarefas, 24 páginas geradas), `bun run performance:check` e `git diff --check`. Planejamento mediu 222,0 KiB gzip e Ferramentas 220,3 KiB, abaixo do orçamento individual de 225 KiB.

A sessão local do Playwright abriu `/planejamento`, mas o servidor retornou HTTP 500 antes de renderizar o app: o banco configurado não tem `Member.deactivatedAt`. A auditoria local de configuração confirmou que `apps/app/.env.local` usa o pooler Supavisor hospedado na porta 6543; não há PostgreSQL local escutando. Portanto, esse destino não serve como banco isolado de QA e não foi usado para escritas ou migrations. Permanecem pendentes a comparação visual, jornadas autenticadas, responsividade observada e prova de persistência/concorrência. Nenhuma migration foi aplicada. O ambiente não tem Supabase CLI, `psql` ou servidor PostgreSQL local, e o Docker está parado; aguarda-se a autorização já solicitada para criar/usar um banco isolado e aplicar migrations somente nele. Não houve escrita remota, commit ou deployment. O checkout conserva 152 caminhos alterados ou não rastreados, sem exclusões e sem alterações staged; o ZIP original permanece presente. Fase 9 continua `IN PROGRESS`.

### Recorrência compartilhada — validação local — 11/10/2026

Os cálculos de ocorrência e conversão de fuso foram centralizados em `packages/member-domain/src/planner-recurrence.ts` e agora são usados tanto pelo Planejamento quanto pelo outbox de lembretes. Os novos testes cobrem virada de ano, âncora mensal no dia 31, horário de verão, limites inclusivos, término da série e correspondência exata de ocorrência. Os testes focados passaram (9 do domínio e 5 de cronômetro/calendário do app).

Após essa integração passaram `bun run check` (683 arquivos), `bun run typecheck` (16 tarefas), `bun run boundaries` (624 arquivos em 19 pacotes), `bun run test` (357 testes do app em 90 arquivos, 17 do domínio, 9 da API e 30 scripts), `bun run build` (8 tarefas e 24 páginas), `bun run performance:check` e `git diff --check`. Planejamento permaneceu em 222,0 KiB gzip e Ferramentas em 220,3 KiB, ambos abaixo do orçamento de 225 KiB.

A validação visual e persistente continua pendente: o Playwright recebe HTTP 500 por ausência de `Member.deactivatedAt`, e a configuração atual aponta para um pooler Supabase remoto, não para QA isolado. O checkout conserva 155 caminhos alterados ou não rastreados, sem exclusões ou alterações staged; o ZIP original permanece presente. Nenhuma migration, escrita remota ou deployment foi realizado. Fase 9 permanece `IN PROGRESS`.

### Notas — ajuste do editor móvel à referência — 11/10/2026

Os HTMLs 95 (390 × 844) e 48 (1440 × 900) foram medidos no Playwright. No mobile, a referência mede 58 × 610 px para a barra, em x=322/y=220, com 13 alvos de 44 px. No desktop, a barra mede 540 × 96 px, com topo sticky em 112 px, botões de 40 px e “Desfazer” alinhado à direita. O modo de Notas agora usa o trilho fixo lateral e a barra de status/ações fixa embaixo no mobile, mantém a barra branca horizontal sticky no desktop, reserva 84 px à direita para o trilho e oferece as ações secundárias em menu. A ação de imagem insere por URL; uploads locais seguem desabilitados, conforme a decisão de começar sem anexos. O editor da Comunidade continua no caminho de código anterior.

Passaram `bun run check` (683 arquivos), `bun run typecheck` (16 tarefas), `bun run boundaries` (624 arquivos), `bun run test` (357 testes do app em 90 arquivos, 17 do domínio, 9 da API e 30 scripts), `bun run build` (8 tarefas, 24 páginas) e `bun run performance:check`. Após o ajuste, Planejamento mediu 222,2 KiB gzip e Ferramentas 220,5 KiB, ambos sob o orçamento de 225 KiB. `git diff --check` também passou.

A validação Playwright do app não foi concluída: o contexto aberto nesta revisão foi redirecionado ao Clerk e a sessão anterior falhava antes da renderização por ausência de `Member.deactivatedAt` no banco configurado. As medidas citadas são do protótipo, não screenshots do app. Permanecem pendentes renderização autenticada, comparação visual da aplicação nos breakpoints e validação funcional/persistente ponta a ponta. Nenhuma migration foi aplicada, não houve escrita remota, commit ou deployment; o checkout conserva 155 caminhos alterados ou não rastreados, sem exclusões ou alterações staged, e o ZIP original continua presente. Fase 9 segue `IN PROGRESS`.

### Notas — cabeçalho e composição móvel — 11/10/2026

Ao abrir uma nota no celular, a URL sincroniza o estado sem recarregar a página; o shell mostra “Nota” com voltar, Salvos, busca e notificações, e recolhe o seletor geral de área. A tela usa a largura e o fundo da referência e apresenta pasta/aula/etiquetas antes do título. O vínculo exibe “Aula 1” no celular e “Aula · [título]” no desktop, a partir das lições publicadas ordenadas no módulo. Status, fixação, lixeira e ações secundárias seguem alcançáveis; voltar dispara o salvamento pendente sem bloquear a resposta visual. No desktop, o shell e as três colunas permanecem, com a linha de status/ações após os metadados. Etiquetas continuam editáveis e persistentes, e exportação Markdown/duplicação ficam disponíveis no menu também no celular.

Após essa tranche passaram `bun run check` (683 arquivos), `bun run typecheck` (16 tarefas), `bun run boundaries` (624 arquivos em 19 pacotes), `bun run test` (357 testes do app em 90 arquivos, 17 do domínio, 9 da API e 30 scripts), `bun run build` (8 tarefas; 24 páginas) e `bun run performance:check`. No build, Planejamento ficou em 222,4 KiB gzip e Ferramentas em 220,7 KiB, ambos abaixo do orçamento de 225 KiB; `git diff --check` também passou.

O Playwright confirmou novamente no protótipo as barras: HTML 95 em 390 × 844 mede 58 × 610 px, x=322/y=220, com 13 botões; HTML 48 em 1440 × 900 mede 540 × 96 px, x=839/y=400, com 14 botões. A sessão do app continua na tela local de login, portanto esta revisão ainda não tem screenshot nem fluxo autenticado da implementação. A execução anterior de rota autenticada falhou no servidor pela ausência de `Member.deactivatedAt`; permanece necessária uma base local isolada para provar renderização, persistência e concorrência. Não apliquei migration em banco algum, não fiz escrita remota, commit ou deployment. O checkout mantém os 155 caminhos locais já existentes, com 0 exclusões e 0 alterações staged, e o ZIP de 24.472.003 bytes continua em `D:\files (1).zip`. Fase 9 segue `IN PROGRESS`.

### Ferramentas da aula — drawer, gates e preservação — 11/10/2026

O drawer de Ferramentas foi ligado à página de aula: o timer usa a API existente para sincronizar estado no servidor e registrar/desfazer sessões; as notas carregam apenas quando o drawer abre e reutilizam o armazenamento/ações de Notas. O painel desktop é não modal, com 400 px abaixo do shell; o mobile abre como folha inferior até 74dvh, com overlay vinho e alvos de fechamento de 44 px. O cabeçalho móvel ganhou o espaçamento da alça e do título da referência. Não criei estado demonstrativo. A busca no código do produto por `prefers-reduced-motion`, `motion-reduce:` e `motion-safe:` não encontrou referências; nenhuma preferência ou heurística de redução de animação foi adicionada.

Passaram `bun run check` (684 arquivos), `bun run typecheck` (16 tarefas), `bun run boundaries` (625 arquivos em 19 pacotes), `bun run test` (357 testes do app em 90 arquivos, 17 do domínio, 9 da API e 30 scripts), `bun run build` (8 tarefas; 24 páginas da app) e `bun run performance:check`. Planejamento mediu 222,6 KiB gzip e Ferramentas 221,3 KiB, abaixo do orçamento individual de 225 KiB. `git diff --check` passou. O build terminou com código 0 e emitiu um aviso do cache externo sobre a tentativa de copiar `BUILD_ID` para `D:\CodexBuildCache`.

O Playwright permanece em `/sign-in`; não há screenshot nem fluxo autenticado desta implementação. A validação de uma rota autenticada já havia falhado antes de renderizar, pois o banco configurado não tem `Member.deactivatedAt`; ainda é necessária uma base local isolada para provar renderização, persistência e concorrência. Nenhuma migration foi aplicada, não houve escrita remota, commit ou deployment. O checkout conserva 157 caminhos locais alterados ou não rastreados, com 0 exclusões e 0 alterações staged; `D:\files (1).zip` permanece íntegro (24.472.003 bytes). Fase 9 continua `IN PROGRESS`.

### Consolidação autenticada e proteção de primeiro acesso — 11/10/2026

A autorização explícita mais recente inclui backup, migration aditiva no GREEN, commit/push e deploy da app/API, seguidos de QA autenticado em produção. BLUE continua protegido. O checkpoint `a812be6` preserva a implementação local; a integração de `origin/main` recupera os designs aprovados de Biblioteca, Comunidade, Perfil e Exercícios, conciliando o shell novo, Salvos editoriais e o editor compartilhado de Notas.

Planejamento/Ferramentas exigem o snapshot autenticado com onboarding completo antes de consultar o domínio. Leituras não provisionam defaults: preferências e três colunas usam valores virtuais até uma edição persistida. Isso elimina a corrida entre página/layout e a FK de primeiro acesso, sem chamada extra ao Clerk Backend. Notas usam o schema completo de TableKit, incluindo linhas/células; o portal não fica oculto pela regra de transição destinada às páginas internas. O cronômetro reconcilia conflitos Prisma P2002/P2034 com HTTP 409 sem detalhes internos.

QA autenticado em Chrome e PostgreSQL isolado `interprete_member_qa2`, com TLS verificado: meta semanal persistida; tarefa diária com edição/conclusão de ocorrência sem alterar a série; coluna renomeada; evento semanal; timer iniciar/pausar/retomar/recarregar/registrar; nota TipTap com autosave/reload, pasta, exportação Markdown, lixeira e restauração. Consulta SQL confirmou registros reais desses fluxos e nenhum timer aberto após o ensaio. Capturas de Planejamento, Timer e Notas em 320, 390, 768 e 1440 px não mostraram overflow horizontal. Entrada e retorno pelo corredor do portal foram exercitados.

Antes da integração passaram os seis gates, com 371 testes do app, 17 do domínio, 9 da API e 30 scripts. O build Windows precisou limitar prerender a dois workers; Linux mantém sua configuração. Planejamento 221,6 KiB e Ferramentas 220,5 KiB gzip / 225 KiB. O aviso de cache externo sobre `BUILD_ID` persistiu, sem falha no build. Os gates serão repetidos após a integração. Evidência local não substitui percentis, matriz completa de papéis, dispositivos físicos, comparação de todos os quadros ou QA publicado; fases 9/10 permanecem `IN PROGRESS`.

### Gates e migration do GREEN — 11/10/2026

Após integrar os designs aprovados, passaram `bun run check` (708 arquivos), `bun run typecheck`, `bun run boundaries`, `bun run test` (398 testes do app em 100 arquivos; 17 domínio, 9 API e 30 scripts), `bun run build` e `bun run performance:check`. Planejamento: 220,8 KiB gzip; Ferramentas: 219,8 KiB; todas as dez rotas medidas abaixo de 225 KiB. O aviso externo de cache `BUILD_ID` persistiu. As novas rotas também passam pelo tratamento de sessões Clerk pendentes; treze testes verificam proteção, retorno da tarefa de sessão e saúde pública.

QA adicional no banco isolado: duas partidas concorrentes retornaram 200/409, sem segundo timer ativo; busca confirmada persistiu após reload e foi apagada pelo controle do histórico; exclusão de uma ocorrência preservou 118 das 119 ocorrências projetadas, exclusão da série removeu todas e Desfazer restaurou a série sem ressuscitar a ocorrência excluída. Um lembrete pessoal foi entregue pelo consumidor do outbox e exibido no painel existente. A base local passou a usar UTC na sessão SQL (mesmo padrão do GREEN); o fuso do membro continua America/Sao_Paulo.

Backup GREEN de 19:35:52 UTC verificado por TLS verify-full, criptografia autenticada, DPAPI e `pg_restore --list`. Migration `20261010170000_member_planner_tools` aplicada com Prisma, sem operações destrutivas: 53 migrations, zero drift/checksum falho, 88 tabelas de domínio com RLS habilitado. A comparação das 73 tabelas anteriores não encontrou diminuição de contagem. BLUE não foi alterado. Publicação e validação autenticada em produção são o próximo gate; a sessão de produção ainda exige login humano.

### Publicação e primeiro ciclo de QA rigoroso — 11/10/2026

A consolidação bed84e8 foi publicada na app e API. O alias canônico da app foi corrigido para esse deployment; saúde pública retornou 200 e endpoints de cron sem credencial retornaram 401. O worker GREEN registrou seis respostas 200 em 30 minutos, sem filas pendentes/retry/dead na leitura. Uma sessão autenticada real em produção iniciou, recarregou, pausou, retomou e registrou um cronômetro privado de QA; o histórico persistiu após reload. Isso substitui o bloqueio anterior de login, sem representar aceite completo.

Este ciclo reconstrói Estudar conforme HTMLs 20/76, Aprender conforme 21/80 e Atividades conforme 24/81: próximo passo, catálogo por progresso real, linhas compactas e filtro persistido na URL. Corrige submissão somente com arquivo rejeitada por conteúdo ausente, feedback de submissão após persistência, estado de rascunho, tarefas vencidas, títulos móveis, sobreposição sticky e modo foco durante sessão ativa. O foco usa Dialog compartilhado e posicionamento explícito no viewport.

QA local com fixtures explícitas e Prisma exclusivamente na base isolada: 18 combinações das três telas prioritárias e 66 visitas a 22 rotas em desktop/tablet/mobile; sem overflow horizontal ou exceções JS nessas visitas. Conclusão de aula, resposta textual, Salvos e filtro resistiram a reload. Não foram provados upload físico, todos os controles/subrotas dinâmicas, matriz completa de papéis, leitor de tela, dispositivos físicos ou percentis. As fases 9/10 continuam IN PROGRESS. Os seis gates finais passaram (406 testes app; 17 domínio, 9 API, 30 scripts), build 0, orçamento das dez rotas respeitado; aviso BUILD_ID do cache externo persiste. Consulte o registro de release para os deployments e os limites de evidência.

### Publicação do ciclo visual e correção de hidratação — 11/10/2026

O commit f1d8fb8 está publicado no deployment dpl_JECLu4D6gzUsrF8ewfEUG1Np3KjY e no alias canônico. A navegação autenticada confirmou a nova composição de Estudar, o catálogo editorial real de Aprender e o filtro de Atividades com URL e estado vazio; nenhuma aula fictícia foi inserida em produção. Timer e nota privados de QA persistiram após reload. O console expôs erro React 418 associado à formatação implícita de fuso em Ferramentas. A correção seguinte fixa o fuso do membro e o instante de referência das datas relativas, com quatro regressões automatizadas. Essa correção exige novos gates e publicação. Capturas via extensão Edge apresentaram timeout; medidas DOM não substituem comparação visual publicada. A matriz completa continua aberta.

Gates da correção de fuso: check/typecheck/boundaries/test/build/performance:check e diff --check passaram; 410 testes app em 104 arquivos, 17 domínio, 9 API, 30 scripts. Tools 220,3 KiB gzip / 225 KiB; aviso BUILD_ID persistente. Chrome local em 390 px recarregou Notas com data estável e zero pageerror novo. O cache do runtime isolado criado nesta sessão foi preservado por renomeação antes de regenerar chunks; dados e servidor original não foram removidos.

### Sidebar do portal e tablet — defeito reproduzido — 11/10/2026

O relato de menu inoperante foi reproduzido na sessão publicada: a sidebar abria e o efeito de sincronização a fechava imediatamente. O efeito dependia de sidebarOpen e recolhia o drawer a cada abertura. A correção recolhe apenas na entrada do modo drawer, preservando a preferência original ao retornar ao desktop. Duas regressões falharam antes da mudança; três testes passaram depois (portal abrir/fechar/reabrir, tablet abrir e restauração desktop). Os seis gates e diff --check passaram: 413 testes app, 17 domínio, 9 API, 30 scripts; dez rotas dentro de 225 KiB. Aviso BUILD_ID persiste.

Matriz local adicional: Membro bloqueado em 16 rotas administrativas; Professor em 17 visitas (gravacoes/personalizacao/acessos bloqueadas pelas guardas admin); Admin em sete visitas mobile, incluindo edição/preview de curso. Sem overflow/exceção JS nessas visitas; papel local restaurado a Membro. Isso não prova todos os formulários e permissões de escrita. A sessão de staff fornecida permitiu visitas publicadas a painel/conteúdo/atividades/encontros/gravações/biblioteca/exercícios/comunidade. As fases 9/10 seguem abertas.

### Escape no drawer mobile — 11/10/2026

O componente compartilhado montava TooltipContent com hidden em menus expandidos/mobile. Ao focar um link, a camada invisível consumia o primeiro Escape e deixava o drawer aberto. Reproduzido no Chrome local: tooltip hidden=true/instant-open, drawer open antes e depois de Escape. O novo teste falhou antes (estado true em vez de false) e passou depois. Tooltips agora só montam no desktop recolhido, sem mudar a aparência dos menus abertos. Chrome local em 390 px confirmou fechamento com um Escape após reload e foco no link. Não há nova consulta, cache, persistência ou payload de dados no caminho crítico.

Gates finais do ajuste de Escape: check, typecheck, boundaries, test, build, performance:check e diff --check passaram. 414 testes app, 17 domínio, 9 API e 30 scripts. Planner 220,9 KiB e Tools 220,3 KiB gzip locais, abaixo de 225 KiB; aviso externo BUILD_ID persiste. Mais 20 visitas locais em 390/820 px (grupos, criação, biblioteca pessoal, tarefas, trilha/curso/aula e páginas públicas): HTTP 200, sem overflow ou pageerror. Busca e filtros de notificações publicados responderam e navegaram; nenhum conteúdo público de QA foi criado.

### Grupos: nome longo e retorno — 11/10/2026

QA local criou grupos privados controlados pelo formulário e confirmou persistência após reload. Um nome válido de 80 caracteres sem espaços causava scrollWidth 2289 em viewport 390, mesmo após estabilizar. O cabeçalho agora admite quebra de palavras longas e encolhimento do item flex, sem alterar o layout de nomes comuns. Após correção: scrollWidth 375/viewport 390, sem overflow. O link Todos os grupos agora retorna a /comunidade/grupos, validado no navegador. Sem mudança de schema, consultas, cache ou dados em produção. Novos gates em execução; fases 9/10 abertas.

Gates finais dos grupos: os seis checks obrigatórios e diff --check passaram (414 testes app). Nove combinações de grupo normal/nome de 80 caracteres/lista em 390, 820 e 1440 px sem overflow. O cluster local ficou indisponível durante o ensaio seguinte de reload do rascunho; isso interrompeu a prévia e não constitui aceite desse fluxo.

### Editor: ciclo de montagem e autosave — 11/10/2026

No runtime local com StrictMode, o cleanup marcava disposedRef=true, mas o setup não restaurava false. Isso bloqueava scheduleSave/flushSave/handlePublish silenciosamente; o teste novo falhou com zero chamadas ao autosave antes da correção e passou depois. O setup agora reativa o componente. Após corrigir, Chrome local confirmou POST 200 de autosave, título e corpo persistidos no reload e prévia com conteúdo correto no grupo privado de QA. Não houve escrita pública em produção. Nenhuma query/cache/schema adicional; a fila e a prevenção de publicação duplicada permanecem. O cluster local existente foi reiniciado após interrupção e verify-local-tls confirmou interprete_member_qa2/TLS validado.

Gates finais do editor: check/typecheck/boundaries/test/build/performance:check e diff --check passaram; 415 testes app em 106 arquivos, 17 domínio, 9 API, 30 scripts. Chrome local confirmou corpo e título após autosave/reload, prévia e publicação privada controlada com reload. Medição estabilizada em 390 px: scrollWidth 375, sem overflow. A medição imediata durante a transição não é usada como aceite. Nenhum conteúdo foi publicado remotamente nesse ensaio.
