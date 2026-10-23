# Evidências do preflight 12A — 23/10/2026

Veredito fechado: **NO-GO**. Plano e ações de desbloqueio em
[RELEASE-PLAN.md](../../RELEASE-PLAN.md).

- `preflight.json`: resultados sanitizados das consultas read-only ao GREEN,
  GitHub Actions, HTTP externo e verificação de backups. Sem dados de linhas,
  JWT, segredos, credenciais, tokens de convite/share ou URLs assinadas.
- `migrations.json`: ordem exata e SHA-256 dos 11 arquivos pendentes no GREEN;
  nenhum foi aplicado. Ledger remoto: 65 concluídas, zero drift.

A consulta PostgreSQL usou pooler de sessão GREEN 5432, CA validada,
`default_transaction_read_only=on` e transação REPEATABLE READ READ ONLY.
Os backups novos usaram GETs Storage e pg_dump read-only/TLS verify-full.
Os dumps/bytes estão cifrados fora do Git, com ACL CurrentUser/SYSTEM; somente
os caminhos de recuperação e hashes constam aqui. A verificação do dump novo
é decodificação/legibilidade; a restauração local histórica foi reutilizada.
Não se afirma restauração do dump novo, reidratação Storage ou recuperação
fora do perfil DPAPI. Snapshots sequenciais sem freeze não substituem T0.

O cron foi comparado ao hash do baseline de 15/10; o valor do secret não foi
lido. O alvo URL foi resolvido separadamente, sem headers/credenciais. Os
status HTTP retidos de pg_net não foram correlacionados individualmente por
request_id ao worker, nem demonstram entrega de job V2. A origem da falha
schedule não foi determinada pelo log disponível.

O pedido com user-agent de crawler usa caminho inválido e só confirma que o
SSO intercepta a requisição antes do produto. Não prova SSR/OG de share real,
receipt de crawler externo ou funcionamento autenticado. A API de gestão
Vercel retornou 403; nenhuma proteção foi contornada.

Ferramentas auxiliares e relatórios brutos permanecem no diretório QA local
registrado no JSON. Nenhum arquivo de configuração/secret foi copiado para
o repositório. Não houve alteração de código de produto nem repetição das
suítes já aceitas. O spec local protegido permanece fora deste handoff.
