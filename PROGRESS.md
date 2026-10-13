# PROGRESS · Gestão do Interprete

> Diário de execução. **Atualize a cada unidade concluída**, com evidência. Releia ao começar e depois de qualquer compactação de contexto. Estado confiável = este arquivo + o Git.

## Estado geral

> Auditoria atual e passagem para outro chat: `docs/gestao/STATUS.md` e
> `docs/gestao/HANDOFF-PROXIMO-CHAT.md`. Registro compacto por unidade:
> `docs/gestao/EXECUTION-LOG.md`. O restante deste arquivo preserva o histórico;
> checkpoints antigos não substituem o resumo atual.
- Branch: `gestao-v2`
- Fase atual: Fase 1 — Shell, autorização, rotas e entrada, retomada para fechar o aceite antes da Fase 2. Fixtures persistentes e trabalho parcial de Turmas/resolvers/Ensino são preservados. Nenhuma dessas fases recebeu aceite completo.
- Calendário unificado, recorrência, cópia e assinatura consolidados em `5581041`; a unidade seguinte consolida a entrada para atribuição de alunos sem turma.
- Orçamento/contexto: (preencher se relevante)

## Fases
| Fase | Estado | Evidência (testes, commit) | Verificação independente |
|---|---|---|---|
| 0 Auditoria | concluída | `docs/gestao-auditoria.md`; 101 pares HTML/PNG inventariados e revistos em pranchas; matriz 1:1 gerada; commit `ffbb93e`; nenhum código/migration alterado | releitura dos critérios e conferência solo; sem subagente por instrução direta para trabalhar sozinho |
| 1 Shell, permissões, rotas, transição | IN PROGRESS — aceite visual/runtime pendente | Shell responsivo desktop/trilho/gaveta; flag `GESTAO_V2_ENABLED` false por padrão; mapa de ações por papel e retorno interno seguro; 20 testes focados e gates locais registrados no commit `1d04e5a`. A rota local de turmas abriu com professor de QA sem Clerk, usando as duas flags de desenvolvimento (`20261012`, registro abaixo). | Navegação de leitura confirmada para um professor local; comparações visuais, matriz dos outros papéis e jornadas autenticadas completas pendentes |
| 2 Turmas e resolvers | IN PROGRESS | Fixtures funcional/visual persistentes em QA local com TLS; migration aditiva de agenda aplicada no banco funcional. Gestão e calendário do aluno projetam eventos, encontros, prazos e liberações, com recorrência/exceções; feed .ics revogável e cópia de agenda implementados. Atribuição de aluno sem turma e revogação .ics passaram por QA de persistência. Camadas e grade foram conferidas em 320/390/1440 px. Evidências e limitações no checkpoint de agenda persistente abaixo. | Revisão solo, ciclos autenticados locais e capturas salvas; matriz completa de papéis, menu de criação por tipo, seis larguras e fidelidade dos quadros ainda pendentes |
| 3 Ensino (YouTube, atividades, exercícios, biblioteca, coleções) | IN PROGRESS — editor de aula/YouTube e medição de playback parcialmente implementados; importação de playlist implementada em código; upload e aceite visual/runtime pendentes; percursos parcialmente implementados (quadro 52 validado em QA local, comparação visual pendente) | Cursos (`343d5ad`) e exercícios (`fdac802`) seguem com os checkpoints anteriores. Atividades (`9cfa4a6`) e correções (`111e554`) mantêm catálogo SQL, alvos de turma, rubricas versionadas e fila/feedback. Biblioteca (`2e823ec`): catálogo SQL paginado de 24, filtros, lista/grade, seleção e ações em lote até 100, editor com validação por campo, idempotência, estado inicial de rascunho e upload privado de arquivo existente. Coleções (`8fce0f9`): catálogo SQL com filtros e 24 por página, editor/ordenação/recursos/capas, prévia sem escrita de progresso, idempotência e controle otimista de versão; reutiliza `ContentCollection`/`ContentCollectionItem` e Storage existente, sem migration. Editor de aula/YouTube (`d72c391`): tela de edição, verificação por API/adaptador de desenvolvimento, metadados aditivos e publicação revalidada no servidor. `check` (825 arquivos), `typecheck` (16 tarefas), `boundaries` (772 arquivos), suíte completa (507 testes app, 17 domínio e 9 API; 27 scripts passaram e 1 harness aposentado ignorado), `build` (8 tarefas), `performance:check` e `git diff --check` passaram. Editor medido em 218,1 KiB gzip / 17 chunks, sob 225 KiB. Y7 adiciona amostras de playback por sessão, intervalos unidos sem duplicidade entre abas, rejeição/recorte de saltos e conclusão automática com 90% de cobertura; a migration `20261012143000_playback_watch_intervals` está aplicada no PostgreSQL local de QA, ainda sem prova de playback autenticado. QA local também confirmou a persistência do vínculo curso-percurso; Clerk real, outros fluxos e comparação visual seguem pendentes | Revisão solo; PostgreSQL de QA atualizado, mas jornadas autenticadas e aceite visual continuam abertos |
| 4 Envios, cronograma, calendário, Aprender, Personalização | IN PROGRESS — feed de atividades e liberação de aulas dinâmicas no Aprender/Planejamento/`.ics` | `de28514` integra atividades; `e421563` integra os prazos; `9498351` integra liberações de aula com regra de acesso por turma. Bundles `learning` 208,6 KiB/16 chunks e `planner` 223,0 KiB/17 chunks. Destaques, envios configuráveis, paginação/estado completo, encontros/eventos de turma, cronograma e personalização continuam sem aceite | Revisão solo do código e testes; jornadas autenticadas e comparação visual ainda não comprovadas no PostgreSQL QA |
| 5 Alunos e correções | IN PROGRESS — fila e feedback parciais; acompanhamento, perfil e aceite pendentes | Fila paginada com escopo por papel/turma, rubrica ponderada 0–10, rascunho separado do feedback enviado, controle de versão da entrega e outbox de notificação na transação; código `111e554`. 473 testes do app, gates estáticos e build completo (8 tarefas) passaram | Migration aplicada no PostgreSQL QA; falta validar persistência em jornada autenticada, isolamento entre professores e comparação visual |
| 6 Comunidade | pendente | | |
| 7 Administração e medalhas | pendente | | |
| 8 Notificações, busca, prévia, interrupções | pendente | | |
| 9 Responsivo, acessibilidade, QA final | pendente | | |

## Quadros (marque só com os 8 itens de GOAL.md §4 cumpridos)
Legenda: `[ ]` pendente · `[~]` em andamento · `[x]` concluído com evidência · `[!]` bloqueado/NÃO VERIFICADO (explicar)

### Diagnóstico, regras e arquitetura
- [ ] `GDiagnostico` — Diagnóstico — o que está errado hoje (12 achados)
- [ ] `GProposta` — Crítica da proposta recebida (mantive, mudei, faltava)
- [ ] `GMapa` — De 16 abas para 5 áreas (onde cada função vai)
- [ ] `GPermissoes` — Permissões e estados de acesso
- [ ] `GRegrasTurma` — Turmas, grupos de estudo, acessos e atribuições: as regras
- [ ] `GGestaoNoAluno` — O que cada ação da Gestão faz na tela do aluno
- [ ] `GFluxos` — Fluxos de referência (A a E)
- [ ] `GRotas` — Rotas da Gestão e redirecionamentos
- [ ] `GPadroes` — Padrões de formulário: hoje e proposta
- [ ] `GEstados` — Estados, confirmações e salvamento
- [ ] `GCobertura` — Cobertura de telas, estados e dispositivos
- [ ] `GBreakpoints` — Pontos de quebra: como a Gestão se adapta

### Como se chega à Gestão e as transições
- [~] `GChegada` — Origem por aba/usuário após navegação e reload; entradas contextuais e matriz de papéis pendentes
- [~] `GEntrada` — Item condicionado ao papel; quatro atores locais e login com destino testados; comparação integral e Clerk real pendentes
- [~] `GTransicao` — Snapshots/fallback, foco e anúncio; timings locais, fidelidade integral e stagger pendentes
- [~] `GTransicaoEstados` — Espera limitada, offline/retry sem apagar a página anterior; estados de permissão/sessão/edição pendentes
- [~] `GTransicaoMobile` — Entrada/retorno e aviso contextual; fidelidade integral pendente
- [ ] `GAulaAluno` — Atalho “Editar na Gestão” na página que o aluno também vê
- [ ] `GVerComoAluno` — Ver como aluno (prévia com a barra de contexto)
- [ ] `GBoasVindas` — Primeiro acesso à Gestão (boas-vindas)
- [ ] `GInteracoes` — Respostas às interações e estados dos componentes
- [ ] `GInterrupcoes` — Interrupções: salvar, sessão, conflito, permissão e rede

### Shell e visão geral
- [ ] `Main` — Visão geral — professor
- [ ] `GVisaoAdmin` — Visão geral — administrador
- [ ] `GVisaoLimpa` — Visão geral — sem pendências
- [ ] `GCriar` — Menu Criar (qualquer tela)
- [~] `GRestrito` — Negação HTTP 403 sem payload, retorno e ajuda reais; 36 capturas; comparação integral do shell pendente
- [ ] `GNotificacoes` — Notificações da Gestão
- [ ] `GBusca` — Busca da Gestão (alunos, turmas, conteúdo)
- [~] `GRail` — Notebook pequeno (1024 px): trilho de 72 px, submenu por hover/toque/teclado; comparação feita, fidelidade integral e papéis pendentes

### O que o aluno vê (resultado das ações)
- [~] `GAprenderAluno` — O que o aluno vê em Aprender (atividades diretas e de turma deduplicadas; destaques, estados completos e comparação pendentes)
- [ ] `GAprenderPadrao` — Aprender sem pendências nem destaques (experiência padrão) e turma nova
- [ ] `GMAprender` — Mobile — Aprender do aluno
- [ ] `GMedalhasAluno` — O museu de medalhas que o aluno vê (conquistadas e bloqueadas)

### Turmas
- [~] `GTurmas` — Alunos — turmas
- [~] `GTurma` — Turma — visão geral
- [~] `GTurmaAlunos` — Turma — alunos (adicionar, mover e remover)
- [~] `GTurmaAdd` — Turma — adicionar alunos (buscar, importar ou convidar)
- [~] `GTurmaRemover` — Turma — remover ou mover aluno (consequências claras)
- [~] `GTurmaCronograma` — Turma — conteúdo e cronograma (liberação por data)
- [~] `GTurmaCalendario` — Turma — encontros e calendário (o que os alunos veem; “Hoje” e aviso de datas compartilhadas entre eventos publicados implementados; reuniões, prazos, liberações, recorrência, `.ics`, cópia entre turmas e comparações desktop/tablet/mobile ainda pendentes)
- [ ] `GTurmaAtividades` — Turma — atividades da turma
- [ ] `GTurmaAvisos` — Turma — avisos da turma
- [~] `GTurmaNova` — Turmas — nova turma (passo 3: pessoas e regra de entrada)
- [~] `GTurmaConfig` — Turma — configurações (regra de entrada, duplicar, arquivar)

### Ensino
- [~] `GCursos` — Ensino — cursos e percursos (catálogo e filtros implementados; comparação visual e fluxo autenticado pendentes)
- [~] `GCurso` — Ensino — curso: conteúdo, módulos e aulas (rota reaproveita o editor existente; fidelidade visual e aceite dos fluxos pendentes)
- [ ] `GCursoTurmas` — Ensino — curso: turmas e acesso
- [~] `GAula` — Ensino — editor de aula (formulário, materiais, metadados e publicação protegida; upload, runtime e comparação pendentes)
- [~] `GAulaYT` — Vídeo do YouTube — estados da verificação (API/adaptador e prévia implementados; chave real e comparação pendentes)
- [~] `GYTImport` — Vídeo do YouTube — importar uma lista de reprodução como aulas (prévia paginada, seleção e importação transacional implementadas; chave real, persistência autenticada e comparação do quadro 51 pendentes)
- [~] `GPercursos` — Ensino — percursos (editor, lista de cursos, associação add/remove com confirmação e controle de versão; ciclo persistente em QA local; comparação visual pendente)
- [~] `GExercicios` — Ensino — exercícios: bancos e listas (catálogo, filtros e paginação implementados; aceite visual/runtime pendente)
- [~] `GLista` — Ensino — lista: questões (reutilizar, reordenar) (filtros, paginação, reuso e swap transacional implementados; comparação e persistência autenticada pendentes)
- [~] `GQuestao` — Ensino — editor de questão (versões e referências) (edição cria versão nova e mantém snapshots; fidelidade visual e jornada persistida pendentes)
- [~] `GAtividades` — Ensino — atividades (catálogo e filtros implementados; runtime e aceite visual pendentes)
- [~] `GAtividade` — Ensino — editor de atividade (critérios versionados, prazo, destinatários de turma/individuais, publicação e prévia; fluxo de entregas/revisão implementado, QA e fidelidade pendentes)
- [~] `GAtividadeEntregas` — Ensino — atividade: entregas por turma (fila paginada e escopada; runtime autenticado e comparação pendentes)
- [~] `GBiblioteca` — Ensino — biblioteca (filtros SQL, 24 por página, seleção e ações em lote; QA visual/persistente pendente)
- [~] `GBibliotecaGrade` — Ensino — biblioteca em grade (grade responsiva e alternância de visualização codificadas; comparação pendente)
- [~] `GMaterial` — Ensino — novo material (rascunho, metadados, URLs HTTPS e arquivos até 20 MB; upload de capa e QA pendentes)
- [~] `GColecoes` — Ensino — coleções (catálogo, filtros, publicação e ações; QA persistente/visual pendente)
- [~] `GColecao` — Ensino — editor de coleção (recursos, ordenação acessível, capa e prévia; QA persistente/visual pendente)

### Alunos
- [ ] `GAcompanhamento` — Alunos — acompanhamento
- [ ] `GAluno` — Alunos — perfil pedagógico
- [~] `GCorrecoes` — Alunos — correções (fila paginada, rubrica, rascunho, envio explícito e notificação; QA e comparação pendentes)
- [ ] `GAtribuicoes` — Alunos — atribuições
- [ ] `GEnviar` — Alunos — enviar ao aluno (destaque, pendência ou aviso, com prévia)
- [ ] `GDestaques` — Alunos — destaques de Aprender (ordem, período e turma)
- [ ] `GNovaAtribuicao` — Alunos — nova atribuição (4 passos, seletor de pessoas)
- [ ] `GTarefas` — Alunos — tarefas e metas coletivas
- [ ] `GReconhecimento` — Alunos — reconhecimento (medalhas conquistadas)

### Comunidade
- [ ] `GPublicacoes` — Comunidade — publicações (moderação sem rascunhos privados)
- [ ] `GDenuncias` — Comunidade — publicações denunciadas
- [ ] `GGrupos` — Comunidade — grupos (endereço automático, imagem por upload)
- [ ] `GAvisos` — Comunidade — avisos
- [ ] `GAviso` — Comunidade — novo aviso (seletor de público, sem IDs digitados)
- [ ] `GEncontros` — Comunidade — encontros (agenda editorial)
- [ ] `GEncontro` — Comunidade — editor de encontro (fuso, repetição e relacionados por seletor)

### Administração
- [ ] `GMembros` — Administração — membros e papéis
- [ ] `GMembro` — Administração — membro (papel, capacidades e histórico)
- [ ] `GPapel` — Administração — confirmar mudança de papel
- [ ] `GAcessos` — Administração — acessos (origem de cada acesso)
- [ ] `GConceder` — Administração — conceder acesso (seletor de conteúdo em árvore)
- [ ] `GGravacoes` — Administração — gravações históricas (um grupo por vez)
- [ ] `GPersonalizacao` — Administração — personalização (arrastar, prévia e publicar uma vez)
- [ ] `GMedalhas` — Administração — medalhas: o museu (foco no símbolo)
- [ ] `GMedalha` — Administração — medalha: palco, símbolo e critério
- [ ] `GIntegracoes` — Administração — integrações (YouTube e origem das gravações)
- [ ] `GAuditoria` — Administração — registro de atividades (quem fez o quê)

### Tablet
- [ ] `GTVisao` — Tablet — visão geral
- [~] `GTCorrecoes` — Tablet — correções (fila e correção lado a lado; composição responsiva codificada, comparação pendente)

### Mobile
- [~] `GMMenu` — Mobile — gaveta modal, contenção/Escape/retorno de foco; comparação feita, fidelidade integral e papéis pendentes
- [ ] `GMVisao` — Mobile — visão geral
- [ ] `GMCursos` — Mobile — cursos (cartões, filtros e novo curso)
- [~] `GMCorrecoes` — Mobile — correções (fila; validação em dispositivo pendente)
- [~] `GMCorrecao` — Mobile — correção (barra de ação fixa; validação em dispositivo pendente)
- [ ] `GMAviso` — Mobile — novo aviso (formulário com barra fixa)
- [ ] `GMMembros` — Mobile — membros (cartões e folha de ações)
- [ ] `GMTurmas` — Mobile — turmas
- [ ] `GMTurmaAlunos` — Mobile — alunos da turma (ações em folha)

## Não verificado / dependências externas
| Item | Motivo | O que falta |
|---|---|---|
| Runtime local e migration da Fase 2 | PostgreSQL local de QA disponível em loopback com TLS validado; `prisma migrate status` reportou 61 migrations em dia. Nenhum banco remoto foi usado. | Percorrer jornadas autenticadas com papéis de QA, validar persistência/autorização em duas sessões e comparar as referências visuais. |
| Clerk real | A sessão local usa o adaptador de teste existente com um `Member` semeado; Clerk não foi chamado. | Clerk real continua sem verificação. Para o QA local, ativar juntas `GESTAO_DEV_AUTH` e `NEXT_PUBLIC_GESTAO_DEV_AUTH`, em `NODE_ENV=development`, com ID de membro existente e host loopback. |
| Visual e jornadas autenticadas | A tela de turmas abriu e recarregou com o adaptador local; não havia dados de turma e nenhuma captura foi salva como evidência de comparação. | Criar seeds funcional/visual, capturar e comparar quadros, e percorrer CRUD e a matriz de papéis. |
| Integrações externas da Fase 3 | Nenhuma chave real do YouTube nem Storage local configurados; não criei credenciais fictícias. | Configurar serviços de QA para validar estados reais do YouTube, uploads e playback quando esses módulos forem implementados. |
| Editor de aula/YouTube | A migration `20261012130000_lesson_youtube_metadata` está aplicada em QA local; chave real do YouTube, capacidade/storage de QA e comparação do quadro 49 continuam sem verificação. | Provar salvamento após recarga, autorização, publicação com respostas reais, upload privado e progresso assistido; comparar o quadro desktop e os tamanhos responsivos. |
| Playback Y7 | A migration aditiva `20261012143000_playback_watch_intervals` está aplicada no PostgreSQL de QA; não há prova autenticada com vídeo de teste. | Provar persistência de intervalos, seek e pausa, retomada, duas abas concorrentes, conclusão aos 90%, assignment/badge e regressões de gravações. |
| Atividades da Fase 3 | A migration `20261012100000_activity_cohort_targets_rubrics` está aplicada no PostgreSQL de QA; as jornadas autenticadas e visuais ainda não foram percorridas. | Testar submissões, progresso, concorrência e notificações com contas de QA; comparar os quadros `GAtividades`/`GAtividade`. |
| Revisão de atividades / Fase 5 | A migration `20261012120000_activity_review_drafts` está aplicada no PostgreSQL de QA; não há prova de persistência via jornada autenticada. | Validar criação/edição concorrente de rascunhos, envio de rubrica, isolamento professor/turma, outbox e feedback no aluno; comparar os quadros desktop/tablet/mobile. |
| Biblioteca / Fase 3 | O PostgreSQL de QA está disponível; Storage/capacidade de arquivo, jornada autenticada e comparação dos PNGs 59–61 ainda não foram validados. | Percorrer CRUD, filtros, ações em lote, publicação e upload privado com papéis de QA; comparar quadros em cada dimensão; validar upload de capa da Biblioteca. |
| Coleções / Fase 3 | PostgreSQL de QA disponível; o Storage e os quadros 62–63 ainda não foram validados visualmente. Nenhuma escrita foi feita em Supabase remoto. | Validar CRUD, recursos, publicação, capas e autorização com contas de QA; confirmar persistência após recarga/segunda sessão e comparar desktop/mobile nos quadros 62–63. |
| Importação de playlist / Fase 3 | PostgreSQL de QA disponível, mas sem chave real do YouTube ou comparação autenticada do quadro 51. O código não adiciona migration. | Testar listas paginadas, vídeos privados/não encontrados/não incorporáveis, importação de rascunho/publicada, replay da chave, notificação após commit e autorização; comparar desktop/mobile do quadro 51. |
| Feed de atividades no Aprender | A migration `20261012100000_activity_cohort_targets_rubrics` está aplicada no PostgreSQL QA; nenhum login de QA ou PNG foi validado para esta jornada. | Percorrer T2/T3/T7/E2 com duas contas e reload; verificar acesso direto/negação no servidor e comparar `GAprenderAluno`/`GMAprender` nas seis larguras. |

## Controles removidos por não terem função
Nenhum removido nesta unidade. A varredura integral de controles fica pendente para o aceite final.

## Notas e problemas abertos
- Fase 1 permanece `IN PROGRESS` até QA autenticado e comparação visual; nenhuma referência foi marcada como concluída.
- As migrations de Gestão registradas no diário foram aplicadas somente no PostgreSQL de QA local; não há evidência de escrita persistente de CRUD das turmas nesta unidade e nenhum banco remoto foi acessado.
- `resolveStudentFeed` cobre somente atividades diretas e alvos dinâmicos; `resolveCalendar` projeta no Planejamento e `.ics` os prazos dessas atividades e as liberações de aulas por turma. O calendário completo ainda precisa incluir reuniões autorizadas por turma, `CohortEvent` e outros envios/prazos; atividades e liberações têm limite de até 200 resultados sem paginação/continuação. Destaques/envios completos, prévia compartilhada e conclusão integrada aos demais itens também seguem pendentes.
- A unidade de cursos entrega o catálogo e entrada para criação/edição. A unidade de exercícios acrescenta catálogo, bancos/listas, editor de questão, reutilização versionada e reordenação; não substitui ainda o aceite visual, autenticação em runtime ou persistência em QA.
- Atividades (`9cfa4a6`): catálogo SQL paginado, editor com rubrica versionada, prazo, turmas/indivíduos e prévia sem escrita de progresso; alvos de turma mantêm acesso dinâmico com revogação por origem. `check` (777 arquivos), `typecheck` (16 tarefas), `boundaries` (724 arquivos), `test` (466 app, 17 domínio, 9 API; scripts 27 passaram e 1 harness aposentado foi ignorado), `build` (8 tarefas e novas rotas), `performance:check`, `prisma validate` e `git diff --check` passaram. A rota mede 212,3 KiB gzip em 17 chunks / limite 225 KiB. Ainda faltam migration aplicada em PostgreSQL QA, prova persistente/autenticada, comparação PNG, fila de entregas/correções, criação de progresso sob demanda e avisos a membros que entrarem depois em `ALL_ACTIVE`.
- Correções (`111e554`): entregas por atividade com fila paginada, projeção mínima e escopo renovado no servidor; respostas com rubrica ponderada, rascunho independente, versão otimista e envio explícito. Entrega preserva a rubrica usada; comentário e todas as notas são obrigatórios no envio; média ponderada é informativa. Migration `20261012120000_activity_review_drafts` somente versionada; persistência real e notificações ainda precisam de QA local.
- Biblioteca (`2e823ec`): usa `LibraryItem` e ações/Storage existentes, sem migration. O catálogo filtra no banco e seleciona 24 por página; a edição valida por campo, mantém o vínculo de arquivo privado em alterações de metadados, e novos itens começam como rascunho. Ações em lote limitam 100 itens e inclusão em coleção usa transação serializável. Medição da rota: 214,2 KiB gzip / 17 chunks. O editor aceita link HTTP(S), capa por URL HTTPS e arquivos PDF/JPG/PNG/WebP/texto até 20 MB. Não há prova de persistência autenticada, disponibilidade do Storage, comparação visual ou upload de capa da Biblioteca.
- Coleções (unidade implementada nesta tranche): reutiliza `ContentCollection`, `ContentCollectionItem`, autorização `content.manage` e Storage privado existente. Catálogo usa filtros SQL e 24 itens por página; editor busca recursos em páginas limitadas, oferece ordenação por botões acessíveis e cobre CRUD, rascunho/publicação/agendamento/arquivamento, capa e prévia sem efeitos colaterais no aluno. Escritas usam versão/idempotência, transação e auditoria; conflitos de adição/remoção abortam a transação. Capas privadas só são lidas pelo proprietário enquanto rascunho ou por membros autorizados quando referenciadas em coleção publicada e dentro da vigência. Não houve migration. `check` (810 arquivos), `typecheck` (16 tarefas), `boundaries` (757 arquivos), `test` (490 app, 17 domínio, 9 API; scripts 27 passaram e 1 harness aposentado ignorado), `build` (8 tarefas), `performance:check` e `git diff --check` passaram. As rotas catalog/editor/prévia mediram 213,9/218,5/211,9 KiB gzip (17/17/16 chunks), sob 225 KiB. A validação de build usou apenas `SKIP_ENV_VALIDATION=true` e URL local; não abriu conexão nem gravou no banco. Persistência/autorização autenticada, teste visual dos quadros 62–63, concorrência no PostgreSQL QA e upload real permanecem sem prova.
- Editor de aula/YouTube (quadro 49, commit `d72c391`, unidade em andamento): adiciona rota `content.manage`, editor versionado de metadados/conteúdo, vínculo de materiais, verificação de URL pelo YouTube Data API v3 com adaptador determinístico somente em desenvolvimento, prévia com o player existente sem progresso e metadados em colunas aditivas. Publicação revalida no servidor e aceita apenas vídeos públicos ou não listados que permitam incorporação; status/asset são atualizados com versão otimista, chave de idempotência e transação. A ação de publicação legada também revalida YouTube para impedir bypass por chamada direta. Testes focados: 12 passaram; suíte: 502 testes app, 17 domínio, 9 API e 27 scripts (1 harness aposentado ignorado); `check` 822 arquivos, `typecheck` 16 tarefas, `boundaries` 769 arquivos e `prisma validate` passaram. `build` (8 tarefas) passou com `SKIP_ENV_VALIDATION=true` e URL local, sem conexão ou escrita no banco; `performance:check` mediu 218,1 KiB gzip/17 chunks frente ao limite de 225 KiB. Migration `20261012130000_lesson_youtube_metadata` está versionada e não aplicada. Sem PostgreSQL, Storage ou chave YouTube de QA, persistência, upload até 500 MB, playback real/Y7, integração real, jornadas autenticadas e comparação visual seguem sem evidência.
- O catálogo de exercícios mantém a projeção inicial limitada (18 bancos, até 20 listas por banco, 200 bancos no seletor de nova lista e 100 categorias/questões reutilizáveis). A navegação completa em acervos maiores e os percursos de paginação desses seletores precisam ser ampliados antes do aceite integral.
- As referências `GCursos` e `GCurso` seguem `[~]`: o checklist de oito critérios exige jornada autenticada, captura comparada e teste de fluxo persistido, ainda indisponíveis.
- Playback/Y7 (`6922855`): players de vídeo armazenam checkpoints por aba com horário do servidor, descartam saltos e reinício após busca, unem trechos assistidos sem duplicidade e concluem aula/atribuição somente com ≥90% da janela. O antigo `completed` do navegador não é usado. A conclusão reaproveita o domínio existente de aulas, módulos, cursos, medalhas e atribuições; `PlaybackProgress` recebeu JSONB aditivo para intervalos/sessões. `check` (825 arquivos), `typecheck` (16 tarefas), `boundaries` (772 arquivos), suíte (507 app, 17 domínio, 9 API; scripts 27 passaram e 1 harness aposentado ignorado), `build` (8 tarefas), `performance:check` e `git diff --check` passaram. A rota `learning` mediu 208,6 KiB gzip/16 chunks, abaixo do limite de 225 KiB. Build e geração Prisma usaram configuração local sem conexão/escrita em banco. Migration não aplicada; sem QA de persistência autenticada, playback real, concorrência no banco, clip, dispositivos ou comparação dos quadros 31–34/49.
- Importação de playlist (quadro 51, `724c394`): prévia paginada, tokens HMAC vinculados ao ator por 15 minutos, revalidação fresca da API e criação transacional de até 200 aulas por operação; auditoria e notificações de publicação entram no outbox do mesmo commit; a chave só reproduz a mesma intenção. Quatro arquivos focados passaram com 23 testes. `check` (831 arquivos), `typecheck` (16 tarefas), `boundaries` (778 arquivos), `test` completo (518 app, 17 domínio, 9 API; 27 scripts passaram e 1 harness aposentado ignorado), `build` (8 tarefas) e `performance:check` passaram. Após o último ajuste de seleção, `apps/app build` e os gates estáticos passaram; a rota do editor mede 216,5 KiB gzip / 17 chunks, sob 225 KiB. O banco de QA, chave YouTube, teste autenticado de persistência e comparação visual/responsiva continuam indisponíveis; nenhuma migration ou escrita remota foi feita.
- Sem alteração de Production, de Supabase remoto ou de notificações externas.

## Checkpoint de implementação · feed dinâmico de atividades (12/10/2026)

O commit `de28514` adiciona `resolveStudentFeed` para atividades publicadas que chegam por atribuição individual ou `ActivityCohortTarget`. A consulta restringe-se a memberships ativos no instante pedido, aplica a regra `FROM_JOIN` no banco e confirma datas/estado no domínio; itens com múltiplas origens aparecem uma vez, com o menor prazo e o recado individual mais recente. O Aprender combina esses itens aos demais materiais enviados sem duplicar atividades e sem criar progresso ao carregar a página. Submissões existentes definem o estado concluído.

Verificação local: 6 testes focados; `check` (847 arquivos), `typecheck` (16 tarefas), `boundaries` (794 arquivos), `test` (536 app, 17 domínio, 9 API; 27 scripts aprovados e 1 harness aposentado ignorado), `build` (8 tarefas), `performance:check` e `git diff --check` passaram. A rota `learning` mediu 208,6 KiB gzip em 16 chunks, abaixo de 225 KiB.

No checkpoint do commit `de28514`, o resolver cobria atividades, não destaques, cursos/liberações ou todos os tipos de entrega, e ainda não alimentava prévia ou calendário. A migration `20261012100000_activity_cohort_targets_rubrics` continua não aplicada. Não houve conexão com banco, teste autenticado, mudança remota/deploy nem comparação de PNG; a fase e os quadros continuam em andamento.

## Checkpoint de implementação · prazos de atividades no calendário (12/10/2026)

O commit `e421563` adiciona `resolveCalendar`, que reaproveita o feed autorizado no servidor e seleciona atividades com prazo dentro do intervalo pedido. A consulta empurra o intervalo para as buscas de atribuições e alvos de turma; itens ainda agendados ficam ocultos até `availableAt`. O Planejamento usa essa projeção e o `.ics` já consome o mesmo resultado. O feed `.ics` passou a responder `private, no-store`, para que revogar o token ou retirar um vínculo não dependa de cache privado de cinco minutos.

Verificação: 12 testes focados; suíte app completa em 541 testes; gates monorepo `check` (849 arquivos), `typecheck` (16 tarefas), `boundaries` (796 arquivos), testes (540 app/17 domínio/9 API; scripts 27 aprovados e 1 harness aposentado ignorado), `build` (8 tarefas), `performance:check` e `git diff --check`. A rota `planner` mediu 222,9 KiB gzip/17 chunks frente ao limite de 225 KiB.

Este é apenas o primeiro grupo de fontes: liberações de aulas, encontros e eventos atribuídos à turma ainda não aparecem como camada própria; consultas estão limitadas a 200 atividades e não exibem continuação. Não houve banco ou sessão autenticada, validação de revogação em runtime, medição de latência, deployment nem comparação visual. Nenhuma migration foi criada ou aplicada nesta unidade; fase 2 e quadros permanecem abertos.

## Checkpoint de implementação · liberações de aulas no calendário (12/10/2026)

Esta unidade estende `resolveCalendar` sem criar outro modelo: primeiro consulta as matrículas ativas do membro e depois busca, no banco, somente liberações publicadas pertencentes às turmas encontradas e ao intervalo solicitado. A projeção valida a vigência da matrícula, a janela de leitura da turma, a política `ALL_ACTIVE`/`FROM_JOIN`, a liberação do curso no momento da aula e a revogação atual; aulas liberadas por mais de uma turma aparecem uma vez na primeira data válida. O Planejamento ganhou a camada opcional “Aulas liberadas”, e a mesma projeção alimenta o `.ics` privado. Cada consulta de liberações ainda limita o resultado a 200 sem cursor; o calendário não inclui reuniões de turma nem `CohortEvent`.

Verificação desta unidade: 15 testes focados em quatro arquivos passaram; `check` (851 arquivos), `typecheck` (16 tarefas), `boundaries` (798 arquivos), `test` (547 app, 17 domínio, 9 API; 27 scripts passaram e 1 harness aposentado foi ignorado), `build` (8 tarefas), `performance:check` e `git diff --check` passaram. O build mediu `planner` em 223,0 KiB gzip / 17 chunks, abaixo do teto de 225 KiB. A consulta de liberações começa pelas matrículas do membro, evitando varrer e truncar as primeiras 200 liberações globais antes de aplicar autorização.

Não houve conexão com banco, aplicação de migration, usuário autenticado de QA, comparação de PNG, medição de latência ou deployment. O runtime ainda precisa provar membership/revogação no PostgreSQL local; a consulta mantém o limite de 200 e não oferece continuação. Nenhum controle visual novo teve comparação quadro a quadro. Fase 2 e todos os quadros seguem abertos.


## Atualização de execução — 12/10/2026 — quadro 52 (continua IN PROGRESS)

O editor de percurso em `/gestao/ensino/cursos/percursos/[pathId]` agora permite incluir cursos por seletor SQL paginado de 8 opções e remover com confirmação explícita quando o percurso está publicado; os botões exibem estado pendente até o commit. Reutiliza `LearningPath` e `Course.position`; as ações verificam papel/escopo, versão e idempotência e registram auditoria/outbox na transação. Nenhuma migration foi criada.

No PostgreSQL local de QA, com TLS validado, migrations e fixtures explicitamente locais, a sessão local de professor concluiu incluir → recarregar → confirmar remoção → recarregar; o curso original continuou vinculado e o candidato voltou a ficar desvinculado. O teste usa `GESTAO_DEV_AUTH` restrito a `NODE_ENV=development` e hosts de loopback, requer um `Member` existente e não representa Clerk real. A busca nos JS gerados não encontrou o ID do fixture nem símbolos do helper executável; o guard de produção permanece fail-closed. Nenhum banco remoto, Production ou deploy foi alterado.

Os gates passaram neste estado: `bun run check` (885 arquivos), `typecheck` (16 tarefas), `boundaries` (832 arquivos), `test` (584 app, 17 domínio, 9 API; 27 scripts passaram e 1 harness aposentado foi ignorado), `build` (8 tarefas), `performance:check` e `git diff --check`. O editor de percurso mede 215,5 KiB gzip/17 chunks, abaixo de 225 KiB. Teste de overflow não encontrou rolagem horizontal nos seis tamanhos desktop/tablet/mobile exercitados. O navegador não conseguiu capturar screenshot por timeout de `Page.captureScreenshot`; por isso não há sobreposição, diff de pixels nem aceite visual do quadro 52. Também permanecem pendentes Clerk real, latências percentis, concorrência com dados representativos e as demais jornadas da Fase 3. Nenhuma fase ou quadro foi marcado como concluído.

## Captura visual e gates atualizados — 12/10/2026

A captura do editor foi obtida no navegador após um timeout inicial. Em 320 px, o cabeçalho agora mostra “Ensino” sem a trilha comprimida e sem rolagem horizontal; o quadro 95 serviu apenas para conferir o padrão do cabeçalho mobile. Na comparação manual do quadro 52, ainda há diferenças no cabeçalho de ações e na coluna de detalhes; a referência também contém três cursos, enquanto o registro local de QA contém um. Nenhum dado foi inventado para reproduzir a imagem. Não foi produzido artefato de sobreposição ou diferença de pixels, então o aceite visual continua pendente.

Após o ajuste mobile passaram `bun run check` (885 arquivos), `typecheck` (16 tarefas), `boundaries` (832 arquivos), `test` (584 app, 17 domínio, 9 API; 27 scripts passaram e 1 harness aposentado foi ignorado), `build` (8 tarefas), `performance:check` e `git diff --check`. O editor de percurso permaneceu em 215,5 KiB gzip/17 chunks, abaixo do limite de 225 KiB. Clerk real, latências percentis, concorrência com dados representativos, comparação pixel a pixel e as demais jornadas continuam pendentes; fase 3 e quadro 52 seguem IN PROGRESS.

## Atualização de execução — 12/10/2026 — calendário de turma (permanece IN PROGRESS)

O calendário de Gestão ganhou um atalho “Hoje” que atualiza o mês e o foco da semana, além de avisos informativos quando eventos publicados da turma compartilham uma data. A leitura dos candidatos permanece protegida pela consulta existente com papel e escopo de turma; rascunhos e eventos arquivados não entram no aviso. O limite de leitura de conflitos é explícito: acima de 500 eventos publicados no intervalo, a interface informa que não conseguiu comparar o conjunto inteiro. Nenhuma ação de salvar/publicar é bloqueada.

O domínio passou a cobrir datas em São Paulo, eventos de vários dias, recorte ao intervalo visível e exclusão de rascunhos/arquivados. Foram adicionados 8 testes focados. `check` (885 arquivos), `typecheck` (16 tarefas), `boundaries` (832 arquivos), `test` (586 app, 17 domínio, 9 API; 27 scripts passaram e 1 harness aposentado foi ignorado), `build` (8 tarefas), `performance:check` e `git diff --check` passaram. O build foi executado com `SKIP_ENV_VALIDATION=true` e `NEXT_PUBLIC_APP_URL=http://localhost:3000` para validação local; isso não comprova configuração de produção, acesso ao banco ou execução autenticada. Calendário mediu 217,6 KiB gzip/17 chunks, abaixo do limite de 225 KiB.

Esta unidade cobre somente conflitos de data entre `CohortEvent` publicados. A tela ainda não projeta reuniões, prazos de atividades ou liberações de aula; não tem recorrência coletiva, `.ics` revogável ou cópia de agenda entre turmas. Nenhum quadro foi concluído. O quadro 41 continua `[~]`; a tentativa inicial de abrir o app local com Playwright retornou HTTP 500 por ausência das flags correspondentes ao adaptador de QA; a causa foi corrigida na atualização seguinte, sem chaves Clerk e sem acesso a Production.

## Atualização de execução — 12/10/2026 — autenticação de QA local (não aceita visualmente)

O `ClerkProvider` causava erro porque a inicialização anterior ligou `GESTAO_DEV_AUTH`, mas deixou desligada `NEXT_PUBLIC_GESTAO_DEV_AUTH`. O fluxo existente já permite sessão de desenvolvimento limitada a loopback e a um `Member` local; a rota `/gestao/alunos/turmas` abriu com ambas as flags, após “Começar” continuou acessível no reload, e a inspeção do console do navegador não encontrou erros. A sessão foi professor, sem Clerk real. A consulta de verificação do PostgreSQL local retornou banco `interprete_gestao_qa_20261012`, versão 17.10 e TLS verificado. A lista de turmas estava vazia; nenhum conteúdo de turma foi criado nesta unidade.

Para evitar repetição, `resolveDevelopmentAuthUserId` e o proxy agora exigem as flags de cliente e servidor juntas em desenvolvimento, validam os valores booleanos e falham cedo com mensagem clara se estiverem desencontradas. `apps/app/.env.example` documenta o par e a seleção de um membro semeado. Teste focado `apps/app/lib/development-auth-config.test.ts`: 3 testes passaram. Ainda faltam matriz dos quatro perfis + admin, ações persistentes de turma, Clerk real, seed visual, screenshot com caminho salvo e comparação dos quadros. Nenhum quadro foi concluído; a Fase 1 e a Fase 2 permanecem abertas.

Validação do código desta atualização: `bun run check` (885 arquivos), `bun run typecheck` (16/16), `bun run boundaries` (832 arquivos), `bun run test` (586 testes do app; 17 de domínio; 9 de API; 27 scripts aprovados e 1 harness aposentado ignorado), `bun run build` (8/8 tarefas com `SKIP_ENV_VALIDATION=true` e URL local), `bun run performance:check` e `git diff --check` passaram. A saída de produção não contém marcador do ator de QA ou `resolveDevelopmentAuthUserId` em `.next/server`, e `.next/static` não contém marcadores de autenticação local. Um chunk de SSR ainda contém o nome da flag pública usado pelo provedor; não foi provada a eliminação total dessa expressão do código de servidor, então a ausência completa do caminho de teste na build permanece por auditar. Build não abriu conexão ao banco.

## Checkpoint de implementação · fixtures QA e base aditiva do calendário (12/10/2026)

Foi criada a entrada separada `bun run db:seed:gestao` com os perfis `functional` e `visual`. A validação ocorre antes de criar o cliente Prisma e exige `NODE_ENV=development`, `SEED_DEVELOPMENT_DATA=true`, perfil explícito, todas as URLs configuradas no mesmo destino de QA, loopback, porta `55433` e o nome de banco fixado pelo perfil. O adapter usa `DATABASE_URL` primeiro e a verificação TLS existente; a seed usa upserts determinísticos e não contém exclusões. O perfil funcional define 3 turmas, 12 alunos, 2 professores, 1 admin, 2 cursos, 6 aulas, 5 atividades com envios, 3 encontros e 8 medalhas. O visual define os nomes e as contagens das referências 35/41 (18, 24 e 12 alunos e 3 sem turma), prazos/liberações de outubro e 54%/100% de progresso. Esses números ainda descrevem a fixture no código: nenhum perfil foi semeado nesta execução.

A migration `20261012180000_cohort_calendar_projection` é aditiva: inclui associação de encontros a turmas, término de recorrência, exceções por ocorrência e feed `.ics` por membro/turma com hash de token e revogação; as quatro tabelas novas habilitam RLS e não recebem policy permissiva. `Meeting` continua sendo a fonte de encontros existente. A migration não foi aplicada. Como nenhuma URL do banco QA está presente nesta sessão, a seed terminou no guard antes do cliente Prisma; não houve conexão, escrita nem tentativa remota. Rollback de aplicação deve voltar o código e manter os objetos aditivos; não há rollback destrutivo.

Verificação desta tranche: 5 testes do guard passaram; o typecheck do pacote de banco e `prisma validate` passaram; `bun run check` (889 arquivos), `bun run typecheck` (16 tarefas), `bun run boundaries` (834 arquivos), `bun run test` (586 app, 17 domínio, 9 API; 32 scripts passaram e 1 harness aposentado foi ignorado), `bun run build` (8 tarefas), `bun run performance:check` e `git diff --check` passaram. Calendário mediu 217,6 KiB gzip/17 chunks e Planejamento 223,9 KiB gzip/17 chunks, sob 225 KiB. Não há persistência da seed, jornada autenticada, captura/sobreposição visual ou prova de revogação `.ics`; nenhuma fase ou quadro foi aceita.

## Checkpoint de execução · agenda persistente e QA contínuo (12/10/2026)

Este checkpoint atualiza as limitações dos registros anteriores: os dois perfis agora existem em bancos isolados locais, e a migration `20261012180000_cohort_calendar_projection` consta aplicada no histórico do banco funcional. A consulta com CA verificada, loopback e porta 55433 confirmou, por prefixo de fixture, 3 turmas, 12 alunos, 2 professores, 1 admin, 2 cursos, 6 aulas, 5 atividades, 5 entregas, 3 encontros e 8 definições de medalha no perfil funcional; 3 alunos ficam sem turma e 2 participam de mais de uma. Registros locais anteriores foram preservados, por isso os totais globais de algumas tabelas excedem os da fixture. No visual, as turmas têm 18, 24 e 12 alunos, com 3 sem turma, 2 cursos, 6 aulas, 5 atividades/entregas e 8 medalhas. Há 4 encontros no conjunto visual, sendo os 3 da Mentoria os exibidos no quadro 41. O banco visual tem as tabelas do schema, mas não tem `_prisma_migrations`; isso não comprova aplicação versionada nesse banco. Nenhuma seed foi repetida para obter as capturas desta passada.

A agenda de Gestão projeta `CohortEvent`, encontros ligados por `MeetingCohortTarget`, prazos de atividade e liberações de aula. Exceções remarcadas/canceladas preservam a série; os resolvers do aluno e o `.ics` passam a tratar essas fontes, deduplicação e revogação. A cópia entre turmas usa confirmação, versões, idempotência e transação; as fontes pedagógicas existentes são reutilizadas. A UI ganhou camadas liga/desliga para os quatro tipos. Os avisos de conflito continuam informativos e refletem o conjunto autorizado, independentemente da camada escondida.

QA funcional local: atribuir o aluno QA sem turma → recarregar confirmou o vínculo; remover com confirmação → recarregar devolveu o aluno à lista sem turma, restaurando o estado inicial. Cancelar/restaurar uma ocorrência recorrente também persistiu. A assinatura retornou HTTP 200, `text/calendar; charset=utf-8` e delimitadores VCALENDAR; após revogar, a mesma URL retornou 404. O token permaneceu apenas no navegador e não foi registrado. A matriz completa de papéis/URLs/Server Actions ainda não foi exercitada.

QA adicional de cópia: a turma criada pela interface `QA local — cópia de agenda 12/10` recebeu 3 encontros e 2 prazos da Mentoria; recarregar manteve os cinco rótulos. Repetir a cópia adicionou zero encontros/prazos. As 3 liberações foram corretamente ignoradas porque o destino não tinha acesso ao curso, com mensagem explícita. A turma de QA foi encerrada/arquivada pela interface, sem excluir registros; consulta TLS ao PostgreSQL confirmou `archived=true`, 3 vínculos de encontro, 2 de atividade, zero liberações e zero matrículas. O conjunto visual mantém um registro arquivado adicional de QA; isso não é dado da referência. A revisão de teclado encontrou e corrigiu o estado do diálogo de cópia ao pressionar Esc; fechar → reabrir → cancelar passou sem executar cópia. Esta correção de seis linhas ocorreu depois da build registrada abaixo e recebeu check focado e QA no navegador; a próxima build deve reconfirmar seu bundle.

QA visual local: as datas e os rótulos de Aula 4/5/6, Leitura crítica, Intervalo de confiança, Risco de viés, Revisões e Intervalos foram conferidos contra HTML/PNG 41. A grade de outubro agora tem 35 células (cinco semanas), conforme a referência; meses que precisam de seis semanas continuam com 42 células. Alternar Prazos esconde somente os prazos e reativar restaura os itens. Foi corrigido um estouro de 28 px do controle de mês em 320 px. A medição após os ajustes retornou `scrollWidth === innerWidth` em 320, 390 e 1440 px; o console em `http://localhost:3000` apresentou 0 erros e 0 avisos. O host 127.0.0.1 havia provocado bloqueio do HMR por origem diferente de `NEXT_PUBLIC_APP_URL`; usar localhost resolveu essa configuração de preview.

Capturas locais salvas em `output/playwright/gestao-v2/`: `turmas-functional-1440.png`, `calendario-functional-1440.png`, `turmas-visual-1440-current.png`, `calendario-visual-1440-viewport-current.png`, `calendario-visual-1440-debug.png`, `calendario-visual-390-current.png` e `calendario-visual-320-current.png`. A captura desktop de calendário foi inspecionada ao lado do PNG 41; ainda diverge no shell, posição/hierarquia dos controles, estilos de itens/rascunho e estado do menu por dia. Não houve diff de pixels nem aceite. No quadro 35, os filtros funcionais mostram somente a situação selecionada; a referência mostra três cartões apesar de Ativas selecionado. Não foi inventada uma quarta turma para reproduzir o contador da referência.

O cache gerado de desenvolvimento foi preservado em `%TEMP%/interprete-gestao-next-dev-cache-20261012-before-recovery`; regenerá-lo recuperou as rotas filhas que caíam no fallback após a build. O preview permanece servido pelo worktree isolado em `http://localhost:3000/gestao/alunos/turmas`, com administrador da fixture visual e ambas as flags de QA. O PostgreSQL continua em loopback e com TLS validado; a configuração temporária de autenticação local e sua reversão estão registradas em DECISIONS.md.

Após os ajustes finais de camadas/grade passaram os gates monorepo: `check` (896 arquivos), `typecheck` (16 tarefas), `boundaries` (841 arquivos), `test` (592 testes do app, 17 de domínio, 9 de API, 32 scripts aprovados e 1 ignorado), `build` (8/8), `performance:check` e `git diff --check`. Calendário mediu 220,9 KiB gzip/17 chunks e Planejamento 224,0 KiB/17 chunks, sob 225 KiB. O teste focado de domínio passou com 11 testes. A build usa `SKIP_ENV_VALIDATION=true` e URL local, sem conexão ao banco. O preview foi reaberto após a build.

Próximas lacunas: menu do dia com criação real de encontro/prazo/liberação/evento; edição das fontes; matriz de autorização completa; fidelidade de shell/controles; demais larguras, movimento reduzido e teclado. Fase 2 e quadro 41 seguem IN PROGRESS. Nenhum quadro foi concluído nesta unidade.

### Entrada de atribuição de alunos sem turma

O aviso da lista de turmas aponta para `/gestao/alunos/turmas/atribuir`, restrita a admin no servidor. A seleção lista turmas ativas/futuras com busca e paginação SQL; o destino mantém `somenteSemTurma=1` na busca/paginação e reutiliza a mutação de matrícula existente, com seleção e confirmação. Os cartões mostram contagens reais de encontros e progresso agregado no PostgreSQL. O ciclo de atribuir/recarregar/remover/recarregar já foi verificado com o perfil funcional (registro acima). Os quatro arquivos de interface desta unidade estavam incluídos nos gates e na build de 592 testes registrada neste checkpoint; a mudança posterior foi apenas o tratamento de Esc no diálogo de cópia do calendário. A matriz completa de permissões e o aceite visual de 35/36/37 continuam abertos.

### Alteração da meta de publicação (12/10/2026)

O objetivo passou a pedir commit, push, main e produção ao final, mas conserva no mesmo texto os limites que proíbem Production, merge em main e release. A implementação e o QA local continuam autorizados. A publicação remota permanece pendente de reconciliar essa contradição antes de qualquer ação dependente; nenhum push, merge ou deploy foi feito.

## Checkpoint · escopo de encontros compartilhados e seis larguras (12/10/2026)

A revisão da Server Action de exceções identificou que o mesmo Meeting pode pertencer a várias turmas. A consulta de escrita agora exige que o professor seja responsável por todas as turmas com vínculo não revogado; admin mantém acesso global. O papel é lido novamente na transação. O hash de idempotência inclui o ator, e a autorização da turma é reconfirmada antes de retornar uma operação repetida. O arquivo `calendar-occurrence-actions.test.ts` passou com 6 testes focados de contrato/mocks: filtro de escopo compartilhado, fonte negada, papel fresco de admin, acesso revogado antes do replay, papel de staff revogado e separação de chaves por ator. Esses testes não substituem a matriz de integração com usuários reais.

Capturas adicionais salvas em `output/playwright/gestao-v2/calendar-qa-2202-{largura}-{movimento}.png`, para 1440, 1280, 1024, 820, 390 e 320 px, com `no-preference` e `reduce`. Nas 12 combinações `scrollWidth === innerWidth`; nenhum evento `pageerror` ocorreu durante a passada. As imagens 1440/820/320 foram inspecionadas junto ao PNG 41: permanecem diferenças de shell, hierarquia/posição dos controles, estilo dos itens/rascunho e menu do dia. O teste de overflow não comprova teclado completo, ausência de recorte em todo o conteúdo ou fidelidade visual. Fase 2 e quadro 41 continuam abertos.

Os gates desta correção passaram: `check` (897 arquivos), `boundaries` (842), `typecheck` (16/16), `test` (598 testes do app, 17 de domínio, 9 de API e 32 scripts aprovados/1 ignorado), `build` (8/8), `performance:check` e `git diff --check`. A build reconfirmou também o tratamento de Esc, com calendário em 220,9 KiB gzip/17 chunks e Planejamento em 224,0 KiB/17 chunks. O preview foi reaberto no worktree isolado com os dados visuais locais: a rota do calendário retornou HTTP 200 e a grade ficou visível após navegação completa. Não houve escrita remota.

Próxima revisão de acesso: os vínculos de encontros agora alcançam o calendário, mas a política `FROM_JOIN` e a inclusão opcional de encontros passados ainda precisam ser auditadas nas leituras de Meeting. O modelo atual não tem `publishedAt`; não confundir presença de matrícula ativa com prova dessas regras de entrada. Resolver isso antes de aceitar C1/T2 ou o calendário do aluno. O guia de execução e limites foi iniciado em `docs/gestao-implementacao.md`.

## Checkpoint · política de entrada dos encontros (12/10/2026)

A Fase 2 — Turmas e resolvers de acesso, feed e calendário — continua IN PROGRESS.
Encontros agora usam publicação/atribuição e os metadados da matrícula para
FROM_JOIN e histórico optativo de ALL_ACTIVE. A mesma política atende detalhes,
gravações, ocorrências do Planejamento e encontros no feed ICS do membro.
Convite individual mantém precedência. A primeira publicação é registrada
transacionalmente; republicar não substitui um instante existente. Legados sem
`publishedAt` usam `createdAt`, sem fabricar backfill.

A migration aditiva `20261012223000_meeting_publication_time` foi aplicada com
`migrate deploy` no banco funcional local (63 migrations no diretório), e o SQL
exato foi aplicado no visual após conferir nome do banco, loopback, porta 55433
e TLS verificado. O visual continua sem `_prisma_migrations`; não afirmar
aplicação versionada nele. Nenhum banco remoto foi acessado. Rollback preserva
coluna/dados e volta o código.

QA persistido funcional: turma `gestao_entry_qa_20261012` e três encontros de
teste, usando um Member já semeado com entrada em 10/10. A consulta real e a
política negaram o encontro publicado em 02/10, permitiram o publicado em 11/10
e preservaram o convite individual. A primeira criação da matrícula falhou no
check de `activeKey`; a repetição idempotente usou a chave canônica, preservou
o check e os dados já criados. Esses extras não alteram a definição da seed.

No navegador, o shell do aluno inicialmente retornou HTTP 500 por chamar
`useClerk` sem provider no runtime local. A view foi separada do componente
Clerk e o layout servidor seleciona QA. Após a correção, os três cenários
renderizaram respectivamente “404”, o encontro posterior e o convite direto;
o título protegido não apareceu. Next fez streaming com HTTP 200 também na
página not-found; a prova aqui é a negação do conteúdo, não status HTTP 404.
Planejamento abriu e a rodada final não capturou `pageerror` nem resposta 5xx.
Relatório: `output/playwright/gestao-v2/meeting-entry-qa-20261012.json`.
Antes dessa rodada final houve também um 500 em focus-timer durante a primeira
provisão concorrente de preferências; as leituras seguintes responderam 200.
Esse fluxo legado ainda exige ensaio próprio de concorrência.

Testes focados: 29 de política/acesso/Planner/conteúdo e 11 de publicação/shell
passaram; incluem regressão sem hook Clerk, transação da publicação, preservação
ao voltar a rascunho, autorização negada e status inválido. Lint final passou
em 901 arquivos. Gates completos desta unidade ainda em execução; não usar
os números do checkpoint anterior como validação das mudanças novas. Matriz
completa de papéis/ações, Clerk real, feed de aluno ponta a ponta e comparação
visual continuam pendentes; nenhum quadro foi aceito.

Atualização dos gates e preview desta unidade: build 8/8 passou com
`SKIP_ENV_VALIDATION=true` e URL local, sem precisar conectar ao banco;
`performance:check` passou com calendário 221,0 KiB e Planner 224,1 KiB gzip,
17 chunks cada. `typecheck` 16/16 e `boundaries` 846 arquivos passaram após o
novo teste de publicação. A suíte incluída na build passou com 609 testes do
app, 17 domínio e 9 API; o teste posterior de publicação passou com 4 casos
focados. A execução final de `bun run test` que inclui todos os 613 casos ainda
está em andamento.

O preview foi restaurado para o admin visual. Após a build, o dev respondeu
com a rota provisória em vez do calendário; reiniciar com `.next/dev` movido
para `.next/dev-before-entry-policy-qa-20261012` preservou o cache anterior e
restaurou a rota correta. Houve timeout na primeira compilação a frio; depois
abriu “Turma Mentoria PBE”. Capturas finais salvas em
`output/playwright/gestao-v2/calendar-entry-policy-20261012-{1440|320}.png`, sem
`pageerror` na passada e sem overflow horizontal do documento. As duas imagens
foram inspecionadas, e a de desktop comparada manualmente ao PNG 41: ainda
faltam alinhamento do shell/toolbar, estilo de rascunho/itens, menu do dia e
outros detalhes. Em 320 px há truncamento de itens e navegação interna rolável;
ausência de overflow não equivale a aceite visual ou acessibilidade completa.
Nenhum quadro foi concluído.

Fechamento dos gates desta unidade: `bun run test` terminou com 613 testes do
app em 141 arquivos, 17 de domínio, 9 de API e 32 testes de scripts aprovados
(1 harness aposentado ignorado). `check` 901 arquivos, `typecheck` 16/16,
`boundaries` 846 arquivos, build 8/8, `performance:check` e `git diff --check`
passaram. Isso encerra a validação de código desta unidade, mantendo abertas
as lacunas de aceite descritas acima.

## Fechamento solicitado pelo usuário · 12/10/2026

O usuário pediu encerrar a unidade corrente, auditar o estado real e passar o
trabalho para outro chat. Nenhuma nova fase será iniciada nesta passagem.
O retrato atual é `docs/gestao/STATUS.md`, com inventário em
`docs/gestao/estado-auditado-20261012.json`, registro compacto por commit em
`docs/gestao/EXECUTION-LOG.md` e instrução em `HANDOFF-PROXIMO-CHAT.md`.

### Unidade encerrada: encontro pelo dia do calendário

O número do dia abre menu com Novo encontro e Evento da turma. O formulário de
Meeting recebe data e nome da turma, início/fim, fuso, repetição, link e
publicação confirmada. A Server Action cria Meeting + alvo da turma + auditoria
em transação serializable, relê papel/ativação/escopo, compara versão da turma
e protege replay por ator/turma/payload. Submit tem trava imediata, estado
pendente, tratamento de falha de rede e conserva os campos após validação.
Rascunhos agora têm borda tracejada na Gestão.

`calendar-meeting-actions.test.ts`: 14 testes focados passaram. Typecheck do
app passou. No navegador admin visual, publicar “QA local — encontro de handoff
20261012” em 19/10 e salvar “QA local — rascunho de handoff 20261012” em 20/10
persistiram após reload. A consulta Prisma com CA verificada confirmou o banco
visual em loopback/55433/TLS, as duas linhas, um alvo ativo cada, 12:00Z–13:00Z
e publishedAt só no publicado. São extras explícitos de QA preservados no
visual; eles alteram contagens e não são dados de produção.

Capturas em `output/playwright/gestao-v2/handoff-meeting-{largura}-{movimento}.png`
para 1440/1280/1024/820/390/320, normal/reduce. Data inicial correta nas 12,
Escape fechou o diálogo em todas, sem overflow horizontal do documento ou
pageerror na passada. As imagens 1440/normal e 320/reduce foram inspecionadas;
isso não é comparação integral com o editor de referência nem aceite visual.
Faltam as entradas Prazo de atividade/Liberar uma aula, jornada do novo encontro
como aluno, matriz de papéis, editor completo e fidelidade do quadro 41.
C1/C2 e Fase 2 continuam IN PROGRESS.

### Auditoria real do estado

O inventário do próprio PROGRESS contém 0 quadros aceitos, 31 em andamento e
70 pendentes. O contrato tem 53 rotas; o source tem 38 páginas da Gestão, com
18 matches exatos após normalização dos parâmetros. Não interpretar os outros
35 como ausência de todo código: há funções em caminhos diferentes. Tampouco
interpretar matches como telas funcionais. No navegador admin local,
`/gestao/comunidade/encontros` e `/gestao/administracao/medalhas` mostraram
“Este fluxo está sendo conectado”; `/gestao/previa` mostrou 404. O streaming
retornou 200 nas três, então status HTTP isolado seria evidência enganosa.
A auditoria inicial de 11/10 agora contém aviso de que é histórica.

Não se promoveu nenhuma fase. O log existente era cumulativo e preservava
informações antigas superadas; o novo STATUS separa o estado atual, evidência
e lacunas. O próximo chat deve fechar unidades verticais e registrar critério
de saída, teste/captura/log e SHA, sem repetir a auditoria global em cada ajuste.

Gates de fechamento: check passou (904 arquivos), typecheck 16/16, boundaries
848 arquivos, testes 627 app/17 domínio/9 API e 32 scripts aprovados/1 ignorado.
Build reportou 8/8 tarefas bem-sucedidas. Calendário: 222,2 KiB gzip/18 chunks;
Planejamento: 223,5 KiB/17, ambos abaixo de 225 KiB. Logs separados em
`output/gestao-final-audit/`. A execução final terminou com exit 0 em todos os
seis gates, incluindo `performance:check`; `git diff --check` também passou.

Releitura SQL com TLS validado confirmou as migrations aditivas de projeção e
publicação terminadas sem rollback no funcional, e RLS habilitado nas quatro
tabelas novas de alvos, feeds e exceções. Nenhuma migration foi aplicada nesta
unidade. O visual continua sem histórico Prisma; nenhuma fase foi promovida.

Preview reaberto após os gates em `http://localhost:3000`. A sondagem final no
Playwright renderizou Turma Mentoria PBE / Agenda da turma, sem placeholder,
com o encontro publicado preservado. Processo dev deixado ativo para inspeção.
Encerramento e passagem para outro chat solicitados pelo usuário; objetivo
completo permanece não atingido e deve ficar pausado.

## Unidade em execução · Fase 1 · R1/R3 · 12/10/2026

Requisito: trilho de 72 px com submenu por ponteiro, toque e teclado (quadro 30);
gaveta modal abaixo de 1024 px com Escape, contenção e retorno de foco
(quadro 93). Arquivos principais: gestao-shell.tsx, gestao.css e harness local
Playwright. Evidência existente: papel/flag e retorno seguro têm testes;
nenhuma prova anterior de navegação completa por teclado ou submenu inativo.
Critério de saída desta unidade: menus reais das áreas já implementadas abrem
sem navegar primeiro; links preservam origem; gaveta fechada não recebe foco;
Escape/devolução do foco e resize funcionam; seis larguras e movimento reduzido
sem overflow; capturas comparadas; gates completos. Não equivale ao aceite da
Fase 1: transição, visão geral, papéis e demais quadros continuam pendentes.

### Resultado da unidade R1/R3 · shell · 12/10/2026

Trilho: 72 px, botões reais para abrir páginas de Ensino/Alunos mesmo quando
inativas, hover com passagem para o painel, toque real, setas/Enter/Escape e
retorno de foco. Links reais preservam `from` sanitizado, sem prefetch automático
no submenu. A gaveta usa Dialog do design system (modal, scroll lock, foco
contido, Escape, clique fora e retorno de foco); menu fechado não é tabulável.
Menus fecham ao sair do seu breakpoint. Menu da conta não fecha a gaveta em
cascata; após resize para desktop, o foco volta à navegação visível. O retorno
à área de membros tem nome acessível inclusive no trilho.

Harness `scripts/qa/gestao-shell-local.mjs`: 12/12 combinações de
1440/1280/1024/820/390/320 com movimento normal/reduzido passaram. Inclui Tab e
Shift+Tab contidos, menu da conta aninhado, Escape/clique fora/botão fechar,
resize, navegação real para Turmas/Exercícios, origem preservada e ausência de
overflow/pageerror. Relatório e 12 capturas:
`output/playwright/gestao-v2/shell-navigation/`; log:
`output/gestao-shell-navigation/browser.log`. A primeira rodada encontrou o
deslocamento de centralização herdado do diálogo e o fechamento em cascata do
menu; ambos foram corrigidos antes da rodada final. Nenhum dado foi criado,
removido ou migrado nesta unidade. Não há ação de persistência nova a validar;
o contexto de retorno segue na URL das navegações verificadas.

HTMLs 30/93 lidos e PNGs inspecionados; capturas implementadas 1024/normal e
390/reduce comparadas com as referências. Trilho e painel têm dimensões
contratuais; gaveta tem 312 px em 390 e limite de 272 px em 320. Ainda diferem
ícone da visão geral, tipografia/pesos, espaçamento vertical, linha/estilo do
perfil e conteúdo/header atrás do menu. Os alvos de toque usam ao menos 44 px,
embora os subitens do HTML mobile usem 38 px. Não há aceite visual integral.
GRail/GMMenu ficam [~]; 0/101 aceitos, 33 em andamento, 68 pendentes. Fase 1
continua aberta: N1/N2/N3 completos, quadros 13–30, matriz de papéis, leitor de
tela real, CLS/latências e demais controles do shell não estão aceitos.

Gates finais passaram: check 905 arquivos; typecheck 16/16; boundaries 848;
testes 627 app/17 domínio/9 API, 32 scripts aprovados/1 ignorado; build 8/8;
performance:check e git diff --check. Logs em `output/gestao-shell-navigation/`.
Calendário: 222,7 KiB gzip/18 chunks; Planejamento: 223,5 KiB/17, sob 225 KiB.
Build usa URLs locais e SKIP_ENV_VALIDATION, com flags de autenticação QA
desligadas; não comprova autenticação ou produção. Critério funcional local
desta unidade cumprido; critérios integrais de quadro/fase continuam abertos.
Commit identificado por `fix(gestao): make rail and drawer navigation accessible`.

Preview reaberto após build pelo comando Bun autorizado, com admin visual,
loopback e CA validada. Navegador confirmou Turmas e Agenda da turma de
Mentoria, sem catch-all/placeholder; snapshot de continuidade em
`output/gestao-shell-navigation/preview-calendar.yml`. O preview permanece
ativo; a configuração temporária do PostgreSQL foi preservada conforme o
procedimento de DECISIONS.md. Sem push/merge/deploy ou banco remoto.

### Unidade em execução — Fase 1, N2/N3: troca de ambiente e origem

Requisito: docs/04 §1–3, quadros 13–17; entrar/sair com feedback imediato,
foco/anúncio no destino, transição reduzida e retorno à origem mesmo após
navegação interna sem `from` e reload. Arquivos principais: controlador do
shell persistente, contexto de navegação, shell da Gestão, CSS global e
harness local. Evidência anterior: retorno sanitizado em URLs do shell e
R1/R3; ainda sem sessão de origem nem foco/anúncio entre ambientes. Critério
de saída: entrada/retorno reais nas seis larguras e dois modos, query/hash
preservados após reload, fallback sem View Transitions, falha/offline sem
tela vazia ou bloqueio permanente, testes e gates. Não inclui fila offline
de escritas/401 em editores (Fase 8), nem promove aceite visual dos quadros.

Resultado funcional local N2/N3: controlador persistente agora centraliza a
troca entre shells, conserva a página anterior enquanto espera, previne
disparo duplicado, limita a espera a 12 s e oferece retry. Snapshots nativos
evitam duplicar árvores/effects; fallback CSS funciona sem a API ou quando
ela lança sincronicamente. Origem inclui query/hash, é sanitizada e guardada
por aba/usuário; URL explícita prevalece. Há loading sem dados de domínio,
foco no título renderizado, anúncio de chegada/retorno, aviso mobile de 4 s e
foco após fechar boas-vindas. Não há nova query, biblioteca ou migration.

`use-shell-navigation.test.tsx`: cinco testes de sessão/isolamento,
sanitização, offline/retry, duplicidade/timeout, API que lança e título tardio
(alguns cenários compartilham o mesmo teste). Com os cinco testes existentes
de gestao-navigation, dez passam. Harness
`scripts/qa/gestao-shell-entry-local.mjs`: 12/12 combinações em seis larguras
e dois modos, Enter real, conteúdo sem `from`, reload e retorno à origem,
foco/anúncio, overflow/pageerror, offline/retry e fallback. Na rodada final,
animação nativa de conteúdo foi 400/120 ms; feedback 20,4–85 ms; CLS zero.
São medidas locais de uma rodada, não percentis nem dispositivo real.
JSON/12 capturas em `output/playwright/gestao-v2/shell-entry/`; logs
`output/gestao-shell-entry/browser-duration.log`.

O ensaio inicialmente confundiu o nome da fixture (Turma Mentoria PBE) e
alcançou a barra antes de seu modo responsivo hidratar. Após três tentativas
de sincronizar o mobile por visibilidade/animação/foco, mudou-se a abordagem:
rastrear eventos e identidade do DOM. A barra SSR usa `collapsible=none`, sem
o container esperado pelo teste; aguardar sua remoção real corrigiu o ensaio.
Não se removeu a ativação por Enter nem se enfraqueceu uma asserção funcional.

PNGs 15/17 e HTMLs aplicáveis inspecionados; imagens implementadas desktop e
mobile comparadas. O destino ainda diverge em tipografia, composição da visão
geral, cards e tamanho/quebra do aviso mobile. Stagger e cronologia integral
das camadas não têm aceite; N2 integral segue pendente. GChegada/GTransicao/
GTransicaoEstados/GTransicaoMobile ficam [~]: 0/101 aceitos, 37 em andamento,
64 pendentes. Critério funcional da unidade cumprido; Fase 1 continua aberta.

Foi observado 500 inicial de `/api/focus-timer?compact=1` no CLI; o harness
final não teve pageerror. Não confundir isso com ausência comprovada de todo
erro HTTP/console. Correção da provisão concorrente do legado continua
pendente. Leitura dos guards também identificou redirecionamento de membro
para `/` e possível ciclo do professor em Administração; será a próxima
unidade N1/permissões, sem ampliar para Turmas antes disso.

Gates já aprovados: check 910 arquivos, typecheck 16/16, boundaries 852,
testes 632 app/17 domínio/9 API e 32 scripts aprovados/1 ignorado. Build 8/8,
performance:check e diff aprovados. Calendário 223,7 KiB/18 chunks;
Planejamento 224,5 KiB/17 (teto 225 KiB). Logs em
`output/gestao-shell-entry/`. Primeira build com NODE_ENV=production
herdado fez Vite externalizar node:crypto nos testes dependentes; log preservado
em `build-node-env-production.log`. Nova build usa NODE_ENV não definido no
orquestrador; Next define produção em seu próprio processo. Sem segredos,
escrita remota, push/merge/deploy.

Preview reaberto com admin visual e os mesmos bancos/CA locais; navegação real
reconfirmou Agenda da turma Mentoria. Identificar esta unidade por
`fix(gestao): preserve origin and coordinate environment navigation`. Nenhum
quadro/fase promovido. Próximo: N1/GRestrito, guard de login com destino,
negação sem ciclo/sem payload administrativo e matriz local de papéis. O foco
de conteúdo que só chega após os 4 s do aviso ainda precisa de ensaio lento;
não declarar esse limite de rede aceito pela rodada rápida.

### Unidade em execução — Fase 1, N1/GRestrito: entrada e negação no servidor

Requisito: docs/04 §1 e docs/05 N1/matriz; quadros 14/27. Incluir Gestão e
Professor na proteção do proxy com destino de login; membro comum recebe
negação sem dados administrativos; professor pode abrir Gestão mas não
Administração, sem ciclo de redirects. Turma de outro professor continua
negada no servidor. Arquivos: proxy/testes, gestao-authorization, Next config
e página forbidden da Gestão. Critério: testes unitários da sessão/flag/papel,
URLs reais nos quatro atores persistidos (membro, docentes 1/2 e admin),
payload de negação sem dados administrativos, retorno funcional, seis larguras
do estado restrito e gates. Sem login Clerk real depende de credenciais
indisponíveis; validar o proxy com adaptador determinístico e manter essa
limitação explícita. Não alterar dados de fixtures ou papéis para o ensaio.
Evidência anterior: guards/testes de escopo existem; os guards atuais usam
requireStaff/redirect e o caso teacher → administração redireciona para si.

### Resultado N1/GRestrito — 13/10/2026

Implementado: proxy protege /gestao e /professor e preserva caminho/busca
no login. Guard da Gestão usa sessão + Member fresco, sem requireStaff que
redirecionava membro para /. Administração negada usa forbidden em vez de
redirect para si. Detalhe de turma sem vínculo retorna restrito, sem consulta
não escopada para distinguir existência. Estado tem retorno e ajuda modal
reais, Escape e foco de volta. Ilustração vem do SVG do HTML 27; nenhum novo
asset desenhado. authInterrupts habilitado conforme docs locais Next 16.3.6.

A primeira rodada detectou 404 no detalhe de outra turma. Após corrigir esse
estado, a rodada passou semanticamente mas manteve HTTP 200 por streaming.
Isso não satisfaz a matriz: o proxy agora faz uma projeção fresca de papel/
ativação e, para professor em detalhe, EXISTS por id/vínculo. NextResponse.next
com status 403 fixa o status antes do streaming; os guards de página/ação
continuam reautorizando. Escrita negada termina no proxy com JSON 403 privado,
antes de despachar. Typecheck encontrou headers lidos de Promise; corrigido
com await e teste de preservação do cabeçalho de segurança assíncrono.

47 testes focados passaram (autorização, boundary e proxy). Harness
scripts/qa/gestao-entry-permissions-local.mjs passou nos quatro atores: admin,
teacher_1, teacher_2 e student_01 do banco funcional. Confere item Gestão,
URLs, status 200/403, turma própria/alheia, resposta sem nome da turma negada
nem payload administrativo testado, POST negado antes do despacho, URL sem
ciclo, retorno do membro, modal/Escape/foco e 36 capturas (três atores negados,
seis larguras, dois movimentos) sem overflow/pageerror. JSON/capturas em
output/playwright/gestao-v2/entry-permissions; logs browser-http-status e
browser-final em output/gestao-entry-permissions. POST usa identificador
sentinela: comprova barreira anterior ao despacho, não substitui a matriz de
Server Actions válidas com payload de outra turma. Sem login real segue não
verificado; redirecionamento é exercitado com adaptador determinístico do proxy.

PNG 27 e capturas desktop/mobile inspecionados. Fonte apontava para token
inexistente; corrigida para font-display-family. Medidas, gap, texto, arte e
botões ajustados ao HTML. Shell/topbar, identidade da fixture funcional e
fidelidade conjunta ainda divergem. GEntrada/GRestrito ficam [~], total
0 aceitos / 39 em andamento / 62 pendentes. Critério funcional desta unidade
cumprido no QA; Fase 1 e aceite visual continuam abertos.

O ambiente reiniciou durante a continuidade: handles antigos desapareceram,
PostgreSQL/preview estavam parados. PGDATA não tinha diretórios auxiliares
vazios (pg_notify e outros). Antes de recuperar, foi feita cópia física local
postgres-data-before-directory-recovery-20261013. Somente diretórios ausentes
foram criados conforme PostgreSQL 17 storage-file-layout; sem initdb, reset de
WAL ou remoção. O servidor executou recovery normal e aceitou conexão TLS.
Releitura dos dois bancos confirmou 4 turmas/16 membros no funcional,
4 turmas/60 membros no visual e os dois extras de handoff publicados/rascunho
preservados. Não confundir cópia física com dump lógico. Regras hostssl locais
anteriores permanecem enquanto o preview está ativo.

Gates desta unidade em execução; não promover por resultado intermediário.
Próxima dependência de aceite da Fase 1: eliminar P2002 concorrente de
PlannerPreferences/focus-timer observado novamente no primeiro acesso, sem
mutação em leitura. Depois fechar espera lenta do título e visual do shell.

Gates N1/GRestrito aprovados: check 915 arquivos; typecheck 16/16; boundaries
856; 658 testes app/17 domínio/9 API e 32 scripts aprovados/1 ignorado;
build 8/8, performance:check e diff. Calendário 223,7 KiB/18 chunks;
Planejamento 224,5 KiB/17, ambos abaixo de 225 KiB. Logs finais em
output/gestao-entry-permissions. Build sem NODE_ENV herdado no orquestrador,
flags QA falsas, URL loopback e CA verificada; não comprova produção/Clerk.
Preview admin visual reaberto após a build. Unidade identificada pelo commit
fix(gestao): enforce private 403 responses before streaming. Próximo:
dependência PlannerPreferences/focus-timer concorrente, sem avançar de fase.

### Unidade em execução — Fase 1, dependência focus-timer/PlannerPreferences

Requisito: entrada e navegação N1/N2 sem o 500 inicial já observado. Não
ampliar o editor de ferramentas. Causa inspecionada: getFocusTimerState e
getActiveFocusTimerState fazem ensureTimerDefaults/upsert com update vazio
antes da leitura; chamadas concorrentes provisionam a mesma chave memberId.
Arquivos: lib/focus-timer.ts, padrões do cronômetro, testes e harness local.
Critério: leituras compacta/completa funcionam sem linha persistida, preservam
preferências existentes e não escrevem PlannerPreferences; concorrência real
retorna 200 e mantém a linha ausente. Iniciar timer pode provisionar padrões
idempotentemente como mutação explícita. Comparar UI de entrada existente,
rodar gates, documentar limite: o ciclo legado de encerramento de sessão
expirada não será refeito nesta correção de preferências. Sem migration,
remoção de dados, mudança de papel ou alteração de fixtures existentes.

### Resultado da dependência de preferências do cronômetro — 13/10/2026

GET compacto/completo agora busca só os campos de configuração e usa padrões
canônicos quando não há PlannerPreferences. Não faz upsert/create nessa
leitura. Os padrões já usados pela UI foram movidos para módulo compartilhado,
sem mudar os valores. Iniciar timer, ação explícita, provisiona com createMany
skipDuplicates (INSERT ON CONFLICT DO NOTHING), preservando valores existentes.
O encerramento legado de timers expirados continua fora desta correção; não
se afirma que todos os efeitos do GET foram removidos.

Dois testes de regressão cobrem oito leituras compactas/completas simultâneas
sem provisionar e preferências salvas preservadas. Os quatro testes do arquivo
focus-timer.test.ts passam. Harness focus-timer-preferences-local.mjs fez 40
GETs reais em cinco rajadas de oito, metade compactos, todos 200, no-store e
configuração padrão; SQL TLS antes/depois confirmou ausência da linha e de
timer ativo. Ator student_03 funcional confirmado no SSR de Biblioteca antes
do ensaio. Dois inícios explícitos simultâneos deram 200/409, uma única linha
de preferências e um timer ativo; Stop parou somente esse timer. Registro e
revisão pendente foram preservados, sem review(false), que apagaria o registro.
Evidências em output/playwright/gestao-v2/timer-preferences/{reads.json,
explicit-starts.json}; runtime-final.log em output/gestao-timer-preferences.

A rodada anterior no student_02 já passou os 40 GETs; o harness confundiu
o envelope POST {result} e esperava 400 em vez do 409 documentado do conflito.
Nenhuma falha de produto foi ocultada: corrigido o harness, o timer próprio
foi parado após conferir ator/id/título; a nova rodada usa student_03 ainda
sem preferências, sem apagar a linha de student_02. Um erro de redeclaração
no script foi corrigido antes da rodada final. Ambos os registros de timer
ficam encerrados com revisão pendente; não foram registrados como estudo.
Não alterar package.json por causa do aviso MODULE_TYPELESS_PACKAGE_JSON do
Node ao importar o módulo TS puro no harness; não afeta o runtime Next/Bun.

Gates em andamento; typecheck 16/16 e boundaries 857 já passaram. Não há novo
quadro aceito ou mudança de fase. Próximo: foco do título que chega depois
dos quatro segundos do aviso de entrada; depois visual do shell/visão geral.

Gates finais da dependência passaram: check 917 arquivos, typecheck 16/16,
boundaries 857, 660 testes app/17 domínio/9 API e 32 scripts aprovados/1
ignorado; build 8/8, performance:check e diff. Calendário 223,7 KiB/18 chunks,
Planejamento 224,5 KiB/17 e Ferramentas 222,8 KiB/17, teto 225 KiB. Browser
com admin visual fez Biblioteca → Gestão → reload, duas respostas compactas
200, sem pageerror e SQL de preferências idêntico antes/depois. JSON em
output/gestao-timer-preferences/browser.json; screenshot shell-smoke.png
inspecionado, layout da visão geral mantém as divergências já registradas.
Preview admin visual reaberto. Critério da dependência cumprido; quadro/fase
não promovidos. Identificar por fix(timer): avoid provisioning preferences
during reads. Próximo: foco/anúncio do título tardio na entrada N2/N3.

### Unidade em execução — Fase 1, N2/N3: título após o aviso de chegada

Requisito: foco/anúncio da entrada quando o h1 só chega depois de 4 s. O
observer atual é desconectado pelo mesmo timer do aviso, perdendo foco/anúncio.
Arquivos: use-shell-navigation.tsx/test e harness shell-entry. Critério:
regressão com título após 6 s, não roubar foco de diálogo aberto e cancelar
observer ao sair da rota; ensaio no controlador real com atraso controlado
do título, além de entrada/retorno normal; seis larguras/dois movimentos,
gates e orçamento existente. Distinguir atraso controlado do DOM de prova de
latência de servidor/rede. Sem dados, consulta, migration ou novo catálogo.
Evidência reutilizável: N2/N3 normal passou 12 combinações; resta ensaio >4 s.

### Resultado N2/N3: título tardio — 13/10/2026

Separado o ciclo do aviso (4 s) do ciclo de foco/anúncio. O pedido de foco
agora pertence à rota de destino; observa até existir o h1 sem diálogo aberto,
e é cancelado ao sair dessa rota/unmount. Observer filtra atributos data-state
para perceber o fechamento do diálogo, e desconecta após cumprir o foco.
Não há consulta, cache de autorização, árvore duplicada ou novo timer de rede.
Revisão solo com vercel:react-best-practices focou cleanup, estado/ref por
instância, efeitos e acesso ao DOM; sem delegação.

Sete testes focados passam: o teste do título agora avança 6 s antes de
renderizar; dois novos cobrem diálogo aberto e cancelamento na navegação.
Harness shell-entry ganhou QA_DELAY_TITLE=true: retém o h1 real antes de
anexar ao DOM e o repõe após 6 s; a mesma árvore e navegação reais continuam.
Isso é atraso controlado de renderização, não medição de servidor/rede.
Passaram 12/12 combinações atrasadas, mais fallback/offline/retorno, em
116,5 s. Título voltou após 6000,25–6016,66 ms, aviso já ausente, foco/anúncio
corretos; feedback 13,91–37,55 ms. Capturas/JSON em
output/playwright/gestao-v2/shell-entry-delayed; log browser-delayed em
output/gestao-shell-late-title. A retirada artificial do título desloca layout
(CLS 0,016–0,04), então essa rodada não prova CLS da rota real.

Rodada normal atual também passou 12/12 e fallback/offline/reload/retorno,
13 subtestes/50,1 s; JSON/capturas em shell-entry, log browser-normal. Capturas
mantêm o visual anterior, com divergências já registradas; nenhum quadro foi
aceito. O ensaio passou a nomear cada largura/movimento; mover somente os
loops não bastou para o limite de complexidade, e setup/asserts do atraso
foram extraídos para helpers de teste sem remover verificações.

Gates em execução. O critério de foco tardio foi cumprido no atraso controlado;
leitor de tela/dispositivo real, cronologia integral/stagger e fidelidade de
N2 continuam pendentes. Próximo depois dos gates: shell/topbar da Fase 1 e
visão geral com dados autorizados conforme quadros 23/24/25.

Gates finais N2/N3 tardio: check 917 arquivos, typecheck 16/16, boundaries
857, 662 app/17 domínio/9 API e 32 scripts aprovados/1 ignorado, build 8/8,
performance:check/diff. Calendário 223,8 KiB/18 chunks, Planejamento 224,5
KiB/17 e Ferramentas 222,9 KiB/17 (teto 225). Rodada normal: feedback
13,77–38,82 ms e CLS zero; são números locais de uma rodada, não percentis.
Preview visual reaberto. Identificar por fix(gestao): retain destination focus
after arrival notice. Próxima unidade executável: shell/topbar e visão geral
23/24/25; professor ainda exibe placeholder mesmo com turmas atribuídas.
39 em andamento/62 pendentes/0 aceitos permanecem, Fase 1 aberta.
