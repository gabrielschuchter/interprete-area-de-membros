import Link from "next/link";
import { notFound } from "next/navigation";
import { getGestaoCohortInvitePreview } from "@/lib/gestao-cohorts";
import { CohortInviteAcceptance } from "./invite-acceptance";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeZone: "America/Sao_Paulo",
});

const CohortInvitePage = async ({
  params,
}: {
  readonly params: Promise<{ token: string }>;
}) => {
  const { token } = await params;
  const invite = await getGestaoCohortInvitePreview(token);
  if (!invite) {
    notFound();
  }

  return (
    <section className="gt-page gt-invite-page">
      <article className="gt-panel gt-invite-card">
        <p className="gt-eyebrow">Convite para turma</p>
        <h1>Você recebeu um convite</h1>
        <h2>{invite.cohortName}</h2>
        <p>
          {dateFormat.format(invite.startsAt)}
          {invite.endsAt
            ? ` a ${dateFormat.format(invite.endsAt)}`
            : " · sem data final"}
        </p>
        {invite.alreadyMember ? (
          <div className="gt-invite-accepted">
            <strong>Você já participa desta turma.</strong>
            <Link href="/aprender">Ir para Aprender</Link>
          </div>
        ) : (
          <>
            <p>
              Ao aceitar, você entra na turma e recebe os cursos e as liberações
              definidos para ela, somados aos seus acessos atuais.
            </p>
            <CohortInviteAcceptance token={token} />
          </>
        )}
        <small>
          Este convite expira em {dateFormat.format(invite.expiresAt)}.
        </small>
      </article>
    </section>
  );
};

export default CohortInvitePage;
