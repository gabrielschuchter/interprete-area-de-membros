# PROGRESS · Gestão do Interprete

> Diário de execução. **Atualize a cada unidade concluída**, com evidência. Releia ao começar e depois de qualquer compactação de contexto. Estado confiável = este arquivo + o Git.

## Estado geral
- Branch: `gestao-v2`
- Fase atual: 3 — Ensino (cursos, exercícios, atividades, Biblioteca e coleções parciais; YouTube/aulas, percursos e aceite visual/runtime pendentes)
- Último commit de implementação verificado: `d72c391` (editor de aula e publicação YouTube; unidade parcial)
- Orçamento/contexto: (preencher se relevante)

## Fases
| Fase | Estado | Evidência (testes, commit) | Verificação independente |
|---|---|---|---|
| 0 Auditoria | concluída | `docs/gestao-auditoria.md`; 101 pares HTML/PNG inventariados e revistos em pranchas; matriz 1:1 gerada; commit `ffbb93e`; nenhum código/migration alterado | releitura dos critérios e conferência solo; sem subagente por instrução direta para trabalhar sozinho |
| 1 Shell, permissões, rotas, transição | IN PROGRESS — aceite visual/runtime pendente | Shell responsivo desktop/trilho/gaveta; flag `GESTAO_V2_ENABLED` false por padrão; mapa de ações por papel e retorno interno seguro; 20 testes focados e gates locais registrados no commit `1d04e5a` | Revisão solo dos critérios; comparações visuais e jornada autenticada ainda pendentes, portanto os quadros permanecem abertos |
| 2 Turmas e resolvers | IN PROGRESS | Modelos e migration aditiva; autorização por papel/turma; CRUD de turmas, responsáveis, matrículas, convites, cursos e liberações; regras de acesso e 24 testes focados. `check`, `typecheck`, `boundaries`, `test`, `build`, `performance:check`, `git diff --check` e `prisma validate` passaram; commit de código `c151c9b`, registro atualizado em `9a5c3c6`. Migration não aplicada: PostgreSQL local indisponível. `resolveStudentFeed` e `resolveCalendar` continuam pendentes | Revisão solo das regras; persistência local, fluxos autenticados e comparação visual pendentes |
| 3 Ensino (YouTube, atividades, exercícios, biblioteca, coleções) | IN PROGRESS — editor de aula/YouTube parcialmente implementados; importação de playlist, upload, percursos e aceite visual/runtime pendentes | Cursos (`343d5ad`) e exercícios (`fdac802`) seguem com os checkpoints anteriores. Atividades (`9cfa4a6`) e correções (`111e554`) mantêm catálogo SQL, alvos de turma, rubricas versionadas e fila/feedback. Biblioteca (`2e823ec`): catálogo SQL paginado de 24, filtros, lista/grade, seleção e ações em lote até 100, editor com validação por campo, idempotência, estado inicial de rascunho e upload privado de arquivo existente. Coleções (`8fce0f9`): catálogo SQL com filtros e 24 por página, editor/ordenação/recursos/capas, prévia sem escrita de progresso, idempotência e controle otimista de versão; reutiliza `ContentCollection`/`ContentCollectionItem` e Storage existente, sem migration. Editor de aula/YouTube (`d72c391`): tela de edição, verificação por API/adaptador de desenvolvimento, metadados aditivos e publicação revalidada no servidor. `check` (822 arquivos), `typecheck` (16 tarefas), `boundaries` (769 arquivos), `test` (502 app, 17 domínio, 9 API; scripts 27 passaram e 1 harness aposentado ignorado), `build` (8 tarefas), `performance:check` e `git diff --check` passaram; editor medido em 218,1 KiB gzip / 17 chunks, sob o limite 225 KiB. PostgreSQL QA autenticado e comparação visual seguem pendentes | Revisão solo; banco QA local indisponível e aceite runtime/visual continua aberto |
| 4 Envios, cronograma, calendário, Aprender, Personalização | pendente | | |
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
- [ ] `GAprenderAluno` — O que o aluno vê em Aprender (pendências, destaques e padrão)
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
- [ ] `GYTImport` — Vídeo do YouTube — importar uma lista de reprodução como aulas
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
| Atividades da Fase 3 | Não há PostgreSQL QA local ativo; migration `20261012100000_activity_cohort_targets_rubrics` não foi aplicada. | Aplicar somente em banco QA local, testar submissões, progresso, concorrência, notificações e jornadas autenticadas; comparar os quadros `GAtividades`/`GAtividade`. |
| Revisão de atividades / Fase 5 | Migration `20261012120000_activity_review_drafts` ainda não aplicada; nenhum PostgreSQL QA local ativo. | Validar criação/edição concorrente de rascunhos, envio de rubrica, isolamento professor/turma, outbox e feedback no aluno após persistência; comparar os quadros desktop/tablet/mobile. |
| Biblioteca / Fase 3 | Não há PostgreSQL nem Storage QA local ativo; a única aba autenticada é Production e foi mantida em leitura. A comparação dos PNGs 59–61 não foi executada. | Percorrer CRUD, filtros, ações em lote, publicação e upload privado com papéis de QA; comparar quadros em cada dimensão; validar upload de capa da Biblioteca. |
| Coleções / Fase 3 | Não há PostgreSQL nem Storage QA local ativo; os quadros 62–63 não foram comparados com a aplicação em execução. Não houve escrita em Supabase remoto. | Validar CRUD, recursos, publicação, capas e autorização com contas de QA; confirmar persistência após recarga/segunda sessão e comparar desktop/mobile nos quadros 62–63. |

## Controles removidos por não terem função
Nenhum removido nesta unidade. A varredura integral de controles fica pendente para o aceite final.

## Notas e problemas abertos
- Fase 1 permanece `IN PROGRESS` até QA autenticado e comparação visual; nenhuma referência foi marcada como concluída.
- Fase 2 tem código local e migration versionada, mas a migration não foi aplicada a banco algum; não há evidência de persistência até a execução do QA local.
- Fechar `resolveStudentFeed` e `resolveCalendar` e integrar os resolvers às telas do aluno/Planejamento na sequência prevista.
- A unidade de cursos entrega o catálogo e entrada para criação/edição. A unidade de exercícios acrescenta catálogo, bancos/listas, editor de questão, reutilização versionada e reordenação; não substitui ainda o aceite visual, autenticação em runtime ou persistência em QA.
- Atividades (`9cfa4a6`): catálogo SQL paginado, editor com rubrica versionada, prazo, turmas/indivíduos e prévia sem escrita de progresso; alvos de turma mantêm acesso dinâmico com revogação por origem. `check` (777 arquivos), `typecheck` (16 tarefas), `boundaries` (724 arquivos), `test` (466 app, 17 domínio, 9 API; scripts 27 passaram e 1 harness aposentado foi ignorado), `build` (8 tarefas e novas rotas), `performance:check`, `prisma validate` e `git diff --check` passaram. A rota mede 212,3 KiB gzip em 17 chunks / limite 225 KiB. Ainda faltam migration aplicada em PostgreSQL QA, prova persistente/autenticada, comparação PNG, fila de entregas/correções, criação de progresso sob demanda e avisos a membros que entrarem depois em `ALL_ACTIVE`.
- Correções (`111e554`): entregas por atividade com fila paginada, projeção mínima e escopo renovado no servidor; respostas com rubrica ponderada, rascunho independente, versão otimista e envio explícito. Entrega preserva a rubrica usada; comentário e todas as notas são obrigatórios no envio; média ponderada é informativa. Migration `20261012120000_activity_review_drafts` somente versionada; persistência real e notificações ainda precisam de QA local.
- Biblioteca (`2e823ec`): usa `LibraryItem` e ações/Storage existentes, sem migration. O catálogo filtra no banco e seleciona 24 por página; a edição valida por campo, mantém o vínculo de arquivo privado em alterações de metadados, e novos itens começam como rascunho. Ações em lote limitam 100 itens e inclusão em coleção usa transação serializável. Medição da rota: 214,2 KiB gzip / 17 chunks. O editor aceita link HTTP(S), capa por URL HTTPS e arquivos PDF/JPG/PNG/WebP/texto até 20 MB. Não há prova de persistência autenticada, disponibilidade do Storage, comparação visual ou upload de capa da Biblioteca.
- Coleções (unidade implementada nesta tranche): reutiliza `ContentCollection`, `ContentCollectionItem`, autorização `content.manage` e Storage privado existente. Catálogo usa filtros SQL e 24 itens por página; editor busca recursos em páginas limitadas, oferece ordenação por botões acessíveis e cobre CRUD, rascunho/publicação/agendamento/arquivamento, capa e prévia sem efeitos colaterais no aluno. Escritas usam versão/idempotência, transação e auditoria; conflitos de adição/remoção abortam a transação. Capas privadas só são lidas pelo proprietário enquanto rascunho ou por membros autorizados quando referenciadas em coleção publicada e dentro da vigência. Não houve migration. `check` (810 arquivos), `typecheck` (16 tarefas), `boundaries` (757 arquivos), `test` (490 app, 17 domínio, 9 API; scripts 27 passaram e 1 harness aposentado ignorado), `build` (8 tarefas), `performance:check` e `git diff --check` passaram. As rotas catalog/editor/prévia mediram 213,9/218,5/211,9 KiB gzip (17/17/16 chunks), sob 225 KiB. A validação de build usou apenas `SKIP_ENV_VALIDATION=true` e URL local; não abriu conexão nem gravou no banco. Persistência/autorização autenticada, teste visual dos quadros 62–63, concorrência no PostgreSQL QA e upload real permanecem sem prova.
- Editor de aula/YouTube (quadro 49, commit `d72c391`, unidade em andamento): adiciona rota `content.manage`, editor versionado de metadados/conteúdo, vínculo de materiais, verificação de URL pelo YouTube Data API v3 com adaptador determinístico somente em desenvolvimento, prévia com o player existente sem progresso e metadados em colunas aditivas. Publicação revalida no servidor e aceita apenas vídeos públicos ou não listados que permitam incorporação; status/asset são atualizados com versão otimista, chave de idempotência e transação. A ação de publicação legada também revalida YouTube para impedir bypass por chamada direta. Testes focados: 12 passaram; suíte: 502 testes app, 17 domínio, 9 API e 27 scripts (1 harness aposentado ignorado); `check` 822 arquivos, `typecheck` 16 tarefas, `boundaries` 769 arquivos e `prisma validate` passaram. `build` (8 tarefas) passou com `SKIP_ENV_VALIDATION=true` e URL local, sem conexão ou escrita no banco; `performance:check` mediu 218,1 KiB gzip/17 chunks frente ao limite de 225 KiB. Migration `20261012130000_lesson_youtube_metadata` está versionada e não aplicada. Sem PostgreSQL, Storage ou chave YouTube de QA, persistência, upload até 500 MB, playback real/Y7, integração real, jornadas autenticadas e comparação visual seguem sem evidência.
- O catálogo de exercícios mantém a projeção inicial limitada (18 bancos, até 20 listas por banco, 200 bancos no seletor de nova lista e 100 categorias/questões reutilizáveis). A navegação completa em acervos maiores e os percursos de paginação desses seletores precisam ser ampliados antes do aceite integral.
- As referências `GCursos` e `GCurso` seguem `[~]`: o checklist de oito critérios exige jornada autenticada, captura comparada e teste de fluxo persistido, ainda indisponíveis.
- Sem alteração de Production, de Supabase remoto ou de notificações externas.
