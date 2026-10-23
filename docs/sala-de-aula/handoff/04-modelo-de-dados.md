# 04 · Modelo de dados

> Princípio: **estender o que existe**. As tabelas abaixo marcadas como “esperada” já devem existir (confirmar na Fase 0). Só as marcadas como **nova** são criadas. Nomes de colunas são sugestões: adapte ao padrão do repositório (snake_case/camelCase, tipos de id).

## Entidades

| Entidade | Situação | Papel na sala |
|---|---|---|
| Curso, Módulo, Aula | esperada | Título, descrição, ordem, vídeo, publicação. |
| Vídeo da aula (YouTube) | esperada | ID, início/fim, status da verificação diária. |
| Liberação por cronograma (`LessonRelease` ou equivalente) | esperada | Decide aula liberada x bloqueada e a data. |
| Acesso/matrícula/turma | esperada | Decide se o aluno vê o conteúdo. |
| Materiais associados (biblioteca, lista de exercícios, atividade, link, arquivo) | esperada | Seção “Materiais”. |
| Gravação de encontro (Minhas gravações) | esperada | Conteúdo da sala com `kind='recording'`. **Vídeo pode ser nulo.** |
| Notas (vinculadas à aula) | esperada | Painel Notas. Precisa de `video_time_sec` e `pinned` (estender se faltar). |
| Cronômetro / Pomodoro / Regressivo | esperada | Painel Tempo (integração por adaptador, sem tabela nova). |
| **`room_progress`** | **nova** (ou estender a de conclusão existente) | Conclusão, última posição, última abertura, por usuário e conteúdo. |
| **`room_video_issues`** | **nova** | Registro de falhas de vídeo reportadas pelo navegador do aluno. |

## `room_progress` (nova; unifica aula e gravação)

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | texto/uuid | **Do servidor**, nunca do cliente. Seguir o padrão do repo (Clerk id ou id interno). |
| `content_kind` | `'lesson' \| 'recording'` | check constraint. |
| `content_id` | uuid | Id da aula ou da gravação. |
| `completed_at` | timestamptz null | Nulo = não concluída. Define “feita”. |
| `last_position_sec` | int not null default 0 | ≥ 0. Posição para retomada. |
| `duration_sec` | int null | Última duração conhecida (do player). |
| `last_opened_at` | timestamptz not null | Atualizada ao abrir a sala. |
| `created_at`, `updated_at` | timestamptz | |

- Unicidade: `(user_id, content_kind, content_id)`.
- Índice: `(user_id, last_opened_at desc)` para “Continuar”.
- **Se já existir** tabela de conclusão de aula: **estenda** com `last_position_sec`, `duration_sec`, `last_opened_at`, e crie um adaptador (`progressRepo`) que a sala usa. Não migre dados históricos de lugar; só adicione colunas. Para gravações, crie linhas na mesma tabela só se ela já for polimórfica; senão, use `room_progress` apenas para `recording`.
- SQL completo em `contracts/schema.sql`.

## Extensão de notas (se faltar)

| Coluna | Tipo | Regra |
|---|---|---|
| `video_time_sec` | int null | Carimbo opcional. ≥ 0. |
| `pinned` | boolean default false | Fixada. |
| vínculo | já existente | Notas já têm vínculo com a aula; para gravações, use o mesmo mecanismo polimórfico (`content_kind`, `content_id`) se existir; senão estender. |

Notas apagadas vão para a **lixeira** (soft delete) segundo o comportamento existente. Se não houver lixeira, use `deleted_at` e filtre nas listas.

## Campos de vídeo (esperados)

Aula e gravação precisam expor, direta ou indiretamente:

| Campo | Observação |
|---|---|
| `youtube_video_id` | Nulo = **sem vídeo**. |
| `video_start_sec`, `video_end_sec` | Trecho opcional (Gestão). |
| `video_status` | Normalizar para `VideoAvailability`: `ok`, `unchecked`, `broken`, `missing`. Mapeie os estados existentes da verificação diária (privado, removido, incorporação desativada → `broken`). `unchecked` é tratado como `ok`. |
| `video_checked_at` | Para diagnóstico. |
| `duration_sec` | Se existir. Usada para “min” e progresso. Se faltar, a duração vem do player e fica em `room_progress.duration_sec`. |

## `room_video_issues` (nova)

| Coluna | Tipo |
|---|---|
| `id` | uuid pk |
| `user_id` | idem |
| `content_kind`, `content_id` | idem |
| `code` | texto: `yt_2`, `yt_5`, `yt_100`, `yt_101`, `yt_150`, `timeout` |
| `user_agent` | texto curto (opcional) |
| `created_at` | timestamptz |

Uso: diagnóstico e alerta da equipe (a mensagem ao aluno diz “a equipe já foi avisada”: isto precisa ser verdade). Índice por `(content_kind, content_id, created_at desc)`. Deduplicar no servidor (veja `05`).

## Regras derivadas (calculadas no servidor, não armazenadas)

- **Número da aula (`ordinal`)**: posição global no curso, contando por módulo e posição, só aulas publicadas. Gravações não têm número; usam `label` = data curta (`09/01`).
- **Liberada**: `release = null` ou `release <= agora` → liberada. Cronograma por turma tem prioridade sobre qualquer campo de aula.
- **Concluída**: `completed_at != null`.
- **Em andamento**: `last_position_sec > 0` e não concluída. `inProgressPct = min(100, round(last_position_sec / duration_sec * 100))`, só se `duration_sec` conhecido.
- **Contadores do painel**: por grupo `completedCount/totalCount`; total do curso `completedCount/totalCount` (aulas publicadas e liberadas ou não: **todas as publicadas**).

## Acesso

- `canAccessCourse(userId, courseId)` e `canAccessRecording(userId, recordingId)`: **reutilize** as regras existentes de matrícula/turma. Se não houver função, crie uma e a use em **todas** as leituras e mutações.
- Toda mutação confere acesso **ao conteúdo** antes de escrever.

## RLS / segurança de linha

- Se as tabelas existentes usam RLS: crie políticas em `room_progress` e `room_video_issues` do tipo “o usuário só lê/escreve as próprias linhas” (`user_id = <identidade do usuário no padrão do repo>`), e **sem** política de DELETE para o aluno.
- Se o repositório faz a checagem só no servidor (service role): replique o padrão e **nunca** exponha as tabelas ao cliente.
- `contracts/schema.sql` traz o esqueleto com comentário `-- ADAPTAR` nos pontos que dependem do padrão do repo.

## Migrações

- Versionadas e **idempotentes** (`create table if not exists`, `add column if not exists`).
- Apenas aditivas. Nenhum `drop`, nenhuma troca de tipo.
- Cada migração tem um script de reversão comentado.
- Criar e testar localmente. **Não aplicar em produção** sem autorização.
