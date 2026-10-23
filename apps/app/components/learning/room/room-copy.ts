// Interface text of the classroom, from docs/sala-de-aula/handoff/10.
// Two deliberate departures: "Aprender" is now "Cursos", and the video error
// never claims the team was notified, because no alert channel exists yet.

export const roomCopy = {
  about: "Sobre a aula",
  aulasTitle: "Aulas",
  checkboxMark: "Marcar aula {n} como feita",
  checkboxUnmark: "Desmarcar aula {n}",
  dockAria: "Ferramentas da aula",
  dockAulas: "Aulas",
  dockNotas: "Notas",
  dockTempo: "Tempo",
  forbiddenBody:
    "Se você acha que isso é um engano, fale com a equipe do Interprete.",
  forbiddenCta: "Voltar a Cursos",
  forbiddenTitle: "Você não tem acesso a este conteúdo.",
  groupCount: "{c}/{t}",
  lockedAria: "Aula bloqueada, libera em {data}",
  lockedBody:
    "Ela aparece aqui sozinha, no dia. Até lá, continue pela aula anterior.",
  lockedCtaCourse: "Voltar ao curso",
  lockedCtaPrevious: "Ir para a aula anterior",
  lockedTitle: "Esta aula será liberada em {data}.",
  marked: "Aula marcada como feita.",
  materials: "Materiais",
  metaDuration: "{min} min",
  metaLocked: "libera em {data}",
  metaNoVideo: "sem vídeo",
  metaUnavailable: "vídeo indisponível",
  metaWatching: "assistindo",
  mobileHeader: "Aula",
  notesActionError: "Não foi possível concluir a ação. Tente de novo.",
  notesEmptyBody:
    "O que você anotar aqui fica guardado nesta aula e também em Ferramentas, em Notas.",
  notesEmptyCta: "Escrever a primeira nota",
  notesEmptyTitle: "Nenhuma nota nesta aula ainda",
  notesFormatBold: "Negrito",
  notesFormatItalic: "Itálico",
  notesFormatList: "Lista",
  notesLoadErrorTitle: "Não foi possível carregar as notas.",
  notesMenuAria: "Mais ações da nota",
  notesMenuGoTo: "Ir para {tempo}",
  notesMenuPin: "Fixar nota",
  notesMenuTrash: "Mover para a lixeira",
  notesMenuUnpin: "Desafixar nota",
  notesNew: "Nova nota",
  notesOpenInNotes: "Abrir em Notas",
  notesPlaceholder: "Anotar neste momento…",
  notesSavedAt: "{quando} · salvo",
  notesStampAria: "Alternar carimbo do vídeo",
  notesStampHint: "carimbo do vídeo",
  notesStampNone: "Sem carimbo",
  notesStatusError: "Não foi possível salvar. Tentando de novo…",
  notesStatusSaved: "Salvo agora",
  notesStatusSaving: "Salvando…",
  notesTitle: "Notas desta aula",
  notesTrashed: "Nota movida para a lixeira.",
  notesUndo: "Desfazer",
  noVideoBody:
    "A aula existe, mas o vídeo ainda não foi anexado. Quando estiver disponível, ele aparece nesta página.",
  noVideoTitle: "Esta aula ainda não tem vídeo.",
  notFoundBody: "O link pode estar errado ou a aula foi removida.",
  notFoundCta: "Voltar a Cursos",
  notFoundTitle: "Não encontramos esta aula.",
  offlineBody: "O vídeo volta quando a conexão voltar.",
  offlineTitle: "Você está sem conexão.",
  panelAria: "Painel da aula: {nome}",
  panelBack: "Voltar",
  panelClose: "Ocultar painel",
  panelClosed: "Painel fechado.",
  panelOpened: "Painel {nome} aberto.",
  play: "Reproduzir aula",
  playerIframeTitle: "Vídeo: {titulo}",
  playerLoading: "Preparando o vídeo…",
  progress: "{c} de {t}",
  readMore: "Ler mais",
  resumeCta: "Retomar",
  resumeLabel: "Você parou em",
  resumeRestart: "Do início",
  retry: "Tentar de novo",
  saveError: "Não foi possível salvar agora. Tente de novo.",
  subtitle: "{curso} — Módulo {n}, {modulo}",
  tempoBreak: "Pausa",
  tempoClaim: "Continuar aqui",
  tempoClockAria: "Tempo da sessão",
  tempoCountdown: "Regressivo",
  tempoFocusCta: "Entrar no Modo foco",
  tempoFocusHint: "No Modo foco, os avisos do Interprete ficam silenciados.",
  tempoLinkHere: "Vincular a esta aula",
  tempoLinkedLesson: "Vinculado a esta aula",
  tempoLinkedOther: "Vinculado a outra aula",
  tempoPause: "Pausar",
  tempoPomodoro: "Pomodoro",
  tempoReset: "Reiniciar",
  tempoResume: "Retomar",
  tempoRound: "Foco {n} de {total}",
  tempoSetDuration: "Duração",
  tempoSettings: "Configurar",
  tempoStart: "Começar",
  tempoStopwatch: "Cronômetro",
  tempoUnlinked: "Sem vínculo",
  tempoWithoutLink: "Começar sem vínculo",
  timeoutBody: "Confira sua conexão e tente de novo.",
  timeoutTitle: "Não foi possível carregar o vídeo.",
  unavailableBody: "Enquanto isso, veja os materiais da aula.",
  unavailableBodyNoMaterials: "Tente de novo mais tarde.",
  unavailableMaterials: "Ver materiais",
  unavailableTitle: "Este vídeo está indisponível no momento.",
  unmarked: "Marcação removida.",
} as const;

export type RoomCopyKey = keyof typeof roomCopy;

export const roomText = (
  key: RoomCopyKey,
  values: Readonly<Record<string, string | number>> = {}
) =>
  roomCopy[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(values[name] ?? "")
  );

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  timeZone: "America/Sao_Paulo",
});

export const roomReleaseDate = (value: Date | string) =>
  shortDateFormatter.format(
    typeof value === "string" ? new Date(value) : value
  );

const shortDateWithMonthFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "America/Sao_Paulo",
});

// "21 out." as the board shows it in the lessons list.
export const roomReleaseDateShort = (value: Date | string) =>
  shortDateWithMonthFormatter
    .format(typeof value === "string" ? new Date(value) : value)
    .replace(" de ", " ");
