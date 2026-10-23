# 14 · Plano de implementação

Fases sequenciais. Cada fase tem entregáveis, critério de pronto e verificação. Todo o trabalho fica **local** (sem commit/push/deploy sem autorização) e **atrás da flag `roomV2`**.

## Feature flags

| Flag | Efeito | Padrão em dev | Padrão em produção |
|---|---|---|---|
| `roomV2` | Liga a nova sala (rotas novas/ajustadas, layout, dock, painéis). Desligada: comportamento atual **idêntico**. | ligada | **desligada** até o QA final |
| `roomOpenRecordingsWithoutVideo` | Itens de Minhas gravações sem vídeo abrem a sala | ligada | ligada (quando `roomV2` ligar) |
| `roomNotesTimestamp` | Carimbo de tempo nas notas + “Ir para” | ligada | ligada |
| `roomSavePosition` | Salva posição e oferece retomada | ligada | ligada |

Mecanismo: o do repositório (descobrir na Fase 0). Se não houver, variáveis de ambiente lidas no servidor (`ROOM_V2=1`) e expostas ao cliente apenas por props.

## Fase 0 · Descoberta
Entrega: `DISCOVERY.md` (`02`). Pronto quando: todos os itens do checklist respondidos; lacunas e riscos listados.

## Fase 1 · Dados e domínio
- Migração aditiva (`contracts/schema.sql` adaptada): `room_progress`, `room_video_issues`; colunas de notas (`video_time_sec`, `pinned`) se faltarem.
- Repositórios: `progressRepo`, `roomContentRepo` (aula/gravação → `RoomPageData`), `outlineRepo`, `issuesRepo`.
- Funções puras e testadas: `resolveInitialPlayerState`, `isResumable`, `effectiveStartSec`, `parseStartAt`, cálculo de `ordinal`, contadores, ordenação de notas.
- Regras de acesso e liberação reutilizadas.
- **Pronto:** testes de unidade verdes; migração aplicada e revertida com sucesso em banco local; typecheck/lint/build.

## Fase 2 · Rotas, carregamento e estados de página
- Rotas (`03`): sala de aula, `continuar`, sala de gravação; 404/403/erro; metadados; `noindex`.
- Carregador de servidor único (`getRoomPageData`).
- Ações: `markOpened`, `setCompleted`, `savePosition` (+ handler `POST /api/room/position`), `reportVideoIssue`.
- Páginas de estado (`08` §7) sem o layout final ainda (versão funcional).
- **Pronto:** testes de integração das ações (acesso, validação, idempotência, limites); rotas respondem 200/403/404 corretamente com seeds.

## Fase 3 · Layout desktop e player
- Estrutura da sala (`08` §1–3), tipografia, meandro, “Sobre a aula”, “Materiais”.
- `PlayerFacade`, `useYouTubePlayer`, estados do player (`06`/`07`), cartões de vidro, persistência de posição, retomada.
- CSP ajustada (se aplicável).
- **Pronto:** estados `idle`, `resume`, `loading`, `playing`, `unavailable`, `no_video`, `locked`, `timeout`, `offline` verificáveis no navegador; 0 requisições ao YouTube antes do toque; posição salva e retomada ao recarregar.

## Fase 4 · Dock e painéis
- Dock, painel (acoplado/sobreposto), provedor de estado da sala (inicia `null`).
- **Aulas:** trilha com grupos, linhas, miniaturas, caixa de conclusão (otimista), navegação sem remontar o provedor.
- **Notas:** composer (autosave, carimbo, ordem, menu, lixeira com desfazer, “Abrir em Notas”), tecla `N`.
- **Tempo:** integração com o módulo existente por adaptador; dock com tempo rodando; “Entrar no Modo foco”.
- **Pronto:** `09` inteiro funcional; sem divergência visual das telas válidas (`reference/A2_*`).

## Fase 5 · Tablet e mobile
- Breakpoints (`08` §8–10): painel sobreposto, gaveta da barra lateral (existente), barra inferior, folhas, player fixo, paisagem.
- **Pronto:** QA nas larguras 390, 820, 1024, 1280, 1440; sem rolagem horizontal; sem abas horizontais no mobile.

## Fase 6 · Minhas gravações
- Rota `/gravacoes/[id]`, `kind='recording'` em todo o fluxo; lista com itens abrindo e selo “Sem vídeo”; flag.
- **Pronto:** roteiro de QA de `11` passa por inteiro.

## Fase 7 · Acabamento, a11y, desempenho, limpeza
- Auditoria de acessibilidade (`12`), orçamentos de desempenho, textos conferidos contra `10`, remoção de código morto **só da nova sala** (não apagar a sala antiga: ela fica atrás da flag até a decisão de produto).
- Relatório final (`00`).

## PRs sugeridos (se o fluxo do repositório usar PRs)

| PR | Conteúdo |
|---|---|
| 1 | Fase 1 |
| 2 | Fase 2 |
| 3 | Fase 3 |
| 4 | Fase 4 |
| 5 | Fases 5 e 6 |
| 6 | Fase 7 |
Cada PR compila e passa nos testes **com a flag desligada**.

## Rollout

1. Dev/preview com `roomV2` ligada; QA manual completo (`15`).
2. Produção com flag **desligada**; deploy do código inerte.
3. Ligar para a equipe/QA (se o mecanismo permitir por usuário) e repetir o checklist em produção.
4. Ligar para todos, com observação de erros e do volume de `room_video_issues` nas primeiras 48 h.

## Rollback

- Desligar `roomV2`: volta ao comportamento anterior imediatamente (nenhuma migração precisa ser revertida; são aditivas).
- Reverter migrações (`schema.sql`, bloco de reversão) **só** com autorização e depois de confirmar que nada depende das tabelas.
