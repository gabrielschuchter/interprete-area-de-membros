# 06 · Prompt para o Codex (copiar e colar)

```text
CONTEXTO
Você vai implementar a GESTÃO do Interprete (monorepo next-forge, Bun, Clerk, Prisma, Supabase PostgreSQL): um ambiente único para professores e administradores que funciona como organizador NO-CODE da plataforma. Inclui: shell próprio com cinco áreas (Visão geral, Ensino, Alunos, Comunidade, Administração); TURMAS como eixo do ensino; envio ao aluno (destaque, pendência, aviso); calendário e cronograma da turma; aulas com vídeo do YouTUBE (não listado) ou upload; correção com rubrica; encontros, avisos e moderação; administração (papéis, acessos com origem, gravações históricas, personalização, medalhas em formato de MUSEU com símbolo trocável por upload, integrações, auditoria); e as telas do aluno que dependem disso (Aprender com pendências, destaques e padrão; museu de medalhas). O pacote interprete-gestao-handoff/ tem HANDOFF.md, docs/ (01 a 06), data/ (routes, permissions, events), html/ e referencia-png/.

O RESULTADO FINAL TEM DE SER VISUALMENTE IDÊNTICO AOS QUADROS E FUNCIONAR DE PONTA A PONTA. Implementar só a aparência é falha. Não há controle decorativo: ou faz a função, ou sai.

COMO ESTUDAR (obrigatório, antes de qualquer outra coisa)
1. Leia o HANDOFF.md e TODOS os arquivos de docs/ sem pular seções. As seções 3 e 4 de docs/01 e as seções 1 a 3 de docs/02 são a base da lógica.
2. Abra os HTMLs de html/ pelo CÓDIGO-FONTE e as capturas de referencia-png/. Extraia medidas, cores, tipografia, raios e sombras reais. Não estime a olho.
3. Estude o repositório com a mesma profundidade: AGENTS.md/README/docs, design system e tokens, shell atual, rota /professor e as 16 abas atuais, modelos de cursos, aulas, atividades, entregas, exercícios, biblioteca, coleções, encontros (e seu calendário), avisos, medalhas, gravações históricas, acessos, permissões (papéis), comunidade, notificações, busca, uploads/Storage, jobs/agendadores, e como Aprender é montado hoje. Descubra o que já existe e REUTILIZE.
4. Explore muito, reporte pouco.

REGRAS FIXAS
- NÃO FAÇA MOCK. Nomes e números dos quadros são ilustrativos. Seeds só em desenvolvimento.
- Migrations SOMENTE ADITIVAS e SOMENTE COM MINHA AUTORIZAÇÃO EXPLÍCITA. Nada remoto, nada destrutivo, nenhum backfill sem aprovação. Nunca remodele dados existentes.
- AUTORIZAÇÃO NO SERVIDOR em toda rota, Server Action e consulta (authorize(user, action, resource)). Professor não alcança dado administrativo nem por URL. Administração para professor retorna estado restrito SEM payload.
- UMA FONTE DA VERDADE: resolveStudentFeed, resolveAccess e resolveCalendar no servidor, usadas por Gestão, aluno e prévia.
- TURMA É O EIXO: todo envio, encontro, aviso, atividade e acesso escolhe turma primeiro; individual é exceção (regras em docs/01 §3).
- Rascunho antes de publicar; autosave; arquivar antes de excluir; Desfazer; concorrência otimista (version) com diálogo de conflito.
- YouTube: verificação no servidor, estados completos (quadro GAulaYT), job diário, player youtube-nocookie com IFrame API (progresso ≥ 90%). Não prometa proteção do vídeo não listado. Segredos só no servidor, criptografados.
- MEDALHAS: NUNCA desenhe símbolos. Upload de SVG/PNG/WebP com sanitização de SVG, derivados, estado bloqueado, histórico e restaurar. Os símbolos dos quadros são placeholders.
- UPLOAD em vez de URL em todo campo de imagem. Endereços (slug) automáticos. Seletor de pessoas/turmas em vez de IDs digitados.
- TRANSIÇÃO Área↔Gestão conforme docs/04 §2 (400 ms, só opacity/transform, View Transitions com fallback, foco e anúncio, versão reduzida). Estados de falha e interrupções conforme docs/04 §3–4.
- RESPONSIVO: trilho 1024–1279, gaveta abaixo, tabelas viram cartões, modais viram folhas, barra de ação fixa, sem barra horizontal de navegação no celular, sem rolagem horizontal de 320 a 1920 px.
- ACESSIBILIDADE: teclado completo, foco visível, aria-live, arrastar com teclado, contraste AA.
- Preserve .git/next-forge, Bun, Clerk (UI customizada e proxy same-origin /__clerk), Supabase PostgreSQL e a autorização existente. Não troque provedor de auth. Não adicione Neon.
- Trabalhe localmente em branch isolada. Sem release, sem Production, sem push forçado. Preserve alterações Git existentes. Mudanças pequenas e revisáveis. Sem dependências novas além do que o repositório já usa (sem biblioteca de animação).
- Reutilize o TipTap da Comunidade para texto rico. Não crie segundo editor.
- NÃO DECIDA SOZINHO as decisões pendentes do HANDOFF.md §6: apresente opções com impacto e aguarde.
- Não declare sucesso sem verificação. Diga exatamente o que ficou sem verificar.

FASE 1: AUDITORIA, SOMENTE LEITURA. NÃO IMPLEMENTE NADA AINDA.
Entregue um relatório com EVIDÊNCIAS (caminhos e trechos), separando fato de opinião:
1. Inventário do que existe hoje: rota /professor e cada uma das 16 abas (o que funciona, o que não funciona, o que é incompleto), modelos de dados, papéis, acessos, jobs, uploads, notificações, busca, Aprender, calendário de Encontros.
2. Mapeamento 1:1 de cada quadro (html/ e referencia-png/) para: (a) existe e basta estilizar, (b) existe e precisa mudar, (c) não existe e exige trabalho novo.
3. Modelo de dados: o que reutilizar, o que criar (aditivo), com tabelas, índices, RLS e migrations propostas (NÃO aplicar).
4. Como implementar resolveStudentFeed, resolveAccess e resolveCalendar sobre o modelo real; como o aluno passa a ler Aprender a partir deles; plano de compatibilidade para alunos já existentes (SEM matricular ninguém automaticamente).
5. YouTube: chave de API ou OAuth, cotas, onde guardar segredos, como o player registra progresso, impacto no tempo de estudo e medalhas.
6. Uploads: Storage, URLs assinadas, sanitização de SVG, variantes, upload de vídeo próprio.
7. Agendador: o que existe (cron, filas) e como rodar os jobs de docs/02 §6.
8. Transição, View Transitions e dois layouts de raiz no App Router; guarda de saída; offline/fila local.
9. Plano de rotas e redirecionamentos de /professor/*; flag gestao_v2.
10. Decisões pendentes: o que o código diz hoje, as opções e o impacto.
11. Riscos: autorização, vazamento por URL direta, regras de turma, acessos herdados, concorrência, desempenho, 320 px, acessibilidade, conflitos entre quadros e código.
12. Plano em fases pequenas e reversíveis (use as fases do HANDOFF.md §5) com critérios de aceite por fase.
Pare aqui e aguarde minha autorização explícita.

FASE 2: SOMENTE APÓS MINHA AUTORIZAÇÃO, FASE A FASE
Implemente exatamente o plano aprovado. Ao final de CADA fase reporte apenas: o que foi implementado, o que foi adiado de propósito, os checks (typecheck, lint, build e Playwright autenticado em 1440, 1280, 1024, 820, 390 e 320 px, com e sem movimento reduzido, com professor, administrador, membro e sem login), os testes de aceite de docs/05 que passaram, bloqueios reais e o que continua não verificado. Compare visualmente com referencia-png/. Não marque nada como concluído sem QA autenticado de ponta a ponta, build completo e testes de permissão.
```
