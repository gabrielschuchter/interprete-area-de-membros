# Domínios de produto

## Regra comum

O Clerk fornece a identidade. O servidor obtém o `userId` com `auth()` e usa o Prisma compartilhado para ler ou mutar dados. O cliente nunca escolhe o `memberId` e nenhuma tela usa dados embutidos como se fossem dados reais.

Leituras de membros aceitam apenas conteúdo `PUBLISHED`. Professor/admin é autorizado pelo registro `Member.role`: `TEACHER` ou `ADMIN`. A ausência de registro mantém o usuário como `MEMBER`; não existe fallback por e-mail.

## Teacher/Admin

`/admin/learning` permite criar percursos e cursos. A tela do curso cria módulos e aulas, aceita documento JSON estruturado ou texto convertido em documento, oferece preview privado e publica/arquiva cada nível. Um rascunho não entra nas queries de membros.

`/admin/activities`, `/admin/community`, `/admin/meetings` e `/admin/library` usam o mesmo guard e fornecem curadoria mínima, sem criar um segundo painel SaaS.

## Activities

`Activity` é conteúdo publicado. Cada membro tem no máximo uma `ActivitySubmission` por atividade (`@@unique([activityId, memberId])`). O envio substitui a versão anterior e o professor grava `Feedback` em transação com o estado `REVIEWED`.

## Community

O fluxo é `CommunitySpace -> CommunityPost -> CommunityComment`. Comentários aceitam `parentId` e a UI limita a indentação visual. `PostVote` e `CommentVote` têm constraint única por membro/alvo e são removidos ao clicar novamente. Posts e comentários usam `deletedAt` para preservar a integridade da thread.

O autor é apresentado por `Profile` em feed, tópico e resposta. O editor salva texto plano para busca/preview e JSON sanitizado para renderização rica; a identidade do autor sempre vem da sessão Clerk no servidor. Busca, ordenação recente/popular, drafts, bookmarks e diretório de membros são superfícies do mesmo domínio, não mocks separados.

## Meetings

`Meeting` guarda contexto, horário, timezone, links externos, preparação,
materiais e vínculo opcional com `Course`. A área de membros destaca o próximo
encontro, oferece detalhe com professor/curso e liga gravações históricas quando
existem. A aplicação não implementa videoconferência própria, WebRTC ou
calendário externo.

`ImportedRecordingGroup` e `ImportedRecording` representam o arquivo histórico
importado da Kiwify, não uma hierarquia curricular. O vínculo do grupo com um
`Member` é explícito, administrativo e auditável; nome legado nunca concede
acesso. `/encontros/gravacoes` é a superfície do membro e a rota antiga
`/aprender/minhas-gravacoes` redireciona para ela.

## Library

`LibraryItem` é curadoria, não file manager. O modelo guarda tipo, categoria, tags e URL. A busca é textual por título/descrição/tag e os filtros são pequenos. Upload e Storage só devem ser adicionados quando houver necessidade concreta, bucket e policy revisados.

## Smart Home

A Home calcula no servidor o que merece atenção agora, nesta ordem: próximo
encontro, preparação, retomada de gravação, atividade pendente, feedback,
conteúdo assíncrono relevante e discussão recente. Blocos sem dados não são
renderizados. Gravações não produzem métricas de aulas concluídas.

## Progresso e curadoria

`LessonProgress` mede conclusão de conteúdo assíncrono. `PlaybackProgress`
guarda posição de reprodução por membro e asset e alimenta “Continue
assistindo”; assistir uma gravação não conclui curso, módulo ou aula.
`ContentCollection` é curadoria de apresentação, não curso, trilha ou sequência
com percentual agregado.

## Validação

O schema e as migrations foram conferidos no PostgreSQL/Supabase oficial; o
inventário live-first e a integridade de gravações estão registrados em
[`live-first-recordings.md`](../architecture/live-first-recordings.md). Os
gates estáticos (`check`, `typecheck`, `boundaries`, testes, Prisma e build)
devem continuar sendo executados em cada lote. A validação autenticada de
membro/administrador e a validação pública de produção são gates independentes
do build e não devem ser substituídas por screenshots ou por dados de seed.
