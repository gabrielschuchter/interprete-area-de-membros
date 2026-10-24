# 03 · Rotas e navegação

Os caminhos abaixo seguem o padrão `/estudar/aprender/...` e `/gravacoes/...`. **Se o repositório já usa outros caminhos, mantenha os existentes** (regra do `02`). O que vale é o comportamento.

## Mapa de rotas

| Rota | Tipo | Quem acessa | O que renderiza |
|---|---|---|---|
| `/estudar/aprender` | existente | autenticado | Lista de cursos (Aprender). Os cartões ganham “Continuar” que aponta para `/continuar`. |
| `/estudar/aprender/[cursoSlug]` | existente (confirmar) | autenticado com acesso | Página do curso. Destino do “voltar” da sala. Se não existir, o voltar vai para `/estudar/aprender`. |
| `/estudar/aprender/[cursoSlug]/continuar` | **nova**, route handler | autenticado com acesso | Redireciona 307 para a aula certa (regra abaixo). |
| `/estudar/aprender/[cursoSlug]/aulas/[aulaId]` | **nova ou ajustada** | autenticado com acesso | **A Sala** com `kind='lesson'`. |
| `/gravacoes` | existente | autenticado | Minhas gravações. Itens sem vídeo passam a abrir (`11`). |
| `/gravacoes/[gravacaoId]` | **nova** | autenticado com acesso | **A Sala** com `kind='recording'`. |
| `/ferramentas/foco` (ou equivalente) | existente | autenticado | Modo foco. A sala só linka e envia contexto. |
| `/ferramentas/notas` (ou equivalente) | existente | autenticado | Notas. “Abrir em Notas” da sala aponta para cá, filtrado pela aula. |

`[aulaId]` e `[gravacaoId]` são o identificador estável do banco (uuid). Slug decorativo opcional **não** entra nesta fase.

## Resolução de “Continuar”

`GET /estudar/aprender/[cursoSlug]/continuar`

1. Sem acesso ao curso → 403 (página de acesso negado).
2. Se existe progresso: abra a aula com maior `last_opened_at` **que ainda não está concluída**; se todas as abertas estão concluídas, a primeira aula não concluída e liberada, por ordem.
3. Sem progresso: a primeira aula **liberada**, por ordem (módulo, depois posição).
4. Sem nenhuma aula publicada/liberada → redirecione para a página do curso (que mostra o estado “curso sem aulas”).
5. Resposta: `307` para `/estudar/aprender/[cursoSlug]/aulas/[aulaId]`.

## A sala: parâmetros e erros

### Query params
- `?t=<segundos inteiros>` · posição inicial. Usado por “Ir para” das notas e por links vindos de Notas. Valor inválido ou negativo é ignorado. Se maior que a duração conhecida, ignorado.
- Nenhum outro parâmetro de interface. **Não existe** `?painel=`: o painel sempre começa oculto (LD-03).

### Ordem de decisão do servidor (cada passo pode encerrar com uma resposta)
1. Sem sessão → Clerk redireciona para entrar (comportamento existente; não alterar).
2. Conteúdo não existe, está despublicado ou não pertence ao curso/série da URL → **404** `notFound` (`C-page.notFound`).
3. Aluno sem acesso ao curso/gravação → **403** `forbidden` (`C-page.forbidden`).
4. Erro inesperado no carregamento → **error boundary** da rota (`C-page.error`) com “Tentar de novo”.
5. Aula não liberada (cronograma no futuro) → **200** com `playerState='locked'` (a página existe, o vídeo não).
6. Aula sem vídeo cadastrado → **200** com `playerState='no_video'`.
7. Vídeo com status quebrado na verificação → **200** com `playerState='unavailable'`.
8. Caso contrário → `playerState='idle'` (ou `'resume'` se houver posição elegível).

> Despublicada = 404 para o aluno. **Não** crie pré-visualização de equipe nesta entrega.

### Metadados
- `<title>`: `{título} · {curso} · Interprete` (gravação: `{título} · Minhas gravações · Interprete`).
- `robots: noindex, nofollow`.
- Cache: dinâmico por usuário, sem cache compartilhado.

## Navegação dentro da sala

- Trocar de aula pelo painel Aulas = navegação cliente para a nova URL **sem recarregar a sala**. O painel (se estiver aberto) permanece aberto; o player volta para fachada da nova aula.
- Para manter o painel aberto entre aulas, o provedor de estado da sala (`RoomShellProvider`) vive em um layout do segmento `aulas/` (ou `gravacoes/`), que **não** remonta ao mudar `[aulaId]`. Ao **entrar** na sala vindo de fora, o provedor monta do zero e o painel começa oculto.
- Voltar do navegador volta para a aula anterior da navegação; a posição não é restaurada por URL, e sim pelo progresso salvo (`06`).
- **Link “voltar”** (topo do conteúdo): leva ao curso (`lesson`) ou a Minhas gravações (`recording`). Rótulo: nome do curso ou “Minhas gravações”.
- O **crumb do cabeçalho** (caixa alta, mono) é o existente: `ESTUDAR · APRENDER · AULA`; para gravações, `MINHAS GRAVAÇÕES · GRAVAÇÃO`.

## Teclado (somente dentro da sala)

| Tecla | Ação | Regras |
|---|---|---|
| `N` | Abre o painel Notas e foca o editor | Ignorar se o foco está em campo de texto, `contenteditable`, ou com modificadores (Ctrl/Alt/Meta). |
| `Esc` | Fecha o painel e devolve o foco ao botão do dock que o abriu | Também fecha menu de nota aberto primeiro. |

Atalhos do player são os do próprio YouTube.

## Redirecionamentos e compatibilidade

- Se a sala atual já tem URL pública usada em e-mails/links, **mantenha-a** e faça a nova rota responder a ela.
- Rotas antigas que deixarem de existir devem redirecionar 308 para a equivalente.
- Links externos de materiais abrem em nova aba com `rel="noopener noreferrer"`.
