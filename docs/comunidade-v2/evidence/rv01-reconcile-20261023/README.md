# RV-01 — reprodução conclusiva no QA migrado

23/10/2026. Base: `93f053cecb91b60d2d32ba4bd0d0514485bc5663`, descendente
do código `80f6c1341acea4a56830d4091cc10e904e1cbbcc`, mais a migration 1400
e seu teste já preservados no worktree. Nenhum código de runtime foi alterado.

- `rv01-existing-null-notification-before-reconcile.json`: relatório original
  preservado; fixture visível antes da reconciliação.
- `rv01-existing-null-notification-report.json`: repetição sem alteração do
  script original do auditor; fixture invisível na mesma consulta com cursor.
- `rv01-endpoint-reconcile-report.json`: HTTP real da rota de notificações,
  listas completas MENTIONS/ALL, contagens, resumo, persistência da fixture e
  checksum da migration aplicada. As listas possuem outros itens; não se
  trata de uma resposta vazia causada por falha de autenticação.

O banco já estava migrado. A notificação originalmente `communitySpaceId=NULL`
foi reconciliada para `__community_scope_unresolved__`; o post segue
`UNRESOLVED`, sem grupo e DRAFT. Não foi reinserido NULL após a migration:
o objetivo foi repetir a reprodução da linha existente após o backfill.

A chamada HTTP utilizou o modo de autenticação de desenvolvimento já existente,
com o destinatário da fixture e validação real de Member no PostgreSQL local.
O servidor ficou em localhost:3101 com `APP_WRITE_FREEZE=true` e foi encerrado.
TLS continuou com validação da CA QA. Não houve escrita no banco nem serviço remoto.
O controle positivo de notificação global com referência direta TOPIC não existe
para esse destinatário; o relatório registra essa limitação, sem criar dados.
Esta evidência fecha exclusivamente a exclusão da linha original e sua ausência
nas contagens; não certifica Clerk remoto ou todos os cenários de migração.

Harnesses e originais permanecem no diretório protegido:
`C:\Users\gabsc\AppData\Local\Codex\qa\community-v2-foundation-20261015`.
Em `tools/`: `rv01-existing-null-notification.ts` (original),
`rv01-endpoint-reconcile.ts` e `rv01-endpoint-reconcile.ps1` (prepare/server/verify).
O runner original exigiu `NEXT_PUBLIC_APP_URL=http://localhost:3101` e o QA root
acima: o LOCALAPPDATA virtualizado do aplicativo apontava para uma cópia com CA
desatualizada. A validação TLS permaneceu habilitada.

Teste diretamente afetado, executado em `apps/app`:

```powershell
bun x vitest run lib/notification-audience-migration.test.ts
```

Resultado: 3/3. Nenhuma suíte integrada, build geral, Graphify ou alteração
remota. Release continua NO-GO; OPS-01 e demais gates pertencem à Etapa 12A.
