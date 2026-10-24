# 06 · Lógica e estados

Cinco máquinas independentes: **página**, **player**, **painel**, **linha da trilha** e **nota**. O Tempo é do módulo existente. Código de referência da resolução inicial em `contracts/resolve-player-state.ts` (função pura; escreva testes de unidade).

## 1. Estados de página (resolvidos no servidor, `03`)

| ID | Estado | Condição | Resposta | Texto |
|---|---|---|---|---|
| S-P1 | Pronta | Acesso, existe, publicada | 200 | — |
| S-P2 | Não encontrada | Não existe / despublicada / fora do curso da URL | 404 | `page.notFound` |
| S-P3 | Sem acesso | Sem matrícula/turma | 403 | `page.forbidden` |
| S-P4 | Erro | Falha inesperada | error boundary | `page.error` |
| S-P5 | Curso sem aulas | Zero aulas publicadas | página do curso (não a sala) | `course.empty` |

Cada estado de erro de página tem layout próprio: cabeçalho e barra lateral normais, bloco central com ícone, título em serifa, texto, e um ou dois botões. Veja `08`.

## 2. Estados do player

**Resolvidos no servidor** (`initialPlayerState`), por precedência:

| Precedência | Estado | Condição |
|---|---|---|
| 1 | `locked` | Liberação no futuro |
| 2 | `no_video` | Sem vídeo cadastrado (`videoId` vazio) ou `availability='missing'` |
| 3 | `unavailable` | `availability='broken'` na verificação |
| 4 | `idle` | Tem `?t=` válido |
| 5 | `resume` | Posição elegível (regra de retomada) |
| 6 | `idle` | Padrão |

**Cliente** (superconjunto): `loading`, `playing`, `paused`, `ended`, `error_timeout`, `offline`.

### Transições

```
idle | resume ── toque em Play / Retomar / Do início ──▶ loading
loading ── YouTube pronto e tocando ──▶ playing
loading ── 12 s sem ficar pronto ──▶ error_timeout   (+ reportVideoIssue 'timeout')
loading | playing | paused ── erro 2/5/100/101/150 ──▶ unavailable   (+ reportVideoIssue)
playing ⇄ paused
playing ── fim do vídeo (ou fim do trecho 'end') ──▶ ended
idle | resume | loading ── navegador offline ──▶ offline ── voltou a conexão ──▶ estado anterior
error_timeout ── Tentar de novo ──▶ loading (destrói e recria o player)
unavailable (do cliente) ── Tentar de novo ──▶ loading
unavailable (do servidor) ── Tentar de novo ──▶ router.refresh(); se continuar quebrado, permanece
mudança de rota ── destrói o player (salva a posição antes) ──▶ novo ciclo
```

### Retomada (regra única)

- **Elegível** quando `lastPositionSec ≥ max(20, trechoInicio + 20)` **e** (`fim` desconhecido **ou** `lastPositionSec ≤ fim − 20`), com `fim = endSec ?? durationSec`.
- “**Retomar**”: começa em `max(trechoInicio, lastPositionSec)`.
- “**Do início**”: começa em `trechoInicio ?? 0`. Salva a nova posição normalmente.
- Com `?t=`: **sem** cartão; o play começa em `max(trechoInicio, t)`.
- Aula **concluída** com posição elegível: oferece retomada igual (concluir não zera a posição).
- Fim do vídeo grava posição `0` (`05`), então a próxima abertura é `idle`.

### O que cada estado mostra

| Estado | Player | Título + subtítulo | Descrição | Materiais | Dock e painel |
|---|---|---|---|---|---|
| `idle` | Fachada com Play e chip de duração (se conhecida) | sim | sim | se houver | funcionam |
| `resume` | Fachada + cartão de vidro “Você parou em 08:42” (Retomar / Do início) + fio dourado de 3 px na base com o % assistido | sim | sim | se houver | funcionam |
| `loading` | Pôster esmaecido com spinner e “Preparando o vídeo…” | sim | sim | se houver | funcionam |
| `playing` / `paused` / `ended` | Iframe com controles nativos | sim | sim | se houver | funcionam |
| `unavailable` | Pôster esmaecido + cartão de vidro: alerta, “Este vídeo está indisponível no momento.”, texto, botões | sim | sim | se houver; botão “Ver materiais” só se houver | funcionam |
| `no_video` | Pôster esmaecido + cartão: ícone de vídeo, título e texto de “sem vídeo” | sim | sim | se houver | funcionam |
| `locked` | Pôster esmaecido + cartão com cadeado e a data | sim | **oculta** | **ocultos** | **Aulas** funciona; **Notas** e **Tempo** funcionam |
| `error_timeout` | Cartão com alerta, “Não foi possível carregar o vídeo.” e “Tentar de novo” | sim | sim | se houver | funcionam |
| `offline` | Cartão “Você está sem conexão.” | sim | sim | se houver | funcionam |

Regras:
- Textos exatos em `10`. “Ver materiais” rola até a seção “Materiais” e foca o título dela; se não há materiais, o botão **não existe**.
- Notas funcionam em qualquer estado. Sem player ativo, o carimbo é nulo (“Sem carimbo”).
- `locked` não expõe descrição nem materiais (conteúdo ainda não liberado).

## 3. Estados do painel (cliente)

```
estado: null | 'aulas' | 'notas' | 'tempo'      (inicial SEMPRE null)
clicar no ícone do dock:
  se estado == ícone  → null (oculta)
  senão               → ícone (abre ou troca o conteúdo sem fechar)
X no cabeçalho do painel → null
Esc → null (devolve o foco ao ícone que abriu)
tecla N → 'notas' + foco no editor
trocar de aula pelo painel Aulas → estado permanece
sair da sala e voltar → null (provedor remonta)
```
- Não persistir em `localStorage`/cookie (LD-03).
- Abrir/fechar não perde nada: rascunho de nota e estado do Tempo vivem fora do painel.

## 4. Linha da trilha (painel Aulas)

Cada item combina flags. Aparência:

| Situação | Caixa | Miniatura | Linha 2 |
|---|---|---|---|
| Atual | normal | normal | “assistindo” (vinho, 600) |
| Em andamento (não atual) | normal | fio dourado de 3 px com o % | duração |
| Concluída | marcada | normal | duração |
| Bloqueada | **desabilitada** | escurecida + cadeado | “libera em {data}” |
| Vídeo indisponível | normal | normal | “vídeo indisponível” |
| Sem vídeo | normal | normal | “sem vídeo” |
| Padrão | desmarcada | normal | duração (“15 min”) |

Prioridade da linha 2: bloqueada > atual > indisponível > sem vídeo > duração. Linha atual com fundo `--tint`. Itens bloqueados **não navegam**.

### Conclusão (LD-06)

- Marcar/desmarcar: **otimista**. Atualiza a caixa, o contador do módulo e o do curso na hora; chama `setCompleted` com o valor absoluto.
- Sucesso: reconcilia contadores com `summary`. Aviso discreto (região `aria-live="polite"`, sem toast visual obrigatório): `panel.aulas.marked`/`panel.aulas.unmarked`.
- Falha: **reverte** caixa e contadores e mostra toast de erro `panel.aulas.saveError`.
- Dois cliques rápidos: serializar (ignorar o 2º até o 1º terminar) ou enfileirar; nunca enviar valores contraditórios fora de ordem.
- Concluir **nunca** muda de aula, nunca abre nada, nunca dispara animação grande.
- Regra de grupos abertos: abrir módulos/séries que **contêm a aula atual ou algum item não concluído**; recolher os totalmente concluídos. Depois, o aluno controla; o estado dura só enquanto a sala está montada.

## 5. Nota (painel Notas)

```
composer vazio ── 1ª alteração não vazia ──▶ criando (createNote) ──▶ salvando ──▶ salvo
salvo ── edição ──▶ salvando (debounce 800 ms) ──▶ salvo
salvando ── falha ──▶ erro (repetir com recuo exponencial: 2 s, 5 s, 15 s; mantém o texto) ──▶ salvo
perder o foco com composer vazio ── descarta (nada é criado)
```
- Rodapé do editor mostra: `Salvando…`, `Salvo agora` ou `Não foi possível salvar. Tentando de novo…`.
- **Carimbo:** ao abrir um composer novo, captura `getCurrentTime()` (inteiro) se o player existe; senão nulo. Clicar no chip alterna entre “com carimbo” (mantém o valor capturado) e “Sem carimbo”.
- Trocar de aula: **descarrega** (flush) o rascunho em salvamento antes de navegar; o composer da nova aula começa vazio.
- Lixeira com desfazer (`notes.trashed` + “Desfazer”, 6 s).

## 6. Casos de borda

| Caso | Comportamento |
|---|---|
| Aula sem duração conhecida | Sem chip de duração; sem % de andamento; retomada usa só a posição (`end` desconhecido). |
| Duas abas/dispositivos | Última escrita vence. Sem bloqueio. |
| Aluno tenta concluir aula bloqueada | Servidor devolve `FORBIDDEN`; cliente reverte; checkbox já vem desabilitado, então só ocorre por requisição manual. |
| Aula despublicada com a sala aberta | Próxima ação falha com `NOT_FOUND`; toast genérico de erro; a navegação seguinte mostra 404. |
| Sessão expirada | Resposta `UNAUTHENTICATED`: seguir o fluxo existente do Clerk (redirecionar para entrar). Rascunho de nota fica no editor até o redirecionamento. |
| `?t=` inválido | Ignorado. |
| Troca rápida de aulas | Cancelar timers do player anterior; salvar posição do anterior; descartar respostas atrasadas (usar chave `kind:id`). |
| Gravação sem série/agrupamento | Painel mostra um único grupo com o título “Gravações”. |
| Curso com um único módulo | Cabeçalho do módulo ainda aparece (para consistência) e começa aberto. |
| Reduzir movimento ativado | Sem transições (`12`). |
