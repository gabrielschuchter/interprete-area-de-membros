# 01 · Produto e regras de negócio

Este documento define **o que o sistema faz**, não só como ele parece. Toda regra aqui é um requisito funcional. Se um quadro mostra algo que esta seção não explica, pergunte antes de inventar (veja a seção de decisões em `HANDOFF.md`).

## 1. O que é a Gestão

A Gestão é o ambiente onde professores e administradores **organizam a plataforma sem escrever código**. Ela existe para três coisas:

1. **Montar o que o aluno recebe:** cursos, aulas, atividades, encontros, calendário da turma, tarefas, avisos.
2. **Pôr em evidência:** "jogar" um curso, uma aula, um material ou uma coleção para o aluno ver de forma bem visível.
3. **Acompanhar e administrar:** corrigir, acompanhar, moderar, conceder acesso, configurar medalhas e a aparência.

A experiência do aluno em **Aprender** tem três camadas, nesta ordem:

| Camada | O que é | Quem controla | Fonte de dados |
|---|---|---|---|
| **Pendências da turma** | O que a equipe atribuiu com prazo ou que foi liberado e ainda não foi feito | Professores (Envios do tipo "Pendência com prazo", atividades, liberações por cronograma) | `Delivery(kind=ASSIGNMENT)`, `Activity` com prazo, `LessonRelease` |
| **Em destaque** | Itens que a equipe pôs à vista, sem obrigação, com recado do professor | Professores (Envios do tipo "Em destaque") | `Delivery(kind=FEATURE)` |
| **Experiência padrão** | Continuar de onde parou e Todos os cursos liberados à turma | Automática | progresso do aluno + acessos |

Se não houver pendências nem destaques, Aprender mostra só a experiência padrão (quadro `GAprenderPadrao`). **Não pode haver bloco vazio com título.**

## 2. Glossário (use exatamente estes termos na interface)

| Termo | Definição |
|---|---|
| **Turma** | Grupo de alunos de uma mesma edição. Tem período, responsáveis, cursos liberados, cronograma e calendário. É a unidade de ensino. |
| **Aluno individual** | Exceção: um item enviado só a alguns alunos, sem tirá-los da turma. |
| **Atribuição** | Orientar alguém a estudar/fazer algo. Gera **pendência**. Pode ter prazo. |
| **Destaque** | Pôr algo à vista em Aprender. **Não gera pendência.** Pode ter recado e período. |
| **Tarefa** | Ação com prazo ou frequência (uma vez, diária, semanal). Aparece no Planejamento do aluno. |
| **Meta coletiva** | Objetivo da turma medido em tempo de estudo. Só mostra o agregado, nunca horas individuais. |
| **Acesso** | Autorização técnica de visualizar um recurso. Pode vir da **turma**, **direto**, de uma **atribuição**, **herdado** (curso → módulo → aula) ou de **mentoria** (gravações históricas). |
| **Grupo de estudo** | Grupo **social** da Comunidade. **Não dá acesso a conteúdo.** Não confundir com turma. |
| **Encontro** | Evento ao vivo, com data, fuso, link e participantes. |

## 3. Regras de turma (obrigatórias)

1. **O que é da turma é de todos.** Cursos, atividades, encontros, avisos, cronograma e calendário atribuídos a uma turma valem para **todos** os alunos ativos dela.
2. **Quem entra depois:** a turma tem a política `lateJoinPolicy`:
   - `ALL_ACTIVE` (padrão): o novo aluno vê tudo que está **ativo** agora (cursos liberados, atividades abertas, encontros futuros, avisos vigentes, destaques vigentes). O que já terminou fica de fora, salvo a opção "incluir também atividades e encontros já encerrados (somente leitura)" ao adicionar.
   - `FROM_JOIN`: só recebe o que for publicado **a partir da entrada**.
3. **Individual é exceção, não substituição.** Qualquer Envio, Encontro, Aviso, Tarefa ou Acesso pode ter alvos de dois tipos: turma e usuário. O aluno vê a **união** do que recebe.
4. **Um aluno pode estar em mais de uma turma.** Soma o que cada uma oferece. Conflitos de horário no calendário geram aviso, nunca bloqueio.
5. **Remover da turma remove só o que veio dela:** deixa de receber encontros, atividades, avisos, destaques e **perde os acessos concedidos pela turma**. **Mantém** entregas, feedbacks, histórico, acessos diretos e atribuições individuais. Opcional: "manter leitura do curso por 30 dias" (cria `AccessGrant` direto com validade).
6. **Mover** = remover + adicionar em uma única operação atômica; o aluno passa a receber o que a nova turma oferece.
7. **Encerrar turma** (por data de fim ou manualmente) congela novos envios; a leitura dos cursos continua por `readAfterEndDays` (padrão 90). **Arquivar** esconde das listas ativas; é reversível.
8. **Quem vê o quê:** professor vê as turmas em que é responsável; administrador vê todas; aluno só vê o que lhe foi atribuído.
9. **Aluno sem turma** não recebe nada por turma. A Gestão mostra aviso permanente em Turmas ("N alunos ainda não estão em nenhuma turma").
10. **Duplicar turma** cria uma turma nova com o mesmo conteúdo: copia cronograma (datas deslocadas pelo intervalo entre os inícios) e atividades como **rascunho**; **nunca copia alunos**.

## 4. Como "o que o aluno recebe" é calculado (regra única)

Existe **uma função servidora** que resolve o que um aluno vê. Todas as telas do aluno e todas as prévias usam a mesma função. Nunca recalcule isso na interface.

```
resolveStudentFeed(userId, at = now):
  cohorts   = CohortMember onde userId e status ACTIVE (e joinedAt <= at)
  targets   = [{COHORT, c} para c em cohorts] + [{USER, userId}]
  deliveries = Delivery com algum DeliveryTarget em targets
               e status ACTIVE e (startsAt <= at) e (endsAt nulo ou >= at)
               e, para alvos COHORT com lateJoinPolicy FROM_JOIN: createdAt/startsAt >= joinedAt
  pendencias = deliveries(kind=ASSIGNMENT|TASK) onde progresso do usuário != DONE
             + atividades com prazo sem entrega + aulas liberadas ainda não concluídas
  destaques  = deliveries(kind=FEATURE) ordenados por pinned desc, order asc, startsAt desc (máx. 3 visíveis)
  cursos     = cursos com AccessGrant efetivo (turma | direto | atribuição | aberto a todos)
  calendario = união de Event, prazos, LessonRelease, CohortEvent dos alvos
```

Regras de desempate: um mesmo item que chega por turma **e** diretamente aparece **uma vez**; vale o menor prazo; o recado do professor mais recente vence.

## 5. Envio ao aluno (Enviar ao aluno) — comportamento exato

Uma tela, três modos (`GEnviar`):

| Modo | Efeito | Gera pendência? | Notifica? |
|---|---|---|---|
| **Em destaque** | Cartão em Aprender com o recado, no período definido | Não | Só se "Também enviar um aviso" estiver ligado |
| **Pendência com prazo** | Entra em Pendências, no calendário e no Planejamento | Sim | Sim (interna; e-mail conforme preferência) |
| **Só avisar** | Cria um aviso com link para o item | Não | Sim |

- O item pode ser Curso, Aula, Atividade, Material ou Coleção. Enviar um **curso** ou **aula** também **concede acesso** (`AccessGrant` com origem `ASSIGNMENT`, vinculado ao envio); revogar o envio revoga **só** esse acesso.
- **Concluído** (para pendências) = aula assistida ≥ 90% (via player), atividade entregue, material aberto, coleção com todos os itens abertos, lista de exercícios finalizada. O aluno também pode "marcar como feito" quando o item não tem sinal automático.
- Destaques: **no máximo 3 visíveis por vez**; os demais esperam na fila, em ordem. Fixar põe em primeiro. Ao fim do período, o destaque sai sozinho.
- A prévia ao vivo usa `resolveStudentFeed` com os dados do rascunho, sem gravar.
- Enviar com alvos vazios é bloqueado ("Escolha ao menos uma turma ou um aluno").
- O resumo mostra o número real de destinatários (soma deduplicada de turmas ativas + individuais).

## 6. Calendário da turma

O calendário **não é uma tabela própria**: é a **projeção** de quatro fontes (`GTurmaCalendario`):

| Camada | Fonte | Quem edita |
|---|---|---|
| Encontros | `Event` com alvo na turma (somente publicados aparecem ao aluno; rascunhos aparecem tracejados só na Gestão) | Encontros |
| Prazos | `Delivery.dueAt` e `Activity.dueAt` | Envios e Atividades |
| Liberações de aulas | `LessonRelease` | Cronograma |
| Eventos da turma | `CohortEvent` | Calendário (Novo na turma → Evento da turma) |

Clicar num dia abre o menu **Novo encontro / Prazo de atividade / Liberar uma aula / Evento da turma**; cada opção abre o formulário correspondente **já com a turma e a data preenchidas**. O aluno recebe o mesmo calendário no Planejamento (`.ics` privado com token por usuário e por turma, revogável).

## 7. Vídeo do YouTube (aulas e gravações)

- Fonte da aula: `YOUTUBE` (recomendado) ou `UPLOAD`. Gravações de encontro usam a mesma verificação.
- Ao colar o link, o servidor extrai o ID (aceita `youtu.be/`, `watch?v=`, `embed/`, `shorts/`, e links com `&t=`), consulta a API do YouTube e salva **título, duração, miniatura, visibilidade e se pode incorporar**.
- Estados e mensagens: exatamente os do quadro `GAulaYT` (vazio, verificando, não listado, público, privado, não encontrado, incorporação desativada, link inválido, YouTube fora do ar).
- **Público**: permite salvar com aviso. **Privado / não encontrado / incorporação desativada / inválido**: bloqueia **publicar** a aula; permite salvar rascunho.
- **Verificação periódica** (diária, 06h): reconfere todos os vídeos de aulas publicadas; se algum falhar, marca a aula, notifica os responsáveis e mostra alerta na Visão geral. O aluno vê a mensagem de "vídeo indisponível" com os materiais da aula, nunca uma tela quebrada.
- O aluno assiste **dentro do Interprete**, em iframe `youtube-nocookie.com`; o link do YouTube não é exibido na interface.
- **Limite honesto:** vídeo "não listado" não é protegido por senha. Quem inspecionar a página consegue descobrir o link. O Interprete **não promete** proteção contra isso. Não prometa isso na interface nem em textos.
- Importar lista de reprodução (`GYTImport`): cria uma aula por vídeo selecionado, na ordem da lista, em um módulo escolhido, como rascunho ou publicado. Vídeos privados não são importáveis.

## 8. Medalhas (museu)

- Cada medalha tem: nome, descrição, critério (tipo + quantidade), **símbolo** (imagem), tom do mostruário e estado (rascunho/publicada/arquivada).
- O **símbolo é um arquivo substituível**: SVG (recomendado), PNG ou WebP, quadrado, 512 a 2048 px, fundo transparente, até 5 MB. O servidor sanitiza SVG, gera derivados (512/256/128) e o estado **bloqueado** (silhueta dessaturada).
- Histórico de símbolos: cada troca cria uma versão; é possível restaurar uma anterior.
- Os símbolos que aparecem nos quadros são **placeholders**. Os símbolos oficiais já existem e devem ser enviados pela própria tela de edição. **Nenhum símbolo é desenhado no código.**
- Mudar o **critério** cria uma nova versão da medalha; conquistas anteriores continuam válidas na versão em que ocorreram. Cada membro recebe cada medalha **uma única vez**. A avaliação do critério é **no servidor**.
- Aluno vê o museu: conquistadas acesas, bloqueadas em silhueta com barra de progresso quando o critério for mensurável.

## 9. Personalização (no-code)

Controla, por **rascunho + publicar uma vez**, com prévia:

- recursos disponíveis na navegação (Arquivo de gravações, Aprender na navegação);
- **blocos de Aprender**: Pendências da turma, Em destaque, Continue de onde parou, Coleções em destaque, Todos os cursos (ordem por arrastar, liga/desliga, textos);
- nota de aviso do portal de entrada (automática: a mais urgente; ou manual).

Pendências da turma nunca pode ser desligada sem confirmação (o aluno perderia o que a equipe atribuiu).

## 10. Permissões

Três papéis (`MEMBER`, `TEACHER`, `ADMIN`) + **capacidades** + **escopo** (veja `data/permissions.json`). Regras:

- Toda rota, Server Action e consulta chama `authorize(user, action, resource)`. A interface só **reflete** o resultado.
- Professor sem capacidade para a ação **não vê o botão** (não fica desabilitado sem explicação) ou vê o motivo ("Só administradores").
- **Administração** aparece com cadeado para professores; ao entrar mostra o estado de acesso restrito (`GRestrito`), **sem consultar nem devolver dados**.
- Alterar papel: confirmação com efeitos, registro em auditoria, e invalidação de sessão/cache de permissões do usuário afetado (a mudança vale na próxima requisição).
- Revogação durante o uso: a próxima ação retorna 403; a tela mostra a faixa "Você não tem mais acesso a esta área" e recarrega como restrita (`GInterrupcoes`).
