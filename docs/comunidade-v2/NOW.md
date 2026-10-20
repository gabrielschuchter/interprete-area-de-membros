# Comunidade V2 — estado para continuidade

- **Branch:** `codex/comunidade-v2`
- **Worktree:** `C:\Users\gabsc\.codex\worktrees\comunidade-v2\interprete-area-de-membros`
- **Candidato de código:** 5072ee15d5b9058693cb6c422da0a058034cf48e (fix(comunidade): alinhar salvos e detalhes visuais), enviado a origin/codex/comunidade-v2.
- **Preview App:** Ready, deployment B4uZvEmKgxVZADX8J7ubfCrwnTGb, SHA exato 5072ee15d5b9058693cb6c422da0a058034cf48e; host https://interprete-area-de-membros-pdi4dteli-gabrielschuchters-projects.vercel.app.
- **Etapa 02 — Navegação e Explorar:** implementação e gates locais concluídos; validação visual autenticada do SHA atual continua pendente. O candidato f04a7bb foi comparado após hidratação em 390, 820 e 1280 CSS px; as alterações posteriores em Salvos, Composer, lateral e seletor ainda não foram comparadas no host 5072ee1. A fase 7 da Comunidade permanece IN PROGRESS.
- **Segurança:** no host exato do candidato 5072ee1, /comunidade redireciona ao formulário /sign-in. A sessão QA existente está em outro host Preview e não se aplica a esta origem. Nenhuma senha, OTP, cookie ou token foi transferido ou submetido; nenhuma escrita no GREEN, alteração de Production ou mudança no checkout original ocorreu.

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

## Limites comprovados e próxima etapa

- A medição de `performance:check` comprova o orçamento de JavaScript da rota. Percentis de navegação, LCP, INP e CLS não foram medidos neste gate e não são reivindicados.
- As capturas do candidato `f04a7bb` registradas na atualização abaixo não comprovam o SHA atual. A conclusão visual da etapa exige autenticação QA no host 5072ee1 e novas capturas hidratadas em 390 e 820 px, incluindo o seletor mobile e rotas Salvos, Grupos, Encontros e Gravações.
- Não houve escrita de QA em GREEN, migração, mudança em Production, cron, OIDC ou SSO.
- Próxima unidade prevista no plano: Etapa 03 — Rascunhos e publicações, quando autorizada. OPS-01 continua sendo dependência apenas das jornadas e do release que a exigem.

O checkout original `C:\Users\gabsc\Documents\Codex\interprete-area-de-membros` permanece intocado.

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
