# Comunidade V2 — decisões definitivas

**Fonte:** protocolo aprovado em 15/10/2026, complementado somente pelos refinamentos explícitos registrados nesta conversa.
**Regra de precedência:** estas decisões prevalecem sobre trechos conflitantes do handoff. O código, o schema, AGENTS.md e as restrições verificáveis do ambiente determinam a implementação técnica sem reabrir escolhas de produto.

## As 25 respostas aprovadas

| Nº/código | Resposta aprovada | Consequência de execução |
|---|---|---|
| 1C | Desenvolver em branch e worktree isolados a partir da main atualizada, com Preview atualizado e autenticado; liberar integralmente a V2 somente depois do QA final. | Isolar em codex/comunidade-v2. Release integral é autorizada após gates, mas não nesta etapa. |
| 2A | Fidelidade pixel-perfect aos 53 boards: dimensões, tipografia real, layout, cor, espaçamento, estados e responsividade; adaptar apenas conflito com decisão posterior ou limite técnico demonstrado. | Comparar os HTMLs/fontes oficiais; usar exceções registradas por board. |
| 3A | Um agente Codex por vez. Pode-se trocar de modelo ou conversa entre etapas; não executar agentes em paralelo. | Fluxo de trabalho sequencial em um único worktree V2. |
| 4B | Alterar Início, Gestão, notificações, perfil, dados ou serviços somente quando a integração exigir; não redesenhar módulos fora do escopo. | Mudanças externas à Comunidade são estreitas e documentadas. |
| 5A | Qualquer membro pode criar grupo. | Criação exige sessão/autorização normal e persistência real. |
| 6A | Grupo público permite entrada imediata. | Criar vínculo de membro na ação de entrada e confirmar após persistência. |
| 7A | Grupo privado exige vínculo para membros; professor/admin possuem acesso privilegiado de moderação, auditável e verificado no servidor. | Acesso de staff não depende de link oculto, email ou metadata pública. |
| 8A | Apenas dono, moderadores e equipe autorizada podem convidar. | Verificar capacidade na ação e no endpoint para cada destinatário. |
| 9C | Moderador pode moderar posts/comentários, remover membros, gerenciar convites e editar configurações selecionadas; não pode assumir propriedade, elevar papéis ou executar operações reservadas. | Propriedade, privacidade, papéis privilegiados e arquivo ficam com dono/staff conforme regra específica. |
| 10B | Excluir grupo significa arquivar de forma reversível, preservando privacidade. | Manter spaceId das publicações; não convertê-las em posts do feed geral. |
| 11A | Convite recebido oferece Aceitar ou Recusar; a recusa é persistida. | Estado explícito para recusa, idempotência e reload. |
| 12A | Link de convite não expira por tempo; pode ser revogado e regenerado. | Validade temporal não é exigida para link de grupo; revogação é server-side. |
| 13C | E-mail real fica fora dos critérios bloqueadores. Preparar interfaces/templates/dados, sem exigir envio; ocultar/desabilitar controles sem provedor com explicação honesta; nunca simular entrega nem contratar serviço. | Fluxo in-app funciona sem fornecedor de e-mail. |
| 14B | Notificações in-app funcionam. Integração de e-mail para menções/convites pode ficar arquiteturalmente pronta, mas não bloqueia release. | Outbox e persistência in-app são obrigatórios; não afirmar envio externo. |
| 15A | @todos é exclusivo de professor/admin. | Autorizar no servidor. Destinatários elegíveis são participantes/seguidores atuais com acesso; silenciados não recebem notificação. |
| 16A | Comentar passa a seguir automaticamente a publicação; é possível silenciar. | Preservar estado muted em atualizações do follow e respeitá-lo na entrega. |
| 17B | Link para publicação de grupo privado é permitido, mas não dá leitura ou entrada. Pessoa sem acesso vê landing/OG genéricos, sem título, capa, trecho, autor, comentários ou metadados privados. | Reautorizar leitura após autenticação; não tratar link compartilhado como convite. |
| 18A | No máximo uma publicação fixada por escopo: feed geral e cada grupo. | Restrição concorrente por escopo; desafixar anterior e fixar nova operação de forma consistente. |
| 19A | Publicação é excluída logicamente, com possibilidade de restauração administrativa até 30 dias. | Preservar conteúdo e trilha; não criar purga automática nesta entrega. |
| 20C | Não apagar/higienizar rascunhos antigos; impedir novos rascunhos vazios e duplicados. Relatório de rascunhos pode ser somente leitura. | Só iniciar persistência após edição real; retry e múltiplas abas não duplicam. |
| 21C | Regras e Como participar são textos fixos no código nesta entrega; organização pode virar configurável pela Gestão no futuro, sem tela de edição agora. | Conteúdo inicial aprovado: ver abaixo. |
| 22C | Meta conta horas somente de registros persistidos por recursos que já funcionam. Não reescrever timers apenas para contabilizar; não fabricar dados; declarar fontes, agregação e permitir meta não configurada. | Reutilizar intervalos existentes e união de períodos sobrepostos por membro. |
| 23C | Renovação do período da meta pode ser automática ou manual, configurável. | Persistir modo, período e histórico; não assumir regra fixa silenciosa. |
| 24A | Fotos/iniciais são decorativas e escolhidas sem consultar presença; não afirmar que alguém está online nem mostrar contagem; permitir exclusão da exibição no perfil. | Bounded query de membros elegíveis, sem presença/realtime ou cache pessoal compartilhado. |
| 25C | Migrations aditivas e release final de produção estão autorizadas ao fim dos gates, com preflight, backup, rollback por flags e smoke real. Não autoriza migration destrutiva, troca de credenciais, contratação de serviço ou exclusão de dados. | Esta etapa é documental. Nenhuma migration ou publicação foi executada. |

## Texto fixo aprovado para Regras e Como participar

**Regras**

1. Respeite quem pensa diferente.
2. Cite a fonte ao compartilhar uma evidência.
3. Pergunte com contexto: conte o que você já tentou.

**Como participar**

1. Faça uma pergunta ou compartilhe um artigo.
2. Responda com uma leitura, uma dúvida ou uma referência.
3. Entre em um grupo de estudo.

## Refinamentos aprovados nesta conversa

- **Capacidades do moderador:** edita nome, descrição curta, Sobre/detalhes, capa e abertura/fechamento de comentários. Privacidade, propriedade, atribuição de papéis privilegiados e arquivamento ficam reservados ao dono/staff.
- **Avisos:** V2 não exibe aviso da Comunidade na Início/seção do portal. O módulo da Gestão continua como fonte e a Comunidade pode exibir seus avisos.
- **Banco para Preview:** usar o GREEN atual, compartilhado com produção; não criar ambiente de homologação separado. A configuração de branch deve apontar ao GREEN após backup verificável.
- **Backup:** fazer cópia manual verificável como estado inicial antes de qualquer escrita/migration. Registrar como ler e recuperar. O backup do Postgres não inclui objetos do Storage.
- **Movimento:** não criar lógica prefers-reduced-motion para esta entrega, conforme protocolo aprovado.
- **Agendador da V2 Preview:** em 15/10/2026, o usuário autorizou revisar a regra contra scheduler paralelo e preparar um workflow GitHub Actions com OIDC para recuperação somente do namespace `preview.*` no API Preview. O GREEN cron de Production permanece intocado. O acesso deve exigir claims exatas de issuer/audience, repositório, `main`, evento `schedule`, ambiente GitHub e `workflow_ref`, com Trusted Source aplicado somente a Preview e Vercel SSO mantido. O workflow usa segredo de rota restrito ao Preview em ambiente Actions limitado a `main`; cadência GitHub é best-effort e só contará como gate após observação repetida e recuperação real. PR #10 está aberto; a autorização não equivale a merge nem a validação concluída.

## Prevalência e exceções visuais autorizadas

Quando o handoff contradiz essas respostas, aplicar a decisão aprovada e anotar a exceção na BOARDS.md:

- Release integral é permitida ao fim do QA; qualquer frase do handoff que proíba release é superada por 1C/25C.
- Rascunhos antigos permanecem; qualquer sugestão de limpeza automática é superada por 20C.
- E-mail real é opcional; qualquer board ou prompt que simule/obrigue envio é superado por 13C/14B.
- Compartilhamento de publicação privada é permitido com landing/OG genéricos para não autorizados; não compartilha acesso. Grupo privado não tem ação de link compartilhável.
- Nenhum aviso é colocado no portal/Início nesta V2, mesmo que o handoff descreva a cadeia Gestão → Comunidade → Início.
- Não criar regra prefers-reduced-motion; rotação visual pausa com aba oculta e tem cleanup.
- Fatos e dados do mockup não substituem registros reais. Avatares decorativos não são presença; horas não são fabricadas; fixtures não são evidência de produção.

## Contratos técnicos que preservam estas decisões

- Clerk é a identidade; Member.role é a autoridade. Páginas, ações, busca, contadores, assets, notificações, OG e API compartilham a mesma autorização server-side.
- Prisma/Supabase são a persistência canônica; usar somente migrations aditivas, uma por entrega vertical. Não remover entidades/índices existentes sem evidência e aprovação técnica registrada.
- Grupo arquivado mantém a associação das publicações; a autorização privada é revalidada a cada leitura.
- Token de convite/compartilhamento tem alta entropia gerada no servidor e armazenamento em hash. Logs/telemetria não carregam tokens, IDs pessoais, conteúdo ou URLs assinadas.
- Outbox é transacional, idempotente e versionado; nenhum side effect durável depende de promise solta.
- Teste, preview ou release não autoriza apagar dados do GREEN, resetar tabelas, alterar credenciais ou desabilitar TLS.

## Relação com roadmap e documentação anterior

- docs/implementation/roadmap.md é a sequência mestre. A fase 7 Comunidade permanece IN PROGRESS. Esta execução detalha somente essa fase; a meta coletiva não declara a fase 8 concluída, o wrapper de Encontros não declara a fase 9 concluída e o QA visual/performance não fecha a fase 10 sem os gates próprios.
- docs/product/community-and-profiles.md registra contratos anteriores à V2: rascunho nasce no começo da composição e pin era exclusivo de professor/admin. A decisão 20C substitui a criação antecipada. A decisão 18A define unicidade de pin por escopo, sem conceder por si só novo papel. Até evidência explícita de board/regra aprovada, preservar a autorização atual para pin e não elevar moderador implicitamente.
- O roadmap descreve uma integração histórica de bookmarks da Comunidade em /salvos global; a implementação atual de apps/app/(authenticated)/salvos/page.tsx só carrega biblioteca pessoal e favoritas de exercícios. A entrega 02 restaura a integração conforme o board 19, sem criar outro armazenamento.
- A matriz de boards e os critérios do HANDOFF são referência visual/funcional, não fonte para reabrir decisões fechadas.

## Questões técnicas a validar durante a execução

Estas não reabrem decisões de produto; são verificações que condicionam migrations e contratos:

1. Confirmar idempotência de criação e a unicidade atual de título normalizado por proprietário. A auditoria não autoriza remover a restrição existente para facilitar repetição de nome.
2. Confirmar ordem/compatibilidade de consumidores versionados do outbox no worker compartilhado.
3. Provar o caminho seguro de notificações privadas depois de revogar vínculo antes de restringir a policy REST atual.
4. Medir locks e plano das restrições parciais de pin e convite antes da migration.
5. Confirmar limites de tamanho/tipo e referências de coverUrl para grupo sem apagar objetos antigos.
6. Definir fronteira de janela/timezone da campanha usando BRT explicitamente e testar sessões sobrepostas/fonte manual.
7. Comprovar proteção Vercel e login Clerk separadamente no Preview da branch.

## Preparação operacional da Etapa 01 — 15/10/2026

- O usuário delegou a escolha das contas para QA. Foram criadas quatro identidades explícitas somente no Clerk Development; não há autoridade de staff em metadata Clerk.
- Atribuições autorizadas e persistidas exclusivamente em novos Members de QA: community-v2-qa-20261015-member-a → MEMBER; member-b → MEMBER; teacher → TEACHER; admin → ADMIN. Profiles ficam fora do diretório público. Não elevar, trocar identidade ou atualizar papel de conta real.
- Após a rejeição inicial da revisão automática, o usuário respondeu explicitamente Autorizar essas inserções QA no GREEN. Foram inseridos quatro Members, quatro Profiles ocultos e um DomainEvent, em transação serializável; os hashes dos sete Members e sete Profiles anteriores conferiram antes/depois. Nenhum job/notificação foi criado, nenhum papel existente foi alterado e Clerk Production permaneceu intacto. Isso não altera as 25 decisões de produto.
- A fila usa consumerKey com prefixo preview no Preview e mantém as chaves Production. A reversão exige freeze e preservação dos jobs namespaced; não reenfileirar em chave legada.
- Namespace não isola as linhas de Notification. O produtor e o consumidor agora recusam ator/destinatários fora de OUTBOX_PREVIEW_MEMBER_IDS no Preview; a lista tem somente as quatro identidades QA autorizadas e existe apenas nos overrides da branch. A entrega/recuperação no Preview ainda precisa ser comprovada.
