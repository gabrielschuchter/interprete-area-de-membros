# 05 · Testes de aceite

Nada é "pronto" sem estes testes passando **em um navegador autenticado**, com dados reais de teste (não *mocks*), nos tamanhos 1440, 1280, 1024, 820, 390 e 320 px, com e sem movimento reduzido. Escreva-os como testes automatizados (Playwright) sempre que possível; os demais são roteiro manual.

## 1. Critérios globais ("definição de pronto")

1. **Visual:** cada tela é fiel ao quadro correspondente (medidas, cores, tipografia, espaçamento, estados). Comparar com as capturas em `referencia-png/` (diferença visual aceitável: renderização de fontes).
2. **Funcional:** todo controle faz o que `docs/03` descreve, com persistência real e validação no servidor.
3. **Sem enfeite:** nenhum botão, filtro ou menu que não faça nada.
4. **Estados:** carregando, vazio, sem resultados, erro, sem permissão e confirmação existem e funcionam.
5. **Permissão:** cada rota e ação recusa quem não pode (testar com professor, administrador, membro e sem login).
6. **Acessibilidade:** teclado completo, foco visível, leitor de tela nas transições e diálogos.
7. **Qualidade:** typecheck, lint e build passam; sem erros no console; sem rolagem horizontal; CLS 0 nas transições.
8. **Auditoria e notificações** conforme `data/events.json`.

## 2. Cenários funcionais

### Turmas
- **T1.** *Dado* um administrador, *quando* cria "Turma Teste" com datas válidas e um responsável, *então* ela aparece em Turmas como "Não iniciada"/"Em andamento" conforme as datas e em todos os filtros de turma.
- **T2.** *Dado* uma turma com um curso liberado, *quando* adiciono o aluno A, *então* A vê o curso em Aprender; *quando* removo A, *então* A **não** vê mais o curso, mas **mantém** suas entregas e um acesso direto que já tinha.
- **T3.** *Dado* `lateJoinPolicy = ALL_ACTIVE`, *quando* o aluno B entra depois que uma atividade foi atribuída à turma, *então* B vê a atividade aberta; com `FROM_JOIN`, **não** vê.
- **T4.** *Quando* adiciono uma planilha CSV com uma linha de e-mail inválido, *então* vejo a prévia com o erro **por linha** e só as linhas válidas são importadas após confirmar.
- **T5.** *Quando* movo um aluno da turma X para Y, *então* a operação é atômica, a auditoria registra `cohort.member.moved` e o aluno passa a receber o que Y oferece.
- **T6.** *Quando* duplico uma turma, *então* o cronograma é copiado com as datas deslocadas, as atividades viram **rascunho** e **nenhum aluno** é copiado.
- **T7.** *Dado* um aluno em duas turmas, *então* ele vê a união; um item que chega pelas duas aparece **uma vez**.
- **T8.** *Dado* um professor que não é responsável pela turma Z, *então* Z não aparece para ele em nenhuma lista nem na busca, e `/gestao/alunos/turmas/Z` retorna restrito.

### Envios, destaques e Aprender
- **E1.** *Quando* envio uma aula **em destaque** para a turma com recado, *então* o cartão aparece em Aprender de todos os alunos ativos, com o recado e a foto do professor, **sem** gerar pendência.
- **E2.** *Quando* envio **pendência com prazo**, *então* ela aparece em Pendências, no calendário e no Planejamento; ao concluir (aula ≥ 90% assistida), sai de Pendências.
- **E3.** *Dado* 4 destaques ativos, *então* só 3 aparecem; reordenar na Gestão muda a ordem em Aprender imediatamente.
- **E4.** *Quando* o período do destaque termina, *então* ele sai de Aprender sozinho (job `activate-deliveries`).
- **E5.** *Quando* envio com alvos vazios, *então* o envio é bloqueado com a mensagem do campo.
- **E6.** A **prévia ao vivo** de `GEnviar` é igual ao que o aluno vê depois de enviar.
- **E7.** *Quando* revogo um envio de curso, *então* só o acesso criado por **esse** envio é revogado; acessos diretos ou da turma continuam.
- **E8.** *Dado* uma turma sem pendências nem destaques, Aprender mostra só a experiência padrão (sem blocos vazios); turma nova mostra a mensagem de preparação.

### Calendário e cronograma
- **C1.** *Quando* clico num dia no calendário da turma e escolho "Novo encontro", *então* o formulário abre com a turma e a data preenchidas; ao publicar, o encontro aparece no calendário do aluno.
- **C2.** Rascunhos aparecem tracejados na Gestão e **não** aparecem para o aluno.
- **C3.** *Quando* defino a liberação da aula 6 para 21/10, *então* a aula só fica visível a partir dessa data (teste com relógio simulado).
- **C4.** O `.ics` assinado reflete o calendário da turma; revogar o link o invalida.
- **C5.** Dois itens no mesmo dia geram aviso de conflito, sem bloquear.

### YouTube
- **Y1.** Colar link **não listado** válido → título, duração e miniatura aparecem; publicar a aula funciona; o aluno vê o vídeo no player do Interprete (sem expor o link).
- **Y2.** Link **público** → aviso, permite salvar e publicar com aviso.
- **Y3.** Link **privado / não encontrado / incorporação desativada / inválido** → mensagem do estado correto; **publicar bloqueado**; rascunho salva.
- **Y4.** YouTube fora do ar → "Não foi possível verificar agora"; salvar rascunho permitido; nova verificação automática.
- **Y5.** Um vídeo publicado fica privado → o job diário marca a aula, notifica os responsáveis e o aluno vê "Este vídeo está indisponível" com os materiais.
- **Y6.** Importar lista de reprodução → cria uma aula por vídeo na ordem da lista; privados não são importáveis.
- **Y7.** Progresso ≥ 90% no player marca a aula como concluída e soma tempo de estudo.

### Correção e atividades
- **A1.** Atividade com critérios (pesos somando 100%) → publicar cria o envio; pesos ≠ 100% bloqueiam.
- **A2.** Enviar feedback exige comentário; ao enviar, a entrega vira Corrigida, o aluno é notificado e a próxima da fila abre. Rascunho é preservado ao sair.
- **A3.** "Lembrar a quem não entregou" notifica só quem não entregou naquela turma.

### Administração
- **D1.** Alterar papel exige confirmação com efeitos, registra auditoria e vale na **próxima requisição** do usuário.
- **D2.** Não é possível rebaixar o último administrador.
- **D3.** Acessos mostram a **origem**; revogar uma concessão direta **não** remove o acesso por turma/atribuição.
- **D4.** Vincular gravação histórica exige confirmação de identidade e evidência; cria o acesso `HISTORICAL` e o registro no histórico do grupo.
- **D5.** Personalização: alterações ficam em rascunho; **Publicar** altera Aprender de todos de uma vez; **Descartar** volta ao publicado; desligar Pendências pede confirmação.
- **D6.** Professor abre `/gestao/administracao/...` por URL → restrito, **sem payload** de dados (verificar a resposta da rede).

### Medalhas
- **M1.** Trocar o símbolo por um SVG válido → museu, detalhe e museu do aluno atualizam; histórico guarda a versão anterior; **Restaurar** funciona.
- **M2.** SVG com `<script>` ou evento embutido → é **sanitizado** (conteúdo perigoso removido) ou rejeitado; nunca executa.
- **M3.** Arquivo não quadrado, grande demais ou de tipo inválido → erro no campo, sem alterar a medalha.
- **M4.** Mudar o critério cria nova versão; conquistas antigas continuam válidas; cada membro recebe a medalha **uma vez**.
- **M5.** Medalha bloqueada aparece em silhueta com progresso para o aluno.

### Navegação, transições e interrupções
- **N1.** Professor vê "Gestão" no menu; membro comum não vê (nem por link).
- **N2.** Transição Área → Gestão: duração ≈ 400 ms, sem salto de layout, foco no título, anúncio de leitor de tela; com movimento reduzido: fusão de 120 ms.
- **N3.** "Voltar à área de membros" leva à **página de origem**.
- **N4.** "Ver como aluno" não grava nada; "Sair da prévia" volta ao ponto exato.
- **N5.** Sair com alterações abre o diálogo; **Continuar editando** é o foco padrão; voltar do navegador também aciona.
- **N6.** Sessão expira durante a edição → diálogo; após entrar, o conteúdo digitado é restaurado.
- **N7.** Dois usuários editam o mesmo aviso → o segundo vê o diálogo de conflito com as três opções.
- **N8.** Papel revogado durante o uso → próxima ação mostra a faixa e a tela vira restrita.
- **N9.** Sem conexão → faixa; edições sobem quando a rede volta, em ordem.

### Responsividade
- **R1.** 1024–1279 px: trilho de 72 px; passar o mouse/tocar abre o submenu; teclado também.
- **R2.** < 768 px: tabelas viram cartões; modais viram folhas; barra de ação fixa não cobre o último campo; abas viram seletor; arrastar vira "Mover para…".
- **R3.** Nenhuma rolagem horizontal de 320 a 1920 px.

## 3. Matriz de papéis (testar cada linha com 4 usuários)

| Ação | Sem login | Membro | Professor (responsável) | Professor (outra turma) | Admin |
|---|---|---|---|---|---|
| Abrir `/gestao` | login | 403 | ok | ok | ok |
| Ver a turma Z | — | 403 | ok | **403** | ok |
| Corrigir entrega da turma Z | — | 403 | ok | **403** | ok |
| Alterar papel | — | 403 | **403** | **403** | ok |
| Conceder acesso | — | 403 | **403** | **403** | ok |
| Personalização, Medalhas, Integrações, Auditoria | — | 403 | **403** | **403** | ok |
| "Ver como aluno" | — | 403 | ok | ok | ok |

## 4. Dados de teste (somente para desenvolvimento)

Crie *seeds* de desenvolvimento com 3 turmas (ativa, não iniciada, encerrada), 12 alunos, 2 professores, 1 admin, 2 cursos, 6 aulas (vídeos do YouTube **não listados de teste** e um privado), 5 atividades, 3 encontros, 8 medalhas com símbolos de teste. **Jamais use esses dados em produção.**
