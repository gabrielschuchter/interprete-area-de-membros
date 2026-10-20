# Comunidade V2 — estado para continuidade

- **Branch:** `codex/comunidade-v2`
- **Worktree:** `C:\Users\gabsc\.codex\worktrees\comunidade-v2\interprete-area-de-membros`
- **Candidato de código em validação:** ajuste local do seletor mobile sobre `19a0257`; o novo commit e Preview ainda não foram gerados.
- **Etapa ativa:** 02 — Navegação e Explorar.
- **Estado:** `IN PROGRESS`. Os gates locais passaram para o ajuste do seletor. O runtime autenticado anterior confirma as rotas em 390 px no commit `19a0257`, mas não prova o novo código nem desktop/tablet. A evidência 18/18 anterior à correção CSS continua inválida como aceite final.

## Implementado

- Cinco destinos da Comunidade, navegação responsiva e seletor mobile; o seletor agora segue o board 38 com título, botão de fechar, ícones em círculos e descrições dos cinco destinos.
- Explorar conectado às consultas reais, com busca, filtros, URL preservada, paginação por cursor e retorno contextual.
- Salvos da Comunidade integrado à listagem global de Salvos.
- Wrappers de Encontros e Gravações sobre autorização e dados existentes.
- Diretório real de grupos com Meus grupos e descoberta pública, busca, filtros e paginação.
- Estados vazios e de erro; correções anteriores de responsividade para tooltip de presença, ordem do rail mobile e altura da capa tablet.
- Sem migration, fixture de produto ou implementação de funcionalidades de etapas futuras.

## Gates locais do código atual

- `bun run check`: passou, 978 arquivos.
- `bun run typecheck`: passou, 16/16 tarefas.
- `bun run boundaries`: passou, 906 arquivos.
- `bun run --cwd apps/app test -- components/community/community-navigation.test.tsx`: passou, 3/3 testes.
- `bun run build`: 8/8 tarefas. Incluiu 787 testes do App em 162 arquivos, 9 testes da API e 24 do domínio de membros; compilação do App e API concluída.
- `bun run performance:check`: passou; Comunidade 213,8 KiB gzip, abaixo do teto de 225 KiB.
- `bunx biome check` nos quatro arquivos alterados e `git diff --check`: passaram.
- `graphify update .` concluiu; o grafo local foi atualizado. `/graphify-out/` em `.gitignore` mantém os mapas e caches fora dos commits sem removê-los.
- Build carregou os `.env.local` já vinculados ao Preview. Checagem segura confirmou os arquivos e `NEXT_PUBLIC_APP_URL` sem exibir valores; nenhum marcador BLUE foi encontrado.

## Preview e QA visual

- Preview autenticado do predecessor `19a0257` confirmado Ready no deployment `9HWDPbjRmvDcNUyRoe7N27GoKy1N`. Essa versão foi aberta com Clerk QA e dados reais do GREEN, somente leitura.
- Na viewport CSS de 390 px e após hidratação, Explorar mostrou publicações, filtros, presença e grupos; a medição `documentElement.scrollWidth=375` com `innerWidth=390` não indicou overflow horizontal.
- Salvos exibiu 1 publicação real e o atalho para Salvos global; Grupos exibiu Meus grupos vazio e um grupo público real com 2 membros; Encontros mostrou zero próximos/anteriores; Gravações mostrou zero itens e o aviso de acesso controlado.
- Comparações do predecessor com os boards 37/38/43/44/50: os conteúdos reais diferem dos boards populados; não foram criados dados para preencher as telas. O board 38 revelou a falta de descrições, título e fechar no seletor, corrigida localmente neste candidato.
- Uma tentativa de aplicar viewport 1440 px manteve `innerWidth=390`. A tentativa seguinte de abrir uma nova aba encerrou a conexão do browser. Portanto não há screenshots autenticadas do código atual, nem prova desktop/tablet. Os boards 09/35/37/38/43/44/50 foram consultados; o board 33 descreve estados de Encontros.
- A navegação imediata exibiu carregamento transitório antes dos dados reais. Não houve estado de erro natural; skeleton não foi tratado como layout final.
- Nenhuma ação de salvar/remover, entrar em grupo, criar publicação/grupo ou escrever no GREEN foi executada.

## Próximo passo

Fazer commit/push do candidato e confirmar App Preview Ready no SHA novo. No host desse deployment, reabrir a sessão Clerk QA para conferir o seletor corrigido e capturar Explorar em 1440/820/390 px, além de Salvos, grupos, Encontros e Gravações. Atualizar `NOW.md` e `STATUS.md` com as evidências finais; manter Etapa 02 `IN PROGRESS` até essa validação.

## Preservar

O checkout original em `C:\Users\gabsc\Documents\Codex\interprete-area-de-membros` permanece intocado. Preview e Production compartilham GREEN: continuar somente em leitura, sem criar dados QA. Não remover artefatos Graphify nem implementar etapas futuras.
