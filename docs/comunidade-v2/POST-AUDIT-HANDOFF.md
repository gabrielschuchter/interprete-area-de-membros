# Comunidade V2 — fechamento pós-auditoria e handoff 12A

Data: 23/10/2026. Candidato de código: `a20b28d2d0854c82d543048cc66fb5d81981ea1a`.
Este documento organiza a transição; não executa a Etapa 12A nem autoriza publicação.

## Estado

Correção complementar de RV-01 commitada, seis gates e QA final concluídos;
rechecagem independente do candidato ainda pendente. Não declarar fechamento
antes de registrar os resultados abaixo.

## Contrato corrigido

- O escopo da notificação é persistido sem FK destrutiva e reautorizado na lista,
  resumo, contagens e mutações de leitura. Tipos de leitura são classificados
  explicitamente; tipo desconhecido não recebe acesso por exclusão.
- A migration complementar `20261023120000_notification_community_audience_fail_closed`
  é aditiva à `20261023110000_notification_community_audience`, já commitada.
  Ela fecha notificações comunitárias legadas com escopo NULL e recupera somente
  vínculos com grupo verificável. Um post global antigo e um post cujo grupo foi
  excluído são indistinguíveis: ambos ficam inacessíveis nesse backfill.
  Não há exclusão de conteúdo ou restauração artificial de proveniência.
- Inserts antigos que omitem a coluna recebem o marcador
  `__community_scope_unresolved__`. O produtor atual exige escopo resolvido ou
  NULL explicitamente global. O consumer descarta evento antigo sem escopo se
  o post estiver sem grupo; eventos novos explicitamente globais continuam.
- Locks SHARE de grupo, associação e convite serializam entrega do outbox com
  remoção/arquivo/revogação. Dedupe e retry durável permanecem os existentes.
- A primeira migration revoga grants diretos da Data API. O QA local confirma
  RLS ativo e SELECT negado para anon/authenticated. Não há afirmação sobre
  catálogo remoto nem execução dessas migrations remotamente.

## Evidências

- Harness direcionado externo ao Git:
  `C:\Users\gabsc\AppData\Local\Codex\qa\community-v2-foundation-20261015\tools\rv01-final-targeted.ps1`,
  relatório `rv01-final-targeted-report.json` no mesmo QA root.
  Executou o SQL corretivo em transação com rollback, incluindo exclusão de um
  grupo temporário, recuperação de vínculo vivo e insert que omite a coluna.
  Executou o consumer real em PostgreSQL nas duas ordens de corrida:
  remoção primeiro não entrega; entrega primeiro mantém o lock e a remoção
  concorrente encontra lock_timeout. Replay produz uma linha, nunca duas.
  Evento legado ambíguo é descartado e evento explicitamente global entrega.
  Fixture exclusiva identificada por `qa-rv01-1792773100683` foi preservada;
  grupo e post encerrados como DRAFT. Nenhum registro real foi modificado.
- Seis gates em `4296978`: check 1.058; typecheck 16/16; boundaries 986/19;
  scripts 32 pass/1 skip, App 852/177, API 13/3, domínio 24/5; build 8/8;
  Comunidade 216,2/225 KiB gzip. Logs em `rv01-final-gates/results.json`.
  Runtime/schema/testes do candidato final são idênticos. O único delta é a
  remoção do escape literal inválido da primeira migration, validado pelo
  ensaio SQL completo posterior em `rv01-migrations-sql-report.json`.
  Ambas as migrations foram executadas em tabelas temporárias; sete casos
  passaram e toda a transação foi revertida, sem interferir no E2E ativo.
- Banco QA: 74 migrations concluídas e zero pendentes. A migration complementar
  tem checksum aplicado idêntico ao arquivo final. O histórico local da
  primeira migration tem checksum `0ba36523…`, diferente do arquivo final
  `f7b628c3…`; a diferença já existia antes desta conversa. O ledger não foi
  reescrito para simular igualdade. A sintaxe e o resultado de ambos os SQLs
  finais foram comprovados no ensaio acima. Na 12A, confirmar se ambas estão
  pendentes no alvo remoto; se houver histórico aplicado divergente, reconciliar
  esse histórico explicitamente antes de qualquer migration. Nenhum checksum
  remoto foi consultado ou alterado aqui.
- Espaço local: três runs históricos foram transferidos para
  `D:\CodexQA-preserved\community-v2\verified`, com hashes SHA-256 de todos
  os arquivos conferidos e junções preservando os caminhos originais.
  Ledger: `rv01-evidence-preservation.json` no QA root. Permissões ficaram
  restritas ao usuário e SYSTEM; nenhum artefato foi descartado. Caches locais
  receberam compressão transparente, sem alterar seu conteúdo.
- QA integrado final `6543bd9dd78c4043b0e3da327d056236`: 20 aprovados e
  uma falha de preparação na meta coletiva, em 19,9 min. A campanha QA
  `20261023-130605-25df8a74` da execução anterior interrompida ainda estava
  publicada. Foi arquivada somente essa campanha, sem exclusão de linhas.
  O primeiro reteste `c23408062446430bbc35788a95861784` avançou até o estado
  "Sem registros" e revelou nove sessões da mesma fixture anterior ainda
  elegíveis (inclusive intervalos de borda futuros). Para o reteste final,
  somente essas nove sessões QA foram isoladas temporariamente por endedAt,
  com snapshot para restauração exata e verificação após a execução. Nenhuma
  asserção ou código de produto foi alterado. Reteste final
  `ad6e6f8897d9462296dd14dbcc6f9dae` passou **5/5** em 2,1 min.
  Os nove endedAt originais foram restaurados e conferidos após o run,
  inclusive os valores NULL originais. Não afirmar que o run integrado teve
  21/21: sua única falha foi coberta pelo reteste focado; nenhuma outra
  jornada foi repetida nem a Etapa 10 reaberta.
- Rechecagem adversarial independente: aguardando resultado.
- Spec protegido `apps/app/e2e/community-v2/community-groups.spec.ts` permanece
  fora dos commits, hash Git `43bb75e8482c3638840cbfa760a91e01927ed770`.
  O QA integrado usa esse overlay de teste preservado; o código de produto é o
  candidato commitado. A revisão visual das 53 referências da Etapa 10 permanece
  válida: não houve mudança de UI nesta correção.
- Graphify AST: 8.440 nós, 22.124 arestas, 358 comunidades. Os 76 arquivos SQL
  não foram extraídos por ausência do parser SQL; o SQL foi testado diretamente.

## Requisito de compatibilidade para 12A

A migration protege inserts omitindo a coluna, mas não pode tornar um leitor
antigo seguro: esse binário ignora o escopo. A versão anterior `53d4ae5` também
não é destino seguro de rollback porque deixa ambíguos os casos de grupo excluído.

1. Preparar backup verificável de banco e Storage e um artefato de fallback
   que retenha o schema/Prisma atual, os enums MODERATOR/COHORT e toda esta
   correção. Preferir rollback por avanço compatível; não reverter para main
   antiga nem apagar enums/linhas/notificações.
2. Ensaiar localmente o artefato de fallback com os enums e com eventos antigos
   e novos. A aprovação depende desse ensaio, não só do documento.
3. Planejar retirada de tráfego de todos os leitores incompatíveis (App/API,
   aliases e deployments antigos acessíveis) e pausa/drain de todos os workers
   incompatíveis. APP_WRITE_FREEZE sozinho não bloqueia leituras.
4. Só no processo de release autorizado, sem versões inseguras servindo,
   aplicar ambas as migrations com checksum verificado, subir exclusivamente
   App/API/workers compatíveis e confirmar grants/RLS/negação PostgREST.
   Evitar janela de coexistência: o default não corrige um worker intermediário
   que escreva NULL explicitamente. Não religar versões antigas em rollback.
5. Liberar tráfego e recuperação somente após a reconciliação das filas,
   origem/namespace, contagens e comportamento de membro removido. Preservar
   backlog legado ambíguo sem revelar ou apagar seu conteúdo.

Esse é um requisito operacional ainda não ensaiado, não uma comprovação de
rollout/rollback remoto.

## Escopo do preflight da Etapa 12A

| Item | Classe | Condição para release |
|---|---|---|
| RV-01 | Código/segurança | Rechecagem do candidato final, incluindo o legado excluído e outbox concorrente |
| RV-02 / OPS-01 | Operacional | Diagnosticar recovery e observar runs periódicos com recuperação real |
| RV-03 | Compatibilidade operacional | Ensaiar fallback compatível e retirada de leitores/workers antigos |
| RV-04 | Preflight de dados | Consulta atual de duplicados de convites, backup e resultado esperado antes da migration |
| RV-05 | Validação de performance | Percentis autenticados, papéis e rede/dispositivo/cache representativos |
| Grants/RLS, Clerk/Supabase, Storage, crawler Preview, Broadcast | Validação remota | Confirmar no alvo real autorizado; QA local não substitui essas provas |

Os gates remotos e operacionais mantêm o release em NO-GO. Não reabrem a Etapa
10 nem exigem outra auditoria geral do código. O avanço para planejar/executar
12A ocorre em conversa própria após fechamento formal de RV-01; nenhuma tarefa
de 12A, migration remota, alteração em GREEN/BLUE/Production, mudança de cron,
credencial, alias ou publicação foi executada aqui.
