# Gravações históricas e experiência live-first

Atualizado em 26/09/2026. Este documento descreve a transição segura da área
de aprendizagem para separar conteúdo assíncrono de gravações históricas sem
apagar ou mover os dados importados.

## Ontologia atual

- `Course.experience = ASYNC` representa aulas que pertencem à experiência
  Aprender e podem produzir progresso acadêmico (`LessonProgress`).
- `Course.experience = RECORDING_ARCHIVE` representa o arquivo histórico
  importado da Kiwify. Esses cursos permanecem na hierarquia legada para
  rastreabilidade, mas não aparecem como aulas novas para membros.
- `ImportedRecordingGroup` indexa um módulo legado e conserva `sourcePlatform`,
  `sourceId`, nome do aluno legado e referência ao módulo original.
- `ImportedRecording` indexa cada asset legado sem copiar, renomear, reencodar
  ou mover o objeto do Storage.
- `ImportedRecordingGroup.memberId` é o vínculo administrativo canônico para
  autorização do arquivo histórico. Um grupo sem vínculo não é legível por
  membros.
- `AccessGrant` continua sendo a autorização canônica para o conteúdo
  assíncrono. Não se usa nome legado como permissão.
- `PlaybackProgress` guarda somente posição de reprodução por
  `(memberId, assetId)`. Ele não altera nem substitui `LessonProgress`.

## Migração

As migrations `20260926210000_live_first_recordings` e
`20260926213000_live_first_recording_constraints` são aditivas, idempotentes e
reversíveis no sentido operacional: nenhuma tabela legada, asset ou caminho do
Storage é removido. O backfill usa apenas `MigrationRecord`, IDs de módulo/aula
e `metadata.studentSourceId` já existente. Não há fuzzy matching, inferência por
nome ou associação automática de ownership.

O vínculo de um grupo é feito por ação autenticada de admin, em transação, com
histórico de `ASSIGNED`, `REASSIGNED` e `REVOKED`. O vínculo só altera a
autorização; os assets históricos continuam no bucket privado
`learning-assets`.

## Experiência e compatibilidade

- `/encontros/gravacoes` é a nova superfície semântica do arquivo.
- `/aprender/minhas-gravacoes` permanece como compatibilidade e redireciona
  para a nova rota.
- Rotas de curso/aula do arquivo histórico não são tratadas como Aprender;
  redirecionam para o arquivo quando a experiência do curso é histórica.
- A navegação Aprender só aparece quando existe conteúdo assíncrono publicado e
  acessível; a configuração pode ser controlada em `/admin/personalizacao`.
- A Home não calcula progresso usando o curso histórico de 99 aulas. Ela só
  mostra progresso de conteúdo assíncrono e pode priorizar retomada de uma
  gravação autorizada.

## Segurança e playback

O acesso é validado no servidor antes de emitir asset, playlist, segmento HLS,
PDF ou posição de playback. Staff tem acesso de operação; membros só recebem
grupos explicitamente vinculados a seu `Member.id`. A API de progresso usa
upsert e a constraint única `(memberId, assetId)`, com persistência controlada
no player em pausa, término, troca/desmontagem e intervalos espaçados.

## Baseline real da produção

Antes do backfill: 2 Members, 2 Profiles, 2 Courses, 15 Modules, 101 Lessons,
102 LessonAssets, 16 MigrationStudents, 233 MigrationRecords, 0 PlaybackProgress
e 0 grupos/recordings semânticos.

Depois das migrations: 1 Course `RECORDING_ARCHIVE`, 1 Course `ASYNC`, 14
ImportedRecordingGroups, 102 ImportedRecordings, 102 LessonAssets preservados,
0 assets com ownership inferido e 0 PlaybackProgress criado artificialmente.
O bucket original continuou com seus objetos e prefixos; nenhuma operação de
Storage faz parte do backfill.

Qualquer grupo sem vínculo permanece preservado para decisão explícita do
admin. A limpeza de legado não faz parte desta etapa.
