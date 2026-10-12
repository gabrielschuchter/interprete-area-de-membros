# PROGRESS · Gestão do Interprete

> Diário de execução. **Atualize a cada unidade concluída**, com evidência. Releia ao começar e depois de qualquer compactação de contexto. Estado confiável = este arquivo + o Git.

## Estado geral
- Branch: `gestao-v2`
- Fase atual: 2 — Turmas e acesso (em andamento; validação de runtime local pendente)
- Último commit verificado: `c151c9b` (fundação de turmas e acesso)
- Orçamento/contexto: (preencher se relevante)

## Fases
| Fase | Estado | Evidência (testes, commit) | Verificação independente |
|---|---|---|---|
| 0 Auditoria | concluída | `docs/gestao-auditoria.md`; 101 pares HTML/PNG inventariados e revistos em pranchas; matriz 1:1 gerada; commit `ffbb93e`; nenhum código/migration alterado | releitura dos critérios e conferência solo; sem subagente por instrução direta para trabalhar sozinho |
| 1 Shell, permissões, rotas, transição | IN PROGRESS — aceite visual/runtime pendente | Shell responsivo desktop/trilho/gaveta; flag `GESTAO_V2_ENABLED` false por padrão; mapa de ações por papel e retorno interno seguro; 20 testes focados e gates locais registrados no commit `1d04e5a` | Revisão solo dos critérios; comparações visuais e jornada autenticada ainda pendentes, portanto os quadros permanecem abertos |
| 2 Turmas e resolvers | IN PROGRESS | Modelos e migration aditiva; autorização por papel/turma; CRUD de turmas, responsáveis, matrículas, convites, cursos e liberações; regras de acesso e 24 testes focados. `check`, `typecheck`, `boundaries`, `test` (449 app + API/domínio/scripts), `build`, `performance:check`, `git diff --check` passaram; `prisma validate` passou; commit `c151c9b`. Migration não aplicada: PostgreSQL local indisponível. `resolveStudentFeed` e `resolveCalendar` continuam pendentes | Revisão solo das regras; persistência local, fluxos autenticados e comparação visual pendentes |
| 3 Ensino (YouTube, atividades, exercícios, biblioteca, coleções) | pendente | | |
| 4 Envios, cronograma, calendário, Aprender, Personalização | pendente | | |
| 5 Alunos e correções | pendente | | |
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
- [ ] `GCursos` — Ensino — cursos e percursos
- [ ] `GCurso` — Ensino — curso: conteúdo, módulos e aulas
- [ ] `GCursoTurmas` — Ensino — curso: turmas e acesso
- [ ] `GAula` — Ensino — editor de aula (vídeo do YouTube não listado ou arquivo)
- [ ] `GAulaYT` — Vídeo do YouTube — estados da verificação
- [ ] `GYTImport` — Vídeo do YouTube — importar uma lista de reprodução como aulas
- [ ] `GPercursos` — Ensino — percursos (organizar cursos em uma jornada)
- [ ] `GExercicios` — Ensino — exercícios: bancos e listas
- [ ] `GLista` — Ensino — lista: questões (reutilizar, reordenar)
- [ ] `GQuestao` — Ensino — editor de questão (versões e referências)
- [ ] `GAtividades` — Ensino — atividades
- [ ] `GAtividade` — Ensino — editor de atividade (critérios, prazo, destinatários)
- [ ] `GAtividadeEntregas` — Ensino — atividade: entregas por turma
- [ ] `GBiblioteca` — Ensino — biblioteca (filtros, seleção e ações em lote)
- [ ] `GBibliotecaGrade` — Ensino — biblioteca em grade
- [ ] `GMaterial` — Ensino — novo material (upload e metadados avançados)
- [ ] `GColecoes` — Ensino — coleções
- [ ] `GColecao` — Ensino — editor de coleção (arrastar, capa por upload)

### Alunos
- [ ] `GAcompanhamento` — Alunos — acompanhamento
- [ ] `GAluno` — Alunos — perfil pedagógico
- [ ] `GCorrecoes` — Alunos — correções (fila, resposta e feedback)
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
- [ ] `GTCorrecoes` — Tablet — correções (fila e correção lado a lado)

### Mobile
- [ ] `GMMenu` — Mobile — menu de Gestão (gaveta)
- [ ] `GMVisao` — Mobile — visão geral
- [ ] `GMCursos` — Mobile — cursos (cartões, filtros e novo curso)
- [ ] `GMCorrecoes` — Mobile — correções (fila)
- [ ] `GMCorrecao` — Mobile — correção (barra de ação fixa)
- [ ] `GMAviso` — Mobile — novo aviso (formulário com barra fixa)
- [ ] `GMMembros` — Mobile — membros (cartões e folha de ações)
- [ ] `GMTurmas` — Mobile — turmas
- [ ] `GMTurmaAlunos` — Mobile — alunos da turma (ações em folha)

## Não verificado / dependências externas
| Item | Motivo | O que falta |
|---|---|---|
| Runtime local e migration da Fase 2 | Serviço `com.docker.service` parado; iniciar o Docker Desktop não criou o pipe Linux; `127.0.0.1:5432` sem listener. Não usei banco remoto. | Disponibilizar Supabase/Postgres local, aplicar a migration aditiva, rodar fixtures explícitas e validar persistência/autorização com os papéis de QA. |
| Visual e jornadas autenticadas | A aplicação local depende do banco; a única aba autenticada disponível aponta para Production e foi consultada somente para leitura. | Abrir o app local com contas de QA, comparar PNGs nos tamanhos do aceite e percorrer os fluxos reais. |

## Controles removidos por não terem função
Nenhum removido nesta unidade. A varredura integral de controles fica pendente para o aceite final.

## Notas e problemas abertos
- Fase 1 permanece `IN PROGRESS` até QA autenticado e comparação visual; nenhuma referência foi marcada como concluída.
- Fase 2 tem código local e migration versionada, mas a migration não foi aplicada a banco algum; não há evidência de persistência até a execução do QA local.
- Fechar `resolveStudentFeed` e `resolveCalendar` e integrar os resolvers às telas do aluno/Planejamento na sequência prevista.
- Sem alteração de Production, de Supabase remoto ou de notificações externas.