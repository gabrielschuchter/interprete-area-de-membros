"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { GestaoIcon } from "../../../../gestao-icon";
import { copyGestaoCohortCourses } from "../../actions";

export interface CopySource {
  readonly id: string;
  readonly name: string;
}

export const AddToCohortMenu = ({
  cohortId,
}: {
  readonly cohortId: string;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button className="gk-btn gk-btn--primary" type="button">
        Adicionar à turma
        <GestaoIcon name="chevron-down" size={14} />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="gestao-create-menu">
      <DropdownMenuItem asChild>
        <Link href={`/gestao/alunos/turmas/${cohortId}/conteudo?visao=cursos`}>
          <GestaoIcon name="book" size={18} />
          Liberar curso
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href={`/gestao/ensino/atividades/nova?turma=${cohortId}`}>
          <GestaoIcon name="inbox" size={18} />
          Nova atividade
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href={`/gestao/alunos/turmas/${cohortId}/calendario`}>
          <GestaoIcon name="video" size={18} />
          Agendar encontro
        </Link>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export const CopyContentButton = ({
  archived,
  cohortId,
  expectedVersion,
  sources,
}: {
  readonly archived: boolean;
  readonly cohortId: string;
  readonly expectedVersion: number;
  readonly sources: readonly CopySource[];
}) => {
  const router = useRouter();
  const key = useRef(crypto.randomUUID());
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const submit = () =>
    startTransition(async () => {
      const result = await copyGestaoCohortCourses({
        cohortId,
        sourceCohortId: sourceId,
        expectedVersion,
        idempotencyKey: key.current,
      });
      setFailed(!result.ok);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      key.current = crypto.randomUUID();
      setMessage(
        result.invitedCount
          ? `${result.invitedCount} curso(s) liberado(s) nesta turma.`
          : "Esta turma já tem todos os cursos da turma escolhida."
      );
      router.refresh();
    });
  return (
    <>
      <button
        className="gk-btn"
        disabled={archived || sources.length === 0}
        onClick={() => {
          setMessage(null);
          setOpen(true);
        }}
        title={
          sources.length === 0
            ? "Você não gerencia outra turma para copiar."
            : undefined
        }
        type="button"
      >
        Copiar de outra turma
      </button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent
          className="gk-modal gk-modal--narrow"
          overlayClassName="gk-modal-overlay"
          showCloseButton={false}
        >
          <div className="gk-modal-head">
            <div>
              <DialogTitle className="gk-modal-title">
                Copiar conteúdo de outra turma
              </DialogTitle>
              <DialogDescription className="gk-modal-sub">
                Libera aqui os cursos já liberados na turma escolhida, com as
                mesmas datas. Nada do que existe nesta turma é alterado.
              </DialogDescription>
            </div>
          </div>
          <div className="gk-modal-body">
            <label className="gk-label">
              <span>Turma de origem</span>
              <select
                className="gk-select gk-select--plain"
                onChange={(event) => setSourceId(event.target.value)}
                value={sourceId}
              >
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            {message ? (
              <output className={failed ? "gk-error-box" : "gk-hint"}>
                {message}
              </output>
            ) : null}
          </div>
          <div className="gk-modal-foot">
            <button
              className="gk-btn gk-btn--primary"
              disabled={pending || !sourceId}
              onClick={submit}
              type="button"
            >
              {pending ? "Copiando…" : "Copiar cursos"}
            </button>
            <button
              className="gk-btn gk-btn--dark"
              disabled={pending}
              onClick={() => setOpen(false)}
              type="button"
            >
              Fechar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
