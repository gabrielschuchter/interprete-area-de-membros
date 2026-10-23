# 05 · API e ações

A implementação pode usar **Server Actions** e/ou **Route Handlers**, conforme o padrão do repositório. Os contratos abaixo valem para qualquer um. Tipos completos em `contracts/room.types.ts`.

## Princípios

1. O `userId` vem **sempre** da sessão no servidor. Nunca de body, query ou header do cliente.
2. Toda leitura/mutação verifica **acesso ao conteúdo** (`04`).
3. Validação de entrada com **zod** (ou o validador do repo). Entrada inválida → `VALIDATION` (422).
4. Mutações são **idempotentes** (valores absolutos, não “alternar”).
5. Respostas de erro seguem um formato único e **nunca** vazam detalhes internos.
6. Nenhum dado pessoal em logs.

## Formato de erro

```ts
type RoomErrorCode =
  | 'UNAUTHENTICATED' // 401
  | 'FORBIDDEN'       // 403 (sem acesso, ou aula bloqueada)
  | 'NOT_FOUND'       // 404
  | 'VALIDATION'      // 422
  | 'CONFLICT'        // 409
  | 'RATE_LIMITED'    // 429
  | 'INTERNAL';       // 500
interface RoomError { code: RoomErrorCode; message: string; retryAfterSec?: number }
```
`message` é técnica e curta (inglês). O texto ao aluno vem de `10`, escolhido pelo cliente a partir de `code`.

## Leitura

### `getRoomPageData({ kind, id, startAtSec? })`
- Usado pelo carregador da rota (servidor). **Uma consulta agregada** (sem cascata): conteúdo, vídeo, liberação, progresso do usuário, materiais, trilha (outline) com status por item.
- Retorna `RoomPageData` ou lança `NOT_FOUND`/`FORBIDDEN` (a rota converte em 404/403, `03`).
- `initialPlayerState` já resolvido no servidor por `resolvePlayerState` (`06`).
- A trilha traz **todos** os itens do curso/série (um curso tem dezenas de aulas; sem paginação nesta entrega).

## Mutações

### `markOpened({ kind, id })`
- Chamada pelo cliente **uma vez por montagem da aula** (efeito), nunca durante a renderização do servidor.
- Faz upsert em `room_progress` atualizando `last_opened_at = now()`.
- Falha silenciosa (log), nunca interrompe a sala.

### `setCompleted({ kind, id, completed })`
- Upsert em `room_progress`: `completed_at = completed ? now() : null`. Mantém posição.
- Aula **bloqueada** → `FORBIDDEN` (o checkbox já vem desabilitado).
- Resposta: `{ completedAt: string | null, outlineSummary: { groupId, groupCompleted, groupTotal, completed, total } }` para atualizar contadores sem nova consulta.
- Revalida a tag de progresso do curso (cartões de Aprender mostram a porcentagem).

### `savePosition({ kind, id, positionSec, durationSec? })`
- Upsert de `last_position_sec` (clamp: `0 ≤ pos ≤ (durationSec ?? 86400)`), e `duration_sec` se informado e válido (> 0).
- **Limite:** no máximo 1 gravação por conteúdo a cada 5 s por usuário (descartar o excedente com 204, sem erro).
- Se `positionSec` ≥ `durationSec - 20` (fim do vídeo), grave `last_position_sec = 0` (assim a retomada não oferece o final).
- Também exposta como **Route Handler** `POST /api/room/position` (JSON) para `navigator.sendBeacon` ao sair da página, pois beacon não chama Server Actions. Mesma validação e mesma autenticação por cookie de sessão. Retorna 204.

### `reportVideoIssue({ kind, id, code })`
- Registra em `room_video_issues`. Deduplicação: um registro por `(user, conteúdo, code)` a cada 30 min.
- Limite: 3 por hora por usuário. Excedente → 429 (o cliente ignora).
- Retorna 202.
- **Efeito de produto:** o alerta à equipe usa o mecanismo que já existe (e-mail, painel da Gestão, verificação diária). Na Fase 0, descubra qual. Se não houver, apenas a tabela + log estruturado, e registre no relatório que “a equipe já foi avisada” depende desse canal.

## Notas

Reutilize a API de Notas existente. Se nomes divergirem, crie um adaptador `roomNotesAdapter` com esta interface:

```ts
listNotes({ kind, id }): Promise<RoomNote[]>
createNote({ kind, id, html, videoTimeSec }): Promise<RoomNote>
updateNote(noteId, patch: { html?: string; videoTimeSec?: number | null; pinned?: boolean }): Promise<RoomNote>
trashNote(noteId): Promise<void>
restoreNote(noteId): Promise<RoomNote>
```
- Autosave com debounce de 800 ms; criação da nota na **primeira alteração não vazia**; nota vazia ao perder o foco é descartada (não criada).
- `html` sanitizado com o mesmo sanitizador do editor existente.
- Ordenação **no cliente**: fixadas, depois com carimbo por tempo crescente, depois sem carimbo por `createdAt` decrescente.

## Tempo

Sem endpoints novos. Integração por adaptador (`09`):

```ts
interface StudyTimerAdapter {
  getState(): TimerState;                     // modo, fase, restante/decorrido, rodando, vínculo
  subscribe(fn: (s: TimerState) => void): () => void;
  setMode(mode: 'stopwatch' | 'pomodoro' | 'countdown'): void;
  start(opts: { linkTo?: { kind: RoomKind; id: string } | null }): void;
  pause(): void; resume(): void; reset(): void;
  setCountdown(seconds: number): void;
}
```
Se o estado do cronômetro hoje vive só no cliente, mantenha assim. Se vive no servidor, use as ações existentes.

## Revalidação e cache

- Tag `room:${kind}:${id}:${userId}` para dados da sala; invalidada por `setCompleted`.
- Tag `course:${courseId}:progress:${userId}` para Aprender/curso.
- `savePosition` **não** invalida nada (só afeta a próxima abertura).

## Limites e proteção

- Rate limit por usuário usando o mecanismo existente (ou em memória/tabela se não houver). Valores acima.
- CSRF: ações do Next.js já protegem; o Route Handler de beacon exige same-origin (`Origin`/`Sec-Fetch-Site: same-origin`).
- Tamanho máximo de body: 2 KB (position), 8 KB (issue).
