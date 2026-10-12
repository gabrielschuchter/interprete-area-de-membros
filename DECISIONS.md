# DECISIONS · padrões já decididos e registro de novas decisões

> **Não pergunte ao usuário.** Para cada decisão pendente do `HANDOFF.md §6`, use o padrão abaixo. Registre qualquer decisão nova no fim, com data, contexto, opção escolhida e motivo.

## Padrões adotados (pode implementar já)
| # | Tema | Padrão |
|---|---|---|
| 1 | Aluno em mais de uma turma | **Sim.** Soma o que cada turma oferece; item que chega por duas vias aparece uma vez; conflitos de horário avisam, não bloqueiam. |
| 2 | Quem entra depois | `ALL_ACTIVE` por padrão; `FROM_JOIN` como opção da turma. |
| 3 | Escopo do professor | Vê/gerencia só turmas em que é responsável; admin vê todas. |
| 4 | YouTube | Começar com **chave de API** (sem OAuth): privado e "não encontrado" aparecem como "privado ou não encontrado". Deixar o adaptador pronto para OAuth (`youtube.readonly`) como evolução. Adaptador de teste determinístico para desenvolvimento e testes. |
| 5 | Conclusão de pendência | Aula concluída com ≥ 90% assistido (IFrame API); atividade = entregue; material = aberto; coleção = todos os itens abertos; lista = finalizada; "marcar como feito" quando não houver sinal automático. |
| 6 | Recorrência | Não repete / diária / semanal / mensal (subconjunto de RRULE) com exceção por ocorrência. |
| 7 | Notificações | Internas (tabela + sino). E-mail só se a infraestrutura já existir e a preferência permitir. **Avisos sem e-mail.** Nunca enviar a pessoas reais em desenvolvimento. |
| 8 | Rubrica | Nota 0–10 por critério; média ponderada **informativa** ao professor; comentário obrigatório para enviar. |
| 9 | Alunos existentes | **Não matricular automaticamente.** Sem *backfill*. Entregar a ação administrativa "Criar turma e adicionar membros" na interface, sem executá-la. Camada de compatibilidade: aluno sem turma continua vendo o que já via. |
| 10 | Destaques | Até 3 visíveis; fila ordenada; remover aluno da turma **mantém** envios individuais pendentes. |
| 11 | Símbolo de medalha ausente | Placeholder neutro (gerado). Upload substitui. |
| 12 | Notas/tarefas pessoais nos Salvos | Fora do escopo. |
| 13 | Conclusão de turma | `readAfterEndDays = 90`. |
| 14 | Convites | Link com token de 128 bits (guardado em hash), validade padrão 14 dias, limite de usos configurável. |

## Registro de decisões novas
| Data | Contexto | Decisão | Motivo |
|---|---|---|---|
| 11/10/2026 | Divergência entre os layouts propostos no handoff e o plano aprovado | Manter uma raiz App Router e trocar o shell por segmento; usar a branch isolada `gestao-v2` | O Next faz navegação de documento completo entre raízes; a decisão aprovada exige continuidade e branch com nome exato. |
| 11/10/2026 | GOAL pede revisor delegado, mas o usuário determinou execução solo | Não delegar agentes; realizar uma segunda passada independente usando os critérios de aceite | Respeitar a instrução direta do usuário e manter a verificação auditável. |
| 11/10/2026 | Lint global inclui as referências HTML/JSON do handoff presentes no workspace | Ignorar apenas interprete-gestao-handoff no escopo do Biome, preservando os arquivos de referência | O código do produto segue verificado sem reformatar os originais usados na comparação visual. |
| 11/10/2026 | QA autenticado precisa de banco local, mas o serviço Docker não pode ser iniciado pela conta atual | Não apontar para Supabase remoto nem criar credenciais fictícias; registrar o runtime como não verificado e continuar com validação isolada | Respeita o limite de ambiente local e mantém a possibilidade de retomar comparação e jornadas quando o serviço local estiver disponível. |
| 12/10/2026 | QA local da Fase 2 depende do Docker indisponível | Validar o schema com Prisma local e manter a migration sem aplicação; registrar runtime como não verificado | As URLs disponíveis apontam para Supabase remoto, que não pode ser usado; preserva os dados e a regra de não escrita remota. |
| 12/10/2026 | Primeira unidade da Fase 3 precisa introduzir Gestão ao catálogo e edição de cursos | Reutilizar `Course`, `LearningPath`, `Module`, `Lesson`, as ações autorizadas existentes e o editor compartilhado; usar um sentinela interno `GESTAO` para retornar à nova rota sem alterar o fluxo legado | Mantém uma única fonte de conteúdo e autorização, limita a migration e permite migrar os módulos pedagógicos em unidades; o editor ainda não atende ao aceite visual nem às jornadas autenticadas. |
