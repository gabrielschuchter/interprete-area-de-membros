# Comunidade V2 — estado para continuidade

- **Branch:** `codex/comunidade-v2`
- **Worktree:** `C:\Users\gabsc\.codex\worktrees\comunidade-v2\interprete-area-de-membros`
- **Candidato de código:** `3705bfd` (`fix(comunidade): alinhar seletor mobile ao board 38`), commit enviado à branch.
- **Preview:** App Ready no deployment `22o9mBgbCu2TX1BSEAgUQTNbDGsA`; API Ready no deployment `B34QC9x1n7TGLCCVsCMV53Bb53yh`. Ambos apontam para o SHA completo `3705bfd86517f390ba3ee83a44d9e3b0674d8d38`.
- **Etapa ativa:** 02 — Navegação e Explorar.
- **Estado:** `IN PROGRESS`. As rotas do candidato foram verificadas autenticadas e em leitura após hidratação. A comparação visual atual cobre a janela desktop; falta captura confiável do candidato nas larguras tablet/mobile e do seletor mobile aberto. O status não é aceite final.

## Implementado

- Cinco destinos da Comunidade, navegação responsiva e seletor mobile com título, botão de fechar acessível, ícones em círculos e descrições alinhados ao board 38.
- Explorar conectado às consultas reais, com busca, filtros, URL preservada, paginação por cursor e retorno contextual.
- Salvos da Comunidade integrado à listagem global de Salvos.
- Wrappers de Encontros e Gravações sobre autorização e dados existentes.
- Diretório real de grupos com Meus grupos e descoberta pública, busca, filtros e paginação.
- Estados vazios e de erro; correções anteriores de responsividade para tooltip de presença, ordem do rail mobile e altura da capa tablet.
- Sem migration, fixture de produto ou implementação de funcionalidades de etapas futuras.

## Gates locais do código candidato

- `bun run check`: passou, 978 arquivos.
- `bun run typecheck`: passou, 16/16 tarefas.
- `bun run boundaries`: passou, 906 arquivos.
- `bun run --cwd apps/app test -- components/community/community-navigation.test.tsx`: passou, 3/3 testes.
- `bun run build`: passou, 8/8 tarefas. Incluiu 787 testes do App em 162 arquivos, 9 testes da API e 24 do domínio de membros; compilação App/API concluída.
- `bun run performance:check`: passou; Comunidade 213,8 KiB gzip, abaixo do orçamento de 225 KiB.
- `bunx biome check` nos quatro arquivos de implementação e `git diff --check`: passaram antes da atualização documental.
- `graphify update .` concluiu. `/graphify-out/` está ignorado localmente e os artefatos foram preservados.
- Build carregou os `.env.local` já vinculados ao Preview. Checagem segura confirmou os arquivos e `NEXT_PUBLIC_APP_URL`, sem imprimir valores; nenhum marcador BLUE foi encontrado.

## Preview e QA visual

- GitHub marcou App e API como concluídos; o painel Vercel mostra App `Ready`, branch `codex/comunidade-v2` e commit `3705bfd`. Host autenticado: `https://interprete-area-de-membros-pkok25g17-gabrielschuchters-projects.vercel.app/comunidade`.
- A Clerk QA existente autenticou no host deste SHA. Explorar, Grupos, Salvos, Encontros, Gravações e Minhas publicações carregaram em sessão autenticada. Screenshots foram examinadas após a hidratação.
- A captura desktop mostrou as cinco opções de navegação, capa, busca/filtros e rail contextual de Explorar; a página não exibiu overflow horizontal aparente na janela capturada (~1896×900 pixels). A tela de grupos mostrou Meus grupos vazio e um grupo público existente com dois membros; a captura da dobra seguinte confirmou os cartões.
- Salvos mostrou um item real e o atalho para Salvos global. Encontros mostrou zero próximos/anteriores. Gravações mostrou zero itens e o aviso de acesso controlado. Minhas publicações carregou registros existentes, sem publicar ou editar.
- Comparação com os boards 37/38/43/44/50: hierarquia desktop, rail, filtros, cards e destinos foram conferidos; conteúdo e quantidades diferem por serem dados GREEN existentes. O board 38 motivou a correção do seletor descrita acima, coberta pelo teste de navegação; a tela mobile atualizada não foi capturada.
- O predecessor `19a0257` tinha captura hidratada a 390 CSS px e sem overflow horizontal (`scrollWidth=375`, `innerWidth=390`), mas essa medição não é evidência do código `3705bfd`. As tentativas registradas para alternar o viewport não produziram a largura desejada; não foram repetidas em loop.
- Houve skeleton transitório ao abrir Encontros e Gravações; depois de aguardar, ambas mostraram os estados reais finais. Nenhum erro ocorreu naturalmente e nenhum estado de erro foi fabricado.
- QA permaneceu somente leitura: nenhum apoio, salvar/remover, publicação, entrada/criação de grupo ou escrita no GREEN foi executada.

## Próxima etapa recomendada

Obter capturas hidratadas do SHA candidato em tablet e mobile por um mecanismo de viewport que produza larguras verificáveis, incluindo o seletor mobile aberto, e concluir a comparação correspondente aos boards. Se um erro não ocorrer naturalmente, registrar a ausência sem criar dados. Manter Etapa 02 `IN PROGRESS` até essa prova.

## Preservar

O checkout original em `C:\Users\gabsc\Documents\Codex\interprete-area-de-membros` permanece intocado. Preview e Production compartilham GREEN: manter QA somente em leitura. Não remover artefatos Graphify nem implementar etapas futuras.
