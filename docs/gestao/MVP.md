# Gestão V2 — contrato da primeira publicação

Este documento define o que precisa funcionar. A fonte de estado, evidências reutilizáveis e próxima ação é [STATUS.md](STATUS.md). A especificação funcional e visual completa, preservada sem alterações, fica em `interprete-gestao-handoff/`.

## Capacidades de saída

1. **Ensino e acesso do aluno:** professores/admins criam, editam e publicam os conteúdos previstos; acesso respeita matrícula, liberação, atribuição e concessão existente. O aluno autorizado encontra e consome o conteúdo, com progresso persistido quando previsto.
2. **Turmas e cronograma:** criar/editar turma, atribuir responsável, associar conteúdo e matricular/remover alunos pela interface. Mudanças persistem e respeitam origens independentes de acesso e histórico.
3. **Envios e correções:** publicar atividade para o público correto, receber envio, salvar rascunho privado, corrigir, notificar internamente quando previsto e exibir o resultado após reload. Uma pessoa fora do escopo não vê payload nem altera dados.
4. **Comunidade:** fluxos anunciados para gestão de publicações, grupos, avisos e encontros permitem as ações essenciais, com público e autorização aplicados no servidor.
5. **Administração:** papéis, acessos e revogações exibem sua origem e efeito; mudanças persistem e passam a valer na requisição seguinte.
6. **Shell da Gestão:** busca, navegação, notificações e prévia que forem anunciadas levam a destinos operacionais ou mostram indisponibilidade explícita, nunca uma ação simulada.
7. **Experiência utilizável:** controles funcionam; estados vazios, erros e sem permissão são claros; teclado e layout responsivo funcionam sem overflow em larguras representativas entre 320 e 1440 px.

## Aceite funcional

Para cada capacidade essencial, verificar fluxo pela interface com persistência real, reload, ator permitido e ator negado. Conferir ações no servidor; esconder botão não é autorização. Preservar papel, concessão direta, histórico e registros independentes quando uma origem for revogada. Não usar fixtures como prova de produção.

## QA integrado e publicação

Sobre uma versão candidata, cruzar as seções professor/admin → aluno, cobrir os cinco contextos de acesso do GOAL, permissões em rotas e ações, estados de erro, revogação, reload, notificações/jobs relevantes e estrutura responsiva. Conferir a qualidade visual essencial dos caminhos principais contra as referências.

Antes de publicar, validar Clerk e cada serviço indispensável, banco/migrations/RLS, integridade dos dados e configuração do projeto Vercel. Não levar fixtures de QA à produção. Fazer smoke real após release.

## Backlog fora do bloqueio funcional inicial

Por decisão do usuário em 14/10/2026, a configuração e validação da integração YouTube ficam adiadas e não bloqueiam esta publicação. Preservar a implementação e a recusa explícita de publicar vídeos YouTube sem validação server-side; não apresentar a integração como validada. Upload e playback privado por Storage continuam no fechamento previsto.

A comparação pixel a pixel de todos os 101 quadros, movimentos detalhados, dispositivos físicos e medições de percentis podem continuar após a publicação inicial. Integrações reais deixam de ser backlog quando forem indispensáveis a uma capacidade acima; se não puderem ser validadas, bloquear a publicação e registrar o motivo.
