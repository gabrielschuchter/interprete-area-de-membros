# Comunidade V2 — estado para continuidade

- **Branch:** `codex/comunidade-v2`
- **Worktree:** `C:\Users\gabsc\.codex\worktrees\comunidade-v2\interprete-area-de-membros`
- **Etapa 02:** `ACEITA PARA AVANÇO`; a captura autenticada do estado de erro real no runtime segue pendente no QA integrado e não bloqueia o avanço.
- **Etapa 03:** `CONCLUÍDA`. Editor, autosave, estados de publicação, pin, exclusão lógica/recuperação, capa e permissões foram validados em Postgres QA local e Supabase Storage real isolado. A execução final `storage-cover` passou 4/4; nenhuma escrita foi feita em GREEN, BLUE ou Production.
- **Etapa 04:** `IMPLEMENTADA E VALIDADA EM QA LOCAL`. Leitura, comentários, respostas de um nível, edição/remoção, menções contextuais, `@todos`, follow automático e mute passaram a jornada autenticada; gates do monorepo completos.
- **Escopo que já existia ao entrar na Etapa 04:** leitura/paginação, respostas persistidas, criação idempotente, follow automático no comentário, mute básico, edição, exclusão e recipients de `@todos` foram iniciados durante a Etapa 03. Esses serviços foram estendidos, não duplicados.
- **Entrega atual:** sugestões de menção limitadas à discussão/comunidade, `@todos` para ADMIN/TEACHER com contagem reconciliada, confirmação explícita, follow/mute persistentes e reautorização transacional em operações de comentário. Composer de comentário/resposta usa diálogo mobile com contexto; captura QA cobre desktop e mobile.
- **E2E atual:** PostgreSQL QA local `interprete_community_v2_qa`, Clerk Development MEMBER/ADMIN existentes e namespace `preview` com allowlist local; última execução passou 4/4. Eventos ficaram no outbox local namespaced; nenhum consumer/envio real foi executado.
- **Handoff visual recuperado:** arquivo original `C:\Users\gabsc\Downloads\files nova comunidade.zip`, SHA-256 `5C570782C1EA270DFD3514C0BEA39A4A6A8BEECDAD2E05EAFBFC8D1E7F515C44`; extraído em `C:\Users\gabsc\AppData\Local\Codex\qa\community-v2-handoff-20261021\original\interprete-comunidade-v2`. Boards 14/15/39/40 e capturas hidratadas foram comparados; saída QA mais recente: `C:\Users\gabsc\AppData\Local\Codex\qa\community-v2-foundation-20261015\playwright\results\e137669863ca4bbf82bc18105dcf6394`.
- **Etapa 03/Storage:** checkpoints mantidos; Storage QA continua isolado em `interprete-community-storage-qa-20261021`, API/DB em loopback, bucket privado `community-v2-cover-qa`; sem GREEN/BLUE/Production.
- **READY anterior:** o usuário confirmou App Preview e API Preview `READY` para o commit funcional `2c43980977741f09815553179588b642969d48fc`. Esta evidência é do checkpoint anterior; nenhuma consulta de deployment foi feita nesta etapa.
- **Integridade:** sem migration remota, alteração de GREEN ou Production, nem envio de notificação real. Checkout original e arquivos de handoff restaurados fora do Git preservados.
- **Gates da Etapa 04:** `bun run check` 1009 arquivos; `typecheck` 16/16; `boundaries` 937 arquivos; `bun run test` 829 App + 24 domínio + 9 API, scripts 32 pass/1 skip; `bun run build` 8/8; `performance:check` Comunidade 213,9 KiB gzip de 225 KiB; Playwright `discussion` 4/4. `graphify update .` executado (7.989 nós, 20.824 arestas).
- **Fechamento da Etapa 04:** jornada pronta para commit/push no branch `codex/comunidade-v2`. Não inferir READY da revisão atual a partir do checkpoint anterior nem promover alias; sem mudança de GREEN/Production.

## Implementado

- Cinco destinos da Comunidade e navegação responsiva, incluindo o seletor mobile em bottom sheet.
- Explorar com consultas reais, busca, filtros, URL preservada, paginação por cursor e retorno contextual.
- Salvos da Comunidade integrado ao Salvos global; wrappers de Encontros e Gravações sobre os serviços e as autorizações existentes.
- Diretório real com Meus grupos e descoberta pública, busca, filtros e paginação.
- Estados vazios e de falha, sem migration ou implementação de funcionalidades de etapas posteriores.
- O candidato 5072ee1 completa Salvos com cards reais da Comunidade, filtros por grupo/tipo/ordem, atalho global e preservação do contexto. Também alinha Composer, destaque de publicação fixada, conteúdo expandido Sobre/Regras/Como participar e cabeçalho do seletor mobile aos boards.

## Gates locais do candidato `f04a7bb`

- `bun run check`: passou, 978 arquivos.
- `bun run build`: passou, 8/8 tarefas. Incluiu App 787 testes em 162 arquivos, API 9 testes e domínio de membros 24 testes.
- `bun run performance:check`: passou; Comunidade 213,8 KiB gzip, dentro do orçamento de 225 KiB.
- Build usou os `.env.local` Preview já configurados. A presença de `NEXT_PUBLIC_APP_URL` e a ausência de marcador BLUE foram verificadas sem imprimir valores.
- O código alterado desde `04aeebb` é somente CSS; `typecheck` (16/16), `boundaries` (906 arquivos) e teste focado de navegação (3/3) foram aprovados em `04aeebb`, antes desse ajuste CSS.
- `graphify update .` concluiu após o CSS. `graphify-out/` continua ignorado pelo `.gitignore` e foi preservado; nenhum artefato gerado foi incluído no Git.

## Prova visual autenticada anterior — candidato `04aeebb`

- Capturas do SHA exato `04aeebb` após hidratação, usando dados GREEN existentes, nas larguras 390, 820, 1280 e 1440 CSS px. Não houve overflow horizontal em nenhuma largura.
- A matriz também mediu 320, 360, 768 e 1024 px: larguras do documento 309, 345, 753 e 1009 px, respectivamente, todas menores que o viewport. As larguras 390, 820, 1280 e 1440 mediram 375, 805, 1265 e 1425 px.
- A 820 px, a capa mede 725 px; filtros e composer ficam sobre o feed. O feed termina em y=2131 e o título do rail “Ativo agora” começa em y=2147, conforme o board 35.
- A 1280 px, capa e feed medem 609 px e a lateral ocupa coluna própria à direita. A 1440 px, capa/feed medem 769 px e a lateral começa à direita. Cinco destinos permanecem visíveis nas duas larguras.
- A 390 px, o seletor mostra os cinco destinos e descrições com foco no acionador; capa e filtros medem 335 px. Salvos mostra o item GREEN existente e o atalho global; Grupos mostra Meus grupos vazio e o grupo público existente com dois membros; Encontros mostra zero próximos/anteriores; Gravações mostra zero itens e a informação de acesso controlado.
- Comparações feitas com os boards 09, 35, 37, 38, 43, 44 e 50. Conteúdo e contagens refletem apenas dados existentes. Nenhuma fixture foi criada e nenhuma ação de salvar, apoiar, entrar/criar grupo ou publicar foi executada.
- Estados de carregamento foram aguardados até os dados finais. Um erro não ocorreu naturalmente; não foi provocado nem fabricado.

## Atualização do candidato `f04a7bb` — 20/10/2026

- Vercel confirmou App Preview `Ready`, deployment `DbGqXYbem8TMmi2aURj3cqjQUWEy`, branch `codex/comunidade-v2` e SHA exato `f04a7bb6c1034883c5870258598934238d4886bb`. O status GitHub do App é `success` com descrição `Deployment has completed`; API `success` e `Skipped - Not affected`.
- O ajuste CSS corrige a linha de título/fechar do seletor mobile, reduz os recuos mobile e reposiciona presença/rail no grid tablet. `git diff --check`, `bun run check`, `bun run build` e `bun run performance:check` passaram para esse código.
- A sessão Clerk autenticada no host anterior foi redirecionada ao formulário `/sign-in` no novo host `7vui07hsh`. Após hidratação, o formulário de e-mail/senha ficou visível. Não houve captura autenticada, screenshots do candidato `f04a7bb` nem confirmação visual das correções nesse host.
- Não foram copiados cookies, tokens ou credenciais entre origens. Nenhuma tentativa de login com senha/OTP, acesso a GREEN ou mutação foi realizada nesta atualização.
- Portanto, as comparações autenticadas registradas acima continuam válidas somente para `04aeebb`; não comprovam a aparência/runtime do SHA `f04a7bb`. O estado da página de login não é evidência da tela Comunidade nem foi comparado aos boards.

## Limites registrados antes da retomada da Etapa 03

Este snapshot descreve o corte anterior; o estado operacional atual está no topo deste documento.

- A medição de `performance:check` comprova o orçamento de JavaScript da rota. Percentis de navegação, LCP, INP e CLS não foram medidos neste gate e não são reivindicados.
- As capturas do candidato `f04a7bb` registradas na atualização abaixo não comprovam o SHA atual. A conclusão visual da etapa exige autenticação QA no host 5072ee1 e novas capturas hidratadas em 390 e 820 px, incluindo o seletor mobile e rotas Salvos, Grupos, Encontros e Gravações.
- Não houve escrita de QA em GREEN, migração, mudança em Production, cron, OIDC ou SSO.
- Próxima unidade prevista no plano: Etapa 03 — Rascunhos e publicações, quando autorizada. OPS-01 continua sendo dependência apenas das jornadas e do release que a exigem.

O checkout original `C:\Users\gabsc\Documents\Codex\interprete-area-de-membros` permanece intocado.

## Candidato atual `ecc1dca` — 20/10/2026

- O registro GitHub de deployment App Preview `7199735169` ficou `success` para o SHA exato `ecc1dcaf67d3a0fd8275606ede564da994395230`; o App concluiu, a API foi `Skipped - Not affected` e o alias autenticado serviu a aplicação da branch.
- Após hidratação, Explorar foi capturado em 390, 820 e 1280 CSS px. O documento mediu 375, 805 e 1265 px, respectivamente, sem overflow horizontal. O seletor mobile exibiu os cinco destinos.
- Comparações autenticadas de leitura: boards 09/35/37 (Explorar), 38 (seletor), 11 (busca sem resultados), 43 (Salvos), 44 (Grupos) e 50 (Encontros/Gravações). O GREEN exibiu Meus grupos vazio, um grupo público com dois membros, um salvo, nenhum encontro futuro e nenhuma gravação. Nenhuma fixture ou ação de escrita foi usada.
- O ajuste atual da busca vazia corresponde ao card centralizado do board 11, com termo na mensagem e ação para limpar filtros. Os boundaries de erro foram ajustados e têm testes focados; erro real não ocorreu naturalmente no Preview. Os boards de erro 11/33 foram consultados como referência, mas a captura de runtime de erro segue pendente.
- Gates do candidato: `bun run check` 980 arquivos; `bun run typecheck` 16/16 pacotes; `bun run boundaries` 908 arquivos; testes focados 5/5; `bun run build` 8/8 tarefas, App 793 testes/164 arquivos, API 9/3 arquivos e domínio 24/5 arquivos; `bun run performance:check` 213,8 KiB gzip / orçamento 225 KiB. Ambiente Preview foi verificado sem imprimir valores, sem marcador BLUE e com seeds desabilitadas.
- `graphify update .` concluiu com 7.834 nós, 20.366 arestas e 340 comunidades; 67 arquivos SQL foram ignorados por ausência do extrator `tree_sitter_sql`. `graphify-out/` foi confirmado como ignorado pelo Git e preservado; nenhum artefato gerado foi adicionado nem houve refatoração do tooling.
- O QA foi somente leitura. Não houve escrita no GREEN, migration, mudança em Production ou alteração do checkout original. O `performance:check` mede orçamento de bundle, não LCP/INP/CLS ou percentis.
- Estado de encerramento: implementação, gates locais, deployment e comparações de estados de dados estão comprovados; a Etapa 02 permanece `IN PROGRESS` até existir captura autenticada do erro em runtime. A sessão CUA não tem interceptação/offline e não expõe DevTools nativo; aguardar ocorrência natural ou mecanismo isolado disponível, sem fabricar dados nem afetar o GREEN.

## Fechamento visual do candidato `a1d87b0` — 20/10/2026

- O primeiro deployment `Ready` de `a1d87b0` serviu uma folha CSS sem as regras novas de grupos. Um redeploy Preview sem reutilizar o build cache criou o deployment `6PuY9Ej6wXsCwZX82etnW8b7D2x7`, `Ready`, no mesmo branch e SHA. O navegador confirmou a regra mobile carregada: intro `display:none`, filtros antes do CTA, cartão duplicado `display:none`.
- Capturas após hidratação e comparação: Explorar 390, 820 e 1280 px; seletor mobile com os cinco destinos; Grupos 390; Salvos 390 com filtros expandidos; Encontros 390; Gravações 390. Boards: 09, 35, 37, 38, 43, 44 e 50. Conteúdo GREEN permaneceu real: um grupo público com dois membros, Meus grupos vazio, um salvo, zero encontros e zero gravações.
- Largura do documento sem overflow: Explorar 390→375/375, 820→805/805 e 1280→1265/1265 px (viewport/documento); Grupos, Salvos, Encontros e Gravações também mediram 375/375 px no viewport mobile de 390 px. No desktop, capa/feed medem 609 px e a lateral permanece à direita.
- `bun run check` passou (978 arquivos); `bun run typecheck` (16/16); `bun run boundaries` (906 arquivos); teste focado de navegação (3/3); `bun run build` passou (8/8 tarefas, App 788 testes/162 arquivos, API 9/3 arquivos, domínio de membros 24/5 arquivos); `bun run performance:check` passou (Comunidade 213,8 KiB gzip / 225 KiB). `graphify update .` concluiu; `graphify-out/` segue ignorado e fora do Git.
- Loading skeletons foram observados em transições e aguardados até hidratação. O console não registrou erros; um estado de erro da aplicação não ocorreu naturalmente e continua sem prova visual de runtime. Percentis LCP/INP/CLS não foram medidos.
- QA foi somente de leitura: nenhum apoio, salvamento, entrada/criação de grupo ou publicação. Não houve fixture, migration, mutação GREEN, mudança Production, cron, OIDC/SSO ou alteração do checkout original.

## Atualização do candidato 5072ee1 — 20/10/2026

- O commit 5072ee15d5b9058693cb6c422da0a058034cf48e foi enviado à branch codex/comunidade-v2. O deployment App B4uZvEmKgxVZADX8J7ubfCrwnTGb concluiu Ready e o painel Vercel mostra a branch e o SHA candidato. O status GitHub do App é success; o deployment API foi Skipped - Not affected.
- Gates executados para o código deste SHA: bun run check (978 arquivos), bun run typecheck (16 tarefas), bun run boundaries (906 arquivos), bun run test (788 testes do App em 162 arquivos; API 9/3 arquivos; domínio 24/5 arquivos; testes internos 32 aprovados e 1 harness aposentado ignorado), bun run build (8/8 tarefas) e bun run performance:check (Comunidade 213,8 KiB gzip, orçamento 225 KiB). git diff --check passou antes do commit.
- O ambiente efetivo do worktree foi conferido sem mostrar valores: URLs de App/API e configuração de Preview presentes, variáveis necessárias de build/banco presentes, seeds de desenvolvimento desabilitados e nenhum marcador BLUE. graphify update . concluiu após as edições; os arquivos em graphify-out/ continuam ignorados, preservados e fora do commit.
- A prova visual autenticada do commit f04a7bb foi feita após hidratação e antes das alterações que compõem 5072ee1. Em 390 px, Explorar carregou dados GREEN, cinco destinos e conteúdo real; em 820 px, uma leitura estabilizada mediu documento de 820 px sem overflow e feed acima do rail em duas colunas; em 1280 px, documento de 1265 px sem overflow, feed/capa de 609 px e rail à direita. Comparações: boards 09, 35, 37 e 38. A presença online real foi preservada conforme o escopo vigente.
- Na prova f04a7bb, Grupos exibiu Meus grupos vazio e um grupo público real com dois membros; Encontros e Gravações exibiram seus estados vazios reais; Salvos exibiu um item real. Essa captura revelou que Salvos não mostrava o card completo/filtros dos boards 19/43 e que Composer, texto expandido Sobre/Regras/Como participar, contraste da fixada e linha de título/fechar do seletor divergiam dos boards. Essas diferenças foram corrigidas no código 5072ee1; ainda não há screenshot autenticado desse novo código.
- O host do deployment 5072ee1 foi aberto diretamente em /comunidade após Ready; a sessão de outro host Preview não se aplicou e a página exibiu /sign-in. Os campos de login foram verificados visualmente, mas nenhum formulário foi submetido. Não houve acesso adicional ao GREEN nem escrita de QA.
- Logo, o código e os gates locais do candidato estão comprovados; a inspeção Vercel confirma SHA e Ready; a fidelidade visual/runtime autenticada do SHA atual não está comprovada. Nenhum estado de erro foi fabricado; percentis de navegação, LCP, INP e CLS não foram medidos.
- Próximo passo recomendado: concluir QA autenticado e somente de leitura no host do SHA 5072ee1, comparar as telas hidratadas com boards 09, 19, 35, 37, 38, 43 e 50, e então atualizar o estado da Etapa 02. Não avançar a Etapa 03 antes desse aceite. OPS-01 e as etapas futuras permanecem fora do escopo.

### Retificação da observação de login do candidato f04a7bb

A seção histórica de f04a7bb acima registra o primeiro estado daquele host, quando /sign-in ainda era exibido. Em seguida, uma sessão QA existente foi autenticada nesse host e as capturas de 390, 820 e 1280 CSS px descritas na atualização 5072ee1 foram realizadas após hidratação. Isso comprova somente o predecessor f04a7bb; no host novo do SHA 5072ee1, /sign-in continua visível.
