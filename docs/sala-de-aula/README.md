# Sala de Aula

Especificação recebida em 23/10/2026 em `handoff/` (só os textos). Os contratos (`contracts/*.ts`, `schema.sql`, `tokens.css`), os SVGs e as telas HTML de referência ficam fora do Git, na pasta do projeto `sala-de-aula/handoff/`, porque o lint do repositório os varreria.

`DISCOVERY.md` registra o que já existe no repositório e onde o código diverge do pacote. Quando os dois divergem, valem as decisões registradas ali, e não o texto do pacote: não há `room_progress` (a sala usa `LessonProgress` e `PlaybackProgress`), a conclusão aos 90% continua valendo junto com a caixa manual, e as rotas são as de `/cursos`.
