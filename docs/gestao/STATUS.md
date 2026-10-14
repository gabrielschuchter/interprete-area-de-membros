# Gestão V2 — estado operacional

Atualizado em 14/10/2026 após fechar a jornada local Ensino → aluno. Fonte única para retomada; decisões de produto ficam em `DECISIONS.md`, critérios de primeira publicação em `MVP.md`, e o contrato visual/funcional completo no pacote de referência.

## Git e ambiente

- Worktree: `C:\Users\gabsc\.codex\worktrees\interprete-gestao\interprete-area-de-membros`; branch `gestao-v2`; última entrega funcional `46c1d59`, sobre a base `1f2a046`.
- A autorização da lista de atividades está em `c5fb778`; simplificação operacional/runtime compartilhado em `a26d0f4`; prontidão do runtime frio em `28c9096`; escopo de atribuição em `46c1d59`. O único diff local é o ajuste CSS preexistente de cinco linhas responsivas em `apps/app/app/(authenticated)/gestao/gestao.css`; preserve-o. O checkout original em `Documents\Codex\interprete-area-de-membros` contém alterações de outro trabalho; não o use para esta frente.
- Após os smoke locais, as portas 3000 e 3002 estão sem listener; PostgreSQL QA segue no loopback `127.0.0.1:55433`. Confira ambos antes de reutilizar e preserve a base e as fixtures existentes.
- Sondagem de recursos de 13/10: aproximadamente 17 GiB livres em C, 16 GiB em D e 3,3 GiB de memória física livre; é uma amostra, não garantia. Junctions existentes direcionam `.next-local-a2`, `.next-local-a2-d`, `.next-local-build-d`, `.next-local-item2-d` e `.next-local-preview3000-d` para D; preserve-as e confira o destino se um processo pesado voltar a ser necessário.

## Capacidades comprovadas que podem ser reutilizadas

| Jornada | Evidência local existente | Limite que continua aberto |
|---|---|---|
| Envio, rascunho privado, correção e feedback após reload | `output/gestao-mvp-a2/`, resumo do fluxo em `MVP.md`; testes focados, navegação professor/aluno, API e PostgreSQL/TLS | Adaptador QA não comprova Clerk real, worker contínuo, canal externo ou matriz integral |
| Turma, matrícula, acesso, remoção e revogação por origem | `output/gestao-mvp-t2/`; grant direto e histórico foram preservados | CSV, movimentação, convite, concessão temporária e matriz integral |
| Encontro de turma em rascunho, edição, publicação e calendário do aluno | `output/gestao-mvp-item2/local-browser-smoke.md`; `output/gestao-final-audit/`; teste com TLS e reload | C1/C2 integral, restantes das fontes/menu e fidelidade visual |
| Atividade direcionada e isolamento de aluno/professor fora do escopo | `9d7e48a`, testes de acesso e jornada em `output/gestao-mvp-activity/` | A1 e demais fluxos/perfis não estão integralmente aceitos |

As evidências são locais e preservam fixtures mutáveis. Consultá-las antes de reexecutar escrita. Reexecutar apenas se a alteração em análise atingir a jornada ou o controle que a evidência prova.

## Estado e próxima entrega funcional

**Ensino → aluno — funcional local concluído.** Cursos, aulas, exercícios, biblioteca e coleções reutilizam os serviços existentes e aplicam publicação, escopo de acesso, atribuição e liberação no servidor; os 36 testes previamente registrados continuam válidos. Nesta rodada, o admin criou e publicou um curso, módulo e aula pela interface, atribuiu o curso a `gestao_qa_visual_student_01` (perfil fora do diretório público) e a aluna encontrou o envio e abriu o texto da aula após reload. Outro membro recebeu 404 no curso; a API de busca privada de destinatários retornou 403 para membro. Os dois testes focados desta rodada passaram (15/15), assim como typecheck do app e Biome nos sete arquivos funcionais alterados. Evidência é local com dev auth; Clerk, Storage/upload/playback e YouTube reais seguem sem prova. QA integrado dos cinco contextos e visual essencial fica para a candidata.

**Comunidade — próxima capacidade funcional.** `/gestao/comunidade`, `/publicacoes`, `/avisos`, `/avisos/novo` e `/encontros` encaminham para os fluxos staff existentes em `/admin/community`, `/admin/avisos` e `/admin/meetings`. O redirecionamento exige `community.moderate`; páginas e mutações de destino continuam exigindo papel staff. Os sete testes de navegação permanecem válidos. Falta provar as ações essenciais pela interface, persistência após reload e visibilidade para ator permitido/negado; corrigir apenas lacunas concretas antes da candidata.

**Administração — destinos essenciais conectados.** Membros, acessos, gravações, personalização e medalhas encaminham apenas para telas existentes. As rotas da Gestão exigem admin; cada destino mantém sua própria guarda e mutações de papéis/acessos continuam restritas a admin. “Integrações” e “Registro de atividades” saíram da lista porque não têm uma tela operacional. Destinos desconhecidos retornam 404. A navegação tem 7 testes focados; typecheck e Biome passaram. Persistência por interface e reload continuam para a candidata.

**Shell — busca, notificações e prévia disponíveis no código local.** Gestão reutiliza a busca global e o popover de notificações do membro; prévias de atividade, coleção e curso já têm rotas próprias. “Novo aviso” abre o fluxo operacional; “Atribuir conteúdo” e aliases de atribuição/tarefas agora encaminham para as telas staff existentes, com suas guardas preservadas. Rotas sem destino operacional retornam 404 em vez de mostrar um placeholder. O mapeamento tem 8 testes focados; QA integrado de interação/reload segue para a candidata.

## Release e verificação

A primeira publicação exige as capacidades de `MVP.md`, autorização fresca em rotas e ações, persistência, QA integrado nos cinco contextos de acesso, fluxos Gestão → aluno, interface essencial utilizável em desktop/mobile e ausência de risco crítico. Clerk e demais integrações indispensáveis precisam de prova real no preflight. Comparação exaustiva dos 101 quadros é backlog separado.

Durante desenvolvimento, usar testes focados e validação estática conforme o alcance. Retestar imediatamente mudanças de autorização/dados. Usar browser quando necessário para provar persistência/layout/comportamento. Build e gates completos são um único fechamento da candidata; `build` já executa testes e `check:performance`. Correções posteriores invalidam somente checks/cenários afetados.

## Causa operacional recente

Os registros em `output/gestao-mvp-a2/` e nos logs de build anteriores incluem ENOSPC/cache corrompido e falha de typecheck por memória; a recuperação do PG local também interrompeu QA. A configuração de C/D e o encerramento dos processos variam por sessão. Antes de browser/build, conferir Git, listener da porta alvo, destino físico do distDir, espaço e memória. Nunca mover ou apagar cache/junction, base ou fixture para liberar espaço sem necessidade e autorização explícita.

## Aferição do processo — próximas duas capacidades

Ao concluir as duas próximas capacidades, registrar aqui somente tempo até prova funcional, builds completos e motivo, rodadas de browser/repetições e motivo, tempo de recuperação do ambiente e problemas do QA integrado que deveriam ter sido detectados antes. Critério: nenhuma repetição sem mudança que a justifique, nenhuma interrupção repetida pela mesma configuração de cache e verificações de segurança mantidas. Ampliar checks apenas para a classe de risco que escapar.

| Capacidade | Registro |
|---|---|
| Ensino → aluno | Curso criado/publicado/atribuído, leitura após reload e negação a outro membro; QA integrado da candidata pendente |
| Comunidade | Próxima capacidade funcional; ações pela interface e reload ainda sem prova |
| Administração | Destinos essenciais conectados; QA integrado da candidata pendente |
| Shell | Implementação local existente; QA integrado da candidata pendente |
