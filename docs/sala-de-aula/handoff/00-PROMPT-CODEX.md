# Prompt mestre para o Codex

Copie tudo abaixo da linha e cole no Codex, com a pasta deste pacote disponível no repositório (por exemplo em `docs/sala-de-aula/`).

---

Você vai implementar a **Sala de Aula de aulas gravadas** da área de membros do Interprete (e a abertura de **Minhas gravações** dentro dela). A especificação completa está nos arquivos `README.md` e `01` a `16` deste pacote, mais `contracts/`, `assets/` e `reference/`. Leia tudo antes de agir. O repositório já tem parte do que a spec descreve; o seu primeiro trabalho é descobrir o que existe.

## Regras inegociáveis

1. **Não altere** a autenticação com Clerk, o proxy `/__clerk`, a arquitetura next-forge/Bun, nem a escolha de banco (Supabase PostgreSQL). Siga o padrão de acesso a dados que o repositório já usa.
2. **Escopo único:** Sala de Aula de conteúdo gravado (aulas de curso e gravações de encontros) e a abertura de gravações a partir de Minhas gravações. Fora de escopo: encontros ao vivo, Comunidade, Início, Biblioteca, Exercícios, Gestão (exceto leitura de dados), Ferramentas (exceto integração descrita no `09`).
3. **Reutilizar > estender > criar.** Barra lateral global, editor de notas, cronômetro/Pomodoro/regressivo, Modo foco, biblioteca, listas de exercícios e atividades já existem ou têm equivalentes: integre, não duplique.
4. **Preserve todas as funcionalidades atuais** da sala e das áreas vizinhas. Nada é removido sem estar listado neste pacote.
5. **Não invente funcionalidades.** Se algo não está na spec, não entra. Dúvida de produto vira item no relatório, não código.
6. **Fidelidade visual:** siga o `08` e as telas válidas de `reference/`. Não redesenhe, não “melhore”, não troque tipografia, cores ou espaçamentos.
7. **Textos:** use exatamente os de `10` e `contracts/copy.pt-BR.ts`. Todo texto novo precisa ser curto, em pt-BR e sem culpar o aluno.
8. **Sem dados falsos em produção.** Seeds de QA só em ambiente de desenvolvimento/preview.
9. **Sem abas horizontais no mobile.** Sem botões decorativos: todo botão visível funciona ou não existe.
10. **Trabalho local.** Não faça commit, push, deploy, migração em produção nem altere variáveis de ambiente remotas sem autorização expressa. Migrações são criadas e testadas localmente.
11. **Honestidade:** se algo não puder ser verificado (sem acesso, sem ambiente, teste que não roda), diga exatamente o que ficou sem verificação. Nunca declare “concluído” sem evidência.

## Como trabalhar

Execute de forma autônoma, fase por fase, na ordem do `14-plano-de-implementacao.md`. Pare e pergunte **apenas** se houver bloqueio real (falta de acesso, conflito entre a spec e o código que mude o escopo, decisão de produto sem padrão seguro em `16`). Em qualquer outro caso, siga o padrão seguro documentado e registre.

### Fase 0 · Descoberta (obrigatória, antes de qualquer código)
Siga o `02`. Produza `docs/sala-de-aula/DISCOVERY.md` com o que existe, o que falta, o mapeamento para a spec e os riscos. Só então continue.

### Fases 1 a 7
Conforme `14`. Cada fase termina com:
- typecheck, lint e build passando (use os scripts do repositório; descubra-os na Fase 0);
- testes da fase escritos e passando;
- lista objetiva do que mudou (arquivos) e do que ficou pendente.

### Feature flag
Toda a nova sala fica atrás da flag `roomV2` (nome e mecanismo conforme o repositório; veja `14`). Com a flag desligada, o comportamento atual permanece idêntico.

## Entrega final (formato do relatório)

1. **Resumo** em até 10 linhas.
2. **Mapa de mudanças:** arquivos criados/alterados por fase.
3. **Verificação:** comandos executados e resultado (typecheck, lint, build, testes unitários, E2E). Cole a saída resumida.
4. **QA manual:** o checklist de `15` marcado item a item, com observações.
5. **Pendências e riscos:** o que não foi feito, por quê, e o que depende de decisão (`16`).
6. **Como reverter:** passos para desligar a flag e, se aplicável, reverter migrações.

Comece pela Fase 0.
