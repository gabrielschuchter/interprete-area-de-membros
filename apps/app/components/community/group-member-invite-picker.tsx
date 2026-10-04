"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Input } from "@repo/design-system/components/ui/input";
import { useEffect, useState } from "react";

interface InviteCandidate {
  readonly avatarUrl: string | null;
  readonly displayName: string;
  readonly id: string;
  readonly kind: "USER" | "GROUP";
  readonly role: string;
  readonly username: string;
}

interface GroupMemberInvitePickerProperties {
  readonly currentMemberId: string;
  readonly description?: string;
  readonly fieldName?: string;
  readonly label?: string;
  readonly maxSelected?: number;
  readonly studentsOnly?: boolean;
}

export const GroupMemberInvitePicker = ({
  currentMemberId,
  description = "Os convites ficam registrados no perfil de cada pessoa. Você pode selecionar até 50 pessoas de cada vez.",
  fieldName = "inviteeIds",
  label = "Convidar pessoas",
  maxSelected = 50,
  studentsOnly = false,
}: GroupMemberInvitePickerProperties) => {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<InviteCandidate[]>([]);
  const [selected, setSelected] = useState<InviteCandidate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setCandidates([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/members/search?q=${encodeURIComponent(normalizedQuery)}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      })
        .then(async (response) => {
          if (!response.ok) {
            return { items: [] };
          }
          return (await response.json()) as { items?: InviteCandidate[] };
        })
        .then((result) => {
          setCandidates(
            (result.items ?? []).filter(
              (candidate) =>
                candidate.kind === "USER" &&
                (!studentsOnly || candidate.role === "MEMBER") &&
                candidate.id !== currentMemberId &&
                !selected.some(({ id }) => id === candidate.id)
            )
          );
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setCandidates([]);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [currentMemberId, query, selected, studentsOnly]);

  const addCandidate = (candidate: InviteCandidate) => {
    if (selected.length >= maxSelected) {
      return;
    }
    setSelected((current) => [...current, candidate]);
    setQuery("");
    setCandidates([]);
  };

  const removeCandidate = (candidateId: string) => {
    setSelected((current) => current.filter(({ id }) => id !== candidateId));
  };

  const searchId = `member-picker-${fieldName}`;

  return (
    <div>
      <label className="block" htmlFor={searchId}>
        <span className="font-medium text-sm">{label}</span>
        <Input
          autoComplete="off"
          className="mt-2"
          id={searchId}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Busque pelo nome ou @username"
          value={query}
        />
      </label>
      <p className="mt-2 text-muted-foreground text-xs leading-5">
        {description}
      </p>
      {selected.map((candidate) => (
        <input
          key={candidate.id}
          name={fieldName}
          type="hidden"
          value={candidate.id}
        />
      ))}
      {selected.length > 0 && (
        <ul
          aria-label="Pessoas convidadas"
          className="mt-3 flex flex-wrap gap-2"
        >
          {selected.map((candidate) => (
            <li
              className="flex items-center gap-2 rounded-full border bg-background py-1 pr-2 pl-1 text-sm"
              key={candidate.id}
            >
              <Avatar className="size-7">
                {candidate.avatarUrl ? (
                  <AvatarImage alt="" src={candidate.avatarUrl} />
                ) : null}
                <AvatarFallback>
                  {candidate.displayName.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-40 truncate">{candidate.displayName}</span>
              <button
                aria-label={`Remover ${candidate.displayName} da lista de convites`}
                className="rounded-full px-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => removeCandidate(candidate.id)}
                type="button"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= 2 && (
        <div aria-live="polite" className="mt-2">
          {loading && (
            <p className="text-muted-foreground text-sm">Buscando pessoas…</p>
          )}
          {!loading && candidates.length > 0 && (
            <ul className="max-h-60 overflow-y-auto rounded-sm border bg-background p-1">
              {candidates.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    className="flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => addCandidate(candidate)}
                    type="button"
                  >
                    <Avatar className="size-9">
                      {candidate.avatarUrl ? (
                        <AvatarImage alt="" src={candidate.avatarUrl} />
                      ) : null}
                      <AvatarFallback>
                        {candidate.displayName.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-sm">
                        {candidate.displayName}
                      </span>
                      <span className="block truncate text-muted-foreground text-xs">
                        @{candidate.username}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!loading && candidates.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Nenhuma pessoa disponível para convidar.
            </p>
          )}
        </div>
      )}
      {selected.length >= maxSelected && (
        <p className="mt-2 text-amber-800 text-sm">
          Limite de {maxSelected} pessoas por envio alcançado.
        </p>
      )}
    </div>
  );
};
