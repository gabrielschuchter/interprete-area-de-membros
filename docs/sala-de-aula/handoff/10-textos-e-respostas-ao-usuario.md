# 10 · Textos e respostas ao usuário

Todos os textos da interface, em **pt-BR**. A fonte executável é `contracts/copy.pt-BR.ts` (mesmas chaves). **Use exatamente estes textos.** Placeholders entre chaves.

## Princípios de redação

- Curtos, diretos, humanos. Sem jargão técnico, sem “erro”/“falha” na cara do aluno quando houver alternativa.
- Nunca culpar o aluno. Dizer o que aconteceu e o que fazer em seguida.
- “A equipe já foi avisada” só aparece quando há de fato um registro (`room_video_issues`) ou verificação que alerta a equipe (`05`).
- Sem emojis. Sem pontos de exclamação.
- Datas e tempos: ver formatação abaixo.

## Formatação

| Tipo | Formato | Exemplo |
|---|---|---|
| Tempo de vídeo | `m:ss`, e `h:mm:ss` a partir de 1 h | `8:42`, `1:22:43` (no chip do carimbo e no cartão de retomada, sempre `mm:ss`: `08:42`) |
| Duração de aula | minutos arredondados para cima | `15 min` |
| Data curta (miniatura e rótulo de gravação) | `dd/mm` | `09/01` |
| Data em frases | dia + mês por extenso, minúsculo | `21 de outubro` |
| Data compacta (linha de aula bloqueada) | dia + mês abreviado | `21 out.` |
| Data relativa em notas | `Hoje, 09:40` · `Ontem` · `12 de out.` | |
| Fuso | o do aluno (navegador) | |

## Sala · cabeçalho e conteúdo

| Chave | Texto |
|---|---|
| `room.back.recordings` | Minhas gravações |
| `room.subtitle.lesson` | {curso} — Módulo {n}, {modulo} |
| `room.subtitle.recording` | {serie} — {data} |
| `room.about.lesson` | Sobre a aula |
| `room.about.recording` | Sobre a gravação |
| `room.materials.title` | Materiais |
| `room.materials.type.library` | Biblioteca |
| `room.materials.type.exerciseList` | Lista |
| `room.materials.type.activity` | Atividade |
| `room.materials.type.link` | Link |
| `room.materials.type.file` | Arquivo |
| `room.materials.externalAria` | {titulo}, link externo, abre em nova aba |
| `room.mobile.headerTitle.lesson` | Aula |
| `room.mobile.headerTitle.recording` | Gravação |
| `room.readMore` | Ler mais |
| `room.continue` | Continuar |

## Dock e painel

| Chave | Texto |
|---|---|
| `dock.aria` | Ferramentas da aula |
| `dock.aulas` | Aulas |
| `dock.gravacoes` | Gravações |
| `dock.notas` | Notas |
| `dock.tempo` | Tempo |
| `panel.aria` | Painel da aula: {nome} |
| `panel.close` | Ocultar painel |
| `panel.back` | Voltar |
| `a11y.panelOpened` | Painel {nome} aberto. |
| `a11y.panelClosed` | Painel fechado. |

## Painel Aulas

| Chave | Texto |
|---|---|
| `aulas.title` | Aulas |
| `aulas.titleRecordings` | Gravações |
| `aulas.progress` | {c} de {t} |
| `aulas.groupCount` | {c}/{t} |
| `aulas.meta.watching` | assistindo |
| `aulas.meta.locked` | libera em {data} |
| `aulas.meta.unavailable` | vídeo indisponível |
| `aulas.meta.noVideo` | sem vídeo |
| `aulas.meta.duration` | {min} min |
| `aulas.checkbox.mark` | Marcar aula {n} como feita |
| `aulas.checkbox.unmark` | Desmarcar aula {n} |
| `aulas.checkbox.markRecording` | Marcar gravação de {data} como feita |
| `aulas.checkbox.unmarkRecording` | Desmarcar gravação de {data} |
| `aulas.lockedAria` | Aula bloqueada, libera em {data} |
| `aulas.marked` | Aula marcada como feita. |
| `aulas.unmarked` | Marcação removida. |
| `aulas.saveError` | Não foi possível salvar agora. Tente de novo. |

## Player

| Chave | Texto |
|---|---|
| `player.play.lesson` | Reproduzir aula |
| `player.play.recording` | Reproduzir gravação |
| `player.iframeTitle` | Vídeo: {titulo} |
| `player.resume.label` | Você parou em |
| `player.resume.cta` | Retomar |
| `player.resume.restart` | Do início |
| `player.loading` | Preparando o vídeo… |
| `player.unavailable.title` | Este vídeo está indisponível no momento. |
| `player.unavailable.body` | A equipe já foi avisada. Enquanto isso, veja os materiais da aula. |
| `player.unavailable.bodyNoMaterials` | A equipe já foi avisada. Tente de novo mais tarde. |
| `player.unavailable.materials` | Ver materiais |
| `player.retry` | Tentar de novo |
| `player.noVideo.lesson.title` | Esta aula ainda não tem vídeo. |
| `player.noVideo.lesson.body` | A aula existe, mas o vídeo ainda não foi anexado. Quando estiver disponível, ele aparece nesta página. |
| `player.noVideo.recording.title` | Esta gravação ainda não tem vídeo. |
| `player.noVideo.recording.body` | O registro do encontro está aqui, mas o vídeo ainda não foi anexado. Quando estiver disponível, ele aparece nesta página. |
| `player.locked.title` | Esta aula será liberada em {data}. |
| `player.locked.body` | Ela aparece aqui sozinha, no dia. Até lá, continue pela aula anterior. |
| `player.locked.ctaPrev` | Ir para a aula anterior |
| `player.locked.ctaCourse` | Voltar ao curso |
| `player.timeout.title` | Não foi possível carregar o vídeo. |
| `player.timeout.body` | Confira sua conexão e tente de novo. |
| `player.offline.title` | Você está sem conexão. |
| `player.offline.body` | O vídeo volta quando a conexão voltar. |

## Painel Notas

| Chave | Texto |
|---|---|
| `notes.title` | Notas desta aula |
| `notes.titleRecording` | Notas desta gravação |
| `notes.openInNotes` | Abrir em Notas |
| `notes.placeholder` | Anotar neste momento… |
| `notes.stamp.hint` | carimbo do vídeo |
| `notes.stamp.none` | Sem carimbo |
| `notes.stamp.aria` | Alternar carimbo do vídeo |
| `notes.status.saving` | Salvando… |
| `notes.status.saved` | Salvo agora |
| `notes.status.error` | Não foi possível salvar. Tentando de novo… |
| `notes.empty.title` | Nenhuma nota nesta aula ainda |
| `notes.empty.body` | O que você anotar aqui fica guardado nesta aula e também em Ferramentas, em Notas. |
| `notes.empty.cta` | Escrever a primeira nota |
| `notes.new` | Nova nota |
| `notes.menu.aria` | Mais ações da nota |
| `notes.menu.goTo` | Ir para {tempo} |
| `notes.menu.pin` | Fixar nota |
| `notes.menu.unpin` | Desafixar nota |
| `notes.menu.open` | Abrir em Notas |
| `notes.menu.trash` | Mover para a lixeira |
| `notes.trashed` | Nota movida para a lixeira. |
| `notes.undo` | Desfazer |
| `notes.actionError` | Não foi possível concluir a ação. Tente de novo. |
| `notes.loadError.title` | Não foi possível carregar as notas. |
| `notes.savedAt` | {quando} · salvo |
| `notes.format.bold` | Negrito |
| `notes.format.italic` | Itálico |
| `notes.format.list` | Lista |

## Painel Tempo

| Chave | Texto |
|---|---|
| `tempo.title` | Tempo |
| `tempo.mode.stopwatch` | Cronômetro |
| `tempo.mode.pomodoro` | Pomodoro |
| `tempo.mode.countdown` | Regressivo |
| `tempo.linked.lesson` | Vinculado a esta aula |
| `tempo.linked.recording` | Vinculado a esta gravação |
| `tempo.linked.other` | Vinculado a outra aula |
| `tempo.linkHere` | Vincular a esta aula |
| `tempo.start` | Começar |
| `tempo.pause` | Pausar |
| `tempo.resume` | Retomar |
| `tempo.reset` | Reiniciar |
| `tempo.settings` | Configurar |
| `tempo.round` | Foco {n} de {total} |
| `tempo.break` | Pausa |
| `tempo.countdown.set` | Ajustar duração |
| `tempo.withoutLink` | Começar sem vínculo |
| `tempo.focusHint` | No Modo foco, os avisos do Interprete ficam silenciados. |
| `tempo.focusCta` | Entrar no Modo foco |

## Páginas (404, 403, erro, vazios)

| Chave | Texto |
|---|---|
| `page.notFound.title` | Não encontramos esta aula. |
| `page.notFound.body` | O link pode estar errado ou a aula foi removida. |
| `page.notFound.cta` | Voltar ao curso |
| `page.notFoundRecording.title` | Não encontramos esta gravação. |
| `page.notFoundRecording.body` | O link pode estar errado ou a gravação foi removida. |
| `page.notFoundRecording.cta` | Voltar a Minhas gravações |
| `page.forbidden.title` | Você não tem acesso a este conteúdo. |
| `page.forbidden.body` | Se você acha que isso é um engano, fale com a equipe do Interprete. |
| `page.forbidden.cta` | Voltar a Aprender |
| `page.error.title` | Algo deu errado ao abrir a aula. |
| `page.error.body` | Tente de novo em instantes. Se continuar, avise a equipe. |
| `page.error.retry` | Tentar de novo |
| `page.error.back` | Voltar ao curso |
| `course.empty.title` | As aulas deste curso ainda não foram publicadas. |
| `course.empty.body` | Quando a primeira aula for liberada, ela aparece aqui. Os materiais do curso continuam disponíveis em Aprender. |
| `course.empty.cta` | Voltar a Aprender |
| `recordings.empty.title` | Nenhuma gravação por aqui ainda. |
| `recordings.empty.body` | Quando houver gravações dos seus encontros, elas aparecem aqui. |
| `recordings.noVideoBadge` | Sem vídeo |

## Respostas por situação (resumo operacional)

| Situação | O que o aluno vê | Chaves |
|---|---|---|
| Marcou aula como feita | Caixa marcada; anúncio discreto (aria-live) | `aulas.marked` |
| Desmarcou | Caixa vazia; anúncio | `aulas.unmarked` |
| Falha ao marcar | Caixa volta ao estado anterior + toast | `aulas.saveError` |
| Vídeo quebrado (verificação ou erro do YouTube) | Cartão no player | `player.unavailable.*` |
| Vídeo sem cadastro / gravação só com registro | Cartão no player | `player.noVideo.*` |
| Aula bloqueada por data | Cartão no player | `player.locked.*` |
| Demora 12 s | Cartão no player | `player.timeout.*` |
| Sem internet | Cartão no player | `player.offline.*` |
| Nota salvando/salva/erro | Texto no rodapé do editor | `notes.status.*` |
| Nota na lixeira | Toast com Desfazer (6 s) | `notes.trashed`, `notes.undo` |
| Link inválido | Página 404 | `page.notFound*` |
| Sem acesso | Página 403 | `page.forbidden.*` |
| Falha inesperada | Página de erro | `page.error.*` |

## Toasts

- Posição: parte inferior central (desktop) e acima da barra inferior (mobile), `role="status"`, `aria-live="polite"`.
- Duração: 5 s (6 s com “Desfazer”). Uma por vez; a nova substitui a anterior.
- Visual: fundo `--plum`, texto creme, raio 8, ação em dourado (`--gold`), altura mínima 48; alvo da ação 44px.
