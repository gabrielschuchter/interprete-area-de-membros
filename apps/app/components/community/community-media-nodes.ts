import { mergeAttributes, Node } from "@tiptap/core";

const communityMediaNode = ({
  attributes,
  label,
  name,
}: {
  readonly attributes: readonly string[];
  readonly label: string;
  readonly name: string;
}) =>
  Node.create({
    addAttributes: () =>
      Object.fromEntries(
        attributes.map((attribute) => [attribute, { default: null }])
      ),
    atom: true,
    draggable: false,
    group: "block",
    name,
    parseHTML: () => [{ tag: `div[data-community-media="${name}"]` }],
    renderHTML: ({ HTMLAttributes }) => [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-community-media": name,
        class: "community-editor-media",
      }),
      label,
    ],
  });

export const CommunityFileNode = communityMediaNode({
  attributes: ["src", "name", "mimeType", "sizeBytes"],
  label: "Arquivo anexado",
  name: "communityFile",
});

export const CommunityVideoNode = communityMediaNode({
  attributes: ["src", "provider", "title"],
  label: "Vídeo incorporado",
  name: "communityVideo",
});

export const CommunityArticleNode = communityMediaNode({
  attributes: [
    "url",
    "doi",
    "title",
    "authors",
    "journal",
    "year",
    "metadataStatus",
  ],
  label: "Artigo científico",
  name: "communityArticle",
});
