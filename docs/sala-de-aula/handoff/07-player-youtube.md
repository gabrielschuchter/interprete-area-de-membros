# 07 · Player (YouTube)

Requisitos: **desempenho** (nada do YouTube carrega antes do toque), **privacidade** (`youtube-nocookie.com`), **controle** (posição, carimbo, erros) e **sem expor o link** (LD-14).

## Fachada (`PlayerFacade`)

- Renderiza o pôster da marca (`08`), o botão de Play e, se conhecida, a duração. **Nenhuma requisição ao YouTube** (nem script, nem iframe, nem imagem) antes do toque. Verifique na aba Network.
- Ao toque em Play/Retomar/Do início: estado `loading`, carrega a API e cria o player.

## Carregamento da API

- Hook `useYouTubePlayer`:
  - **Singleton** da promessa que injeta `https://www.youtube.com/iframe_api` uma única vez e resolve em `window.onYouTubeIframeAPIReady` (encadear callbacks já existentes).
  - Compatível com React Strict Mode (montagem dupla): destruir o player no cleanup e não criar dois.
- Container: `div` com `aspect-ratio: 16 / 9`, borda `8px`, `overflow:hidden`; o player ocupa 100%.

## Criação

```ts
new YT.Player(containerEl, {
  host: 'https://www.youtube-nocookie.com',
  videoId,
  width: '100%', height: '100%',
  playerVars: {
    autoplay: 1,          // veio de um toque do aluno
    playsinline: 1,       // iOS
    rel: 0,
    enablejsapi: 1,
    origin: window.location.origin,
    start: effectiveStartSec,      // inteiro
    // end só quando a Gestão configurou um trecho:
    ...(video.endSec ? { end: video.endSec } : {}),
    // legendas e velocidade: nenhum parâmetro; o aluno usa os controles nativos
  },
  events: { onReady, onStateChange, onError },
});
```
- `iframe` com `title="Vídeo: {título}"`, `allow="autoplay; encrypted-media; picture-in-picture; fullscreen"`, `allowfullscreen`.
- Sem `<a>` para youtube.com em nenhuma parte da interface. O título/logotipo que o YouTube mostra **dentro** do iframe é limitação do provedor e é aceito.

## Eventos

| Evento | Ação |
|---|---|
| `onReady` | Guardar `getDuration()` (se `video.durationSec` for nulo, será enviado ao salvar posição). Cancelar o timeout de 12 s. |
| `onStateChange = 1 (playing)` | Estado `playing`; iniciar o relógio de salvamento (a cada **15 s**). |
| `= 2 (paused)` | Estado `paused`; salvar posição agora; parar o relógio. |
| `= 0 (ended)` | Estado `ended`; salvar (servidor grava 0). |
| `= 3 (buffering)` | Manter estado; sem UI extra. |
| `onError` com `2 \| 5 \| 100 \| 101 \| 150` | Estado `unavailable`; `reportVideoIssue({code:'yt_<n>'})` (uma vez por montagem). |
| Sem `onReady` em **12 s** | Estado `error_timeout`; `reportVideoIssue({code:'timeout'})`. |
| `window offline` | Se ainda não tocava: `offline`. Se tocando: não interferir. |

## Persistência da posição

| Momento | Como |
|---|---|
| Tocando | `savePosition` a cada 15 s com `getCurrentTime()` inteiro. |
| Pausa | `savePosition` imediato. |
| Fim | `savePosition` com a posição final (servidor zera). |
| `visibilitychange → hidden` e `pagehide` | `navigator.sendBeacon('/api/room/position', Blob JSON)` com a última posição. |
| Troca de aula/desmontagem | Salvar a posição final **antes** de destruir o player. |
- Não salvar quando o player nunca saiu de `loading`.
- Não salvar posição menor que 5 s.
- O servidor limita 1 gravação por 5 s por conteúdo (`05`).

## Ações externas ao player

- `seekTo(sec)` (usado por “Ir para” das notas): se o player existe → `seekTo(sec, true)` + `playVideo()`; se não (fachada) → iniciar com `start = sec`.
- Capturar carimbo: `getCurrentTime()` quando o painel Notas abre um composer novo.
- “Tentar de novo”: destruir e recriar o player; `loading`.

## CSP (se o repositório tiver Content-Security-Policy)

Acrescentar, sem remover o que existe:
- `script-src`: `https://www.youtube.com` (e `https://s.ytimg.com` se o navegador pedir).
- `frame-src`: `https://www.youtube-nocookie.com` e `https://www.youtube.com`.
- Não é necessário liberar imagens do YouTube (miniaturas são da marca, LD-15).
Registrar a alteração no relatório.

## Limitações conhecidas (documentar, não “consertar”)

- Política de autoplay do iOS pode exigir um segundo toque no botão nativo do YouTube. Se, 3 s após `onReady`, o estado continuar `cued (5)`, não mostrar nada extra: o botão nativo do YouTube já aparece.
- Controles, qualidade e fechamento de legendas são do YouTube.
- Vídeos privados/removidos/sem incorporação geram os erros 100/101/150.
