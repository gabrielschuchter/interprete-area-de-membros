# AGENTS.md

## Propósito

Este repositório mantém a área de membros do Interprete sobre a fundação next-forge. Use Bun e os comandos do Turborepo. O roadmap organiza o produto em geral; a sequência atual da Gestão V2 e o estado de trabalho ficam em `docs/gestao/STATUS.md`.

## Produto e dados

- Reutilize modelos, serviços e interfaces existentes antes de criar outros.
- Antes de ampliar o contrato de produto, consulte o trecho relevante do pacote de referência `interprete-gestao-handoff/`.
- Preserve as fronteiras atuais: `apps/app` para a área autenticada, `apps/api` para infraestrutura/webhooks, `packages/database` como acesso Prisma/Supabase e os pacotes compartilhados para auth, design system e observabilidade.
- Não adicione conceitos de SaaS B2B à navegação dos membros.
- Não embuta dados de demonstração na aplicação. Seeds devem ser explícitas, locais, protegidas contra destinos remotos e preservadas após o ensaio.
- Supabase PostgreSQL é a fonte oficial. Runtime usa `DATABASE_URL` no pooler de transação (6543, `pgbouncer=true`, limite explícito); Prisma CLI usa `DIRECT_URL` no pooler de sessão (5432). Preserve verificação TLS.
- Clerk é a fonte de identidade. Professor e administrador são autorizados por `Member.role` associado ao usuário Clerk; nunca por e-mail, metadata pública ou controles escondidos.
- Mantenha RLS habilitado e não crie policies permissivas para acesso que acontece por Prisma server-side.
- Identidade, papel, grants e dados pessoais não entram em cache persistente compartilhado; mantenha telemetria sanitizada.
- Migrations de produto são aditivas. Não apague dados, registros ou fixtures para reiniciar uma jornada.
- Nunca versione arquivos `.env`, senhas, tokens ou chaves.

## Segurança e qualidade

Autorização server-side, isolamento de dados, persistência, resposta correta após reload e suporte utilizável a desktop e mobile são requisitos de produto. Trabalho que altera papel, grants, publicações, dados privados, migrations ou worker deve verificar os controles e fluxos que toca antes de seguir. Mantenha os contratos de desempenho em `docs/architecture/performance.md` e `packages/design-system/PERFORMANCE.md` quando uma mudança os afetar.

Use verificações proporcionais à mudança: validação estática e testes focados durante implementação; navegador quando precisa comprovar uma jornada real; conjunto completo do monorepo e QA integrado uma vez sobre a versão candidata. Reexecute somente os checks e jornadas afetados por correções posteriores. Build executa a suíte de testes e a checagem de orçamento; não repita esses comandos sobre os mesmos artefatos sem mudança pertinente.

## Gestão V2

`docs/gestao/STATUS.md` é a única fonte de estado, evidências reutilizáveis, lacunas e próximo passo. `docs/gestao/MVP.md` define o contrato de primeira publicação. Consulte decisões específicas em `DECISIONS.md` quando necessário. Os documentos históricos e o handoff original não governam a sequência atual.

A ordem de entrega é: base funcional local → QA integrado → correções → preflight/publicação → smoke real. O critério da primeira publicação é funcionalidade completa, segurança e qualidade visual essencial; comparações exaustivas dos 101 quadros permanecem backlog separado. Não marque uma capacidade como concluída enquanto seus caminhos essenciais estiverem em placeholder, sem persistência ou sem autorização.
