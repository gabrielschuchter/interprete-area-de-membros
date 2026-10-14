# Gestão V2 — estado operacional

Atualizado durante a intervenção de simplificação em 13/10/2026. Fonte única para retomada; decisões de produto ficam em `DECISIONS.md`, critérios de primeira publicação em `MVP.md`, e o contrato visual/funcional completo no pacote de referência.

## Git e ambiente

- Worktree: `C:\Users\gabsc\.codex\worktrees\interprete-gestao\interprete-area-de-membros`; branch `gestao-v2`; base desta intervenção `1f2a046` (`feat(gestao): edit and publish cohort meetings`).
- A correção de autorização da lista de atividades da aula está separada em `c5fb778`; a simplificação operacional e o runtime QA compartilhado estão em `a26d0f4`. Os ajustes funcionais seguintes foram registrados em commits focados. O único diff local fora dos commits é o ajuste CSS preexistente de cinco linhas responsivas em `apps/app/app/(authenticated)/gestao/gestao.css`; preserve-o. O checkout original em `Documents\Codex\interprete-area-de-membros` contém alterações de outro trabalho; não o use para esta frente.
- Não há processo escutando nas portas 3000, 3002 ou 55433 na última sondagem. Preview e PostgreSQL QA precisam ser verificados e iniciados explicitamente antes de uso.
- Nesta sondagem: aproximadamente 17 GiB livres em C, 16 GiB em D e 3,3 GiB de memória física livre. É uma amostra, não garantia de capacidade. Junctions locais existentes direcionam `.next-local-a2`, `.next-local-a2-d`, `.next-local-build-d`, `.next-local-item2-d` e `.next-local-preview3000-d` para D; preservá-las e verificar o destino antes do próximo processo pesado.

## Capacidades comprovadas que podem ser reutilizadas

| Jornada | Evidência local existente | Limite que continua aberto |
|---|---|---|
| Envio, rascunho privado, correção e feedback após reload | `output/gestao-mvp-a2/`, resumo do fluxo em `MVP.md`; testes focados, navegação professor/aluno, API e PostgreSQL/TLS | Adaptador QA não comprova Clerk real, worker contínuo, canal externo ou matriz integral |
| Turma, matrícula, acesso, remoção e revogação por origem | `output/gestao-mvp-t2/`; grant direto e histórico foram preservados | CSV, movimentação, convite, concessão temporária e matriz integral |
| Encontro de turma em rascunho, edição, publicação e calendário do aluno | `output/gestao-mvp-item2/local-browser-smoke.md`; `output/gestao-final-audit/`; teste com TLS e reload | C1/C2 integral, restantes das fontes/menu e fidelidade visual |
| Atividade direcionada e isolamento de aluno/professor fora do escopo | `9d7e48a`, testes de acesso e jornada em `output/gestao-mvp-activity/` | A1 e demais fluxos/perfis não estão integralmente aceitos |

As evidências são locais e preservam fixtures mutáveis. Consultá-las antes de reexecutar escrita. Reexecutar apenas se a alteração em análise atingir a jornada ou o controle que a evidência prova.

## Estado e próxima entrega funcional

**Ensino → aluno — implementação funcional local concluída.** Cursos, aulas, exercícios, biblioteca e coleções reutilizam os serviços existentes e aplicam publicação, escopo de acesso, atribuição e liberação no servidor. A evidência focada previamente registrada (36 testes em 5 arquivos) continua válida; nesta continuação, o caso de retomar sessão de exercícios já aberta foi corrigido em `apps/app/app/(authenticated)/exercicios/actions.ts` e coberto pelo teste de ações (11 testes passaram). Falta validar a jornada cruzada autenticada e reload sobre a candidata; Clerk, Storage e YouTube reais também não foram sondados nesta etapa.

**Comunidade — rotas operacionais conectadas.** `/gestao/comunidade`, `/publicacoes`, `/avisos`, `/avisos/novo` e `/encontros` encaminham para os fluxos staff existentes em `/admin/community`, `/admin/avisos` e `/admin/meetings`. O redirecionamento exige `community.moderate`; páginas e mutações de destino continuam exigindo papel staff. O teste de navegação cobre destinos conhecidos e rejeita subcaminhos não mapeados (7 testes passaram). Validação de interface e reload fica para a candidata.

**Administração — destinos essenciais conectados.** Membros, acessos, gravações, personalização e medalhas encaminham apenas para telas existentes. As rotas da Gestão exigem admin; cada destino mantém sua própria guarda e mutações de papéis/acessos continuam restritas a admin. “Integrações” e “Registro de atividades” saíram da lista porque não têm uma tela operacional. Destinos desconhecidos retornam 404. A navegação tem 7 testes focados; typecheck e Biome passaram. Persistência por interface e reload continuam para a candidata.

**Shell — busca, notificações e prévia disponíveis no código local.** Gestão reutiliza a busca global e o popover de notificações do membro; prévias de atividade, coleção e curso já têm rotas próprias. O atalho “Novo aviso” foi conectado ao formulário operacional; QA integrado de interação/reload segue para a candidata.

## Release e verificação

A primeira publicação exige as capacidades de `MVP.md`, autorização fresca em rotas e ações, persistência, QA integrado nos cinco contextos de acesso, fluxos Gestão → aluno, interface essencial utilizável em desktop/mobile e ausência de risco crítico. Clerk e demais integrações indispensáveis precisam de prova real no preflight. Comparação exaustiva dos 101 quadros é backlog separado.

Durante desenvolvimento, usar testes focados e validação estática conforme o alcance. Retestar imediatamente mudanças de autorização/dados. Usar browser quando necessário para provar persistência/layout/comportamento. Build e gates completos são um único fechamento da candidata; `build` já executa testes e `check:performance`. Correções posteriores invalidam somente checks/cenários afetados.

## Causa operacional recente

Os registros em `output/gestao-mvp-a2/` e nos logs de build anteriores incluem ENOSPC/cache corrompido e falha de typecheck por memória; a recuperação do PG local também interrompeu QA. A configuração de C/D e o encerramento dos processos variam por sessão. Antes de browser/build, conferir Git, listener da porta alvo, destino físico do distDir, espaço e memória. Nunca mover ou apagar cache/junction, base ou fixture para liberar espaço sem necessidade e autorização explícita.

## Aferição do processo — próximas duas capacidades

Ao concluir as duas próximas capacidades, registrar aqui somente tempo até prova funcional, builds completos e motivo, rodadas de browser/repetições e motivo, tempo de recuperação do ambiente e problemas do QA integrado que deveriam ter sido detectados antes. Critério: nenhuma repetição sem mudança que a justifique, nenhuma interrupção repetida pela mesma configuração de cache e verificações de segurança mantidas. Ampliar checks apenas para a classe de risco que escapar.

| Capacidade | Registro |
|---|---|
| Ensino → aluno | Implementação local concluída; QA integrado da candidata pendente |
| Comunidade | Rotas conectadas a fluxos staff existentes; QA integrado da candidata pendente |
| Administração | Destinos essenciais conectados; QA integrado da candidata pendente |
| Shell | Implementação local existente; QA integrado da candidata pendente |
