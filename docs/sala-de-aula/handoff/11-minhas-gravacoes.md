# 11 · Minhas gravações dentro da Sala (inclui o caminho de QA)

## Objetivo

1. **Gravações de encontros** passam a ser conteúdo da sala (`kind='recording'`, rota `/gravacoes/[gravacaoId]`).
2. **Itens sem vídeo** (só o registro do encontro) passam a **abrir**. Dentro da sala aparece o estado “sem vídeo”. Isso permite **QA completo** do fluxo sem depender de vídeos reais e evita itens mortos na lista.

## Situação de partida (confirmar na Fase 0)

Provavelmente, em Minhas gravações, itens sem vídeo aparecem desabilitados ou sem ação. Descubra como é hoje e registre no `DISCOVERY.md`.

## Mudança na lista (Minhas gravações)

- **Todos** os itens passam a ser link para `/gravacoes/[gravacaoId]`.
- Itens sem vídeo ganham um selo discreto: chip “Sem vídeo” (Inter 500 12px, `--muted`, fundo branco, borda `--line`). Não esmaecer o item inteiro: ele é clicável.
- Vídeo **quebrado** (reprovado na verificação) **não** ganha selo na lista: o selo “Sem vídeo” é só para registros sem vídeo. O estado de vídeo quebrado aparece dentro da sala (consistência com a trilha, `06` §4).
- Lista vazia: `recordings.empty.*`.

## Feature flag da abertura

- Flag `roomOpenRecordingsWithoutVideo` (mesmo mecanismo da `roomV2`).
- **Padrão: ligada** (pedido do produto). Se desligada, a lista volta ao comportamento atual (itens sem vídeo não clicáveis).
- Pode ser restringida depois a equipe/QA sem mudar código da sala.

## Sala com `kind='recording'`

| Elemento | Comportamento |
|---|---|
| Rota | `/gravacoes/[gravacaoId]` (se `/gravacoes` tiver outro caminho hoje, mantenha) |
| Link voltar | “Minhas gravações” → `/gravacoes` |
| Crumb do cabeçalho | `MINHAS GRAVAÇÕES · GRAVAÇÃO` |
| Título | Título da gravação (ex.: “Mentoria 09/01”) |
| Subtítulo | `room.subtitle.recording`: `{série} — {data por extenso}` (ex.: “Gravações de Mentoria — 9 de janeiro”). Sem série: apenas a data. |
| Descrição | “Sobre a gravação” se houver; senão a seção não existe |
| Materiais | Os associados à gravação, se existirem; senão não existe |
| Dock | “Gravações” no lugar de “Aulas”; “Notas”; “Tempo” |
| Painel Gravações | Agrupado por **série/turma** (ex.: “Gravações de Mentoria”), contador `{c}/{t}`; linhas iguais às de aulas, com **data curta** na miniatura em vez do número; ordem por data decrescente |
| Conclusão | Mesma caixa (`room_progress` com `content_kind='recording'`) |
| Posição | Mesma lógica de retomada |
| Notas | Vinculadas à gravação (`notes.titleRecording`) |

## Estado “sem vídeo” (o caminho de QA)

Quando a gravação não tem vídeo anexado (`videoId` vazio ou `availability='missing'`):

- `initialPlayerState = 'no_video'`.
- Pôster esmaecido + cartão de vidro com ícone de vídeo (ouro) e:
  - Título: `player.noVideo.recording.title` → “Esta gravação ainda não tem vídeo.”
  - Texto: `player.noVideo.recording.body` → “O registro do encontro está aqui, mas o vídeo ainda não foi anexado. Quando estiver disponível, ele aparece nesta página.”
  - **Sem botões** (não há o que tentar).
- Título, subtítulo, descrição, materiais, dock e painéis funcionam normalmente.
- **Não** chamar `reportVideoIssue` (não é falha; é ausência de cadastro).
- Não mostrar “A equipe já foi avisada” neste caso (não é verdade).

Vídeo anexado, mas quebrado → `unavailable` (texto do `player.unavailable.*`), igual às aulas.

## Roteiro de QA (usar o seed de `15`)

1. Entrar em Minhas gravações. Ver 4 itens: dois com vídeo OK, um com vídeo quebrado, um sem vídeo (com selo “Sem vídeo”).
2. Abrir o item sem vídeo → sala em `no_video`; trilha mostra os 4 itens da série; item atual destacado.
3. Marcar o item como feito na trilha → caixa marcada; contador da série muda; recarregar mantém.
4. Escrever uma nota (sem carimbo, pois não há player) → “Sem carimbo”; recarregar mantém.
5. Abrir o item com vídeo quebrado → `unavailable`; **não** “sem vídeo”.
6. Abrir um item com vídeo OK → fachada; tocar; sair; voltar → cartão de retomada.
7. Desligar a flag `roomOpenRecordingsWithoutVideo` → lista volta ao comportamento atual; rota direta continua válida e mostra `no_video`.
8. Abrir a URL de uma gravação inexistente → 404 `page.notFoundRecording.*`; de outra turma → 403.

## Riscos

- **Dados:** se hoje gravações não têm identificador estável ou agrupamento por série, resolver na Fase 0 (usar o campo existente que agrupa, como turma/encontro) e registrar.
- **Acesso:** regra de acesso a gravações pode diferir da de cursos (por turma). Usar a regra existente; **nunca** abrir acesso a gravações de outra turma por causa da flag.
