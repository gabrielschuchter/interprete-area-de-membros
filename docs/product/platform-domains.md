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

`Meeting` guarda contexto, horário, timezone, links externos e vínculo opcional com `Course`. A área de membros destaca o próximo encontro e oferece detalhe com professor/curso; gravações são opcionais. A aplicação não implementa vídeo, WebRTC ou calendário próprio.

## Library

`LibraryItem` é curadoria, não file manager. O modelo guarda tipo, categoria, tags e URL. A busca é textual por título/descrição/tag e os filtros são pequenos. Upload e Storage só devem ser adicionados quando houver necessidade concreta, bucket e policy revisados.

## Smart Home

A Home calcula o próximo passo no servidor, nessa ordem: atividade pendente, aula em andamento/próxima aula, próximo encontro e discussão recente. Se não houver dados, mostra uma orientação honesta para começar em Aprender; não inventa métricas, gráficos ou recomendações de IA.

## Validação pendente

Os fluxos acima passaram por `check` e `typecheck`, mas persistência real, migration status, seed, E2E autenticado e reload ainda exigem uma `DATABASE_URL`/`DIRECT_URL` válida do Supabase oficial e uma cadeia TLS confiável no ambiente de execução.
