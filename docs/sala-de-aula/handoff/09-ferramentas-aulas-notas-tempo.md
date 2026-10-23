# 09 · Ferramentas de bolso: Aulas, Notas e Tempo

O dock tem três ferramentas. Cada uma abre no painel de 372px (desktop) ou numa folha (mobile). As três funcionam em **qualquer** estado do player.

## A. Aulas (ou Gravações)

**Título do painel:** “Aulas” para aula de curso; “Gravações” para gravação de encontro (`outline.panelTitle`).

### Cabeçalho do conteúdo
- Nome do curso (ou da série): Source Serif 4 600 16px/1.3.
- Progresso: barra de 4px (`--vine` sobre `--line`) + texto `{concluídas} de {total}` (Inter 500 12.5px, `--muted`). Total = todas as aulas **publicadas** do curso.

### Grupos (módulos ou séries)
- Cabeçalho do grupo: `<button aria-expanded>`, altura mín. 44, fundo `--soft`, raio 6, padding `0 12px`; título Source Serif 4 600 15px; contador `{c}/{t}` Inter 500 12.5px; chevron 16px.
- Abertos por padrão: grupos que **contêm a aula atual ou algum item não concluído**. Recolhidos: totalmente concluídos. O aluno pode alternar durante a sessão da sala.
- Ao abrir o painel, rolar a linha atual para o centro se estiver fora da área visível.

### Linha (item)
Estrutura **semântica correta** (o mockup colocou a caixa dentro do link; **não repita**):

```
<li class="lesson-item">
  <label class="lesson-item__check">   ← 36×44 de área clicável
    <input type="checkbox" aria-label="Marcar aula 3 como feita">
  </label>
  <a class="lesson-item__link" href=… aria-current="page"?>   ← miniatura + texto
    <span class="thumb">…</span>
    <span class="text"><span class="title">…</span><span class="meta">…</span></span>
  </a>
</li>
```
- Padding da linha `6px 8px 6px 2px`; raio 8; linha atual com fundo `--tint`.
- Caixa de seleção nativa 20px com `accent-color: --plum`; marcada = aula feita.
- Miniatura **88×50**, raio 5, gradiente da marca, templo em linha (62%×82%, 30%), **número** em Source Serif 4 600 18px creme (canto inferior esquerdo, 8px/5px). Gravação: no lugar do número, a **data curta** (`09/01`) em serifa 15px.
- Em andamento: fio de 3px na base da miniatura (trilho `rgba(241,235,232,.3)`, preenchimento ouro).
- Bloqueada: miniatura escurecida `rgba(21,10,18,.55)` + cadeado creme 18px; caixa desabilitada; item sem link (`aria-disabled="true"`).
- Título: Inter 14px/1.3 (500; **600** na atual), até 2 linhas. Linha 2: Inter 12.5px `--muted` (regras em `06` §4).
- Clicar na caixa **não navega**; clicar no restante navega.
- Contadores (módulo e curso) atualizam otimisticamente ao marcar (`06` §4).

### Textos
`10`, seção “Painel Aulas”.

## B. Notas

**Título:** “Notas desta aula” (gravação: “Notas desta gravação”). À direita, “Abrir em Notas” (link para a rota existente de Notas filtrada por este conteúdo) e o X.

### Composer
- Caixa: borda `1px --line`, raio 8, fundo branco, padding `12px 12px 8px`. Foco: borda `1.5px --vine` + anel `0 0 0 3px rgba(140,21,53,.14)`.
- Topo: chip de carimbo (IBM Plex Mono 500 12px, fundo `--tint`, texto `--plum`, ícone relógio 12px) + legenda “carimbo do vídeo”. O chip é um **botão** (alterna “com carimbo”/“Sem carimbo”).
- Corpo: o **editor de texto existente** (editor da Comunidade). Placeholder “Anotar neste momento…”. Altura mínima 66px (2 linhas) / 88px (3 linhas).
- Rodapé: botões de formatação 32px (negrito, itálico, lista) e, à direita, o estado (“Salvando…”, “Salvo agora”, “Não foi possível salvar. Tentando de novo…”).
- Salvamento automático (`06` §5). **Sem** botão “Salvar”.

### Lista
- Cada nota: padding `12px 14px`, raio 8, fundo `--soft`, borda `--line`, sombra `0 1px 0 rgba(64,34,47,.05)`.
- Topo: chip de carimbo (ou “Sem carimbo”, Inter 12px `--muted`), espaço, ícone de fixada (se fixada, `--vine`), botão “mais” (44×44 de área, ícone 18px).
- Corpo: HTML da nota (Inter 14px/1.55). Rodapé: “Hoje, 09:40 · salvo” (Inter 12px `--muted`; datas relativas em pt-BR).
- **Menu da nota** (popover, 220px, raio 8, sombra `0 14px 30px rgba(64,34,47,.16)`): `Ir para {mm:ss}` (só com carimbo e player disponível), `Fixar nota`/`Desafixar nota`, `Abrir em Notas`, `Mover para a lixeira` (cor `--error`). Itens de 44px.
- Clique no chip de carimbo de uma nota salva também faz “Ir para”.
- Ordem: fixadas; com carimbo (crescente); sem carimbo (mais recentes primeiro).
- Vazio: bloco tracejado com ícone, “Nenhuma nota nesta aula ainda”, texto e botão “Escrever a primeira nota” (foca o editor).
- Atalho `N` abre este painel e foca o editor (`03`).

## C. Tempo

**Título:** “Tempo”. Integra o que a plataforma já tem: **Cronômetro**, **Pomodoro** e **Contagem regressiva**. **Reutilize a lógica existente** através do `StudyTimerAdapter` (`05`/`contracts/room.types.ts`). Nada de novo temporizador.

### Desktop
- Seletor de modo (controle segmentado de 40px): `Cronômetro | Pomodoro | Regressivo`.
- Cartão central (`border:1px --line`, raio 10, padding `22px 18px`, fundo `--soft`, itens centralizados, gap 14):
  - Chip “Vinculado a esta aula” (quando o timer está vinculado a este conteúdo). Gravação: “Vinculado a esta gravação”.
  - Tempo: Source Serif 4 600 60px/1, `letter-spacing:-.02em`.
  - Linha de contexto: Pomodoro → quatro pontos de 8px (o atual em `--vine`, os demais `--line`) + “Foco {n} de {total}” (ou “Pausa”); Regressivo → campo para ajustar a duração; Cronômetro → nada.
  - Botões: **Começar** (primário 44px) / **Pausar** / **Retomar**; botão “mais” 44px (configurar, abre as opções existentes do módulo); **Reiniciar** como item das opções.
- Abaixo do cartão: link “Começar sem vínculo” (Inter 500 13.5px `--vine`): inicia o timer sem associá-lo à aula.
- Texto auxiliar (Inter 13.5px `--muted`): “No Modo foco, os avisos do Interprete ficam silenciados.”
- Botão secundário de 44px, largura total: **“Entrar no Modo foco”** → rota existente do Modo foco, enviando o contexto (`aula`/`gravacao` + id), conforme a Fase 0.
- “Começar” inicia o timer **vinculado** à aula atual por padrão.

### Mobile
- **Sem** controle segmentado: três linhas de rádio (Cronômetro, Pomodoro, Regressivo), cada uma com 56px, depois o cartão e os botões.

### Comportamentos
- O timer **continua** ao trocar de aula, fechar o painel ou navegar; só para pelo próprio controle.
- Se o timer estava vinculado a outra aula e o aluno troca de aula: mantém o vínculo original; o chip mostra “Vinculado a outra aula” (Inter, `--muted`) e o botão “Vincular a esta aula” fica disponível no menu “mais”.
- Dock: quando rodando, mostra o tempo (ver `08` §4).
- Quando um Pomodoro muda de fase ou um regressivo termina, usar a notificação/aviso **que o módulo já usa**. Não criar canal novo.

## Estados e erros das ferramentas

| Situação | Comportamento |
|---|---|
| Notas indisponíveis (falha ao listar) | Bloco de erro no painel: “Não foi possível carregar as notas.” + botão “Tentar de novo”. O composer continua utilizável. |
| Falha ao fixar/lixeira | Toast `notes.actionError`, revertendo o estado otimista. |
| Tempo sem suporte (adaptador ausente) | O ícone Tempo **não aparece** no dock (nada de botão morto). Registrar no relatório. |
| Aulas: falha ao salvar conclusão | Reverter + toast (`06` §4). |
