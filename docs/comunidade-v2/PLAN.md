# Comunidade V2 — plano técnico de execução

## Escopo e fontes de verdade

Este plano organiza a implementação da Comunidade V2 a partir da main em b6028a3, preservando a fundação next-forge e os módulos existentes. O Estágio 00 documental está concluído e o Estágio 01 de isolamento/Preview está em andamento. A autorização vigente cobre preparação operacional e documentação; não inclui funcionalidades V2, migrations ou escritas no GREEN.

Precedência:

1. As 25 decisões aprovadas no roteiro de 15/10/2026 e os refinamentos registrados em DECISIONS.md.
2. O código, o schema, AGENTS.md, as regras de autorização e os contratos operacionais do repositório.
3. HANDOFF.md, os 53 boards, o protótipo e os assets como especificação visual e funcional, exceto onde os itens anteriores prevalecem.

O roteiro, esta página, STATUS.md, DECISIONS.md e BOARDS.md são as fontes operacionais da execução. Este plano de trabalho é uma decomposição da fase 7 do docs/implementation/roadmap.md, que permanece IN PROGRESS até prova de persistência, autorização, desktop/mobile e gates. A meta exibida na Comunidade não conclui a fase 8 de Estudo; o wrapper de Encontros não conclui a fase 9; a revisão de responsividade contribui com a fase 10, sem encerrá-la. Não versionar uma cópia desnecessária dos assets do pacote original. A matriz de boards é o vínculo entre referência, componente e teste. A especificação anterior docs/product/community-and-profiles.md também foi lida; quando seu contrato antigo de rascunho divergir das decisões V2, prevalece a decisão aprovada.

## Arquitetura a preservar

- Prisma em packages/database é o único acesso de domínio ao PostgreSQL Supabase. Clerk continua sendo a identidade inicial; permissões de membro e staff vêm de Member.role, sempre verificadas no servidor.
- CommunityPost, CommunityComment, CommunitySpace, CommunitySpaceMember, Invitation, Mention, TopicFollow, CommunityBookmark e votos são as entidades canônicas. Ampliar esses contratos em vez de criar um segundo domínio de publicações, grupos ou salvos.
- TipTap e o editor atual são a base do editor. Corrigir o ciclo de criação/salvamento e a concorrência sem substituir a experiência do editor.
- Announcement, StudyCampaign, StudyTrackingSession, StudyActivityInterval, FocusTimerSession, DomainEvent e OutboxJob são as bases canônicas de avisos, estudo e tarefas duráveis.
- Reutilizar o proxy de assets autenticado e o Storage atual. Estender a autorização de referências para capas de grupo; não criar bucket paralelo.
- Reutilizar a navegação compartilhada, o shell 248 px, cabeçalho 56 px e o sistema tipográfico existente. A navegação da Comunidade passa a ter cinco destinos. A Home/Início não exibirá avisos da Comunidade V2.
- Feed, busca e listas devem paginar e projetar dados no banco. Não antecipar em massa cards visíveis. Identidade, papel, grants e dados privados não entram em cache persistente compartilhado.
- Notificações e efeitos secundários usam outbox transacional e consumidores idempotentes versionados. Preview e produção compartilham o GREEN; consumidores V2 não podem disputar jobs legados com semântica incompatível.

## Dependências entre entregas

| Entrega | Depende de | Bloqueia ou habilita |
|---|---|---|
| 00 — documentação | auditoria concluída | fonte de execução e critérios rastreáveis |
| 01 — isolamento e Preview | main atualizada, backup GREEN íntegro, configuração exclusiva da branch e acesso Vercel protegido | leitura autenticada e QA controlado; nenhuma escrita até haver identidade/escopo de QA e isolamento do outbox |
| 02 — navegação e Explorar | 01 e sessão humana Clerk Development comprovada | entrada, origem/retorno e destinos comuns |
| 03 — rascunhos e publicações | 01, 02 e limite seguro para escrita de QA no GREEN compartilhado | leitura, discussão, salvos e links |
| 04 — comentários e menções | 03, autorização existente, papéis de grupo de 05 para casos privados e isolamento de jobs de Preview | notificações de discussão e testes B |
| 05 — grupos e papéis | 01–03, identidade de QA autorizada e isolamento de jobs antes de testar notificações/convites | conteúdo privado, convites e moderação de grupo |
| 06 — convites | 05 e isolamento de jobs de Preview | entrada por token, estados recebidos e testes de jornada |
| 07 — compartilhamento | 03 e 05; 06 não é requisito para compartilhar publicação | landing anônima, OG e retorno autenticado |
| 08 — avisos | 01, contratos atuais de Gestão/Announcement e isolamento de jobs de Preview | avisos da Comunidade; não altera a Início |
| 09 — meta e avatares | 01, leitura dos registros de estudo e preferência de perfil | meta configurável e bloco visual sem presença real |
| 10 — QA integrado | 02–09 | candidato visual e funcional |
| 11 — revisão adversária | candidato e evidências da 10 | lista de bloqueadores ou aprovação |
| 12 — release | aprovação da 11, backup e preflight final | publicação integral já autorizada após os gates |

A execução permanece sequencial, com um agente e um worktree V2. A ordem mantém os fluxos de produto curtos; se uma dependência real exigir mudança, atualizar esta tabela e STATUS.md antes de avançar.

## Entregas verticais

| Etapa | Trabalho e saída verificável | Migration e gates de saída |
|---|---|---|
| 00 | Gravar PLAN, STATUS, DECISIONS e BOARDS. Registrar a precedência das fontes, achados, decisões e lacunas sem alterar produto. | Sem migration. Revisar consistência entre as 25 decisões e a matriz. |
| 01 | Trabalhar em codex/comunidade-v2 a partir da main atualizada. Fazer backup manual do GREEN, validar legibilidade/integridade e documentar recuperação; inventariar e arquivar os bytes de Storage. Configurar somente overrides da branch, Clerk Development, proteção Vercel e modo Preview somente leitura. Provar sessão Clerk humana de membro e uma recuperação segura de jobs antes de liberar qualquer escrita. | Nenhum schema de produto adiantado. Não prosseguir a QA mutável sem backup verificável, sessão autenticada e identidade/escopo QA autorizado. O teste de eventos que enfileiram notificações aguarda isolamento do outbox. |
| 02 | Criar cinco destinos, navegação responsiva, filtros/origem/retorno em URL, Explorar e estados vazios/erro. Integrar Salvos da Comunidade ao Salvos global e envolver Encontros/Gravações existentes sem reescrever o domínio de reuniões. | Nenhuma tabela nova. Paginação por cursor em lotes de 10 e projeção mínima no banco. Validar links antigos e novos, autorização e widths da matriz. |
| 03 | Completar criar-escrever-salvar-publicar, listas Publicadas/Rascunhos/Arquivadas, leitura e capa. Não criar rascunho no simples abrir/sair; uma edição produz no máximo um registro. Conflitos entre abas e falhas de rede são explícitos. Fixar uma publicação por escopo. Exclusão lógica com restauração administrativa por 30 dias; preservar rascunhos antigos. | Migration aditiva apenas para versão de edição e alt da capa se ainda necessários, metadados de recuperação e restrições de fixação única. Antes de índice parcial, verificar duplicidades e o comportamento de NULL do escopo geral. Escrever em GREEN somente por identidade QA autorizada e escopo isolado; notificações ficam fora desta etapa até o gate de outbox. |
| 04 | Completar leitura, comentários de um nível, edição/remoção, menções contextuais, @todos somente professor/admin, seguir ao comentar e silenciar. Comentário, menções, notificações e outbox têm consistência transacional e idempotência. Reautorizar leitura antes de retornar resultado idempotente antigo. | Migration aditiva somente para campos/índices realmente faltantes. Não apagar texto privado copiado para notificações; aplicar autorização fresca em todas as leituras e no REST legado. Antes de testar escrita no Preview, separar jobs por origem/ambiente e provar que o worker de produção não os reivindica. |
| 05 | Criar grupos por qualquer membro, entrada imediata em público, membership privado, donos/moderadores/membros, abas Membros/Sobre/Configurações, capa e arquivo reversível. Moderador tem apenas capacidades selecionadas; staff privilegiado é auditável. | Enum MODERATOR e idempotência aditiva, se a auditoria final confirmar necessidade. Preservar a unicidade atual de título por proprietário até resolver o caso de nomes repetidos; não eliminar índice ou dados para facilitar UI. Índice de membro e autorização de capa entram junto da jornada. |
| 06 | Entregar convite por pessoa e link: pendente, aceito, recusado, revogado, regeneração sem expiração temporal, retorno Clerk e resultado por destinatário em lote de até 50. E-mail aparece indisponível, sem simular envio. | Token aleatório gerado no servidor; persistir hash, não segredo bruto. Índice parcial único para convite pessoal pendente e entidade separada para o link de grupo, após verificar estado atual. Aceite e vínculo são uma transação idempotente. Aplicar o gate de origem do outbox antes de emitir notificações no Preview. |
| 07 | Entregar folha, link revogável, landing anônima e OG sem JavaScript. Publicação privada pode ter link, mas visitante sem acesso recebe metadados genéricos e nunca ganha acesso. Link de grupo privado não aparece como ação compartilhável. | Nova entidade de compartilhamento guarda hash do token, escopo e revogação. Não colocar segredo em log, URL de telemetria, HTML, cache ou resposta de erro. |
| 08 | Completar o caminho da Gestão existente até os avisos da Comunidade: audiência, turma, intervalo, importância, dispensa por versão e atualização em aba visível. Manter a rota de Gestão existente. Não adicionar avisos à Início/portal. | Ampliar Announcement, relação de turma e dispensa por pessoa/versão. Converter explicitamente datas locais BRT. Escrita e notificações usam outbox; aplicar o gate de origem do outbox antes de testar notificações no Preview. |
| 09 | Configurar meta coletiva opcional com renovação automática/manual e histórico/snapshot; usar apenas intervalos fechados, persistidos e provenientes de recursos funcionais. Unir sobreposições por membro antes da soma. Exibir fontes reais. O bloco de avatares é decorativo, sem presença nem contagem, e respeita preferência de exclusão do perfil. | Estender StudyCampaign e preferência de perfil; snapshot agregado. Não criar modelo paralelo de sessão/meta nem reescrever timers. Intervalos de 30 s contam se a sessão-fonte elegível passou de 60 s; não filtrar cada intervalo por 60 s. |
| 10 | Comparar todos os boards aplicáveis com HTML de referência e fontes oficiais. Executar jornadas A–G por papel/dispositivo, a11y e regressões da Início/Gestão/shell. Corrigir diferenças comprovadas e anexar screenshots/traces. | Rodar os seis checks do monorepo e gates do release candidate. Registrar exceções aprovadas na matriz. |
| 11 | Revisão adversária sequencial por conversa nova, sem agente paralelo: autorização, dados privados, tokens, migrations, caches, RLS, notificações, flags, boards e gates. | Resolver todo bloqueador antes de 12; retornar ao executor com reprodução precisa. |
| 12 | Preflight de produção, migrations aditivas, flags/rollback, release integral, smoke de membro/staff/anônimo em desktop e celular, conferência de OG externo e atualização final de STATUS. | Só executar com backup verificável, gates aprovados e projeto/branch confirmados. Publicação final autorizada pelo protocolo; nenhum gate ou operação destrutiva é presumido. |

## Migrations e riscos por domínio

| Domínio | Alteração aditiva candidata | Risco e controle |
|---|---|---|
| Publicação | versão esperada para escrita concorrente; alt da capa; metadados de restauração; índices parciais para uma fixação por escopo | backfill e conflitos entre abas; pré-consultar conflitos e manter semântica antiga até flag liberada |
| Grupo | MODERATOR, chave de idempotência e metadados de arquivo | enum novo afeta rollback de clientes antigos; não gravar papel novo antes de todos os consumidores compatíveis. Arquivo não pode remover spaceId das publicações |
| Convite | token/validade opcionais pessoais, índice único pendente e registro de link do grupo | estado histórico e corrida concorrente; transação e verificação de duplicidade antes do índice |
| Compartilhamento | token-hash, tipo de escopo, revogação e datas | cache/OG pode preservar card antigo; expor metadado genérico a não autorizado e validar revogação no servidor |
| Aviso | importância, audiência/turmas e dismissals versionados | conversão de fuso BRT, edição e evento concorrentes; migração sem redefinir público atual |
| Estudo/perfil | período/renovação/snapshot de StudyCampaign e opt-out de avatar | união de intervalos, fontes parciais e cache pessoal; total deve derivar apenas de dados persistidos elegíveis |
| Outbox/RLS | tipos/consumidores versionados; política de leitura revisada somente após teste de compatibilidade | produção e Preview compartilham banco e worker. Preservar entrega atual e Broadcast; remover acesso REST legado só depois de provar caminho alternativo |

Nenhuma migration é executada antecipadamente. Cada mudança deve documentar alvo GREEN, contagem prévia, duração, lock esperado, aplicação, leitura pós-migration e rollback por flag. Não usar BLUE: o BLUE está congelado/legado e os envs locais atuais não são configuração para Preview.

## Preview, backup e rollout

- GREEN é compartilhado pelo Preview V2 e produção. Usar apenas contas existentes autorizadas e fixtures aditivas identificadas; sem reset, identidade inventada ou escrita ampla. O Preview permanece somente leitura enquanto não houver isolamento de escrita e de jobs.
- Antes de qualquer escrita/migration, manter backup manual verificável do schema, dados e ledger, além dos bytes de Storage. Guardar ambos fora do repositório, com criptografia e chave recuperável; documentar como restaurar para um projeto isolado. Não testar restauração no GREEN compartilhado.
- Vercel Preview exige SSO e Clerk humano separado. Validar o ambiente efetivo da branch com `vercel env pull --environment=preview --git-branch=codex/comunidade-v2`, sem imprimir segredos. Preservar o proxy Clerk Production e usar chaves Clerk Development somente no Preview; não usar bypass de proteção para simular login Clerk.
- Para a fase somente leitura, definir `APP_WRITE_FREEZE=true`, omitir `CRON_SECRET`, desativar seed e webhooks e deixar integrações externas de escrita sem credenciais, sempre em overrides exclusivos da branch. Não usar o deployment criado antes desses overrides.
- O worker de produção reivindica todos os jobs elegíveis da chave de consumidor compartilhada, e `dispatchPendingNotifications` executa o consumidor também no app. Antes de liberar mutações que criem jobs no Preview, separar a origem/ambiente no contrato do outbox e em ambos os consumidores; comprovar idempotência, recuperação e não reivindicação cruzada. Só desabilitar o cron do Preview não isola jobs que o próprio app enfileira.
- Flags precisam ser exclusivas da branch/Preview e desligadas em produção. Rollback primário desliga UI/rotas V2 numa versão compatível; backup completo é último recurso pois pode apagar escritas posteriores.
- Não criar banco de homologação, serviço ou cron paralelo. Não apagar objetos de Storage substituídos no editor até existir política de retenção segura e reconciliação comprovada.
- Não apagar objetos de Storage substituídos no editor até existir política de retenção segura e reconciliação comprovada.

## Critérios de aceite e checks

Cada jornada deve persistir após reload e cobrir dois alunos, professor/admin e visitante quando aplicável; testar proprietário, moderador, membro removido, negação direta por URL/API, concorrência e perda de conexão. Estado visual de sucesso só depois de persistência.

- Acessibilidade/interação: resposta visual de clique/toque/submit até 100 ms; foco, teclado, leitor de tela e teclado virtual; toque mínimo de 44 px e sem overflow nas larguras 320, 360, 390, 768, 820, 1024, 1280 e 1440 px.
- Navegação/performance: warm intent p95 até 300 ms, primeira UI útil p95 até 1 s; mutação persistente pequena p95 até 500 ms; LCP p75 até 2,5 s, INP até 200 ms, CLS até 0,1 e JavaScript de rota até 225 KiB. Medir, não inferir.
- Atualização: avisos em até 60 s com aba visível e meta em até 15 min; pausar polling/rotação quando a aba está oculta. Nenhuma presença real, contagem inventada ou regra prefers-reduced-motion.
- Privacidade: validar HTML, API, busca, contadores, notificações, REST, assets, OG, cache e acesso depois de revogação.
- Rodar, ao fechar entregas relevantes, a partir da raiz com Bun/Turborepo:
      bun run check
      bun run typecheck
      bun run boundaries
      bun run test
      bun run build
      bun run performance:check
  Os checks completos ficam para o release candidate; durante a edição, usar testes focados sem repetir suite idêntica sem mudança.
- A prova de OG no Preview protegido e o smoke público após a publicação são gates distintos. Não desativar a proteção para facilitar validação externa.

## Próxima ação

O Estágio 00 materializou estes quatro artefatos. O Estágio 01 permanece aberto até existir deployment da branch com os overrides já validados, acesso Vercel protegido, sessão humana Clerk de membro comprovada, procedimento de recuperação documentado e limite seguro para QA. Nenhuma migration ou escrita de produto foi iniciada.
