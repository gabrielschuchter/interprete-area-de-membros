# Auditoria de rotas — estado verificável

`SOURCE_REVIEWED` significa que a rota, seus estados, navegação e responsividade foram revisados no código. `RUNTIME_BLOCKED_DATABASE` significa que a rota chegou ao servidor, mas a renderização autenticada falhou na consulta Prisma por certificado/credencial PostgreSQL; não é aprovação visual.

| Rota | Desktop | Mobile | Marca | UX | Status |
| --- | --- | --- | --- | --- | --- |
| `/` | fonte revisada | fonte revisada | escola + ação prioritária | home contextual | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/aprender` | fonte revisada | fonte revisada | papel + trilha | progresso e descoberta | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/aprender/trilhas/[slug]` | fonte revisada | fonte revisada | percurso editorial | módulos e cursos | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/aprender/cursos/[slug]` | fonte revisada | fonte revisada | progressão pedagógica | lista de aulas | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/aprender/cursos/[slug]/[lessonSlug]` | fonte revisada | fonte revisada | coluna de leitura | recursos, conclusão e navegação | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/atividades` | fonte revisada | fonte revisada | prática guiada | estados de entrega | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/atividades/[slug]` | fonte revisada | fonte revisada | papel de trabalho | resposta e feedback | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/comunidade` | fonte revisada | fonte revisada | sala de discussão | espaços e descoberta | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/comunidade/[spaceSlug]` | fonte revisada | fonte revisada | fichas de discussão | feed e criação | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/comunidade/[spaceSlug]/[postId]` | fonte revisada | fonte revisada | margem/comentário | thread e respostas | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/comunidade/novo` | fonte revisada | fonte revisada | publicação editorial | editor, preview e autosave | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/comunidade/meus-topicos` | fonte revisada | fonte revisada | caderno de publicação | drafts e arquivados | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/comunidade/salvos` | fonte revisada | fonte revisada | arquivo pessoal | bookmarks | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/biblioteca` | fonte revisada | fonte revisada | arquivo curado | busca e filtros | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/biblioteca/[id]` | fonte revisada | fonte revisada | leitura curada | detalhe e link externo | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/encontros` | fonte revisada | fonte revisada | sala de aula | próximo encontro prioritário | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/encontros/[id]` | fonte revisada | fonte revisada | sala de aula | detalhe, professor e curso | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/perfil` | fonte revisada | fonte revisada | caderno do estudante | identidade e resumo real | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/membros` | fonte revisada | fonte revisada | comunidade escolar | busca e diretório | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/membros/[username]` | fonte revisada | fonte revisada | identidade pública | atividade publicada | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/admin/learning` | fonte revisada | fonte revisada | mesa do professor | autoria protegida | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/admin/activities` | fonte revisada | fonte revisada | prática e feedback | revisão protegida | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/admin/community` | fonte revisada | fonte revisada | moderação | espaços protegidos | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/admin/meetings` | fonte revisada | fonte revisada | agenda da turma | criação protegida | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/admin/library` | fonte revisada | fonte revisada | curadoria | itens protegidos | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/admin/membros` | fonte revisada | fonte revisada | escola protegida | papéis e diretório | SOURCE_REVIEWED / RUNTIME_BLOCKED_DATABASE |
| `/sign-in` | fonte revisada | fonte revisada | auth brand shell | Clerk | RUNTIME_PARTIAL |
| `/sign-up` | fonte revisada | fonte revisada | auth brand shell | Clerk | SOURCE_REVIEWED |

## Evidência de runtime

Em 24/09/2026 o servidor local respondeu em `http://localhost:3000`. A rota pública `/sign-in` carregou o Clerk e a sessão existente redirecionou para `/`; a renderização autenticada então falhou em `prisma.member.findUnique()` com `self signed certificate in certificate chain`. Isso comprova a fronteira de autenticação e identifica o bloqueio real, mas não comprova o shell com dados do Supabase.

As larguras de 375, 430, 768, 1024 e 1440px permanecem `NOT VERIFIED` no navegador porque a credencial PostgreSQL/CA disponível não permite renderizar as consultas autenticadas. O código foi revisado para evitar overflow e a primitiva Button já possui evidência parcial no Storybook; isso não substitui screenshots autenticados.
