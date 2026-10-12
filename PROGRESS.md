# PROGRESS · Gestão do Interprete

> Diário de execução. **Atualize a cada unidade concluída**, com evidência. Releia ao começar e depois de qualquer compactação de contexto. Estado confiável = este arquivo + o Git.

## Estado geral
- Branch: `gestao-v2`
- Fase atual: Fase 2 — Turmas e resolvers. Fixtures persistentes, projeção das quatro fontes de agenda, exceções, assinatura revogável e atribuição de alunos estão em QA local. Fase 1 ainda não foi aceita; a Fase 3 tem implementação parcial. Nenhuma dessas fases recebeu aceite completo.
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
- [ ] `GChegada` — Como se chega à Gestão e como se volta
- [ ] `GEntrada` — O item “Gestão” na área de membros (professor e membro comum)
- [ ] `GTransicao` — Transição — área de membros para a Gestão (desktop)
- [ ] `GTransicaoEstados` — Transições: estados, gatilhos e respostas (entrar, sair, falhar)
- [ ] `GTransicaoMobile` — Transição — área de membros para a Gestão (celular)
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
- [ ] `GRestrito` — Administração — acesso restrito (professor)
- [ ] `GNotificacoes` — Notificações da Gestão
- [ ] `GBusca` — Busca da Gestão (alunos, turmas, conteúdo)
- [ ] `GRail` — Notebook pequeno (1024 px): barra lateral recolhida com submenu ao passar o mouse

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
- [ ] `GMMenu` — Mobile — menu de Gestão (gaveta)
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
