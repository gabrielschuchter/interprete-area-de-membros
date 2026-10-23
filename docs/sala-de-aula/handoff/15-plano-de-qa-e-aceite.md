# 15 · Plano de QA e aceite

## 1. Dados de teste (seed de QA)

`contracts/seed.qa.sql` é um **modelo** (adaptar nomes de tabelas/colunas na Fase 0). Só roda em dev/preview. Cria:

**Usuários**
- `qa_aluno` (com acesso aos cursos e à série de gravações de teste).
- `qa_sem_acesso` (sem matrícula/turma).

**Curso “Mentoria em Prática Baseada em Evidências (QA)”** com 3 módulos e 8 aulas:

| # | Módulo | Aula | Vídeo | Observações |
|---|---|---|---|---|
| 1 | Primeiros conceitos | O que é prática baseada em evidências? | OK (`M7lc1UVf-VE`) | concluída |
| 2 | Primeiros conceitos | Perguntas que orientam a busca | OK | concluída; sem materiais |
| 3 | Da dúvida à busca | Formulando a pergunta (PICO) | OK, duração 872 s | 4 materiais (3 internos + 1 link externo); progresso em 522 s |
| 4 | Da dúvida à busca | Estratégias de busca | OK, trecho `start=30`, `end=600` | 2 materiais |
| 5 | Da dúvida à busca | Bases de dados | **Quebrado** (`aaaaaaaaaaa`, status `broken`) | com 1 material |
| 6 | Avaliando a evidência | Revisões sistemáticas e meta-análises | **Sem vídeo** (`videoId` nulo) | sem materiais, sem descrição |
| 7 | Avaliando a evidência | Risco de viés | OK | — |
| 8 | Avaliando a evidência | Do artigo à decisão clínica | OK | **liberação em +7 dias** (bloqueada) |

**Curso vazio:** “Curso sem aulas (QA)”, sem aulas publicadas.

**Série “Gravações de Mentoria (QA)”** com 4 gravações:

| Gravação | Vídeo |
|---|---|
| Mentoria 09/01 | OK |
| Mentoria 16/01 | OK, progresso em 70% |
| Mentoria 24/01 | **Quebrado** |
| Mentoria 31/01 | **Sem vídeo** (só o registro) |

Sem acesso: `qa_sem_acesso` não vê nada disso.

## 2. Camadas de teste

### 2.1 Unidade (obrigatório)
Funções puras em `contracts/resolve-player-state.ts` e utilitários:

| Caso | Entrada | Esperado |
|---|---|---|
| Liberação futura | `releasesAt = +1 dia` | `locked` |
| Sem vídeo | `video = null` | `no_video` |
| Sem vídeo (missing) | `availability='missing'` | `no_video` |
| Quebrado | `availability='broken'` | `unavailable` |
| `locked` vence `no_video` | futuro + sem vídeo | `locked` |
| `no_video` vence `unavailable` | missing + broken impossível, mas `video=null` | `no_video` |
| `?t` válido | `startAtSec=120` | `idle` |
| Retomável | pos 522, dur 872 | `resume` |
| Posição curta | pos 10 | `idle` |
| Perto do fim | pos 860, dur 872 | `idle` |
| Trecho | start 30, end 600, pos 40 | `idle` (40 < 30+20) · pos 100 → `resume` |
| `parseStartAt` | `'abc'`, `'-5'`, `'999999'` (dur 872), `'120'` | `null`, `null`, `null`, `120` |
| `effectiveStartSec` | resume+start 30+pos 20 | 30 (nunca antes do trecho) |

Também: cálculo de `ordinal`, contadores de grupo/curso, `inProgressPct`, ordenação de notas, formatação de tempo (`8:42`, `1:22:43`) e datas.

### 2.2 Integração (servidor)
- `getRoomPageData`: 200 com acesso; 403 sem acesso; 404 inexistente/despublicada; `locked` com data; não vaza descrição/materiais quando `locked`.
- `setCompleted`: idempotente (repetir não muda); bloqueada → `FORBIDDEN`; outra pessoa não altera meu progresso.
- `savePosition`: clamp, limite de 1 por 5 s, fim → grava 0; entrada inválida → `VALIDATION`.
- `reportVideoIssue`: deduplicação 30 min, limite 3/h.
- `/api/room/position` (beacon): autenticação por sessão; 204; rejeita origem externa.
- “Continuar”: regras de `03` (com progresso, sem progresso, sem aulas).
- Isolamento: usuário A não vê/escreve dados de B.

### 2.3 E2E (Playwright, se o repo usar; senão registrar no relatório)
`contracts/room.e2e.spec.ts` traz o esqueleto. Cobrir, no mínimo, os cenários da seção 3. Usar os `data-testid` definidos abaixo.

### 2.4 Acessibilidade
- Varredura automática (axe) nas telas: sala normal, painel Aulas aberto, painel Notas aberto, cartão de erro, 404/403.
- Teste manual de teclado e leitor de tela (VoiceOver/NVDA) nos fluxos: abrir painel, marcar aula, escrever nota, retomar vídeo.

### 2.5 Visual (manual, comparação com as telas de referência)
- Comparar estado inicial, painel Aulas, Notas e Tempo com `reference/A2_*` em 1440 px; barra recolhida com `A2_Recolhida`.
- Mobile/tablet: validar contra a especificação de `08` (não há tela de referência).

## 3. Cenários (E2E/manual)

| ID | Cenário | Resultado esperado |
|---|---|---|
| Q-01 | Abrir a aula 3 | Título, subtítulo, meandro, fachada com duração, “Sobre a aula”, “Materiais” (4 linhas), dock; **painel oculto**; 0 requisições ao YouTube |
| Q-02 | Recarregar com painel aberto | Painel volta **oculto** |
| Q-03 | Tocar Play | `loading` → vídeo tocando; requisições ao YouTube só agora |
| Q-04 | Reproduzir 20 s e recarregar | Cartão “Você parou em …”; **Retomar** começa na posição; **Do início** começa em 0 (ou no início do trecho) |
| Q-05 | `?t=120` | Sem cartão; Play começa em 2:00 |
| Q-06 | Abrir Aulas no dock | Painel 372px; módulos 2 e 3 abertos, 1 recolhido (concluído); linha atual destacada |
| Q-07 | Marcar aula 4 como feita | Caixa marcada, contadores `1/3` e `3 de 8`; anúncio; recarregar mantém |
| Q-08 | Falha de rede ao marcar | Caixa volta; toast de erro |
| Q-09 | Clicar na aula 7 no painel | Navega para a aula 7 **com o painel ainda aberto** |
| Q-10 | Aula 8 (bloqueada) | Linha com cadeado e “libera em …”; sem link; caixa desabilitada; URL direta mostra `locked` sem descrição nem materiais |
| Q-11 | Aula 5 (quebrada) | `unavailable`; botão “Ver materiais” rola à seção; “Tentar de novo” recarrega |
| Q-12 | Aula 6 (sem vídeo, sem materiais, sem descrição) | `no_video`; sem seções “Sobre a aula” e “Materiais” |
| Q-13 | Aula 2 (sem materiais) | Seção “Materiais” **inexistente**; sem bloco vazio |
| Q-14 | Notas: digitar | Cria a nota ao primeiro caractere; “Salvando…” → “Salvo agora”; recarregar mantém; aparece em Notas |
| Q-15 | Notas: carimbo | Com player ativo, chip mostra o tempo; clicar alterna “Sem carimbo”; “Ir para” leva ao instante |
| Q-16 | Notas: fixar, lixeira + desfazer | Ordem e comportamento conforme `09` |
| Q-17 | Tecla `N` | Abre Notas e foca o editor; ignorada dentro de campos |
| Q-18 | `Esc` | Fecha painel e devolve o foco ao dock |
| Q-19 | Tempo: Pomodoro, Começar | Timer corre; dock mostra o tempo; trocar de aula não interrompe; “Vinculado a esta aula” |
| Q-20 | Tempo: “Entrar no Modo foco” | Abre o Modo foco existente |
| Q-21 | Barra lateral: recolher e expandir | Símbolo ao lado do logo; recolhida mostra “I.” e troca por símbolo com fade no hover/foco |
| Q-22 | Aula inexistente / sem acesso | 404 / 403 com textos e botões de `10` |
| Q-23 | Curso sem aulas | Página do curso com “As aulas deste curso ainda não foram publicadas.” |
| Q-24 | “Continuar” (`/continuar`) | Regras de `03` |
| Q-25 | Gravações | Roteiro completo de `11` |
| Q-26 | Offline durante a abertura do player | Cartão “Você está sem conexão.” |
| Q-27 | 12 s sem carregar o player | Cartão “Não foi possível carregar o vídeo.” + `room_video_issues` registrado |
| Q-28 | Flag `roomV2` desligada | Comportamento anterior, sem diferenças |

## 4. Matriz de viewports

| Largura | O que verificar |
|---|---|
| **1440** | Layout de referência; painel acoplado; conteúdo `max-width` 1100/760 |
| **1280** | Painel acoplado ainda; sem rolagem horizontal |
| **1024** | Painel **sobreposto** sem escurecimento; barra lateral fixa |
| **820** (tablet) | Barra lateral em gaveta; painel sobreposto **com** escurecimento; dock à direita |
| **390** (mobile) | Player fixo; barra inferior; folhas; sem abas horizontais; Tempo com rádios |
| **844×390** (paisagem) | Player em tela cheia na altura; cabeçalho e barra inferior ocultos |
Testar também zoom 200% e texto aumentado do sistema.

## 5. `data-testid` (obrigatórios)

`room-root`, `room-title`, `room-subtitle`, `room-player`, `player-play`, `player-card-<estado>` (`resume`, `unavailable`, `no_video`, `locked`, `timeout`, `offline`, `loading`), `player-resume`, `player-restart`, `player-retry`, `room-about`, `room-materials`, `material-item`, `room-dock`, `dock-aulas`, `dock-notas`, `dock-tempo`, `room-panel`, `panel-close`, `outline-progress`, `group-toggle-<id>`, `lesson-item-<id>`, `lesson-check-<id>`, `lesson-link-<id>`, `note-composer`, `note-stamp`, `note-status`, `note-card-<id>`, `note-menu-<id>`, `timer-mode-<modo>`, `timer-start`, `timer-time`, `sidebar-toggle`, `toast`.

## 6. Checklist final de aceite (marcar item a item no relatório)

**Layout e visual**
- [ ] Estado inicial igual a `reference/A2_Oculto` (painel oculto, dock visível, player central).
- [ ] Sem legenda sob o player; sem “Terminou a aula?”; sem setas ao lado do título; sem blocos anterior/próxima.
- [ ] “Materiais” em linhas mínimas; seção some se não houver itens.
- [ ] Painel Aulas, Notas e Tempo iguais às telas de referência.
- [ ] Barra lateral: recolher/expandir com o símbolo ao lado do logo e o fade do “I.”.

**Funcional**
- [ ] Painel sempre começa oculto; não persiste.
- [ ] Conclusão só pela caixa; otimista com reversão; contadores corretos; persiste.
- [ ] Retomada de posição; “Retomar”/“Do início”; `?t=`.
- [ ] Trocar de aula mantém o painel aberto.
- [ ] Notas: autosave, carimbo, fixar, lixeira com desfazer, ordem, “Abrir em Notas”, tecla `N`.
- [ ] Tempo: três modos integrados ao módulo existente; vínculo; continua entre aulas; Modo foco.
- [ ] Gravações: lista abre itens sem vídeo (flag); sala em `no_video`; roteiro de `11`.

**Estados**
- [ ] `idle`, `resume`, `loading`, `playing`, `unavailable`, `no_video`, `locked`, `timeout`, `offline`.
- [ ] 404, 403, erro, curso vazio, sem notas, sem materiais.

**Segurança e dados**
- [ ] Toda leitura/mutação verifica acesso; `userId` da sessão; isolamento entre usuários.
- [ ] Zero requisições ao YouTube antes do toque; `youtube-nocookie.com`; nenhum link do YouTube visível.
- [ ] CSP ajustada (se houver).

**Qualidade**
- [ ] typecheck, lint, build, testes de unidade e integração verdes; E2E (ou justificativa).
- [ ] axe sem violações sérias; teclado completo; foco visível.
- [ ] Orçamentos de desempenho de `12` atendidos.
- [ ] Flags corretas; rollback testado (`roomV2` desligada).
- [ ] Nenhum commit/push/deploy sem autorização; nenhuma alteração em Clerk/proxy.
