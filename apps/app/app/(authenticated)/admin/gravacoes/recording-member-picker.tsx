"use client";

import { useId, useMemo, useState } from "react";

interface MemberOption {
  readonly displayName: string | null;
  readonly email: string | null;
  readonly id: string;
  readonly profile: {
    readonly username: string;
    readonly displayName: string | null;
  } | null;
}

interface RecordingMemberPickerProperties {
  readonly defaultValue?: string | null;
  readonly members: readonly MemberOption[];
}

const labelFor = (member: MemberOption) =>
  member.profile?.displayName ??
  member.displayName ??
  member.profile?.username ??
  member.email ??
  member.id;

export const RecordingMemberPicker = ({
  members,
  defaultValue,
}: RecordingMemberPickerProperties) => {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const filteredMembers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) {
      return members;
    }
    return members.filter((member) =>
      [labelFor(member), member.profile?.username, member.email, member.id]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalized)
    );
  }, [members, query]);

  return (
    <div className="space-y-2">
      <label
        className="font-data text-muted-foreground text-xs uppercase tracking-[0.12em]"
        htmlFor={searchId}
      >
        Buscar membro
      </label>
      <input
        className="flex h-10 w-full border bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        id={searchId}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Nome, username ou e-mail"
        type="search"
        value={query}
      />
      <select
        aria-label="Membro que receberá o grupo"
        className="flex h-10 w-full border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        defaultValue={defaultValue ?? ""}
        name="memberId"
        required
      >
        <option disabled value="">
          Selecione um membro
        </option>
        {filteredMembers.map((member) => (
          <option key={member.id} value={member.id}>
            {labelFor(member)}
            {member.profile?.username ? ` · @${member.profile.username}` : ""}
          </option>
        ))}
      </select>
      {filteredMembers.length === 0 && (
        <p className="text-muted-foreground text-xs">
          Nenhum membro encontrado.
        </p>
      )}
    </div>
  );
};
