# Goal — concluir e publicar a Gestão V2

## Resultado esperado

Concluir a base funcional da Gestão V2 no worktree `interprete-gestao`, fazer QA integrado das jornadas essenciais, corrigir os achados, preparar e publicar a versão aprovada e realizar smoke real. Fechar uma unidade não encerra o objetivo.

## Estado e ordem de trabalho

- `docs/gestao/STATUS.md` é a única fonte do estado, das evidências reutilizáveis, das lacunas e do próximo passo.
- `docs/gestao/MVP.md` define as capacidades e os critérios da primeira publicação.
- Ordem: completar lacunas funcionais locais → QA integrado → corrigir → preflight/publicação → smoke real.

## Critério da primeira publicação

Áreas anunciadas levam a fluxos operacionais. Professor/admin gerencia os conteúdos do MVP. Alunos recebem e consomem somente itens autorizados. Envios, correções, acessos e mudanças permanecem corretos após reload. Jornadas essenciais funcionam nos papéis previstos, apresentam falhas com segurança e são utilizáveis em desktop e mobile.

O QA integrado da versão candidata cobre cinco contextos: sem sessão, membro, professor responsável, professor fora do escopo e admin; confere rotas e ações servidoras, revogação, persistência, cruzamentos entre Gestão e telas do aluno, erros relevantes, teclado e contrato responsivo. Uma comparação visual essencial é necessária. A comparação exaustiva dos 101 quadros, dispositivos físicos, percentis e serviços reais que não sejam dependência indispensável do MVP ficam registrados para acompanhamento ou preflight.

## Segurança e entrega

- Trabalho e QA ficam locais até a aprovação integrada. Sem escrita remota nem publicação antecipada.
- Publicar após preflight de Clerk, Supabase, serviços indispensáveis, migrations aditivas, integridade e configuração Vercel; seguir o fluxo de release do repositório e fazer smoke real.
- Credencial ausente não é prova de integração real. Bloqueio de dependência essencial impede a publicação.
- Nunca transportar fixtures à produção, apagar dados QA ou enfraquecer autorização para facilitar testes. Preservar checkout original, branch isolada `gestao-v2` e TLS verificado.

## Verificação

Durante implementação, use checks estáticos e testes focados. Mudanças de acesso, grants, publicação, migration ou notificações exigem regressão imediata do risco correspondente. Use o navegador para provar interação, persistência ou layout que testes não cubram. Evite build e jornada completos sem alteração relevante.

Na versão candidata, execute uma vez os gates completos do monorepo e o QA integrado. Depois de uma correção, repita apenas o que ela afetou. `bun run build` já depende dos testes e executa `check:performance`; não refaça esses alvos sobre as mesmas entradas e artefatos.

## Continuidade

Ao retomar, confira branch, HEAD e `git status`; leia `STATUS.md` e o trecho necessário da especificação. Após fechar uma capacidade, atualize seu resumo em `STATUS.md`. `PROGRESS.md`, `EXECUTION-LOG.md` e o handoff recebido são registros históricos. Não reaudite o repositório inteiro a cada ajuste.
