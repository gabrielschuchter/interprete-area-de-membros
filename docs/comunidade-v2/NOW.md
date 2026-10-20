# Comunidade V2 — estado para continuidade

- **Branch:** `codex/comunidade-v2`
- **Worktree:** `C:\Users\gabsc\.codex\worktrees\comunidade-v2\interprete-area-de-membros`
- **Candidato:** `04aeebbce800ce9036938c0fae3bbd82af8de224` (`fix(comunidade): colocar lateral após o feed no tablet`), enviado a `origin/codex/comunidade-v2`.
- **Preview App:** `Ready`, deployment `EHM6eGsA2ibP12kTSkjdKpjY9jbh`, commit `04aeebb`; host `https://interprete-area-de-membros-2g8t98vdq-gabrielschuchters-projects.vercel.app`.
- **Etapa 02 — Navegação e Explorar:** `DONE` após validação do candidato. A fase 7 da Comunidade continua `IN PROGRESS`; as próximas etapas e OPS-01 permanecem separadas.
- **Segurança:** Clerk QA autenticado no Preview; QA somente de leitura. Nenhuma escrita no GREEN, alteração de Production ou mudança no checkout original.

## Implementado

- Cinco destinos da Comunidade e navegação responsiva, incluindo o seletor mobile em bottom sheet.
- Explorar com consultas reais, busca, filtros, URL preservada, paginação por cursor e retorno contextual.
- Salvos da Comunidade integrado ao Salvos global; wrappers de Encontros e Gravações sobre os serviços e as autorizações existentes.
- Diretório real com Meus grupos e descoberta pública, busca, filtros e paginação.
- Estados vazios e de falha, sem migration ou implementação de funcionalidades de etapas posteriores.

## Gates locais do candidato

- `bun run check`: passou, 978 arquivos.
- `bun run typecheck`: passou, 16/16 tarefas.
- `bun run boundaries`: passou, 906 arquivos.
- Teste focado de navegação: 3/3 passou.
- `bun run build`: passou, 8/8 tarefas. Incluiu App 787 testes em 162 arquivos, API 9 testes e domínio de membros 24 testes.
- `bun run performance:check`: passou; Comunidade 213,8 KiB gzip, dentro do orçamento de 225 KiB.
- Build usou os `.env.local` Preview já configurados. A presença de `NEXT_PUBLIC_APP_URL` e a ausência de marcador BLUE foram verificadas sem imprimir valores.
- `graphify update .` concluiu. `graphify-out/` continua ignorado pelo `.gitignore` e foi preservado; nenhum artefato gerado foi incluído no Git.

## Preview autenticado e comparação visual

- Capturas do SHA exato `04aeebb` após hidratação, usando dados GREEN existentes, nas larguras 390, 820, 1280 e 1440 CSS px. Não houve overflow horizontal em nenhuma largura.
- A matriz também mediu 320, 360, 768 e 1024 px: larguras do documento 309, 345, 753 e 1009 px, respectivamente, todas menores que o viewport. As larguras 390, 820, 1280 e 1440 mediram 375, 805, 1265 e 1425 px.
- A 820 px, a capa mede 725 px; filtros e composer ficam sobre o feed. O feed termina em y=2131 e o título do rail “Ativo agora” começa em y=2147, conforme o board 35.
- A 1280 px, capa e feed medem 609 px e a lateral ocupa coluna própria à direita. A 1440 px, capa/feed medem 769 px e a lateral começa à direita. Cinco destinos permanecem visíveis nas duas larguras.
- A 390 px, o seletor mostra os cinco destinos e descrições com foco no acionador; capa e filtros medem 335 px. Salvos mostra o item GREEN existente e o atalho global; Grupos mostra Meus grupos vazio e o grupo público existente com dois membros; Encontros mostra zero próximos/anteriores; Gravações mostra zero itens e a informação de acesso controlado.
- Comparações feitas com os boards 09, 35, 37, 38, 43, 44 e 50. Conteúdo e contagens refletem apenas dados existentes. Nenhuma fixture foi criada e nenhuma ação de salvar, apoiar, entrar/criar grupo ou publicar foi executada.
- Estados de carregamento foram aguardados até os dados finais. Um erro não ocorreu naturalmente; não foi provocado nem fabricado.

## Limites comprovados e próxima etapa

- A medição de `performance:check` comprova o orçamento de JavaScript da rota. Percentis de navegação, LCP, INP e CLS não foram medidos neste gate e não são reivindicados.
- Não houve escrita de QA em GREEN, migração, mudança em Production, cron, OIDC ou SSO.
- Próxima unidade prevista no plano: Etapa 03 — Rascunhos e publicações, quando autorizada. OPS-01 continua sendo dependência apenas das jornadas e do release que a exigem.

O checkout original `C:\Users\gabsc\Documents\Codex\interprete-area-de-membros` permanece intocado.
