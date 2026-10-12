# 02 · Arquitetura, dados, ações e tarefas em segundo plano

> **Aviso importante:** os nomes de tabelas abaixo são **propostas conceituais**. O repositório já tem modelos (cursos, aulas, atividades, entregas, encontros, avisos, medalhas, gravações históricas, acessos). **Primeiro audite o que existe e reutilize.** Só crie o que faltar, com **migrations aditivas** e **somente com autorização explícita**. Nunca remodele dados existentes para encaixar este documento.

## 1. Princípios de arquitetura

1. **Autorização no servidor, sempre.** Uma função central `authorize(user, action, resource)` é chamada no início de **toda** rota, Server Action e query da Gestão. A interface nunca decide permissão.
2. **Uma fonte da verdade por conceito.** "O que o aluno recebe" (`resolveStudentFeed`), "acesso efetivo" (`resolveAccess`) e "calendário" (`resolveCalendar`) são funções servidoras únicas, usadas pela Gestão, pelas telas do aluno e pelas prévias.
3. **Rascunho antes de publicar.** Tudo que o aluno vê tem estado (`DRAFT → SCHEDULED → PUBLISHED → ARCHIVED`). Editores salvam rascunho automaticamente; publicar é uma ação explícita, validada no servidor.
4. **Nenhuma exclusão silenciosa.** Arquivar é o padrão; excluir pede confirmação e (quando possível) é *soft delete* com "Desfazer".
5. **Projeções, não cópias.** Calendário, pendências e destaques são **derivados**; não duplicam registros. Vincular não copia (aula ↔ material ↔ lista).
6. **Concorrência otimista.** Todo registro editável tem `version` (int). Escrita com `version` antigo falha com 409 e abre o diálogo de conflito.
7. **Tudo auditável.** Mudanças sensíveis gravam `AuditLog` (lista em `data/events.json`).
8. **Tempo:** guardar sempre **UTC**; exibir no fuso do usuário (padrão `America/Sao_Paulo`); recorrências expandem no fuso do evento.
9. **Idioma:** pt-BR, sem estados em inglês na interface (DRAFT → Rascunho etc.). Traduzir por tabela única de rótulos.
10. **Sem dados falsos.** Os valores dos quadros (nomes, números, "Dados de exemplo") são ilustrativos. Nada de *mock* em produção; cada número vem do banco.

## 2. Camadas e organização

```
app/(membros)/…            área do aluno (layout próprio, barra lateral Dark Amaranth)
app/(gestao)/gestao/…      área da Gestão (layout próprio, barra lateral Crimson Violet)
  layout.tsx               shell: sidebar, header, Criar, busca, notificações, guarda de permissão
  _components/             sidebar, header, tabelas, seletor de pessoas, upload, dropzone, status…
  ensino/ alunos/ comunidade/ administracao/ previa/
server/
  authz/                   authorize(), capabilities, escopos
  domain/                  cohorts, deliveries, access, calendar, courses, lessons, youtube, medals…
  actions/                 Server Actions (uma por operação), validadas com zod
  jobs/                    tarefas agendadas (seção 6)
  resolvers/               resolveStudentFeed, resolveAccess, resolveCalendar
```

- Dois *layouts* de raiz separados (membros e Gestão) tornam a transição possível sem "piscar" (ver `docs/04`).
- **Componentes compartilhados obrigatórios** (criar uma vez, usar em todas as telas): `PeoplePicker/AudiencePicker`, `MediaUpload`, `YouTubeField`, `StatusChip`, `DataTable` (com seleção, ações em lote, paginação, estados), `ConfirmDialog`, `Drawer`, `Sheet` (mobile), `EntityHeader` (título + estado + salvar/publicar), `AutosaveIndicator`, `RichTextEditor` (o mesmo TipTap da Comunidade), `EmptyState`, `Toast com Desfazer`, `UnsavedChangesGuard`.

## 3. Modelo de dados proposto

Convenções: `id` (cuid/uuid), `createdAt`, `updatedAt`, `version`, `createdById`. Datas em UTC.

### 3.1 Pessoas e permissões
| Entidade | Campos principais | Observações |
|---|---|---|
| `User` (existe) | role `MEMBER|TEACHER|ADMIN`, displayName (obrigatório), avatarAssetId | exigir nome de exibição (corrige "Membro sem nome") |
| `UserCapability` | userId, capability, scopeType (`COURSE|COHORT|ALL`), scopeId | refina o papel |

### 3.2 Turmas
| Entidade | Campos | Regras |
|---|---|---|
| `Cohort` | name, slug, startsAt, endsAt, coverAssetId, lateJoinPolicy (`ALL_ACTIVE|FROM_JOIN`), readAfterEndDays (90), notifyOnNews, archivedAt | status exibido é **derivado** (Não iniciada / Em andamento / Encerrada / Arquivada) |
| `CohortTeacher` | cohortId, userId | quem é "responsável" |
| `CohortMember` | cohortId, userId, joinedAt, leftAt, status (`ACTIVE|REMOVED`), source (`MANUAL|CSV|INVITE|MOVE`), movedFromCohortId | **único** (cohortId, userId) com status ACTIVE |
| `CohortInvite` | cohortId, token (hash), email?, expiresAt, maxUses, usedCount | link de convite; revogável |
| `CohortEvent` | cohortId, title, startsAt, endsAt, allDay, description, color | eventos do calendário da turma |
| `LessonRelease` | cohortId, lessonId, releaseAt | cronograma por turma |
| `CourseCohort` | courseId, cohortId, releaseMode (`ALL_AT_ONCE|SCHEDULE`), startsAt | "Liberado para" |

### 3.3 Envios, acessos, calendário
| Entidade | Campos | Regras |
|---|---|---|
| `Delivery` | itemType (`COURSE|LESSON|ACTIVITY|MATERIAL|COLLECTION|EXERCISE_LIST`), itemId, kind (`ASSIGNMENT|FEATURE|TASK`), titleOverride, teacherNote, startsAt, endsAt, dueAt, pinned, order, status, recurrence (para TASK) | um registro por envio |
| `DeliveryTarget` | deliveryId, targetType (`COHORT|USER`), targetId | alvos múltiplos |
| `DeliveryProgress` | deliveryId, userId, state (`PENDING|IN_PROGRESS|DONE|SKIPPED`), completedAt | criado **sob demanda** (primeira interação ou conclusão); pendência sem linha = `PENDING` |
| `AccessGrant` | subjectType (`USER|COHORT`), subjectId, resourceType, resourceId, origin (`DIRECT|COHORT|ASSIGNMENT|HISTORICAL`), originRefId, validFrom, validUntil, revokedAt, createdById | **acesso efetivo** = existe grant válido, não revogado, para o usuário **ou** para uma turma ativa dele, no recurso **ou em um ancestral** (curso → módulo → aula). Revogar atua **só** sobre o grant escolhido |
| `Event` (Encontro) | title, context, startsAt, endsAt, timezone, type, link, recurrenceRule (RRULE), status (`DRAFT|PUBLISHED|CANCELLED`), relatedCourseId/ActivityId/MaterialId, recordingYoutubeId, recordingCheck | exceções de série em `EventException` |
| `EventTarget` | eventId, targetType, targetId | mesma lógica de alvos |
| `Notice` + `NoticeTarget` | title, body, link, startsAt, endsAt, pinned, status | sem e-mail nesta fase |
| `CollectiveGoal` | title, description, targetMinutes, startsAt, endsAt, cohortId/null, status | só agregado |

### 3.4 Conteúdo
| Entidade | Pontos de atenção |
|---|---|
| `Course`, `Module`, `Lesson` (existem) | `Lesson.videoSource` (`YOUTUBE|UPLOAD|NONE`), `youtubeVideoId`, `youtubeMeta` (JSON: title, durationSec, privacy, embeddable, checkedAt, status), `startAtSec`, `endAtSec`, `videoAssetId`. `Course.openToAllMembers` |
| `Pathway` (percurso) | ordem de cursos em `PathwayCourse` |
| `ExerciseBank/List/Question/QuestionVersion` (existem) | **versões imutáveis**; tentativas ligadas à versão |
| `Activity`, `ActivityRubricCriterion`, `Submission`, `Feedback` | `Feedback`: submissionId, scores (JSON por critério), comment, status (`DRAFT|SENT`), sentAt |
| `Material`, `Collection`, `CollectionItem` | itens polimórficos e ordenados; vincular, nunca copiar |

### 3.5 Medalhas, aparência, integração, auditoria
| Entidade | Campos |
|---|---|
| `Medal` | name, description, criterionType, threshold, criterionVersion, tone, status, currentSymbolId |
| `MedalSymbol` | medalId, assetId, createdAt, createdById (histórico; "Restaurar" cria novo registro apontando ao mesmo asset) |
| `MedalAward` | medalId, medalVersion, userId, awardedAt — **único** (medalId, userId) |
| `SettingsVersion` | scope (`LEARN_PAGE|NAV|PORTAL`), payload (JSON), status (`DRAFT|PUBLISHED`), publishedAt, publishedById |
| `IntegrationYouTube` | channelId, tokens (**criptografados**), scopes, status, rules (acceptOnlyUnlisted, notifyUnavailable, schedule) |
| `Asset` | ownerId, kind, mime, size, width, height, storagePath, checksum, variants |
| `AuditLog` | at, actorId, action, objectType, objectId, summary, diff (JSON) |
| `Notification` | userId, type, payload, readAt |

### 3.6 Índices e RLS
- Índices: `CohortMember(userId,status)`, `DeliveryTarget(targetType,targetId)`, `AccessGrant(subjectType,subjectId,resourceType,resourceId)`, `Event(startsAt)`, `LessonRelease(cohortId,releaseAt)`, `AuditLog(at)`.
- **RLS (Supabase):** o aluno só lê o que `resolveStudentFeed/resolveAccess` permitir. Notas e tarefas pessoais são do dono. Tabelas administrativas (`AccessGrant`, `AuditLog`, `IntegrationYouTube`, `SettingsVersion`) só por `service role` via servidor. **Não confie em RLS sozinha**: a autorização de aplicação continua obrigatória.

## 4. Ações do servidor (Server Actions)

Cada ação: valida entrada (**zod**), chama `authorize`, executa em **transação**, grava `AuditLog`, cria notificações, **revalida** as telas afetadas (`revalidateTag`). Retorna `{ok, data}` ou `{ok:false, error:{code, message, fields}}`.

| Módulo | Ações |
|---|---|
| Turmas | `createCohort`, `updateCohort`, `archiveCohort`, `restoreCohort`, `duplicateCohort`, `addMembers(cohortId, userIds[], includePast)`, `importMembersCsv`, `createInvite`, `revokeInvite`, `removeMember(cohortId, userId, keepReadDays?)`, `moveMember(userId, fromId, toId)`, `setLateJoinPolicy` |
| Cronograma e calendário | `setCourseRelease`, `setLessonRelease`, `copySchedule(fromCohortId, toCohortId)`, `createCohortEvent`, `updateCohortEvent`, `deleteCohortEvent` |
| Envios | `createDelivery`, `updateDelivery`, `scheduleDelivery`, `endDelivery`, `retireFeature`, `reorderFeatures(cohortId, orderedIds)`, `revokeDelivery` |
| Cursos e aulas | `createCourse`, `updateCourse`, `publishCourse` (valida checklist), `unpublishCourse`, `archiveCourse`, `reorderModules`, `reorderLessons`, `createLesson`, `updateLesson`, `publishLesson` |
| YouTube | `verifyYouTubeVideo(url)`, `setLessonYouTube(lessonId, url, startAt?, endAt?)`, `importYouTubePlaylist(courseId, moduleId, playlistUrl, videoIds[], status)`, `recheckAllVideos` (job) |
| Exercícios | `createBank`, `createList`, `createQuestion`, `publishQuestionVersion`, `reorderQuestions` |
| Atividades | `createActivity`, `updateActivity`, `publishActivity`, `saveFeedbackDraft`, `sendFeedback`, `remindMissing(activityId, cohortId)` |
| Biblioteca e coleções | `createMaterial`, `updateMaterial`, `importCuratedLibrary`, `bulkUpdateMaterials`, `createCollection`, `updateCollection`, `reorderCollectionItems` |
| Comunidade | `archivePost`, `restorePost`, `pinPost`, `featurePost`, `removePost` (confirmação), `resolveReport`, `createGroup`, `updateGroup`, `archiveGroup` |
| Encontros e avisos | `createEvent`, `updateEvent`, `publishEvent`, `cancelEvent`, `attachRecording`, `createNotice`, `updateNotice`, `publishNotice`, `endNotice` |
| Administração | `changeRole`, `setCapability`, `grantAccess`, `revokeAccess`, `linkHistoricalGroup`, `saveSettingsDraft`, `publishSettings`, `createMedal`, `updateMedal`, `replaceMedalSymbol`, `restoreMedalSymbol`, `publishMedal`, `connectYouTube`, `disconnectYouTube` |
| Transversais | `createUpload` (URL assinada), `finalizeUpload`, `searchGestao(q)`, `markNotificationsRead`, `startPreview(cohortId?, userId?)`, `endPreview` |

Regras de validação que **não podem faltar**: nome de turma único por edição; `endsAt > startsAt`; `dueAt` ≥ início do envio; nunca enviar com alvos vazios; um aluno não é adicionado duas vezes à mesma turma; não rebaixar o último administrador; arquivo com tipo/tamanho/dimensões válidos; link do YouTube verificado antes de publicar.

## 5. Uploads e arquivos

- Fluxo: cliente pede `createUpload` → recebe URL assinada → envia ao Storage → chama `finalizeUpload` → servidor valida (tipo real pelo conteúdo, tamanho, dimensões), grava `Asset` e gera derivados.
- **Imagens** (capas, símbolos): JPG/PNG/WebP até 5 MB; capas recomendadas 1600×900; gerar variantes.
- **SVG** (símbolo de medalha): **sanitizar** no servidor (remover `<script>`, atributos de evento, `foreignObject`, referências externas), usar apenas em `<img>`; limitar a 2 MB.
- **Materiais**: PDF/imagem/texto até 20 MB.
- **Vídeo próprio:** upload direto para o Storage com envio em partes (retomável); o tamanho máximo vem da configuração; a tela mostra progresso real.
- O arquivo antigo **nunca é apagado** ao substituir: cria versão (histórico e "Restaurar").

## 6. Tarefas em segundo plano (agendador)

| Tarefa | Frequência | O que faz |
|---|---|---|
| `activate-deliveries` | 1 min | `SCHEDULED → ACTIVE` ao chegar `startsAt`; `ACTIVE → ENDED` ao passar `endsAt`; notifica |
| `release-lessons` | 1 min | torna visível a aula no `releaseAt` da turma; notificação opcional |
| `publish-scheduled` | 1 min | publica encontros e avisos agendados |
| `event-reminders` | 1 min | lembrete 30 min antes |
| `verify-youtube` | diária 06h | reconfere vídeos de aulas publicadas; marca, notifica e alerta |
| `expire-access` | 5 min | invalida grants vencidos e convites expirados |
| `cohort-lifecycle` | diária | encerra turmas após `endsAt`; aplica `readAfterEndDays` |
| `evaluate-medals` | por evento + diária | concede medalhas cujo critério foi atingido (idempotente) |
| `task-recurrence` | diária | gera a próxima ocorrência de tarefas recorrentes |

Todas **idempotentes**, com *lock* para não rodar em duplicidade, e registram falhas em log com alerta.

## 7. YouTube: detalhes técnicos

- API: `videos.list?part=snippet,contentDetails,status&id={id}`; usar `status.privacyStatus` (`public|unlisted|private`) e `status.embeddable`; `contentDetails.duration` (ISO 8601 → segundos); `snippet.title`; miniatura.
- **Sem OAuth (só chave de API):** vídeo privado é indistinguível de "não encontrado" (a lista volta vazia). A interface então diz "Vídeo privado ou não encontrado" com as duas dicas. **Com o canal conectado** (OAuth, escopo `youtube.readonly`), vídeos do próprio canal informam o estado real. A tela de Integrações define qual modo está ativo; a mensagem muda conforme o modo.
- Playlist: `playlistItems.list` (paginado) + `videos.list` para status de cada item.
- **Cotas:** cada `videos.list` custa 1 unidade; a verificação diária agrupa até 50 IDs por chamada. Mostrar o uso em Integrações.
- **Player do aluno:** iframe `https://www.youtube-nocookie.com/embed/{id}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1&start={s}&end={e}`; usar a **IFrame API** para registrar progresso (tempo assistido, ≥ 90% = aula concluída) e alimentar tempo de estudo e medalhas.
- **Fallback:** falha de rede na verificação **não** bloqueia salvar rascunho; marca `UNREACHABLE` e reconfere em breve.
- Segredos (chave, tokens) **só no servidor**, criptografados; nunca no cliente.

## 8. Busca, notificações, tempo real

- **Busca da Gestão** (`GBusca`): consulta única no servidor, agrupada (Alunos, Turmas, Atividades e entregas, Cursos e aulas, Materiais, Avisos, Encontros), **respeitando escopo** (professor só encontra o que pode ver). Índice de texto (Postgres FTS). Recentes por usuário (últimos 8).
- **Notificações:** tabela `Notification`; painel do sino com paginação; "Marcar todas como lidas". Gatilhos em `data/events.json`. Lembretes por e-mail respeitam a preferência de cada usuário.
- **Tempo real:** não obrigatório. Atualizar listas por revalidação ao focar a janela e após ações. (Se o produto quiser, Supabase Realtime pode alimentar o sino e a fila de correções.)

## 9. Feature flags e implantação

- Flag `gestao_v2` (por usuário/papel). Com a flag desligada, `/professor` continua funcionando; ligada, `/professor/*` redireciona para `/gestao/*` (tabela em `data/routes.json`).
- Item "Gestão" no menu só aparece com a flag e com papel TEACHER/ADMIN.
- Implantação em fases (veja `HANDOFF.md`); cada fase é reversível por flag.
- **Migrations:** aditivas, com *backfill* separado e idempotente (ex.: criar a primeira turma "Turma atual" e matricular alunos existentes **somente se o produto aprovar**; nunca presumir).

## 10. Segurança

- CSRF: Server Actions do Next já protegem; rotas de API devem exigir token/same-site.
- Limitar taxa em: busca, convites, importação CSV, upload, verificação do YouTube.
- Convites: token aleatório de 128 bits, guardado como *hash*, com expiração.
- CSV: limite de linhas, validação de e-mail, prévia antes de confirmar, relatório de erros por linha.
- Logs sem dados pessoais desnecessários. Nenhum segredo em respostas de erro.
- Acessibilidade e performance são parte do "pronto" (veja `docs/04` e `docs/05`).
