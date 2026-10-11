const urlPattern = /https?:\/\/[^\s<>"']+/giu;
const trailingUrlPunctuation = /[),.;:!?\]}]+$/u;
const referenceLabel = "(?:refer[eê]ncia(?:s)?|fonte|bibliografia)";
const labelledReferenceWithDescriptor = new RegExp(
  `^${referenceLabel}(?:[\\t ]+[^:\\-–—]+)\\s*[:\\-–—]\\s*(.*)$`,
  "iu"
);
const labelledReference =
  /^(?:refer[eê]ncia(?:s)?|fonte|bibliografia)\s*[:\-–—]?\s*(.*)$/iu;
const inlineLabelledReference =
  /(?:^|\s)(?:refer[eê]ncia(?:s)?|fonte|bibliografia)(?:[\t ]+[^:\-–—]+)?\s*[:\-–—]\s*/giu;
const markdownReference = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/iu;
const titledReference = /\s[-–—|:]\s/u;
const referenceLabelEnding = /\s*(?:[-–—|:]\s*)?$/u;

export interface ExerciseReference {
  readonly href?: string;
  readonly label: string;
}

export interface ParsedExerciseExplanation {
  readonly explanation: string;
  readonly references: readonly ExerciseReference[];
}

const safeUrl = (value: string) => {
  const cleaned = value.replace(trailingUrlPunctuation, "");
  try {
    const url = new URL(cleaned);
    return url.protocol === "https:" || url.protocol === "http:"
      ? { href: url.toString(), trailing: value.slice(cleaned.length) }
      : null;
  } catch {
    return null;
  }
};

const labelledCandidate = (content: string): ExerciseReference | null => {
  if (!content) {
    return null;
  }
  const found = [...content.matchAll(urlPattern)].at(-1);
  if (!found?.[0]) {
    return { label: content };
  }
  const url = safeUrl(found[0]);
  if (!url) {
    return { label: content };
  }
  const prefix = content.slice(0, found.index).trim();
  const label = prefix.replace(referenceLabelEnding, "").trim();
  return { href: url.href, label: label || url.href };
};

const referenceCandidate = (line: string): ExerciseReference | null => {
  const markdown = markdownReference.exec(line);
  if (markdown?.[1] && markdown[2]) {
    const url = safeUrl(markdown[2]);
    return url
      ? { href: url.href, label: markdown[1].trim() || url.href }
      : null;
  }

  const labelled =
    labelledReferenceWithDescriptor.exec(line) ?? labelledReference.exec(line);
  if (labelled) {
    const content = (labelled[1] ?? "").trim();
    const labelledMarkdown = markdownReference.exec(content);
    if (labelledMarkdown?.[1] && labelledMarkdown[2]) {
      const url = safeUrl(labelledMarkdown[2]);
      return url
        ? { href: url.href, label: labelledMarkdown[1].trim() || url.href }
        : null;
    }
    return labelledCandidate(content);
  }

  const content = line.trim();
  const standaloneUrl = safeUrl(content);
  if (standaloneUrl) {
    return { href: standaloneUrl.href, label: standaloneUrl.href };
  }
  const found = [...content.matchAll(urlPattern)].at(-1);
  if (!found?.[0]) {
    return null;
  }
  const url = safeUrl(found[0]);
  const prefix = content.slice(0, found.index).trim();
  if (!(url && prefix && titledReference.test(prefix))) {
    return null;
  }
  const label = prefix.replace(referenceLabelEnding, "").trim();
  return { href: url.href, label: label || url.href };
};

/**
 * Existing references live in each immutable question version's explanation.
 * Only a trailing reference block is formatted separately; body text and
 * inline URLs remain intact.
 */
export const parseExerciseExplanation = (
  value: string | null | undefined
): ParsedExerciseExplanation => {
  const lines = (value ?? "").replace(/\r\n?/gu, "\n").split("\n");
  const omitted = new Set<number>();
  const references: ExerciseReference[] = [];
  let index = lines.length - 1;

  while (index >= 0) {
    while (index >= 0 && !(lines[index]?.trim() ?? "")) {
      index -= 1;
    }
    if (index < 0) {
      break;
    }
    const reference = referenceCandidate(lines[index]?.trim() ?? "");
    if (!reference) {
      break;
    }
    references.unshift(reference);
    omitted.add(index);
    index -= 1;
  }

  while (omitted.has(lines.length - 1)) {
    lines.pop();
  }
  while (lines.at(-1)?.trim() === "") {
    lines.pop();
  }

  const lastLineIndex = lines.length - 1;
  const lastLine = lines[lastLineIndex] ?? "";
  const inlineMarker = [...lastLine.matchAll(inlineLabelledReference)].at(-1);
  if (inlineMarker?.index !== undefined) {
    const reference = labelledCandidate(
      lastLine.slice(inlineMarker.index + inlineMarker[0].length).trim()
    );
    if (reference) {
      references.unshift(reference);
      lines[lastLineIndex] = lastLine.slice(0, inlineMarker.index).trimEnd();
    }
  }
  while (lines.at(-1)?.trim() === "") {
    lines.pop();
  }

  return {
    explanation: lines.join("\n").trimEnd(),
    references,
  };
};

export const splitExerciseTextLinks = (value: string) => {
  const result: Array<
    | { readonly key: string; readonly type: "text"; readonly text: string }
    | {
        readonly href: string;
        readonly key: string;
        readonly type: "link";
        readonly text: string;
      }
  > = [];
  let cursor = 0;
  for (const match of value.matchAll(urlPattern)) {
    const rawUrl = match[0];
    const position = match.index ?? 0;
    const parsed = safeUrl(rawUrl);
    if (!parsed) {
      continue;
    }
    if (position > cursor) {
      result.push({
        key: `text-${cursor}`,
        text: value.slice(cursor, position),
        type: "text",
      });
    }
    result.push({
      href: parsed.href,
      key: `link-${position}`,
      text: rawUrl.slice(0, rawUrl.length - parsed.trailing.length),
      type: "link",
    });
    if (parsed.trailing) {
      result.push({
        key: `text-${position + rawUrl.length - parsed.trailing.length}`,
        text: parsed.trailing,
        type: "text",
      });
    }
    cursor = position + rawUrl.length;
  }
  if (cursor < value.length) {
    result.push({
      key: `text-${cursor}`,
      text: value.slice(cursor),
      type: "text",
    });
  }
  return result;
};
