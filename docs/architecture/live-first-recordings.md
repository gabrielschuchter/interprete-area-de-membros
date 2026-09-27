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
- `ImportedRecordingGroupAssignment` é o histórico auditável de cada vínculo;
  a atualização do ponteiro canônico e o evento de auditoria acontecem na
  mesma transação.
- `AccessGrant` continua sendo a autorização canônica para o conteúdo
  assíncrono. Não se usa nome legado como permissão.
- `PlaybackProgress` guarda somente posição de reprodução por
  `(memberId, assetId)`. Ele não altera nem substitui `LessonProgress`.
- `ContentCollectionItem.recordingId` é a relação canônica para uma gravação
  em curadoria. `assetId` continua somente como compatibilidade de linhas
  antigas, sem ser usado em novas gravações.
- `ImportedRecording.meetingId` é opcional e permite relacionar vários
  registros históricos a um encontro sem forçar uma relação 1:1.

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
grupos explicitamente vinculados a seu `Member.id`. A playlist recebe um token
curto, vinculado ao asset e ao membro, e cada segmento revalida o vínculo atual
do grupo; uma revogação não depende do vencimento do token para cortar o
acesso. A API de progresso usa upsert e a constraint única `(memberId, assetId)`,
com persistência controlada no player em pausa, término, troca/desmontagem e
intervalos espaçados.

## Baseline real da produção — 27/09/2026

O inventário foi conferido diretamente no PostgreSQL/Supabase oficial, e não
por números de documentação antiga:

- 3 Members e 3 Profiles;
- 2 Courses (`1 ASYNC` e `1 RECORDING_ARCHIVE`), 15 Modules e 101 Lessons;
- 102 LessonAssets (`99 VIDEO` e `3 PDF`), todos os 102 com `sourcePlatform`
  `KIWIFY` e `sourceId` preservados;
- 16 MigrationStudents e 233 MigrationRecords (`1` asset legado marcado como
  `FAILED`, sem remoção de dados);
- 14 ImportedRecordingGroups e 102 ImportedRecordings;
- 0 AccessGrants, 0 PlaybackProgress, 0 ContentCollections e 0 configurações
  persistidas da Home;
- 5 Meetings, 5 Activities e 13 CommunityPosts;
- bucket privado `learning-assets`, sem movimentação ou reencodificação nesta
  etapa. Os objetos históricos `kiwify-hls/*`, `kiwify/*` e os assets atuais
  de comunidade/perfil permanecem intactos.

Os 14 grupos continuam sem vínculo de membro. Há somente eventos de teste
administrativo já preservados no histórico (`ASSIGNED` e `REVOKED`); eles não
concedem acesso atual. Nenhum ownership foi inferido por nome, e-mail ou
similaridade. As cinco Meetings marcadas com `demoKey` estão em `DRAFT` no
banco oficial e também são filtradas por `demoKey: null` nas queries de membro;
a tela administrativa continua conseguindo auditá-las. A nova migração é
aditiva: adiciona relações explícitas de recording/meeting, constraints de
estado e a fonte tipada de Collections, sem apagar registros, paths, checksums
ou objetos do Storage.
