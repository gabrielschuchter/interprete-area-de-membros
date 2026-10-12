# Interprete · Gestão — Handoff de implementação

> **Leia isto antes de tudo.** Este pacote descreve a **Gestão** (o antigo "Painel do Professor", agora um ambiente único para professores e administradores) e as telas do aluno que dependem dela. **O resultado final precisa ser visualmente idêntico aos quadros e funcionar de ponta a ponta.** Os quadros são desenhos: muitas coisas neles **ainda não existem no sistema**. Implementar só a aparência é falha. Esta documentação diz **como cada coisa deve funcionar**.

## 1. O critério de "pronto"

Uma tela só está pronta quando **as duas** condições são verdadeiras:

1. **Idêntica ao quadro** (medidas, cores, tipografia, espaçamentos, estados, responsividade).
2. **Funcionando de verdade:** cada botão, filtro, campo e menu executa a ação descrita em `docs/03`, **grava no banco**, valida **no servidor**, respeita permissões, mostra os estados de carregando/vazio/erro/sem permissão e gera auditoria e notificações quando previsto.

Um controle que não faz nada **não é aceitável**: implemente a função ou remova o controle (e avise).

## 2. Regras para quem executa (não negociáveis)

1. **Não faça mock.** Nomes, números e "Dados de exemplo" dos quadros são ilustrativos. Em produção, tudo vem do banco. *Seeds* existem só em desenvolvimento.
2. **Audite antes de construir.** O repositório já tem cursos, aulas, atividades, entregas, encontros, avisos, medalhas, gravações históricas e acessos. **Reutilize e estenda.** Nunca remodele dados existentes para caber nos nomes deste pacote.
3. **Migrations somente aditivas e somente com autorização explícita.** Nada remoto, nada destrutivo, nenhum *backfill* sem aprovação.
4. **Autorização no servidor em toda rota, ação e consulta.** A interface só reflete. Professor não pode alcançar dado administrativo nem por URL direta.
5. **Uma fonte da verdade** para "o que o aluno recebe", "acesso efetivo" e "calendário" (`docs/01 §4`, `docs/02 §1`). Nunca recalcule na interface.
6. **Turma é o eixo.** Todo envio, encontro, aviso, atividade e acesso escolhe **turma primeiro**, com alunos individuais como exceção (`docs/01 §3`).
7. **Rascunho antes de publicar**, autosave nos editores, **arquivar antes de excluir**, "Desfazer" onde possível, nenhuma exclusão silenciosa.
8. **Nunca desenhe os símbolos das medalhas.** Eles existem. O sistema precisa permitir **trocar** cada símbolo por upload; os símbolos dos quadros são placeholders (`docs/01 §8`).
9. **Vídeo do YouTube é "não listado", não "seguro".** Não prometa proteção que não existe (`docs/01 §7`).
10. **Mobile e acessibilidade fazem parte do "pronto"** (`docs/04 §7–8`). Nada de barra horizontal de navegação no celular.
11. **Movimento:** só `opacity` e `transform`, com versão reduzida; transições conforme `docs/04 §2`.
12. **Não decida sozinho** o que está em "Decisões pendentes" (§6). Apresente opções e aguarde.
13. Preserve `.git`/next-forge, Bun, Clerk (UI customizada e proxy same-origin `/__clerk`), Supabase PostgreSQL e a autorização existente. Não troque provedor de autenticação. Não adicione Neon. Trabalhe em **branch isolada**; nada de release, Production ou *push* forçado.
14. **Não declare sucesso sem verificar.** Diga exatamente o que ficou sem verificar.

## 3. O que é este produto (visão macro)

- A **Gestão** é uma organizadora **no-code** da plataforma: o professor monta a experiência do aluno com ações simples (criar curso, liberar à turma, atribuir, destacar, criar encontro, enviar aviso) e **vê o resultado antes de publicar** (Ver como aluno).
- O aluno entra em **Aprender** e vê: **Pendências da turma** (o que a equipe atribuiu), **Em destaque** (o que a equipe "jogou" para ele ver, com recado do professor) e a **experiência padrão** (continuar de onde parou, todos os cursos).
- **Turmas** organizam o ensino. Quem está na turma recebe os mesmos cursos, atividades, encontros, avisos e calendário; é possível enviar algo só a alguns.
- **Vídeos** das aulas vêm do **YouTube (não listado)** ou de upload próprio; a plataforma verifica e reproduz dentro do Interprete.
- **Medalhas** são um **museu**: o símbolo é o protagonista e é trocável.
- **Entrar e sair da Gestão** é uma **transição** deliberada (barra lateral muda de contexto), com estados de falha tratados.

Mapa das áreas (cinco entradas na barra lateral): **Visão geral · Ensino · Alunos · Comunidade · Administração** (Administração com cadeado para professor).

## 4. Ordem de leitura

1. Este arquivo.
2. `docs/01-produto-e-regras.md` — **o que o sistema faz** (turmas, envios, calendário, YouTube, medalhas, permissões).
3. `docs/02-arquitetura-e-dados.md` — modelo de dados proposto, ações, jobs, uploads, YouTube técnico, segurança.
4. `docs/03-telas-e-funcoes.md` — **tela por tela**: funções, validações, estados e "pronto quando".
5. `docs/04-estados-transicoes-e-responsividade.md` — transição, máquina de estados, interrupções, interações, breakpoints, acessibilidade.
6. `docs/05-testes-de-aceite.md` — cenários que precisam passar.
7. `docs/06-prompt-codex.md` — prompt de execução em fases.
8. `data/routes.json`, `data/permissions.json`, `data/events.json` — dados estruturados.
9. `html/` (cada quadro como HTML, para extrair medidas e cores pelo **código**) e `referencia-png/` (capturas). O canvas interativo tem os mesmos quadros.

Também existem, de entregas anteriores, os pacotes aprovados de **navegação da área de membros**, **Exercícios**, **Biblioteca**, **Comunidade** e **Perfil**. Esta Gestão **não os altera**; ela se integra a eles (item "Gestão" no menu, telas do aluno em Aprender e museu de medalhas).

## 5. Fases sugeridas (cada uma atrás de flag e reversível)

| Fase | Entrega | Depende de |
|---|---|---|
| 0 | **Auditoria só leitura** do repositório; relatório com evidências; lista de lacunas e decisões | — |
| 1 | Shell da Gestão, permissões (`authorize`), rotas, redirecionamentos `/professor/*`, item "Gestão", transição e estados de entrada | 0 |
| 2 | **Turmas** (modelo, CRUD, membros, convites, CSV, regras de entrada/saída) e `resolveStudentFeed`/`resolveAccess` | 1 |
| 3 | Ensino: cursos/aulas com **YouTube** (verificação, importação, job diário), atividades com critérios, exercícios, biblioteca, coleções | 2 |
| 4 | **Envios** (destaque, pendência, aviso), cronograma e **calendário da turma**, Aprender do aluno (pendências, destaques, padrão), Personalização | 2, 3 |
| 5 | Alunos: acompanhamento, perfil, **correções** com rubrica e feedback | 3 |
| 6 | Comunidade: moderação, grupos, avisos, encontros (com gravação do YouTube) | 2 |
| 7 | Administração: membros e papéis, acessos com origem, gravações históricas, integrações, **medalhas (museu)** com troca de símbolo, auditoria | 1 |
| 8 | Notificações, busca, "Ver como aluno", boas-vindas, interrupções (conflito, sessão, offline) | 2–7 |
| 9 | Responsividade completa, acessibilidade, desempenho, QA ponta a ponta, documentação | todas |

## 6. Decisões pendentes (o executor **não decide sozinho**)

1. **Um aluno em mais de uma turma?** Os quadros assumem que **sim**. Se não, simplifica as regras.
2. **Quem entra depois:** padrão `ALL_ACTIVE`. Confirmar.
3. **Escopo do professor:** vê só as turmas em que é responsável (admin vê todas). Confirmar.
4. **YouTube:** com ou sem conexão do canal (OAuth)? Sem conexão, vídeo privado e "não encontrado" são indistinguíveis (`docs/02 §7`).
5. **Conclusão de pendência:** regra de 90% do vídeo e demais sinais automáticos. Confirmar.
6. **Recorrência** de eventos e tarefas: modelo (RRULE) e exceções.
7. **Notificações:** canais (interno, e-mail, push) e preferências; avisos continuam **sem e-mail** nesta fase.
8. **Nota/rubrica:** os pesos viram nota numérica? Escala?
9. **Matricular alunos existentes:** criar uma turma inicial e matricular? **Somente se o produto aprovar.**
10. **Limite de destaques visíveis** (assumido: 3) e o que acontece ao remover um aluno da turma com envios individuais pendentes (assumido: mantém).
11. **Medalhas:** símbolo padrão quando não houver arquivo (assumido: placeholder neutro) e critérios mensuráveis que alimentam a barra de progresso do aluno.
12. **Notas e tarefas pessoais** entram nos Salvos? (fora do escopo deste pacote.)

## 7. O que os quadros mostram e o que isso **não** significa

- Rótulos como "Dados de exemplo", números e nomes são fictícios.
- Os **símbolos das medalhas** são placeholders desenhados só para o mockup.
- O `GCobertura` lista o que tem tela própria e o que "segue o padrão"; telas "seguem o padrão" **não são opcionais**, apenas não têm quadro dedicado.
- O calendário antigo de Encontros **não foi fornecido ao design**; o do quadro é uma reconstrução. Revise contra o original.
- Rotas e nomes de tabela são **propostas**; alinhe com as convenções reais do repositório.

## 8. Índice dos quadros

| Quadro | Arquivo HTML / PNG | Grupo | Descrição | Largura |
|---|---|---|---|---|
| `GDiagnostico` | `01-diagnostico-o-que-esta-errado-hoje-12-achados` | Diagnóstico, regras e arquitetura | Diagnóstico — o que está errado hoje (12 achados) | 1440 |
| `GProposta` | `02-critica-da-proposta-recebida-mantive-mudei-faltava` | Diagnóstico, regras e arquitetura | Crítica da proposta recebida (mantive, mudei, faltava) | 1440 |
| `GMapa` | `03-de-16-abas-para-5-areas-onde-cada-funcao-vai` | Diagnóstico, regras e arquitetura | De 16 abas para 5 áreas (onde cada função vai) | 1500 |
| `GPermissoes` | `04-permissoes-e-estados-de-acesso` | Diagnóstico, regras e arquitetura | Permissões e estados de acesso | 1440 |
| `GRegrasTurma` | `05-turmas-grupos-de-estudo-acessos-e-atribuicoes-as-regras` | Diagnóstico, regras e arquitetura | Turmas, grupos de estudo, acessos e atribuições: as regras | 1440 |
| `GGestaoNoAluno` | `06-o-que-cada-acao-da-gestao-faz-na-tela-do-aluno` | Diagnóstico, regras e arquitetura | O que cada ação da Gestão faz na tela do aluno | 1440 |
| `GFluxos` | `07-fluxos-de-referencia-a-a-e` | Diagnóstico, regras e arquitetura | Fluxos de referência (A a E) | 1440 |
| `GRotas` | `08-rotas-da-gestao-e-redirecionamentos` | Diagnóstico, regras e arquitetura | Rotas da Gestão e redirecionamentos | 1440 |
| `GPadroes` | `09-padroes-de-formulario-hoje-e-proposta` | Diagnóstico, regras e arquitetura | Padrões de formulário: hoje e proposta | 1440 |
| `GEstados` | `10-estados-confirmacoes-e-salvamento` | Diagnóstico, regras e arquitetura | Estados, confirmações e salvamento | 1440 |
| `GCobertura` | `11-cobertura-de-telas-estados-e-dispositivos` | Diagnóstico, regras e arquitetura | Cobertura de telas, estados e dispositivos | 1440 |
| `GBreakpoints` | `12-pontos-de-quebra-como-a-gestao-se-adapta` | Diagnóstico, regras e arquitetura | Pontos de quebra: como a Gestão se adapta | 1440 |
| `GChegada` | `13-como-se-chega-a-gestao-e-como-se-volta` | Como se chega à Gestão e as transições | Como se chega à Gestão e como se volta | 1500 |
| `GEntrada` | `14-o-item-gestao-na-area-de-membros-professor-e-membro-comu` | Como se chega à Gestão e as transições | O item “Gestão” na área de membros (professor e membro comum) | 1440 |
| `GTransicao` | `15-transicao-area-de-membros-para-a-gestao-desktop` | Como se chega à Gestão e as transições | Transição — área de membros para a Gestão (desktop) | 1440 |
| `GTransicaoEstados` | `16-transicoes-estados-gatilhos-e-respostas-entrar-sair-falh` | Como se chega à Gestão e as transições | Transições: estados, gatilhos e respostas (entrar, sair, falhar) | 1500 |
| `GTransicaoMobile` | `17-transicao-area-de-membros-para-a-gestao-celular` | Como se chega à Gestão e as transições | Transição — área de membros para a Gestão (celular) | 1000 |
| `GAulaAluno` | `18-atalho-editar-na-gestao-na-pagina-que-o-aluno-tambem-ve` | Como se chega à Gestão e as transições | Atalho “Editar na Gestão” na página que o aluno também vê | 1440 |
| `GVerComoAluno` | `19-ver-como-aluno-previa-com-a-barra-de-contexto` | Como se chega à Gestão e as transições | Ver como aluno (prévia com a barra de contexto) | 1440 |
| `GBoasVindas` | `20-primeiro-acesso-a-gestao-boas-vindas` | Como se chega à Gestão e as transições | Primeiro acesso à Gestão (boas-vindas) | 1440 |
| `GInteracoes` | `21-respostas-as-interacoes-e-estados-dos-componentes` | Como se chega à Gestão e as transições | Respostas às interações e estados dos componentes | 1440 |
| `GInterrupcoes` | `22-interrupcoes-salvar-sessao-conflito-permissao-e-rede` | Como se chega à Gestão e as transições | Interrupções: salvar, sessão, conflito, permissão e rede | 1440 |
| `Main` | `23-visao-geral-professor` | Shell e visão geral | Visão geral — professor | 1440 |
| `GVisaoAdmin` | `24-visao-geral-administrador` | Shell e visão geral | Visão geral — administrador | 1440 |
| `GVisaoLimpa` | `25-visao-geral-sem-pendencias` | Shell e visão geral | Visão geral — sem pendências | 1440 |
| `GCriar` | `26-menu-criar-qualquer-tela` | Shell e visão geral | Menu Criar (qualquer tela) | 1440 |
| `GRestrito` | `27-administracao-acesso-restrito-professor` | Shell e visão geral | Administração — acesso restrito (professor) | 1440 |
| `GNotificacoes` | `28-notificacoes-da-gestao` | Shell e visão geral | Notificações da Gestão | 1440 |
| `GBusca` | `29-busca-da-gestao-alunos-turmas-conteudo` | Shell e visão geral | Busca da Gestão (alunos, turmas, conteúdo) | 1440 |
| `GRail` | `30-notebook-pequeno-1024-px-barra-lateral-recolhida-com-sub` | Shell e visão geral | Notebook pequeno (1024 px): barra lateral recolhida com submenu ao passar o mouse | 1024 |
| `GAprenderAluno` | `31-o-que-o-aluno-ve-em-aprender-pendencias-destaques-e-padr` | O que o aluno vê (resultado das ações) | O que o aluno vê em Aprender (pendências, destaques e padrão) | 1440 |
| `GAprenderPadrao` | `32-aprender-sem-pendencias-nem-destaques-experiencia-padrao` | O que o aluno vê (resultado das ações) | Aprender sem pendências nem destaques (experiência padrão) e turma nova | 1440 |
| `GMAprender` | `33-mobile-aprender-do-aluno` | O que o aluno vê (resultado das ações) | Mobile — Aprender do aluno | 390 |
| `GMedalhasAluno` | `34-o-museu-de-medalhas-que-o-aluno-ve-conquistadas-e-bloque` | O que o aluno vê (resultado das ações) | O museu de medalhas que o aluno vê (conquistadas e bloqueadas) | 1440 |
| `GTurmas` | `35-alunos-turmas` | Turmas | Alunos — turmas | 1440 |
| `GTurma` | `36-turma-visao-geral` | Turmas | Turma — visão geral | 1440 |
| `GTurmaAlunos` | `37-turma-alunos-adicionar-mover-e-remover` | Turmas | Turma — alunos (adicionar, mover e remover) | 1440 |
| `GTurmaAdd` | `38-turma-adicionar-alunos-buscar-importar-ou-convidar` | Turmas | Turma — adicionar alunos (buscar, importar ou convidar) | 1440 |
| `GTurmaRemover` | `39-turma-remover-ou-mover-aluno-consequencias-claras` | Turmas | Turma — remover ou mover aluno (consequências claras) | 1440 |
| `GTurmaCronograma` | `40-turma-conteudo-e-cronograma-liberacao-por-data` | Turmas | Turma — conteúdo e cronograma (liberação por data) | 1440 |
| `GTurmaCalendario` | `41-turma-encontros-e-calendario-o-que-os-alunos-veem` | Turmas | Turma — encontros e calendário (o que os alunos veem) | 1440 |
| `GTurmaAtividades` | `42-turma-atividades-da-turma` | Turmas | Turma — atividades da turma | 1440 |
| `GTurmaAvisos` | `43-turma-avisos-da-turma` | Turmas | Turma — avisos da turma | 1440 |
| `GTurmaNova` | `44-turmas-nova-turma-passo-3-pessoas-e-regra-de-entrada` | Turmas | Turmas — nova turma (passo 3: pessoas e regra de entrada) | 1440 |
| `GTurmaConfig` | `45-turma-configuracoes-regra-de-entrada-duplicar-arquivar` | Turmas | Turma — configurações (regra de entrada, duplicar, arquivar) | 1440 |
| `GCursos` | `46-ensino-cursos-e-percursos` | Ensino | Ensino — cursos e percursos | 1440 |
| `GCurso` | `47-ensino-curso-conteudo-modulos-e-aulas` | Ensino | Ensino — curso: conteúdo, módulos e aulas | 1440 |
| `GCursoTurmas` | `48-ensino-curso-turmas-e-acesso` | Ensino | Ensino — curso: turmas e acesso | 1440 |
| `GAula` | `49-ensino-editor-de-aula-video-do-youtube-nao-listado-ou-ar` | Ensino | Ensino — editor de aula (vídeo do YouTube não listado ou arquivo) | 1440 |
| `GAulaYT` | `50-video-do-youtube-estados-da-verificacao` | Ensino | Vídeo do YouTube — estados da verificação | 1440 |
| `GYTImport` | `51-video-do-youtube-importar-uma-lista-de-reproducao-como-a` | Ensino | Vídeo do YouTube — importar uma lista de reprodução como aulas | 1440 |
| `GPercursos` | `52-ensino-percursos-organizar-cursos-em-uma-jornada` | Ensino | Ensino — percursos (organizar cursos em uma jornada) | 1440 |
| `GExercicios` | `53-ensino-exercicios-bancos-e-listas` | Ensino | Ensino — exercícios: bancos e listas | 1440 |
| `GLista` | `54-ensino-lista-questoes-reutilizar-reordenar` | Ensino | Ensino — lista: questões (reutilizar, reordenar) | 1440 |
| `GQuestao` | `55-ensino-editor-de-questao-versoes-e-referencias` | Ensino | Ensino — editor de questão (versões e referências) | 1440 |
| `GAtividades` | `56-ensino-atividades` | Ensino | Ensino — atividades | 1440 |
| `GAtividade` | `57-ensino-editor-de-atividade-criterios-prazo-destinatarios` | Ensino | Ensino — editor de atividade (critérios, prazo, destinatários) | 1440 |
| `GAtividadeEntregas` | `58-ensino-atividade-entregas-por-turma` | Ensino | Ensino — atividade: entregas por turma | 1440 |
| `GBiblioteca` | `59-ensino-biblioteca-filtros-selecao-e-acoes-em-lote` | Ensino | Ensino — biblioteca (filtros, seleção e ações em lote) | 1440 |
| `GBibliotecaGrade` | `60-ensino-biblioteca-em-grade` | Ensino | Ensino — biblioteca em grade | 1440 |
| `GMaterial` | `61-ensino-novo-material-upload-e-metadados-avancados` | Ensino | Ensino — novo material (upload e metadados avançados) | 1440 |
| `GColecoes` | `62-ensino-colecoes` | Ensino | Ensino — coleções | 1440 |
| `GColecao` | `63-ensino-editor-de-colecao-arrastar-capa-por-upload` | Ensino | Ensino — editor de coleção (arrastar, capa por upload) | 1440 |
| `GAcompanhamento` | `64-alunos-acompanhamento` | Alunos | Alunos — acompanhamento | 1440 |
| `GAluno` | `65-alunos-perfil-pedagogico` | Alunos | Alunos — perfil pedagógico | 1440 |
| `GCorrecoes` | `66-alunos-correcoes-fila-resposta-e-feedback` | Alunos | Alunos — correções (fila, resposta e feedback) | 1440 |
| `GAtribuicoes` | `67-alunos-atribuicoes` | Alunos | Alunos — atribuições | 1440 |
| `GEnviar` | `68-alunos-enviar-ao-aluno-destaque-pendencia-ou-aviso-com-p` | Alunos | Alunos — enviar ao aluno (destaque, pendência ou aviso, com prévia) | 1440 |
| `GDestaques` | `69-alunos-destaques-de-aprender-ordem-periodo-e-turma` | Alunos | Alunos — destaques de Aprender (ordem, período e turma) | 1440 |
| `GNovaAtribuicao` | `70-alunos-nova-atribuicao-4-passos-seletor-de-pessoas` | Alunos | Alunos — nova atribuição (4 passos, seletor de pessoas) | 1440 |
| `GTarefas` | `71-alunos-tarefas-e-metas-coletivas` | Alunos | Alunos — tarefas e metas coletivas | 1440 |
| `GReconhecimento` | `72-alunos-reconhecimento-medalhas-conquistadas` | Alunos | Alunos — reconhecimento (medalhas conquistadas) | 1440 |
| `GPublicacoes` | `73-comunidade-publicacoes-moderacao-sem-rascunhos-privados` | Comunidade | Comunidade — publicações (moderação sem rascunhos privados) | 1440 |
| `GDenuncias` | `74-comunidade-publicacoes-denunciadas` | Comunidade | Comunidade — publicações denunciadas | 1440 |
| `GGrupos` | `75-comunidade-grupos-endereco-automatico-imagem-por-upload` | Comunidade | Comunidade — grupos (endereço automático, imagem por upload) | 1440 |
| `GAvisos` | `76-comunidade-avisos` | Comunidade | Comunidade — avisos | 1440 |
| `GAviso` | `77-comunidade-novo-aviso-seletor-de-publico-sem-ids-digitad` | Comunidade | Comunidade — novo aviso (seletor de público, sem IDs digitados) | 1440 |
| `GEncontros` | `78-comunidade-encontros-agenda-editorial` | Comunidade | Comunidade — encontros (agenda editorial) | 1440 |
| `GEncontro` | `79-comunidade-editor-de-encontro-fuso-repeticao-e-relaciona` | Comunidade | Comunidade — editor de encontro (fuso, repetição e relacionados por seletor) | 1440 |
| `GMembros` | `80-administracao-membros-e-papeis` | Administração | Administração — membros e papéis | 1440 |
| `GMembro` | `81-administracao-membro-papel-capacidades-e-historico` | Administração | Administração — membro (papel, capacidades e histórico) | 1440 |
| `GPapel` | `82-administracao-confirmar-mudanca-de-papel` | Administração | Administração — confirmar mudança de papel | 1440 |
| `GAcessos` | `83-administracao-acessos-origem-de-cada-acesso` | Administração | Administração — acessos (origem de cada acesso) | 1440 |
| `GConceder` | `84-administracao-conceder-acesso-seletor-de-conteudo-em-arv` | Administração | Administração — conceder acesso (seletor de conteúdo em árvore) | 1440 |
| `GGravacoes` | `85-administracao-gravacoes-historicas-um-grupo-por-vez` | Administração | Administração — gravações históricas (um grupo por vez) | 1440 |
| `GPersonalizacao` | `86-administracao-personalizacao-arrastar-previa-e-publicar` | Administração | Administração — personalização (arrastar, prévia e publicar uma vez) | 1440 |
| `GMedalhas` | `87-administracao-medalhas-o-museu-foco-no-simbolo` | Administração | Administração — medalhas: o museu (foco no símbolo) | 1440 |
| `GMedalha` | `88-administracao-medalha-palco-simbolo-e-criterio` | Administração | Administração — medalha: palco, símbolo e critério | 1440 |
| `GIntegracoes` | `89-administracao-integracoes-youtube-e-origem-das-gravacoes` | Administração | Administração — integrações (YouTube e origem das gravações) | 1440 |
| `GAuditoria` | `90-administracao-registro-de-atividades-quem-fez-o-que` | Administração | Administração — registro de atividades (quem fez o quê) | 1440 |
| `GTVisao` | `91-tablet-visao-geral` | Tablet | Tablet — visão geral | 820 |
| `GTCorrecoes` | `92-tablet-correcoes-fila-e-correcao-lado-a-lado` | Tablet | Tablet — correções (fila e correção lado a lado) | 820 |
| `GMMenu` | `93-mobile-menu-de-gestao-gaveta` | Mobile | Mobile — menu de Gestão (gaveta) | 390 |
| `GMVisao` | `94-mobile-visao-geral` | Mobile | Mobile — visão geral | 390 |
| `GMCursos` | `95-mobile-cursos-cartoes-filtros-e-novo-curso` | Mobile | Mobile — cursos (cartões, filtros e novo curso) | 390 |
| `GMCorrecoes` | `96-mobile-correcoes-fila` | Mobile | Mobile — correções (fila) | 390 |
| `GMCorrecao` | `97-mobile-correcao-barra-de-acao-fixa` | Mobile | Mobile — correção (barra de ação fixa) | 390 |
| `GMAviso` | `98-mobile-novo-aviso-formulario-com-barra-fixa` | Mobile | Mobile — novo aviso (formulário com barra fixa) | 390 |
| `GMMembros` | `99-mobile-membros-cartoes-e-folha-de-acoes` | Mobile | Mobile — membros (cartões e folha de ações) | 390 |
| `GMTurmas` | `100-mobile-turmas` | Mobile | Mobile — turmas | 390 |
| `GMTurmaAlunos` | `101-mobile-alunos-da-turma-acoes-em-folha` | Mobile | Mobile — alunos da turma (ações em folha) | 390 |
