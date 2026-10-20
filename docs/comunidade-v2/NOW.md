# Comunidade V2 — estado para continuidade

- **Branch:** `codex/comunidade-v2`
- **Worktree:** `C:\Users\gabsc\.codex\worktrees\comunidade-v2\interprete-area-de-membros`
- **Candidato atual:** `6329c70` (`feat(comunidade): concluir diretório de grupos da etapa 02`), enviado a `origin/codex/comunidade-v2`.
- **Etapa ativa:** 02 — Navegação e Explorar.
- **Estado:** `IN PROGRESS`. Código, gates locais e deployments Preview estão validados; faltam sessão QA autenticada e comparação visual do candidato com os boards. A prova autenticada 18/18 anterior às últimas mudanças não vale como aceite desta versão.

## Implementado

- Cinco destinos da Comunidade, navegação responsiva e seletor móvel.
- Explorar conectado às consultas reais, com busca, filtros, URL preservada, paginação por cursor e retorno contextual.
- Salvos da Comunidade integrado à listagem global de Salvos.
- Wrappers de Encontros e Gravações sobre a infraestrutura existente.
- Diretório real de grupos, com Meus grupos e descoberta pública, busca, filtros e paginação.
- Estados vazios e de erro; ajustes de layout da comparação anterior. Sem migration, dados falsos de produto ou funcionalidades de etapas posteriores.

## Evidências do candidato

- `bun run check`: passou, 978 arquivos.
- `bun run typecheck`: passou, 16/16.
- `bun run boundaries`: passou, 906 arquivos.
- Testes direcionados de grupos: 2 arquivos, 5 testes aprovados.
- `bun run build`, com ambiente Preview recuperado para `codex/comunidade-v2`: passou. O build também executou a suíte da aplicação (787 testes em 162 arquivos), além de API (9 testes) e domínio de membros (24 testes).
- `bun run performance:check`: passou; bundle da Comunidade 213,7 KiB gzip, limite 225 KiB.
- App Preview e API Preview: `READY`, ambos no commit `6329c7088c21ee9fd6b061589d2ad7ad227867a2`.
- `graphify-out/` foi preservado; `biome.jsonc` exclui os artefatos gerados do check de formatação.
- Os arquivos locais `apps/app/.env.local` e `apps/api/.env.local`, usados para o build Preview, continuam ignorados e fora do Git. A limpeza desses dois arquivos foi bloqueada pela política do ambiente; seus valores não foram exibidos nem registrados.

## QA visual e runtime

- O Preview App protegido foi acessado pelo OIDC da branch e redirecionou para `/sign-in`. O contexto Playwright usado estava sem sessão autenticada; os envs recuperados não continham senha QA.
- Não redefini senha, criei usuário ou alterei dados. Nenhuma ação de escrita foi executada.
- Os boards relevantes foram identificados (09, 11, 19, 20, 32, 33, 35, 37, 38, 43, 44 e 50), mas screenshots autenticadas do candidato não foram capturadas nem comparadas.
- Persistência, autorização e jornadas de navegação após login continuam sem prova nesta versão.

## Próximo passo

Usar uma sessão/credencial existente da identidade Clerk QA em meio seguro e repetir, em modo somente leitura, as capturas e comparações dos boards em desktop, tablet e mobile. Corrigir somente diferenças comprovadas, repetir os gates afetados e atualizar este estado. Manter Etapa 02 `IN PROGRESS` até essa evidência; OPS-01 não bloqueia esta validação.

## Preservar

O checkout original permanece intocado. Manter `graphify-out/` no worktree sem incluí-lo no commit. Não executar escrita no GREEN nem avançar para etapas posteriores antes do aceite da Etapa 02.
