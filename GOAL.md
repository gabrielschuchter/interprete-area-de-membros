# GOAL · Implementar a Gestão do Interprete (execução autônoma)

> Coloque este arquivo na **raiz do repositório** (junto com `PROGRESS.md` e `DECISIONS.md`) e a pasta `interprete-gestao-handoff/` em um caminho conhecido (ex.: `docs/gestao-handoff/`). A meta do `/goal` aponta para cá. **Releia este arquivo ao começar e depois de qualquer compactação de contexto.**

## 1. Missão

### Prioridade vigente — 13/10/2026

Por instrução do usuário, a próxima entrega é um **MVP funcional local**:
professor/admin gerencia turma e conteúdo, aluno acessa somente o autorizado
e envia uma atividade, professor corrige e o resultado permanece após reload.
Escolher uma unidade vertical por vez, reutilizando fluxos e fixtures existentes.
Persistência, autorização fresca, negação fora do perfil, desktop/mobile sem
overflow e controles com ação são requisitos dessa entrega.

O contrato completo abaixo permanece como backlog de aceite. Comparação dos
101 quadros, acabamento, Clerk real, YouTube real e cobertura integral ficam
identificados separadamente, salvo quando bloquearem o MVP. Não é necessário
encerrar o visual do Main para verificar a jornada seguinte. Gates verdes,
capturas e MVP local não promovem fases nem quadros sem seus critérios originais.
Continuam proibidos banco remoto/Production, push, merge, deploy e exclusão.

Goal solicitado em 13/10: fechar T2 do MVP com matrícula/acesso/reload e
remoção/revogação da origem da turma, preservando concessão direta e histórico;
negação real fora do perfil, smoke1440/390/320, gates, documentação e commit.
Estado/evidência dessa unidade em `docs/gestao/STATUS.md` e final de PROGRESS.
O goal não concede aceite visual nem altera os limites locais acima.

Entregar a **Gestão** descrita no handoff, **funcionando de verdade e visualmente idêntica aos quadros**, sem ajuda humana. O resultado final será avaliado como se fosse produto: não basta existir a tela; cada botão, filtro, regra de turma, envio, calendário, vídeo do YouTube, medalha e permissão precisa funcionar.

**Quem executa é você, sozinho.** Ninguém responde perguntas durante a execução. Você mesmo decide, contorna e verifica.

## 2. Definição de TERMINADO (todos os itens, com evidência)

Marque cada item em `PROGRESS.md` **somente** com a evidência anexada (saída do comando, caminho da captura, nome do teste).

1. **Quadros:** todos os quadros do índice do `HANDOFF.md §8` estão implementados. Um quadro só conta como concluído quando cumpre os **8 itens do §4**.
2. **Qualidade:** `typecheck`, `lint` e `build` passam sem erros; sem erros no console do navegador nas telas novas.
3. **Funcional:** os cenários de `docs/05-testes-de-aceite.md` (T1–T8, E1–E8, C1–C5, Y1–Y7, A1–A3, D1–D6, M1–M5, N1–N9, R1–R3) existem como **testes automatizados** (Playwright/integração) e **passam**. Os que dependem de serviço externo real (YouTube) passam com o adaptador de teste e ficam marcados `NÃO VERIFICADO COM API REAL`.
4. **Permissões:** a matriz de `docs/05 §3` é testada para os 4 perfis (sem login, membro, professor responsável, professor de outra turma) e admin, **no servidor** (incluindo URL direta e Server Actions chamadas fora da interface).
5. **Visual:** para cada quadro, uma captura da tela implementada, com o **seed visual** (§6), foi comparada com `referencia-png/` nos tamanhos aplicáveis. Diferenças só de renderização de fonte são aceitáveis; diferenças de layout, medida, cor, estado ou texto **não** são.
6. **Responsivo e acessível:** 1440, 1280, 1024, 820, 390 e 320 px, com e sem movimento reduzido; sem rolagem horizontal; teclado completo; foco visível; transições conforme `docs/04 §2`.
7. **Sem enfeite:** nenhuma ação sem efeito. Rode uma varredura: todo botão/link/menu das telas novas leva a uma rota existente ou dispara uma ação real. Controles sem função foram removidos e listados em `PROGRESS.md`.
8. **Migrations:** aditivas, versionadas, aplicadas em banco local, com *rollback* documentado; nenhuma migration destrutiva; **nada aplicado em banco remoto**.
9. **Documentação final:** `PROGRESS.md` completo, `DECISIONS.md` atualizado, e um `docs/gestao-implementacao.md` curto (como rodar, como testar, variáveis de ambiente novas, o que ficou não verificado, o que depende do YouTube real).

## 3. Fases (ordem e dependências)

Use as fases do `HANDOFF.md §5`. Cada fase termina com: testes da fase passando, commit, `PROGRESS.md` atualizado. **Comece pela Fase 0 (auditoria)**, mas **não pare** ao terminá-la: registre o relatório em `docs/gestao-auditoria.md` e siga para a Fase 1.

| Fase | Foco |
|---|---|
| 0 | Auditoria do repositório (evidências), mapa quadro → código, lacunas |
| 1 | Shell da Gestão, `authorize()`, rotas, redirecionamentos `/professor/*`, item "Gestão", transição e estados de entrada, flag `gestao_v2` |
| 2 | Turmas + `resolveStudentFeed` / `resolveAccess` / `resolveCalendar` |
| 3 | Ensino: cursos e aulas com YouTube, atividades, exercícios, biblioteca, coleções |
| 4 | Envios (destaque, pendência, aviso), cronograma, calendário da turma, **Aprender do aluno**, Personalização |
| 5 | Alunos: acompanhamento, perfil, correções com rubrica |
| 6 | Comunidade: moderação, grupos, avisos, encontros |
| 7 | Administração: papéis, acessos, gravações históricas, integrações, **medalhas (museu)**, auditoria |
| 8 | Notificações, busca, "Ver como aluno", boas-vindas, interrupções |
| 9 | Responsividade, acessibilidade, desempenho, QA final, documentação |

## 4. Quando um quadro está CONCLUÍDO (8 itens)

1. Rota existe e a permissão é verificada no servidor.
2. Dados vêm do banco (sem mock); *seed* só em desenvolvimento.
3. Todas as ações do `docs/03` para essa tela funcionam e gravam.
4. Validações no servidor com mensagens nos campos.
5. Estados: carregando, vazio, sem resultados, erro, sem permissão.
6. Fiel ao quadro (comparação visual feita).
7. Responsivo conforme `docs/04 §7`.
8. Teste automatizado cobrindo o fluxo principal.

## 5. Como trabalhar (o loop, para cada unidade)

1. **Estudar:** quadro (HTML pelo código-fonte + PNG), `docs/01` e `docs/03` da tela, código existente relacionado. Reutilize o que já existe.
2. **Implementar** em passos pequenos e revisáveis (um commit por unidade coerente).
3. **Verificar você mesmo:** rode testes, abra no navegador, compare com a referência.
4. **Registrar:** `PROGRESS.md` (o que foi feito, evidência, pendências); decisões em `DECISIONS.md`.
5. **Commitar** na branch `gestao-v2` (mensagem objetiva).
6. **Verificação independente ao fim de cada fase:** abra uma sessão/subagente **sem o contexto da implementação** (ou releia só os critérios) e teste a fase como um usuário. **Quem constrói não é quem aprova sozinho.** Corrija o que encontrar antes de seguir.

Se o contexto for compactado, **releia `GOAL.md`, `PROGRESS.md` e `DECISIONS.md`** antes de continuar. O estado confiável está nesses arquivos e no Git, não na sua memória.

## 6. Ambiente e acesso (você precisa se virar sozinho)

**Aba do navegador:** o usuário deixou uma aba aberta e autenticada com a plataforma. Use-a para **estudar o comportamento atual** (rota `/professor` e suas 16 abas, Aprender, Encontros, etc.) e capturar telas de referência.
- Identifique o endereço da aba. Se **não** for `localhost`/`127.0.0.1`, é **PRODUÇÃO ou dados reais**: **somente leitura**. Não clique em salvar, enviar, publicar, excluir, convidar, revogar ou qualquer ação que grave. Não copie nem registre cookies, tokens ou dados pessoais dos alunos em arquivos, logs ou commits.

**Servidor local:** suba o app local e o banco de desenvolvimento (Supabase local/*shadow*). Descubra como pelo `README`/`AGENTS.md`/scripts. Se faltar variável de ambiente, procure `.env.example`, crie `.env.local` com valores de **desenvolvimento** e documente. Nunca use credenciais de produção.

**Autenticação local para QA (nesta ordem, use a primeira que funcionar):**
1. Reutilizar a sessão do navegador/ferramenta de browser disponível, se o app local compartilhar a instância de desenvolvimento do Clerk.
2. Criar usuários de teste (membro, professor A, professor B, admin) na **instância de desenvolvimento** do Clerk, por API/CLI, se houver chaves de desenvolvimento.
3. Criar um **modo de autenticação de teste** habilitado **apenas** com `NODE_ENV=development` **e** variável explícita (ex.: `GESTAO_DEV_AUTH=1`), que **falha a inicialização** se estiver ligado em produção, e que não existe no *build* de produção. Documente em `docs/gestao-implementacao.md`.

**Dois seeds de desenvolvimento (nunca em produção):**
- **Seed funcional:** 3 turmas (ativa, não iniciada, encerrada), 12 alunos, 2 professores, 1 admin, 2 cursos, 6 aulas (vídeos do YouTube **não listados de teste** e um privado), 5 atividades com entregas, 3 encontros, 8 medalhas com símbolos de teste.
- **Seed visual:** reproduz **exatamente os dados de exemplo dos quadros** (nomes, números, datas) para que a captura da tela implementada seja comparável com `referencia-png/`.

**Ferramentas:** Playwright é permitido como dependência de desenvolvimento se ainda não existir. Outras dependências só se indispensáveis (de preferência as que o repositório já usa); registre o motivo em `DECISIONS.md`.

## 7. Política de autonomia (o que fazer quando…)

| Situação | O que fazer |
|---|---|
| **Dúvida de produto** | Use o padrão em `DECISIONS.md`/`HANDOFF.md §6`. Registre. **Não pergunte, não espere.** |
| **Quadro e código divergem** | Visual: o quadro vence. Funcional: `docs/` vence. Convenções do repositório (nomes, pastas, estilo): o repositório vence. Registre. |
| **Falta credencial/serviço externo** (ex.: chave do YouTube, e-mail) | Implemente atrás de um **adaptador** (interface + implementação real + implementação de teste/determinística). Use a de teste em desenvolvimento e testes. Marque `NÃO VERIFICADO COM SERVIÇO REAL`. **Siga adiante.** |
| **Teste falhando** | Corrija a causa. Depois de 3 tentativas com a mesma abordagem, mude de abordagem. **Nunca** enfraqueça ou apague um teste para passar; se o teste estiver errado, corrija-o e explique. |
| **Bloqueio de ambiente** (porta, dependência, banco) | Resolva sozinho: leia logs, README, scripts; reinicie serviços; recrie o banco local. Se persistir, documente e **trabalhe em outra frente**; volte depois. |
| **Dado existente conflita com o modelo novo** | Adapte o código ao dado (camada de compatibilidade). **Nunca** migre ou apague dado existente. **Não matricule alunos existentes em turmas automaticamente.** |
| **Algo parece perigoso** (apagar, produção, segredos) | **Não faça.** Registre em `DECISIONS.md` e escolha a alternativa segura. |
| **Escopo crescendo** | Priorize pelos quadros e critérios do §2. Itens de "segue o padrão" não são opcionais. Não invente funcionalidades fora do handoff. |
| **Orçamento acabando** | Pare em um ponto estável, deixe `PROGRESS.md` com o estado exato, o que falta e os próximos passos, e tudo commitado. |

## 8. Limites absolutos (nunca, em hipótese alguma)

- Production, banco remoto ou compartilhado, serviços pagos reais, envio de e-mail/notificação a pessoas reais.
- `git push --force`, merge em `main`, release, alteração de CI/deploy de produção.
- Apagar dados; migrations destrutivas; mexer em dados reais de alunos.
- Expor ou registrar segredos, tokens, cookies ou dados pessoais.
- Trocar provedor de autenticação; adicionar Neon; reescrever Clerk/Supabase/next-forge.
- Código de produção com *mock* ou dados fixos; botões decorativos.
- Desenhar símbolos de medalha no código: o símbolo é **upload** (placeholder neutro só quando não houver arquivo).
- Declarar sucesso sem evidência.

## 9. Relatório final (obrigatório)

Ao terminar (ou ao esgotar o orçamento), escreva em `PROGRESS.md`:

1. O que foi implementado (por fase), com evidências.
2. O que **não** foi verificado e por quê.
3. Decisões tomadas (resumo de `DECISIONS.md`).
4. Como rodar, testar e reverter (flag `gestao_v2`).
5. Riscos conhecidos e o que um humano deve revisar primeiro (autorização, regras de turma, migrations).
6. Lista de controles removidos por não terem função.
