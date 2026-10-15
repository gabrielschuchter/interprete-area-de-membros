# Comunidade V2 — status da auditoria

**Estado:** auditoria e documentação do Estágio 00 concluídas; etapa funcional não iniciada. A fase 7 do roadmap permanece IN PROGRESS.
**Data de corte:** 15/10/2026.
**Branch e base:** codex/comunidade-v2, criada a partir de origin/main em b6028a37a358c0ff1d45d19297c5454318c799a3.
**Próximo passo:** revisar estes quatro documentos; não iniciar etapa funcional antes dos gates do Estágio 01.

## Escopo e integridade

- Handoff examinado integralmente: HANDOFF.md, 53 boards HTML e PNG, protótipo navegável, tokens, fontes de assets e sete fluxos guiados.
- Pacote entregue: C:/Users/gabsc/Downloads/files nova comunidade.zip
  SHA-256: 5C570782C1EA270DFD3514C0BEA39A4A6A8BEECDAD2E05EAFBFC8D1E7F515C44
- Protocolo de decisões: D:/roteiro-codex-comunidade-v2.md
  SHA-256: F9C6D5E4F657D320BA856D97DC31F489425FE3546B6E2BB303DE81CFC46C62E
- AGENTS.md, schema Prisma, código da main, Gestao V2, Inicio B2, editor, notificações, uploads, perfil, timers e consultas de estudo foram auditados. A fonte de implementação parte da main; o checkout original estava atrás da main.
- O checkout original permanece inalterado: branch codex/interprete-member-area-release-2026-10-04, HEAD a4b68b81dc084d6de4648c488a0442e14cfb0539, com 8 arquivos rastreados modificados e 9 não rastreados já existentes. Nenhum deles foi copiado, limpo ou sobrescrito.
- O worktree desta entrega está limpo antes da documentação e parte de b6028a3. Nenhuma alteração funcional, migration, escrita de dados, backup, publicação, deploy ou configuração de credenciais foi feita nesta auditoria.

## Fontes verificadas na main

- Sequência de produto: docs/implementation/roadmap.md; a tabela de reauditoria mantém fase 7 Comunidade, fase 8 Estudo, fase 9 Biblioteca/Encontros e fase 10 Acessibilidade/Performance/Release em IN PROGRESS.
- Contrato anterior de domínio: docs/product/community-and-profiles.md. Ele registra rascunho criado no início do composer e pin reservado a professor/admin; 20C altera o primeiro comportamento. A cardinalidade de pin muda por 18A, mantendo autorização server-side.
- Schema e acesso: packages/database/prisma/schema.prisma, packages/database/prisma.config.ts.
- Queries e mutations: apps/app/lib/community.ts, community-query.ts, community-mutations.ts, community-space-rules.ts, notifications.ts e study-dashboard.ts, study-tracking.ts, focus-timer.ts.
- UI e ações: apps/app/app/(authenticated)/comunidade/actions.ts; apps/app/components/community/community-composer.tsx, community-start-panel.tsx, mention-textarea.tsx, topic-editor.tsx, comment-composer.tsx, community-presence.tsx; apps/app/app/(authenticated)/salvos/page.tsx e apps/app/components/learning/study-dashboard.tsx.
- Identidade, assets e integrações: apps/app/lib/auth.ts, authorization.ts, apps/app/proxy.ts, packages/auth/clerk-proxy.ts, apps/app/app/api/member-assets/route.ts, apps/app/app/(authenticated)/admin/avisos/page.tsx, apps/app/components/portal/portal-view.tsx, apps/app/lib/meetings.ts, apps/api/lib/notification-outbox-consumer.ts.
- Instruções lidas: AGENTS.md, apps/app/AGENTS.md e apps/api/AGENTS.md, além das instruções fornecidas diretamente nesta conversa.

## Estado verificado do produto

| Domínio | Evidência atual | Trabalho V2 |
|---|---|---|
| Publicações | CommunityPost tem status, slug, capa, conteúdo estruturado, votos, favoritos, pin e deletedAt; consultas principais filtram publicação e exclusão lógica | Ciclo sem rascunho vazio, conflito/versionamento entre abas, fixação por escopo e restauração administrativa |
| Editor | TipTap e salvamento enfileirado já existem; editor foi corrigido para React StrictMode | Iniciar persistência apenas após primeira mudança, retries/saída e reconciliação sem duplicação |
| Discussão | CommunityComment, respostas, edição, exclusão e TopicFollow existem | Limitar resposta a um nível; reautorizar retries idempotentes; persistir comentário, menções e notificações de modo consistente |
| Menções | Nó TipTap, autocomplete, Mention e busca de membros existem | Busca limitada ao contexto, normalização de @, teclado móvel, regras de @todos e destinatários atuais |
| Grupos | CommunitySpace, owner, membros, visibilidade, entrada pública e comentários abertos/fechados existem | Papel MODERATOR, edição de configurações, membros, arquivo reversível e autorização de capa |
| Convites | Invitation, aceite e recusa persistem; convites por membro existem | Resultado individual, proteção concorrente, token/link, revogação e regeneração |
| Avisos | Announcement, tela da Gestão e leitura na Comunidade existem | Importância, público por turma, dispensa por versão, frescor e datas BRT explícitas. A V2 não integra aviso à Início |
| Estudo | StudyCampaign, StudyTrackingSession, StudyActivityInterval e FocusTimerSession; agregação SQL une sobreposição por membro | Meta opcional/configurável, renovação e snapshot, sem reescrever timers nem fabricar horas |
| Salvos | CommunityBookmark e /comunidade/salvos persistem. A página /salvos na main consulta conteúdo pessoal de aprendizagem e favoritos de questões; não consulta CommunityBookmark. | Integrar a Comunidade ao Salvos global. O roadmap registra uma integração anterior, mas a página atual não a implementa; prevalece o código executável. |
| Compartilhamento | Ações visuais existem; página pública, token revogável e OG completo não foram comprovados | Fluxo e landing real, metadados genéricos para publicação privada sem autorização |
| Encontros | Coortes, autorização e gravações existentes | Navegação e wrapper da Comunidade, mantendo contratos atuais de sala/gravação |
| Ativo agora | Presença real e dados de perfil são usados hoje em componentes existentes | Substituir somente o bloco da Comunidade por avatares decorativos habilitados, sem contagem/presença e com opt-out |

## Banco GREEN e segurança

Consulta realizada somente com leitura, TLS validado e transação read-only:

- PostgreSQL 17.11; 65 migrations completas; sem migration incompleta. Os 65 checksums conferem com os arquivos da main auditada.
- 104 tabelas públicas de domínio verificadas e 104 com RLS.
- Nenhuma duplicidade atual de convite pendente ou conflito de pin por escopo.
- Posts: 5 PUBLISHED, 11 DRAFT e 15 ARCHIVED; 14 arquivados têm deletedAt. Entre os rascunhos ativos, 10 estão sem título útil, texto, capa ou mídia. Todos precisam ser preservados.
- Um grupo público publicado e um grupo público arquivado; nenhum grupo privado presente no snapshot.
- 61 intervalos de estudo de 3 membros; 2 timers registrados; nenhuma campanha configurada.
- 2 jobs de outbox em SUCCEEDED e nenhum em outro estado. Cron interprete-member-outbox ativo a cada cinco minutos; 6 execuções bem-sucedidas nos 30 minutos observados.
- 0 convites, 3 notificações do tipo MENTION e 6 do tipo ANNOUNCEMENT.
- Existe policy autenticada de leitura da própria linha em Notification. Embora o cliente observado use API e Supabase Broadcast, validar compatibilidade e exposição de conteúdo copiado após revogação antes de restringir o caminho REST.
- Storage é privado. O proxy de assets já valida tipo/tamanho e remove EXIF; referências atuais não incluem CommunitySpace.coverUrl, então capa de grupo de outro membro não é reconhecida pela regra de acesso.

O GREEN atual é compartilhado por Preview e produção. O BLUE legado permanece congelado. Os arquivos locais de ambiente da auditoria apontam para BLUE e não servem para configurar o Preview V2.

## Reprodução dos defeitos relatados

| Área | Resultado | Limite da evidência |
|---|---|---|
| Menção @todos | Reprodução determinística em memória: o resolvedor captura group:ALL, remove essa chave antes de chamar a expansão e termina com recipients=[] e nenhuma leitura de banco. Menção individual de controle retorna o membro esperado | Não foram criados dados nem enviados avisos a contas reais. Separar autocomplete, nó editor, persistência, autorização, outbox e recebimento entre dois membros no Preview |
| Convites | Código contém convite pessoal, notificação e aceite/recusa. Há retorno sem resultado por destinatário e falta unicidade de pendente no banco para disputa concorrente | GREEN não contém convites; causa do relato histórico não está comprovada. Reproduzir criação, notificação, aceitar/recusar, revogação e reload com contas de QA |
| Avisos | Announcement existente conecta Gestão e Comunidade, mas não implementa importância, turma, dispensa por versão ou atualização automática completa | Não foi publicada alteração de aviso nesta auditoria. Reproduzir público elegível/não elegível, agendamento, edição, desativação e atualização em Preview |

A alegação do handoff de vazamento de rascunho no feed não foi confirmada na consulta estática da main: a consulta atual exige status publicado e deletedAt nulo. Os dez rascunhos vazios são dados reais e continuam preservados. O documento anterior de domínio registra criação do rascunho ao iniciar o composer; o contrato 20C muda esse gatilho. O roadmap registra que Salvos global já reuniu bookmarks da Comunidade, mas a página atual em apps/app/(authenticated)/salvos/page.tsx não consulta esses bookmarks; a integração precisa ser implementada e verificada.

## Preview e runtime

- Preview Vercel encontrado está protegido por SSO; a URL de deployment observada redirecionou para login Vercel e respondeu HTML 200. Isso não prova execução de /health nem autenticação Clerk.
- A produção respondeu 200 no health da aplicação e API contra GREEN.
- Valores de ambiente Vercel são criptografados; não foram decriptados nem usados para afirmar qual banco ou par de chaves um Preview específico usa.
- Os ambientes locais tinham URLs BLUE, Clerk de desenvolvimento e TLS com verificação de certificado. Não havia runtime da aplicação ou PostgreSQL local ativo nas portas verificadas.
- Para começar a execução: criar variável específica da branch apontada para GREEN; validar par Clerk Development apenas em Preview; manter Clerk Production/proxy; provar separadamente proteção Vercel e sessão humana Clerk.
- A infraestrutura de outbox existe e está ativa. A estratégia de consumidores V2 precisa ser demonstrada para evitar que worker legado reivindique job com semântica incompatível.

## Verificações executadas e limites

- O protótipo foi navegado nos sete fluxos guiados; os 53 pares HTML/PNG foram examinados. Comparação visual de release ainda não existe.
- O resolvedor de @todos foi executado isoladamente com banco falso em memória; nenhum dado externo foi alterado.
- Oito arquivos focados, total de 22 testes, passaram pelo entrypoint Node/Vitest no checkout auditado. O checkout de teste estava em a4b68b8, não em b6028a3; isso não prova a suíte da main nem runtime autenticado.
- Uma tentativa usando Bun direto falhou em dois arquivos por interoperabilidade de import Zod no executor. A execução Node/Vitest passou; nenhuma mudança foi feita para contornar esse comportamento.
- Não foram executados os seis checks completos, testes de banco com escrita, percentis, comparação real de screenshots da aplicação ou jornadas Clerk autenticadas. Não declarar esses gates concluídos.

## Bloqueios e riscos que permanecem

1. Backup GREEN verificado e procedimento de restauração documentados ainda não existem.
2. Preview Clerk autenticado não foi comprovado; os envs locais auditados apontam para BLUE.
3. GREEN compartilhado faz com que dados de QA/migrations afetem o ambiente em desenvolvimento; testes precisam de escopo, conta e cleanup aditivo explícitos.
4. Enum novo pode dificultar rollback a código antigo; usar flags compatíveis e não gravar MODERATOR antes dos consumidores atualizados.
5. Tokens, notificações privadas, REST legado, OG e caches devem revalidar permissão após revogação.
6. Backup PostgreSQL não restaura objetos de Storage; não apagar objetos antigos na primeira implementação.
7. A combinação entre o índice atual de título por proprietário e o board de criação com nome repetido precisa ser preservada/explicada antes de qualquer mudança do índice.

## Próximo passo

Revisar PLAN.md, DECISIONS.md e BOARDS.md. Depois iniciar o Estágio 01: inventário/backup GREEN legível, configuração de Preview específica da branch e prova de Clerk autenticado. Nenhuma migration de produto ou QA mutável até esses três gates serem evidenciados.
