# PROGRESS · Gestão do Interprete

> Diário de execução. **Atualize a cada unidade concluída**, com evidência. Releia ao começar e depois de qualquer compactação de contexto. Estado confiável = este arquivo + o Git.

## Estado geral
- Branch: `gestao-v2`
- Fase atual: 2 — resolvers de turma (Aprender e primeira projeção de prazos no Planejamento/`.ics`; fontes completas do calendário, QA visual/runtime e persistência local pendentes). Há entregas parciais anteriores da Fase 3, sem avançar seu aceite.
- Último commit de implementação verificado: `e421563` (prazos de atividades individuais e de turma no Planejamento e `.ics`; QA autenticado pendente)
- Orçamento/contexto: (preencher se relevante)

## Fases
| Fase | Estado | Evidência (testes, commit) | Verificação independente |
|---|---|---|---|
| 0 Auditoria | concluída | `docs/gestao-auditoria.md`; 101 pares HTML/PNG inventariados e revistos em pranchas; matriz 1:1 gerada; commit `ffbb93e`; nenhum código/migration alterado | releitura dos critérios e conferência solo; sem subagente por instrução direta para trabalhar sozinho |
| 1 Shell, permissões, rotas, transição | IN PROGRESS — aceite visual/runtime pendente | Shell responsivo desktop/trilho/gaveta; flag `GESTAO_V2_ENABLED` false por padrão; mapa de ações por papel e retorno interno seguro; 20 testes focados e gates locais registrados no commit `1d04e5a` | Revisão solo dos critérios; comparações visuais e jornada autenticada ainda pendentes, portanto os quadros permanecem abertos |
| 2 Turmas e resolvers | IN PROGRESS | `resolveStudentFeed` fornece atividades publicadas por atribuição individual ou alvo dinâmico; `resolveCalendar` agora projeta seus prazos no intervalo consultado para Planejamento e `.ics` (`e421563`). Preserva `ALL_ACTIVE`/`FROM_JOIN`, deduplicação, menor prazo, disponibilidade e consulta de leitura sem criar progresso. 12 testes focados e 541 testes do app; `check` (849 arquivos), `typecheck` (16 tarefas), `boundaries` (796 arquivos), `test` (540 app na execução monorepo anterior ao último teste focado, 17 domínio, 9 API; scripts 27 passaram/1 harness aposentado ignorado), `build` (8 tarefas), `performance:check` e `git diff --check` passaram. Planejamento: 222,9 KiB gzip/17 chunks, sob 225 KiB. Feed/calendário ainda limitados a 200 candidatos; encontros por turma, liberações, eventos de turma, paginação, migration aplicada e QA visual/runtime permanecem pendentes. | Revisão solo de regras, integração, intervalo, prévia de disponibilidade e teste `.ics`; persistência local, jornada autenticada, revogação em runtime e comparação visual pendentes |
| 3 Ensino (YouTube, atividades, exercícios, biblioteca, coleções) | IN PROGRESS — editor de aula/YouTube e medição de playback parcialmente implementados; importação de playlist implementada em código; upload, percursos e aceite visual/runtime pendentes | Cursos (`343d5ad`) e exercícios (`fdac802`) seguem com os checkpoints anteriores. Atividades (`9cfa4a6`) e correções (`111e554`) mantêm catálogo SQL, alvos de turma, rubricas versionadas e fila/feedback. Biblioteca (`2e823ec`): catálogo SQL paginado de 24, filtros, lista/grade, seleção e ações em lote até 100, editor com validação por campo, idempotência, estado inicial de rascunho e upload privado de arquivo existente. Coleções (`8fce0f9`): catálogo SQL com filtros e 24 por página, editor/ordenação/recursos/capas, prévia sem escrita de progresso, idempotência e controle otimista de versão; reutiliza `ContentCollection`/`ContentCollectionItem` e Storage existente, sem migration. Editor de aula/YouTube (`d72c391`): tela de edição, verificação por API/adaptador de desenvolvimento, metadados aditivos e publicação revalidada no servidor. `check` (825 arquivos), `typecheck` (16 tarefas), `boundaries` (772 arquivos), suíte completa (507 testes app, 17 domínio e 9 API; 27 scripts passaram e 1 harness aposentado ignorado), `build` (8 tarefas), `performance:check` e `git diff --check` passaram. Editor medido em 218,1 KiB gzip / 17 chunks, sob 225 KiB. Y7 adiciona amostras de playback por sessão, intervalos unidos sem duplicidade entre abas, rejeição/recorte de saltos e conclusão automática com 90% de cobertura; migration `20261012143000_playback_watch_intervals` somente versionada. PostgreSQL QA autenticado, persistência, playback real e comparação visual seguem pendentes | Revisão solo; banco QA local indisponível e aceite runtime/visual continua aberto |
| 4 Envios, cronograma, calendário, Aprender, Personalização | IN PROGRESS — atividades dinâmicas no Aprender, Planejamento e `.ics` | `de28514` integra o feed; `e421563` integra a projeção de prazos com intervalo e disponibilidade. Bundle `learning` em 208,6 KiB gzip/16 chunks e `planner` em 222,9 KiB/17 chunks. Destaques, envios configuráveis, paginação/estado completo, liberações, encontros/eventos de turma, cronograma e personalização continuam sem aceite | Revisão solo do código e testes; sem PostgreSQL QA, jornada autenticada ou comparação visual |
| 5 Alunos e correções | IN PROGRESS — fila e feedback parciais; acompanhamento, perfil e aceite pendentes | Fila paginada com escopo por papel/turma, rubrica ponderada 0–10, rascunho separado do feedback enviado, controle de versão da entrega e outbox de notificação na transação; código `111e554`. 473 testes do app, gates estáticos e build completo (8 tarefas) passaram | Revisão solo da regra; sem migração aplicada, jornada autenticada ou comparação visual |
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
- [ ] `GTurmaCalendario` — Turma — encontros e calendário (o que os alunos veem)
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
- [ ] `GPercursos` — Ensino — percursos (organizar cursos em uma jornada)
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
| Runtime local e migration da Fase 2 | Serviço `com.docker.service` parado; iniciar o Docker Desktop não criou o pipe Linux; `127.0.0.1:5432` sem listener. Não usei banco remoto. | Disponibilizar Supabase/Postgres local, aplicar a migration aditiva, rodar fixtures explícitas e validar persistência/autorização com os papéis de QA. |
| Visual e jornadas autenticadas | A aplicação local depende do banco; a única aba autenticada disponível aponta para Production e foi consultada somente para leitura. | Abrir o app local com contas de QA, comparar PNGs nos tamanhos do aceite e percorrer os fluxos reais. |
| Integrações externas da Fase 3 | Nenhuma chave real do YouTube nem Storage local configurados; não criei credenciais fictícias. | Configurar serviços de QA para validar estados reais do YouTube, uploads e playback quando esses módulos forem implementados. |
| Editor de aula/YouTube | Migration `20261012130000_lesson_youtube_metadata` não aplicada; PostgreSQL, Storage e chave de API de QA indisponíveis. A comparação do quadro 49 ainda não foi executada. | Aplicar somente em banco local/QA; provar salvamento após recarga, autorização, publicação com respostas reais, upload privado e progresso assistido; comparar o quadro desktop e os tamanhos responsivos. |
| Playback Y7 | Migration aditiva `20261012143000_playback_watch_intervals` não aplicada; sem PostgreSQL QA ou vídeo de teste autenticado. | Provar persistência de intervalos, seek e pausa, retomada, duas abas concorrentes, conclusão aos 90%, assignment/badge e regressões de gravações após aplicar em banco local/QA. |
| Atividades da Fase 3 | Não há PostgreSQL QA local ativo; migration `20261012100000_activity_cohort_targets_rubrics` não foi aplicada. | Aplicar somente em banco QA local, testar submissões, progresso, concorrência, notificações e jornadas autenticadas; comparar os quadros `GAtividades`/`GAtividade`. |
| Revisão de atividades / Fase 5 | Migration `20261012120000_activity_review_drafts` ainda não aplicada; nenhum PostgreSQL QA local ativo. | Validar criação/edição concorrente de rascunhos, envio de rubrica, isolamento professor/turma, outbox e feedback no aluno após persistência; comparar os quadros desktop/tablet/mobile. |
| Biblioteca / Fase 3 | Não há PostgreSQL nem Storage QA local ativo; a única aba autenticada é Production e foi mantida em leitura. A comparação dos PNGs 59–61 não foi executada. | Percorrer CRUD, filtros, ações em lote, publicação e upload privado com papéis de QA; comparar quadros em cada dimensão; validar upload de capa da Biblioteca. |
| Coleções / Fase 3 | Não há PostgreSQL nem Storage QA local ativo; os quadros 62–63 não foram comparados com a aplicação em execução. Não houve escrita em Supabase remoto. | Validar CRUD, recursos, publicação, capas e autorização com contas de QA; confirmar persistência após recarga/segunda sessão e comparar desktop/mobile nos quadros 62–63. |
| Importação de playlist / Fase 3 | Não há PostgreSQL QA local ativo nem chave real do YouTube; o quadro 51 ainda não foi comparado em navegador autenticado. O código não adiciona migration. | Em QA local, testar listas paginadas, vídeos privados/não encontrados/não incorporáveis, importação de rascunho/publicada, replay/conflicto da chave, notificação após commit e autorização; comparar desktop/mobile do quadro 51. |
| Feed de atividades no Aprender | A consulta depende de `ActivityCohortTarget` e da migration `20261012100000_activity_cohort_targets_rubrics`, ainda não aplicada em PostgreSQL local. Nenhum login de QA nem PNG foi validado. | Aplicar somente em banco local; percorrer T2/T3/T7/E2 com duas contas e reload; verificar acesso direto/negação no servidor e comparar `GAprenderAluno`/`GMAprender` nas seis larguras. |

## Controles removidos por não terem função
Nenhum removido nesta unidade. A varredura integral de controles fica pendente para o aceite final.

## Notas e problemas abertos
- Fase 1 permanece `IN PROGRESS` até QA autenticado e comparação visual; nenhuma referência foi marcada como concluída.
- Fase 2 tem código local e migration versionada, mas a migration não foi aplicada a banco algum; não há evidência de persistência até a execução do QA local.
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
