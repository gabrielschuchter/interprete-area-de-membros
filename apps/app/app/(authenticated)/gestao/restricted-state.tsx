"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const GestaoRestrictedState = ({
  withinGestao = true,
}: {
  readonly withinGestao?: boolean;
}) => {
  const administration = usePathname().startsWith("/gestao/administracao");
  return (
    <section className="gestao-restricted-state">
      <Image
        alt=""
        className="gestao-restricted-art"
        height={219}
        src="/gestao/restricted-administration.svg"
        width={300}
      />
      <div>
        <p className="gestao-restricted-kicker">
          {administration
            ? "Administração · Acesso restrito"
            : "Acesso restrito"}
        </p>
        <h1>
          {administration
            ? "Um espaço reservado à direção da escola."
            : "Você não tem acesso a esta área."}
        </h1>
        <p>
          {administration
            ? "Aqui ficam as configurações institucionais, os papéis, os acessos e as ferramentas administrativas do Interprete. Essas funções são exclusivas da administração e não mostram nenhum dado para o seu perfil."
            : "Seu papel ou vínculo atual não permite abrir este destino. A permissão é verificada no servidor antes de carregar os dados."}
        </p>
        <div className="gestao-restricted-actions">
          <Button asChild>
            <Link href={withinGestao ? "/gestao" : "/estudar"} prefetch={false}>
              {withinGestao
                ? "Voltar à visão geral"
                : "Voltar à área de membros"}
            </Link>
          </Button>
          {administration ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  Conhecer o que a administração faz
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>O que a administração faz</DialogTitle>
                  <DialogDescription>
                    A direção cuida dos papéis e acessos dos membros, das
                    configurações institucionais, das medalhas, das integrações
                    e do registro de atividades. Professores continuam
                    acompanhando suas turmas e organizando o ensino nas áreas
                    autorizadas.
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
        <p className="gestao-restricted-note">
          A permissão é verificada no servidor. Se você acha que deveria ter
          acesso, fale com a administração.
        </p>
      </div>
    </section>
  );
};
