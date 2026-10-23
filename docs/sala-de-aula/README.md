# Sala de Aula

Especificação recebida em 23/10/2026 em `handoff/` (só os textos). Os contratos (`contracts/*.ts`, `schema.sql`, `tokens.css`), os SVGs e as telas HTML de referência ficam fora do Git, na pasta do projeto `sala-de-aula/handoff/`, porque o lint do repositório os varreria.

`DISCOVERY.md` registra o que já existe no repositório e onde o código diverge do pacote. Quando os dois divergem, valem as decisões registradas ali, e não o texto do pacote: não há `room_progress` (a sala usa `LessonProgress` e `PlaybackProgress`), a conclusão aos 90% continua valendo junto com a caixa manual, e as rotas são as de `/cursos`.

## Estado em 23/10/2026

A sala está implementada atrás de `ROOM_V2_ENABLED` (padrão `false`). Desligada, `/cursos/[slug]/[lessonSlug]` renderiza a página antiga sem mudança; ligada, renderiza `components/learning/room/`. As fases 0 a 5 estão feitas. A fase 6 (Minhas gravações) espera a Comunidade V2 chegar na `main`, porque `encontros/gravacoes` é colisão direta com aquela branch.

Pré-requisito de deploy: a migração `20261023160000_planner_note_video_timestamp` precisa estar aplicada no banco antes de qualquer deploy deste código, ligado ou desligado. O campo `videoTimeSeconds` entrou no modelo Prisma e na leitura de notas de Ferramentas, então sem a coluna as notas quebram para todos. Preview e Production usam o mesmo banco GREEN.

O que ficou diferente do pacote, além do registrado em `DISCOVERY.md`. O painel Tempo reaproveita o cronômetro de foco atual (`LessonTimerCard`, `/api/focus-timer`); pomodoro, regressivo e ajustes continuam em Ferramentas, com link no painel. O erro de vídeo é registrado em `mutationLog` (`room.video_issue`) e o texto não diz que a equipe foi avisada, porque não há canal de alerta. Vídeo do Storage abre o player atual (`LessonPlayer`) depois do play; carimbo e "Ir para" nas notas só funcionam com YouTube. A 404 do segmento da aula passou a usar o visual da sala também com a flag desligada. `continuar` é slug de aula reservado.

Verificação feita sem Clerk nem banco: a sala foi montada num harness com dados de fixture e ações simuladas, fotografada em 1440, 1280, 1024, 820 e 390 px e em paisagem, e 16 fluxos foram exercitados (marcar e desmarcar com reversão em falha, Esc, atalho N, autosave de nota com versão, lixeira e desfazer, timeout de 12 s com registro). Não foram verificados: reprodução real do YouTube, a sala com sessão Clerk real e dados do banco, e o visual do painel Tempo (o harness não carrega Tailwind). Bundle inicial da rota da aula no build de produção: 222,2 KiB gzip, com as duas páginas no mesmo chunk, para o teto de 225 KiB usado nas outras rotas.
