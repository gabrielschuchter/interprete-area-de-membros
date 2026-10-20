# Comunidade V2 — estado para continuidade

- **Branch:** `codex/comunidade-v2`
- **Worktree:** `C:\Users\gabsc\.codex\worktrees\comunidade-v2\interprete-area-de-membros`
- **Implementação da Etapa 03:** base `551673e2a9aa8abc92577cd2c0ac5aa3da09b310`; correção de lock/feedback `2c226f00b7c04812b549a412202f3c577671a0ae`, enviada a `origin/codex/comunidade-v2`.
- **Preview (snapshot 20/10/2026):** no SHA `6bca7e810aacaebc1378c20fb0eded4ec22f6b33`, App `EpF8xgJpbyGHmtnvTdunse9A7Veb` e API `BKtMfSzRDFFeqgjqWZdyqyTvkPSF` concluíram `success`. No SHA funcional anterior `2c226f00b7c04812b549a412202f3c577671a0ae`, App `HRWY2Af14F45LnM61PjmLrJeztA4` concluiu `success` e o status da API `2DW4FRiXJ8oQvHf1jcqbZJEysH4B` ficou `failure`. Alias estável: `interprete-area-de-membro-git-553be9-gabrielschuchters-projects.vercel.app`.
- **Etapa 02:** `ACEITA PARA AVANÇO`. Gates locais e QA visual autenticado dos estados reais foram concluídos no candidato `ecc1dca`; a captura autenticada do estado de erro em runtime continua pendente no QA integrado. Essa evidência complementar não bloqueia a Etapa 03 e não significa QA integral concluído.
- **Segurança:** migration aplicada apenas ao Postgres local QA isolado. Nenhuma migration remota, fixture ou mutação no GREEN, alteração de Production ou mudança no checkout original. Credenciais e `storageState` permanecem locais, protegidos e ignorados pelo Git.
- **Pendência integrada:** a captura autenticada do estado de erro em runtime segue aberta para o QA integrado. Não fabricar falhas nem bloquear a etapa atual por essa captura.
- **Etapa 03:** permanece `IN PROGRESS` até os gates finais e a comprovação de upload real no Storage isolado. O ciclo local de publicação, edição, arquivamento, exclusão lógica e recuperação administrativa foi validado sem escrita no GREEN. E2E local autenticado comprovou a corrida concorrente: exatamente uma publicação ficou fixada; o pin original foi restaurado e os posts de QA foram excluídos logicamente.
- **Autenticação QA:** testes locais usam `@clerk/testing` com identidades Clerk Development existentes e `storageState` protegido reutilizado. No Preview, a sessão QA já aberta no Edge autorizado acessou o alias estável; a página autenticada identificou a conta QA. Não houve extração de senha/cookie nem alteração de credenciais Production.

## Etapa 03 — checkpoint atual

- Editor sem linha vazia ao abrir; primeira edição cria uma publicação canônica. Autosave serializado e idempotente cobre estados de rede, retries e conflitos de edição entre abas.
- `Minhas publicações` inclui Publicadas, Rascunhos e Arquivadas; publicar/editar mantém a mesma publicação. Fixação única é aplicada por escopo; exclusão lógica preserva histórico e staff pode recuperar por 30 dias.
- Migration `20261020190000_community_publication_ux` validada apenas em Postgres local QA isolado. E2E autenticado anterior: 5/5, cobrindo salvar/recarregar, publicar, editar, arquivar, excluir/desfazer e recuperação de staff/autor. E2E concorrente adicional: 1/1, dois contextos Clerk QA independentes, uma fixação final e restauração do pin preexistente. O P2010 do lock foi corrigido tipando o retorno da query. Sem mutation de QA no GREEN.
- Vitest focado: composer 9/9; autorização de assets 14/14; menu de moderação 4/4. A cobertura de capa valida leitura do autor antes do autosave, privacidade sem referência e leitura pela audiência após publicar. O upload usa transporte simulado; não prova gravação real no Storage.
- Comparação das capturas desktop/mobile com boards 16b, 17, 41b e 42: editor e lista de publicações. No Preview autenticado, entrar no editor pelo botão e sair sem digitar deixou as contagens iguais (1 publicada, 1 rascunho, 0 arquivadas); nenhuma gravação foi executada. Na leitura do alias estável, uma publicação existente exibiu o fallback da capa; a causa não foi determinada. Upload/progresso/erro de capa e diálogo de saída com alterações ainda não têm captura no Preview.
- Gates em 2026-10-20, após `2c226f0`: `check` (1.001 arquivos), `typecheck` (16/16), `boundaries` (929 arquivos), `test` (814 App, 9 API, 24 domínio; 32 infra, 1 harness aposentado), build (8/8) e `performance:check` (Comunidade 213,9 KiB gzip / 225 KiB).
- Vitest focado do composer: 9/9; menu de moderação: 4/4. E2E autenticado de pin concorrente: 1/1 em dois contextos Clerk QA, com uma fixação final e restauração do pin inicial; se houver conflito, o teste exige o alerta visível. Posts de QA ficaram excluídos logicamente; zero pin de teste ativo e o pin global preexistente permaneceu.
- **Próximo passo:** validar upload real no Storage local isolado quando o serviço puder ser iniciado; esta máquina não tem CLI Supabase nem daemon Docker ativo. Depois, rodar os gates integrados do checkpoint. Sem migration remota ou escrita no GREEN; a captura autenticada do erro da Etapa 02 segue pendente e não bloqueia a Etapa 03.

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
