# 03 · Telas e funções: o que cada quadro precisa fazer de verdade

**Regra de ouro:** nenhuma tela é "só visual". Cada botão, filtro, menu e campo abaixo precisa executar a função descrita, com persistência real, validação no servidor e os estados listados. Um controle que não faz nada deve ser **removido**, não deixado como enfeite.

Cada tela tem: **Quadro** (nome do arquivo no canvas/HTML), **Rota**, **Funções** (o que cada controle faz), **Validações**, **Estados obrigatórios** e **Pronto quando** (critério de aceite). Estados padrão de toda lista: *carregando (esqueleto), vazio (convite à criação), sem resultados (limpar filtros), erro (tentar de novo), sem permissão*. Toda lista: busca, filtros que **persistem na URL**, ordenação, paginação, ações contextuais.

## A. Shell e visão geral

| Quadro / Rota | Funções | Estados e validações | Pronto quando |
|---|---|---|---|
| **Shell** (todos) `/gestao/*` | Barra lateral Crimson Violet: só a área aberta expande os subitens; **Administração** com cadeado para professor. Rodapé: "Voltar à área de membros" (volta à página de origem) e perfil com chip de papel. Cabeçalho: migalhas, busca (Ctrl K), **Ver como aluno**, **Criar**, sino. | 1280+ completa; 1024–1279 trilho; <1024 gaveta. Foco visível. Migalhas reais da rota. | Muda de área sem recarregar o shell; o item ativo reflete a rota; funciona só por teclado |
| **Criar** `GCriar` | Menu com: Curso, Lista de exercícios, Atividade, Material, Coleção, Atribuição, Aviso, Encontro, Grupo de estudo. Cada item abre a tela de criação **com contexto** (turma do filtro atual, quando houver). | Itens que o usuário não pode criar **não aparecem**. | Cria um rascunho real; Esc fecha; setas navegam |
| **Visão geral** `Main`, `GVisaoAdmin`, `GVisaoLimpa` `/gestao` | Filtro "Todas as minhas turmas" (`?turma=`). "Precisa de atenção" lista **itens acionáveis** reais (entregas a corrigir, atrasos, encontros em rascunho, rascunhos, aulas com vídeo indisponível; admin: solicitações de acesso, gravações sem vínculo); cada botão leva à tela filtrada. Próximos encontros, movimentação recente, números da semana. | "Tudo em dia" quando não houver pendências. Números calculados do banco; sem "exemplo" em produção. Administrador vê o bloco Institucional. | Cada número bate com a lista de destino; clicar leva ao mesmo conjunto |
| **Busca** `GBusca` | Resultados agrupados por tipo, com migalha da origem; ↑↓ navegam, ↵ abre, recentes. | Só o que o usuário pode ver. Vazio: "Nada encontrado para …". | Encontra aluno, turma, atividade, curso/aula, material, aviso, encontro |
| **Notificações** `GNotificacoes` | Lista paginada; "Marcar todas como lidas"; cada item leva ao objeto. | Não lidas em destaque; vazio: "Nada novo". | Gatilhos de `data/events.json` criam itens reais |
| **Acesso restrito** `GRestrito` | Mostra o estado e os dois botões. **Não consulta dados da área.** | Servidor retorna 403 sem payload. | Professor não vê nenhum dado administrativo, nem por URL direta |
| **Boas-vindas** `GBoasVindas` | Aparece **uma vez** por usuário no primeiro acesso; "Não mostrar de novo". Registra em preferências. | — | Não reaparece depois de dispensado |
| **Ver como aluno** `GVerComoAluno` `/gestao/previa` | Renderiza as rotas de membro com a barra de prévia. "Trocar": aluno da turma X / aluno específico / aluno novo sem turma. Usa `resolveStudentFeed` do contexto escolhido. **Somente leitura:** nenhuma ação grava dados do aluno. | Sair da prévia volta ao ponto da Gestão. | Nenhuma escrita acontece em modo prévia (bloquear no servidor) |

## B. Turmas

| Quadro / Rota | Funções | Estados e validações | Pronto quando |
|---|---|---|---|
| **Turmas** `GTurmas` `/alunos/turmas` | Cartões/lista; abas Ativas, Não iniciadas, Encerradas, Arquivadas; menu ⋯ (Editar, Duplicar, Arquivar); aviso "N alunos sem turma" com "Atribuir a uma turma". Importar turma de planilha. | Status derivado das datas. Professor vê só as suas. | Contagens (alunos, cursos, encontros) reais |
| **Nova turma** `GTurmaNova` | 3 passos: Dados → Conteúdo → Pessoas (responsáveis, como entram os alunos, **regra de quem entra depois**). Cria a turma e, se escolhido, libera cursos. | Nome único; fim > início; ao menos um responsável. Salvar parcial = rascunho. | A turma criada aparece em Turmas e nos filtros |
| **Turma › Visão geral** `GTurma` | Números reais, "Esta semana na turma", alunos que pedem atenção (regra: sem estudar ≥ 5 dias, inativo ≥ 21 dias, entregas atrasadas), "Quem recebe o quê", responsáveis. | — | "Alunos que pedem atenção" usa a mesma regra do Acompanhamento |
| **Turma › Alunos** `GTurmaAlunos` | Busca, filtro de situação; **Adicionar alunos**; **Importar planilha**; **Convidar por link**; seleção em lote: Mover, Enviar aviso, Remover; convites pendentes (reenviar, cancelar). | Não duplicar aluno na turma. Seleção em lote mostra o total. | Remover/mover aplicam as regras da seção 3 de `01` |
| **Adicionar alunos** `GTurmaAdd` | 3 caminhos: Membros existentes (busca, marca quem já está em outra turma), Importar planilha (CSV: nome, e-mail; prévia + erros por linha), Convidar (link com validade/limite + e-mails). Resumo "Ao entrar, cada aluno passa a ver…" calculado de verdade; opção incluir encerrados. | E-mail inválido; já na turma; CSV > limite. Convites criam o membro ao aceitar. | O aluno adicionado enxerga o que o resumo prometeu |
| **Remover / mover** `GTurmaRemover` | Opções Remover ou Mover (escolhe turma e mostra prévia); lista de consequências **gerada** das regras reais (cursos perdidos, grants mantidos); "manter leitura por 30 dias". Ação atômica. | Confirmação obrigatória. | Auditoria `cohort.member.removed/moved`; histórico preservado |
| **Turma › Cronograma** `GTurmaCronograma` | Linha do tempo por semana com aulas liberadas, prazos e encontros; mudar data (arrastar ou calendário); **Copiar de outra turma**; **Adicionar à turma**; alternar Cronograma/Cursos liberados. | Datas dentro do período da turma (aviso se fora). | Liberação muda o que o aluno vê no dia (`release-lessons`) |
| **Turma › Calendário** `GTurmaCalendario` | Mês/Semana/Lista; camadas liga/desliga; clique no dia → menu Novo encontro / Prazo / Liberar aula / Evento da turma (formulário com turma e data); **Copiar de outra turma**; assinar `.ics`. Conflitos listados. Rascunhos tracejados. | Não mostra rascunho ao aluno. | O que está aqui é idêntico ao calendário do aluno (menos rascunhos) |
| **Turma › Atividades / Avisos** `GTurmaAtividades`, `GTurmaAvisos` | Listas escopadas à turma; "Nova atividade para esta turma" já nasce atribuída; "Reutilizar de outra turma" (cópia como rascunho); aviso rápido para a turma. | — | Criar aqui = alvo da turma preenchido |
| **Turma › Configurações** `GTurmaConfig` | Dados, política de quem entra depois, encerramento, **Duplicar** (cronograma e atividades como rascunho; nunca alunos), **Arquivar** (confirmação). | Salvar com `version`. | Duplicar não copia alunos |

## C. Ensino

| Quadro / Rota | Funções | Estados e validações | Pronto quando |
|---|---|---|---|
| **Cursos** `GCursos` `/ensino/cursos` | Lista/grade; filtros Estado e Percurso; coluna **Liberado para** (turmas); Novo curso/percurso. | — | A coluna reflete `CourseCohort` |
| **Curso** `GCurso` | Título editável, autosave, estado; árvore de módulos e aulas (**arrastar para ordenar**, adicionar, menu ⋯); checklist "Pronto para publicar?" **calculado**; **Publicar curso** valida o checklist; Prévia como aluno. | Publicar bloqueado se faltar item. | Ordem salva ao soltar; publicar muda o estado e gera `course.published` |
| **Curso › Turmas e acesso** `GCursoTurmas` | Tabela de turmas com Liberação (cronograma/tudo de uma vez); **Liberar para uma turma**; acessos individuais com validade e Revogar; "Aberto a todos". | Revogar atua só sobre o grant. | Liberar cria `CourseCohort` + `AccessGrant(origin=COHORT)` |
| **Aula** `GAula`, `GAulaYT` | Fonte do vídeo: **YouTube** ou **arquivo**. YouTube: colar link → verificação (estados completos), usar título do vídeo, testar como aluno, começar/terminar em, legendas/velocidade. Arquivo: upload com progresso. Descrição (TipTap), materiais/exercícios/atividades **vinculados** (não copiados). Quem vê. Publicação: agora/agendar. | Estados do YouTube conforme `01 §7`. Publicar bloqueado com vídeo inválido. | Aula publicada toca no player do aluno; vídeo indisponível dispara o alerta |
| **Importar lista** `GYTImport` | Cola a lista, lista os vídeos com visibilidade, seleciona, escolhe módulo e estado, usa título do vídeo. | Privado não importável; público importa com aviso. | Cria as aulas na ordem da lista |
| **Percursos** `GPercursos` | Criar/editar percurso, ordenar cursos por arrastar, capa por upload. | — | Ordem persiste |
| **Exercícios** `GExercicios`, `GLista`, `GQuestao` | Bancos → listas → questões; reutilizar questão; reordenar; editor de questão (formato, alternativas com gabarito, explicação, referências **da Biblioteca**, etiquetas, versões). Publicar **nova versão** quando já respondida. | Versões imutáveis; tentativas ligadas à versão. | Alterar questão respondida nunca altera tentativas antigas |
| **Atividades** `GAtividades`, `GAtividade`, `GAtividadeEntregas` | Lista com entregas e "a corrigir"; editor (pergunta, instruções, formato, **critérios de avaliação** com peso, materiais, prazo, destinatários **turma + individuais**); aba Entregas por turma, "Lembrar a quem não entregou". | Pesos somam 100%; prazo futuro para publicar. | Publicar cria o envio e as pendências |
| **Biblioteca** `GBiblioteca`, `GBibliotecaGrade`, `GMaterial` | Filtros (tipo, categoria, idioma, nível, estado), lista/grade, **seleção em lote** (publicar, arquivar, categoria, coleção), importar curadoria (aditivo, sem duplicar), editor com Link/Arquivo/Referência, **metadados avançados**, aviso de duplicata (mesmo DOI/URL). | DOI/PMID formatados; arquivo ≤ 20 MB. | Importar não duplica; duplicata é detectada |
| **Coleções** `GColecoes`, `GColecao` | Itens de qualquer origem, **arrastar**, adicionar recursos por busca, capa por upload, quem vê, período. | — | Remover tira só da coleção |

## D. Alunos

| Quadro / Rota | Funções | Estados e validações | Pronto quando |
|---|---|---|---|
| **Alunos e acompanhamento** `GAcompanhamento` | Filtros Turma, Curso, Situação; situação **calculada** (regras: Em ritmo, Atenção ≥ 5 dias sem estudar, Inativo ≥ 21 dias); exportar CSV. | Escopo das turmas do professor. | Situação coincide com "pedem atenção" da turma |
| **Perfil pedagógico** `GAluno` | Turma(s), progresso, atribuições abertas, atividades e feedback, exercícios, metas e medalhas, linha do tempo; **Mover de turma**; Atribuir conteúdo. | — | Tudo é do aluno, não agregado genérico |
| **Correções** `GCorrecoes` | Fila (Pendentes/Corrigidas/Todas) com filtro de turma; resposta + contexto; **rubrica** (nota por critério) + comentário rico; **Salvar rascunho**, **Enviar feedback**; anterior/próxima. | Comentário obrigatório para enviar; rubrica completa se existir. | Enviar → entrega vira Corrigida, aluno notificado, abre a próxima da fila |
| **Atribuições e destaques** `GAtribuicoes`, `GDestaques` | Abas Ativas/Agendadas/Encerradas/Destaques; revogar; **destaques**: ordem por arrastar (até 3 visíveis), período, turma, retirar. | Aviso "até 3 por vez". | Reordenar muda Aprender do aluno na hora |
| **Enviar ao aluno** `GEnviar`, `GNovaAtribuicao` | Item + modo (destaque/pendência/aviso) + público (turma + individuais) + recado + período; **prévia ao vivo**; Enviar, Agendar, Salvar rascunho. Comportamento exato em `01 §5`. | Alvos vazios bloqueiam; resumo com nº real de destinatários. | A prévia é idêntica ao que o aluno vê depois de enviar |
| **Tarefas e metas** `GTarefas` | Tarefas (frequência, prazo, turma/individual, progresso "concluíram hoje"); metas coletivas (minutos, período, só agregado). | Meta coletiva sem horas individuais. | Aparece no Planejamento do aluno |
| **Reconhecimento** `GReconhecimento` | Quem conquistou cada medalha (símbolo em destaque), filtros; atalho para configurar. | — | Conquistas vêm de `MedalAward` |

## E. Comunidade

| Quadro / Rota | Funções | Estados e validações | Pronto quando |
|---|---|---|---|
| **Publicações** `GPublicacoes`, `GDenuncias` | Abas Publicadas/Arquivadas/Denunciadas; menu: Abrir, Fixar, Destacar, Arquivar, **Remover…** (confirma e explica); denúncias: Manter, Arquivar (autor avisado), mais. **Rascunhos privados nunca aparecem.** | Remover só após confirmação. | Moderação não expõe rascunho de ninguém |
| **Grupos** `GGrupos` | Criar (nome → **endereço automático**, descrição, imagem por upload, tipo), gerenciar membros, fechar comentários, arquivar. | Endereço único; editar endereço exige confirmação. | Grupo de estudo não concede acesso a conteúdo |
| **Avisos** `GAvisos`, `GAviso` | Editor (título, mensagem, link por **seletor** de destino, público = todos/turmas/pessoas, período, fixar); mostra **destinatários efetivos**; estados Rascunho/Agendado/Publicado/Encerrado. **Sem e-mail** nesta fase. | Fim > início. | Aviso aparece só no período e para o público certo |
| **Encontros** `GEncontros`, `GEncontro` | Agenda editorial; editor com data, início/fim, **fuso por seletor**, **repetição por seletor**, link, relacionados (curso, atividade, leitura) por seletor, participantes (turma + individuais), **gravação por link do YouTube** (verificada). Publicar. "Depois do encontro": gravação, materiais, presença. | Rascunho nunca aparece ao aluno. Recorrência com exceção por ocorrência. | Publicado aparece no calendário da turma e em Comunidade › Encontros |

## F. Administração

| Quadro / Rota | Funções | Estados e validações | Pronto quando |
|---|---|---|---|
| **Membros** `GMembros`, `GMembro`, `GPapel` | Diretório com busca/filtros; coluna Turmas; "Falta o nome" sinaliza conta sem nome; **Alterar papel** com confirmação listando efeitos; capacidades por professor. | Não rebaixar o último admin. | Auditoria `role.changed`; permissão vale na próxima requisição |
| **Acessos** `GAcessos`, `GConceder` | Por membro / por conteúdo; cada acesso mostra **origem** (Turma, Direta, Atribuição, Herdada, Mentoria); **Revogar só a concessão escolhida**; Conceder: membro + conteúdo em **árvore** + validade; mostra o acesso efetivo resultante. | Revogar herdado: orienta onde revogar. | Idempotente: repetir não duplica |
| **Gravações históricas** `GGravacoes` | Lista pesquisável (Sem vínculo / Vinculados / Todos); um grupo por vez: membro, confirmação de identidade, evidência, **Confirmar vínculo**; histórico do grupo. | Evidência obrigatória; sem senhas/tokens. | Vínculo cria `AccessGrant(origin=HISTORICAL)` e registra histórico |
| **Personalização** `GPersonalizacao` | Recursos disponíveis; blocos de **Aprender** (arrastar, liga/desliga, editar texto); nota do portal; **prévia como aluno**; **Descartar** / **Publicar alterações** (barra fixa). | Rascunho ≠ publicado; aviso ao desligar Pendências. | Publicar altera Aprender de todos de uma vez |
| **Medalhas (museu)** `GMedalhas`, `GMedalha`, `GMedalhasAluno` | Museu (símbolo em destaque, tom, conquistas); detalhe com **palco**, **troca de símbolo** por upload (SVG/PNG/WebP), prévia em 120/72/40 px e bloqueada, **histórico de símbolos** com Restaurar; critério versionado. Aluno vê conquistadas acesas e bloqueadas em silhueta com progresso. | Símbolo inválido → erro no campo. | Trocar o símbolo atualiza o museu do aluno sem redeploy |
| **Integrações** `GIntegracoes` | Conectar/trocar/desconectar o canal do YouTube; regras (só não listados, avisar indisponível, verificação diária); permitir upload próprio; cota. | Tokens criptografados. | Mensagens de vídeo privado mudam conforme o modo (com/sem canal) |
| **Registro de atividades** `GAuditoria` | Tabela filtrável (quem, ação, período), exportar CSV. | Somente leitura. | Toda ação de `data/events.json` aparece |

## G. Telas do aluno que dependem da Gestão

| Quadro | O que precisa funcionar |
|---|---|
| `GAprenderAluno`, `GAprenderPadrao`, `GMAprender` | Aprender mostra **Pendências**, **Em destaque** (com recado e foto do professor) e **Todos os cursos**, na ordem definida em Personalização. Sem dados → experiência padrão. Turma nova → mensagem "Sua turma ainda está se preparando". |
| `GMedalhasAluno` | Museu com conquistadas e bloqueadas; progresso real. |
| `GAulaAluno` | Barra do professor ("Editar na Gestão") só para quem tem permissão no curso. |
