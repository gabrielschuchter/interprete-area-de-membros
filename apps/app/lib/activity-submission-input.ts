const allowedTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);
export const activitySubmissionInput = (
  content: FormDataEntryValue | null,
  attachment: FormDataEntryValue | null
) => {
  if (content !== null && typeof content !== "string") {
    return { ok: false as const, message: "A resposta de texto é inválida." };
  }
  const text = typeof content === "string" ? content.trim() : "";
  const file =
    attachment instanceof File && attachment.size > 0 ? attachment : null;
  if (text.length > 40_000) {
    return {
      ok: false as const,
      message: "A resposta deve ter até 40.000 caracteres.",
    };
  }
  if (file && (!allowedTypes.has(file.type) || file.size > 10 * 1024 * 1024)) {
    return {
      ok: false as const,
      message: "Envie PDF, imagem ou texto de até 10 MB.",
    };
  }
  if (!(text || file)) {
    return {
      ok: false as const,
      message: "Escreva sua resposta ou selecione o arquivo da atividade.",
    };
  }
  return { ok: true as const, text, file };
};
