# 12 · Acessibilidade, desempenho, segurança e observabilidade

## Acessibilidade (meta: WCAG 2.1 AA)

| Tema | Requisito |
|---|---|
| Estrutura | Landmarks: `nav` (barra lateral), `header`, `main`, `aside` (painel), `nav` (dock, `aria-label="Ferramentas da aula"`). Um único `h1` (título da aula). Seções com `h2`. |
| Teclado | Tudo operável só com teclado. Ordem: voltar → player → leitura → materiais → painel (quando aberto) → dock. Foco sempre visível: contorno 2px `--bg` + anel 4px `--vine` (`:focus-visible`). |
| Dock | Botões com `aria-pressed`, `aria-controls="room-panel"`, `aria-expanded`. Abrir move o foco para o painel (primeiro elemento focável); fechar devolve o foco ao botão. |
| Painel e folhas | `role="region"` com `aria-label`; folhas mobile com `role="dialog"` e `aria-modal="true"`, foco preso dentro e devolvido ao fechar. `Esc` fecha. |
| Caixa “marcar como feita” | `<input type="checkbox">` nativo com `aria-label` (`aulas.checkbox.*`). Mudança anunciada em região `aria-live="polite"` (`aulas.marked`/`unmarked`). |
| Trilha | Lista semântica (`ul`/`li`). Aula atual com `aria-current="page"`. Bloqueada com `aria-disabled="true"` e `aria-label` com a data. Grupos com `aria-expanded`. |
| Player | Botão Play com `aria-label`; cartões de estado em `role="status"` (ou `role="alert"` para `unavailable`/`timeout`). `iframe` com `title`. |
| Cartão de retomada | Foco inicial no botão “Retomar” quando o cartão aparece **por ação do aluno** (não roubar foco ao carregar a página). |
| Notas | Editor com `aria-label="Escrever nota"`; status de salvamento em `aria-live="polite"`; menu da nota com `role="menu"` e setas. |
| Contraste | Texto `--muted` (#7A5A69) sobre `--bg` (#F1EBE8) ≈ 5,2:1; sobre branco ≈ 6,3:1. Sobre pôster e vidro: texto `#F1EBE8` sobre camada escura (≥ 4,5:1). Não usar `--disabled` (#BFA9A3) para texto. |
| Alvos de toque | ≥ 44×44px (caixa de seleção: área 36×44 do `label`). |
| Movimento | `prefers-reduced-motion: reduce`: sem transições nem spinner animado (trocar por texto “Preparando o vídeo…” estático). |
| Cor não é a única pista | Concluída = caixa marcada; atual = texto “assistindo”; bloqueada = cadeado + texto. |
| Idioma | `lang="pt-BR"`. |

## Desempenho (orçamentos)

| Métrica | Meta |
|---|---|
| Requisições ao YouTube antes do toque | **0** |
| JS da sala (gzip) além do que a área de membros já carrega | ≤ 60 kB (editor de notas e timer já existentes ficam em *code-splitting*: carregar só ao abrir o painel) |
| LCP (4G rápido, celular médio) | ≤ 2,5 s: o elemento LCP é o título/pôster (SVG inline, sem imagem externa) |
| CLS | ≤ 0,05: player com `aspect-ratio`; dock e painel com larguras fixas; esqueletos com a mesma altura |
| INP | ≤ 200 ms nas ações do painel e da caixa |

Táticas:
- Pôster, meandro e templo em **SVG inline/CSS**; zero imagens raster.
- Dados da sala em **uma consulta** (`05`); sem cascatas no cliente.
- `next/dynamic` para: editor de notas, módulo de Tempo, API do YouTube (só no toque).
- Fontes: `font-display: swap`; Source Serif 4 (400, 600, 400 itálico), Inter (400, 500, 600), IBM Plex Mono (400, 500). Carregar só o que a sala usa (verificar o que já existe).
- `backdrop-filter` apenas no botão Play, nos cartões de vidro e na barra inferior mobile.
- Painel **não** é renderizado até ser aberto pela primeira vez (depois pode permanecer montado, oculto).

## Segurança e privacidade

- `userId` sempre da sessão; verificação de acesso em toda leitura/mutação (`04`, `05`).
- Validação de entrada (zod) e limites de tamanho de corpo.
- Notas: sanitizar HTML com o sanitizador do editor existente ao salvar e ao renderizar.
- `youtube-nocookie.com`, sem cookies de terceiros antes do toque; o link do YouTube nunca é mostrado (LD-14).
- CSP: acrescentar apenas os domínios do YouTube necessários (`07`).
- Links externos: `rel="noopener noreferrer"`.
- Nenhum dado pessoal em logs; `user_agent` em `room_video_issues` truncado a 200 caracteres.
- Rate limits (`05`).
- `noindex` na sala.

## Observabilidade

- Logs estruturados de servidor (sem PII): `room.load` (kind, id hash, estado inicial), `room.setCompleted`, `room.savePosition` (amostrado 1%), `room.videoIssue` (kind, id, code).
- Erros inesperados: reportar ao mecanismo de erros já usado pelo projeto (Sentry ou equivalente, **se existir**).
- Medição opcional (apenas se já houver analytics no produto): `room_opened`, `room_panel_opened{tool}`, `room_note_created`, `room_completed_toggled`. **Não** adicionar ferramenta de analytics nova.
