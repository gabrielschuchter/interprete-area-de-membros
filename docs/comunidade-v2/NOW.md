# Comunidade V2 — estado para continuidade

Branch: codex/comunidade-v2, worktree dedicado C:\Users\gabsc\.codex\worktrees\comunidade-v2\interprete-area-de-membros.
Checkpoint documental: 191c8f1 — correção de rumo e transferência de OPS-01 para backlog.
Checkpoint de implementação da Etapa 02: 1d71ef1, enviado a origin/codex/comunidade-v2.
Etapa ativa: 02 — Navegação e Explorar.
Estado: implementação da etapa concluída no código e validada por gates locais; permanece IN PROGRESS até validar runtime autenticado com dados reais de QA. Não declarar persistência/autorização fim a fim a partir de build ou testes unitários.

## Entregue no código

- Cinco destinos da Comunidade, navegação desktop e seletor móvel; Explorar com busca, grupo, tipo e ordenação refletidos na URL e paginação por cursor.
- Origem e retorno seguros entre feed, detalhe e edição; rotas canônicas para grupos e publicações próprias.
- CommunityBookmark real integrado à listagem global de Salvos, com busca, filtro, paginação e remoção autorizada.
- Encontros e Gravações conectados aos serviços existentes, incluindo estado de inscrição, janela de entrada e miniatura autorizada da gravação.
- Estados vazios/erro e layouts responsivos para os boards da matriz Etapa 02. Nenhum schema/migration, dado fake de produto ou fixture persistente foi adicionado.

## Evidência local

- bun run check, bun run typecheck, bun run boundaries, bun run test e bun run performance:check passaram.
- A suíte do app passou com 782 testes; as suítes API, domínio e guards também passaram.
- Build direto de apps/app passou com SKIP_ENV_VALIDATION=true e URL local http://localhost:3000.
- Bundle inicial de Comunidade: 210,8 KiB gzip, limite 225 KiB.
- Boards consultados: 02, 03, 03b, 08, 09, 11, 19, 32, 33, 35, 37, 38, 43 e 50.
- graphify update . foi tentado, mas o binário não está instalado e graphify-out/graph.json não existe neste worktree.

## Bloqueio real restante

O worktree não contém configuração local de Clerk, Supabase ou PostgreSQL. Nenhuma credencial foi copiada e nenhum Preview/Production foi acessado. Ainda faltam jornadas no navegador autenticado com dados reais: feed e filtros, paginação, retorno, Salvos entre Comunidade/global, e Encontros/Gravações, incluindo autorização e persistência após reload. Manter Etapa 02 IN PROGRESS até essa evidência; OPS-01 não bloqueia esta etapa.

## Próximas 3 ações

1. Configurar um runtime Preview/QA autenticado e autorizado para a branch, preservando Clerk/Supabase e os limites de dados existentes.
2. Percorrer as jornadas acima no desktop, tablet e mobile, capturar screenshots dos boards e registrar resultados de autorização/persistência.
3. Corrigir achados, repetir os gates e só então promover a Etapa 02 a aceita; não iniciar trabalho de Etapa 03 antes desse aceite.

## Preservar

Manter os commits 191c8f1 e 1d71ef1, os dados existentes, o cron GREEN, Vercel SSO, credenciais, Preview/Production e o checkout original sem alterações. OPS-01 permanece backlog independente para recuperação periódica, Broadcast/badge e preflight de release.
