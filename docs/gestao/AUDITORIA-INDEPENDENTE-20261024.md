# Gestão V2: auditoria independente e correções (24/10/2026)

Auditoria feita por execução, não por leitura de relatórios anteriores. Base: `main` em `b5a2f06`. Ambiente: PostgreSQL 16 local com TLS, 68 migrations aplicadas, seed funcional (`seed:gestao`, perfil `functional`: 1 admin, 2 professores, 12 alunos, 3 turmas), quatro servidores de desenvolvimento, um por papel (admin, professor responsável, professor de outra turma, aluno), Playwright. Nada foi aplicado ao banco GREEN; esta entrega não adiciona migration. Evidência visual e scripts ficaram fora do Git (`/tmp/claude-0/audit`).

Convenção: **Verificado** = exercitado em navegador autenticado ou por SQL contra o banco local. **Renderiza** = a rota responde 200 com o título esperado em 1440 e 390, sem o fluxo ter sido exercitado. **Inferido** = lido no código, não executado. **Ausente** = não existe no produto. Esses níveis não se misturam abaixo.

## O que a auditoria encontrou

O núcleo de Ensino e Turmas já existia e funciona. O que estava errado era a costura. Comunidade, Administração, Atribuições e Tarefas só redirecionavam para o `/admin/*` antigo, que usa outro chrome e tira a pessoa da Gestão. Oito rotas do roteiro respondiam 404 (busca, notificações, auditoria, integrações, acompanhamento, reconhecimento, prévia, grupos). A Visão geral mostrava apenas o número de entregas a corrigir. O menu Criar tinha quatro itens em vez de nove, não havia Ctrl K nem migalhas fora de Cursos, e a visão geral da turma não tinha "Esta semana", "Alunos que pedem atenção" nem as métricas de prazo e presença. O perfil do aluno era a página administrativa antiga, só para admin e sem escopo de turma. Nenhuma troca de papel, concessão ou revogação de acesso gravava evento, e o último-admin só era protegido no caso de autorrebaixamento. A caixa de boas-vindas abria durante a hidratação e gerava divergência de hidratação em quase toda página.

O escopo no servidor estava correto, e isso é o dado mais importante para segurança: professor fora da turma recebe 403 ou 404 sem vazar nomes, professor e aluno recebem 403 em Administração, e a fila de correções de um professor só contém as turmas dele. Uma varredura estática dos arquivos `*actions*.ts` de `gestao/` e `admin/` não achou server action sem checagem de papel; a única sem chamada direta é a busca, que checa o papel dentro de `searchGestao`.

## O que foi feito (branch `claude/project-thread-5tid4z`)

Integração ao shell: páginas de Comunidade (publicações, avisos, encontros), Administração (membros, acessos, gravações históricas, personalização, medalhas), Atribuições e Tarefas agora vivem em `/gestao/*` e reexportam a tela existente; o proxy redireciona 307 as URLs `/admin/*` equivalentes para `/gestao/*` quando `GESTAO_V2_ENABLED=true`. Não editei páginas legadas de Comunidade para não colidir com `codex/comunidade-v2`.

Navegação: Ctrl K com busca escopada por papel (alunos, turmas, atividades, cursos, aulas, materiais, avisos, encontros) e página `/gestao/busca`; `/gestao/notificacoes`; menu Criar com dez itens; migalhas por rota; subitens de Alunos, Comunidade e Administração; itens bloqueados para professor não expõem filhos.

Alunos: `/gestao/alunos/acompanhamento` (situação calculada: Atenção a partir de 5 dias sem estudar ou entrega atrasada, Inativo a partir de 21 dias; filtros por turma, curso, situação e busca; exportação CSV com proteção contra injeção de fórmula), perfil pedagógico nativo com escopo, `/gestao/alunos/reconhecimento`, aba Atividades da turma e, na visão geral da turma, entregas no prazo, presença média, atividades abertas, encontros futuros, "Esta semana" e "Alunos que pedem atenção" pela mesma regra do Acompanhamento.

Visão geral: itens acionáveis reais (entregas a corrigir, atrasadas, alunos que pedem atenção, encontros em rascunho, cursos e atividades em rascunho, vídeos indisponíveis, gravações sem vínculo), próximos encontros, movimentação recente, atalhos e bloco Institucional para admin. Todos os números vêm do banco e respeitam `?turma=`.

Administração: Registro de atividades (`/gestao/administracao/auditoria`) lê `DomainEvent`, filtra por quem, ação e período e exporta CSV; Integrações (`/gestao/administracao/integracoes`) mostra o modo do YouTube (nunca a chave) e os vídeos indisponíveis. Troca de papel passa a exigir confirmação com os efeitos, roda em transação, grava `gestao.member.role_changed` e recusa rebaixar o último admin ativo em qualquer caminho. Concessão e revogação de acesso e mudança de situação de curso e percurso gravam evento. Não foi criada tabela nova: o registro reutiliza `DomainEvent`.

Correções de defeito: o nome de classe `gt-roster-search` colava em `gt-addable-search` (faltava espaço), o que quebrava o layout da busca de membros; a boas-vindas passou a abrir 700 ms após a montagem, eliminando os erros de hidratação; rolagem horizontal a 320 px em Notificações e a 390 px em listas; o `display: grid` das listas não usava `minmax(0, 1fr)`.

## Matriz de cobertura (docs/03 e docs/05)

| Área | Situação | Evidência e observação |
|---|---|---|
| Shell, Criar, migalhas, Ctrl K, busca, notificações | Verificado | Busca por papel testada; Criar com 10 itens (Grupo de estudo fora: depende de `codex/comunidade-v2`) |
| Acesso restrito sem payload (D6) | Verificado | Professor recebe 403 em auditoria, exportação, integrações e membros, e o corpo da resposta só contém o nome do próprio professor (sidebar) |
| Boas-vindas "uma vez por usuário, em preferências" | Parcial | Uma vez por navegador (localStorage); falta persistir em preferências do usuário |
| Ver como aluno (`/gestao/previa`, N4) | Ausente | Decisão deliberada, ver recomendações |
| Visão geral (A) | Verificado | admin, professor, 1440 e 390. Faltam "solicitações de acesso" (não existe modelo) |
| Turmas: lista, nova (T1), visão geral, alunos, adicionar, remover, mover (T2, T3, T5) | Verificado | T2 e T3 comprovados do lado do aluno; T5 atômico com evento `members_moved` |
| Turma: duplicar (T6) | Parcial | Copia cursos e liberações sem alunos; **não copia atividades como rascunho** (spec) |
| Turma: importar planilha CSV (T4), convites, `.ics`, conflitos de calendário (C4, C5) | Renderiza | Telas existem; fluxo não exercitado |
| Turma: cronograma e calendário (C1 a C3) | Renderiza | Não exercitado, inclusive liberação por data com relógio simulado |
| Turma: Avisos (aba) e "Enviar aviso à turma" | Ausente | Depende de avisos por turma de `codex/comunidade-v2` |
| Turma: "Quem recebe o quê" | Parcial | "Conteúdos desta turma" mostra cursos liberados, sem atividades e avisos |
| Ensino: cursos, curso, aula, importar lista, percursos, exercícios, atividades, biblioteca, coleções | Renderiza | Todas respondem 200 como admin; editores, YouTube (Y1 a Y7), pesos de critério (A1) e lote da biblioteca não foram exercitados nesta auditoria |
| YouTube: verificação diária e notificação (Y5) | Ausente | Não há job; a página Integrações só mostra o estado gravado na última verificação |
| Alunos: acompanhamento, perfil, reconhecimento | Verificado | Escopo, CSV e 404 de aluno fora de escopo |
| Correções (A2) | Verificado | Comentário obrigatório, entrega vira Corrigida, aluno notificado, abre a próxima |
| Atribuições, destaques, "Enviar ao aluno", entregas com prévia (E1 a E8) | Ausente | Não existe `Delivery`; ver recomendações |
| Tarefas e metas | Renderiza | Re-export do admin antigo |
| Comunidade: publicações, avisos, encontros | Renderiza | Re-export do admin antigo. O editor de avisos digita IDs de membro à mão e não tem público por turma (quadro 77); `codex/comunidade-v2` resolve |
| Comunidade: grupos, denúncias | Ausente | `codex/comunidade-v2` |
| Administração: membros e papéis (D1, D2) | Verificado | Confirmação, auditoria, último admin bloqueado, vale na próxima requisição (N8) |
| Administração: "capacidades por professor" | Ausente | Sem modelo de capacidades |
| Administração: acessos com origem (D3) | Renderiza | Origem existe na tela de curso; revogação de grant direto não foi testada contra acesso por turma |
| Administração: gravações históricas (D4) | Renderiza | Vínculo não exercitado; sem `AccessGrant` de origem HISTORICAL nem evidência obrigatória |
| Administração: personalização (D5) | Renderiza | Rascunho, publicar e descartar não exercitados |
| Administração: medalhas (M1 a M5) | Parcial | Há definição versionada (`BadgeDefinitionRevision`) e URL de imagem; **não há upload de símbolo, sanitização de SVG nem Restaurar** |
| Administração: integrações | Parcial | Somente leitura (YouTube por chave de API, como decidido). Não há conectar canal por OAuth |
| Registro de atividades | Parcial | Cobre papéis, acessos, turmas, cursos, aulas, coleções e encontros. Faltam feedback enviado, avisos publicados, vínculo histórico, medalhas, personalização |
| Responsivo (R1 a R3) | Verificado | 25 rotas sem rolagem horizontal em 1280, 1024, 820, 390 e 320 após as correções |
| Acessibilidade e movimento reduzido | Não auditado | Foco e rótulos só observados em passagem; sem teste com leitor de tela |
| Fidelidade visual ao PNG | Parcial | Visão geral, turma e acompanhamento revisadas a olho contra 23, 24, 36; sem diferença automatizada, os 101 quadros não foram percorridos |

## Evidência, inferência e recomendação

**Evidência.** Typecheck (16 pacotes), `turbo boundaries` (966 arquivos), 829 testes em 168 arquivos, `next build` de produção e orçamento de desempenho passam. Sem CI no repositório: esses gates rodaram localmente. Passar nos gates não prova o produto; o que prova são os fluxos acima, rodados em navegador por papel. Antes das correções, o console tinha erro de hidratação em `/gestao`, biblioteca, coleções, turmas e medalhas; depois, nenhuma dessas páginas emite erro.

**Inferência.** A ausência de `Delivery` não é descuido do Codex: decisões posteriores de produto (Cursos não mostra tarefas; avisos da Gestão aparecem na Comunidade) tornam "Enviar ao aluno" em modo destaque ou pendência um conceito superado, não uma tela faltando. Isso é uma leitura minha das decisões registradas, não uma decisão do Gabriel sobre esses quadros; as telas GDestaques, GEnviar e GNovaAtribuicao precisam de decisão explícita (descartar ou redefinir).

**Recomendação.** (1) Decidir o destino de Delivery e Destaques antes de qualquer trabalho em E1 a E8. (2) Não construir "Ver como aluno" por troca de identidade sem revisão de segurança: o desenho que considero seguro é cookie de prévia só para staff, cabeçalho interno removido pelo proxy, bloqueio de escrita fora de `/gestao` no servidor e `requireGestaoActor` sempre com a identidade real; é uma feature de risco para entregar sem revisão. (3) Mergear `codex/comunidade-v2` antes de tocar em avisos, grupos e denúncias; a reexportação atual será substituída sem conflito, porque esta entrega não editou esses arquivos. (4) Upload de símbolo de medalha exige decisão sobre bucket e sanitizador de SVG; hoje a imagem é URL validada (`http`/`https`) e renderizada em `<img>`, o que não executa script. (5) Criar o job diário de verificação do YouTube só depois de a chave de API estar configurada em produção. (6) Persistir a boas-vindas em preferências do usuário exige coluna nova; fica para quando houver outra migration.

## Entrega e operação (24/10/2026)

O PR #18 foi mergeado na `main` como `de12af7` (squash). O primeiro build de preview da Vercel falhou em `check:performance`: o calendário da turma chegou a 231593 bytes gzip de JavaScript inicial contra o teto de 230400, e a rota somou 226,2 KiB contra 225,0. O número local era 222,8 KiB, porque a Vercel mede cerca de 3 KiB a mais; o gate local, portanto, não basta como margem e convém deixar pelo menos 3 KiB de folga. A causa foi o shell da Gestão, que passou a carregar a busca (Ctrl K) em todas as rotas, somado ao diálogo de encontros de 594 linhas embutido no editor do calendário. Os dois passaram a ser importados dinamicamente (`gestao-search-dialog.tsx` e `CohortMeetingDialog` via `next/dynamic`), e o orçamento não foi alterado. Ctrl K, retorno de foco, busca e abertura do diálogo de encontros foram conferidos em navegador depois da mudança.

A integração Git da Vercel não dispara deploy neste projeto. O deploy é feito por `create_deployment` com `gitSource` (github, `ref`, `sha`), e o alias canônico `interprete-area-de-membros.vercel.app` precisa ser repontado à mão depois de cada deploy de produção. O deploy de produção anterior à Gestão v2 era `dpl_67N5ST2Dn3NR5XF2n4aekveAaXWF`; reapontar o alias para ele desfaz a entrega sem tocar no banco, já que não há migration.
