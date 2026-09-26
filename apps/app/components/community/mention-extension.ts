import { mergeAttributes, Node } from "@tiptap/core";

export const MentionNode = Node.create({
  name: "mention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      id: { default: null },
      username: { default: null },
      label: { default: null },
      kind: { default: "USER" },
      recipientCount: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-mention-id]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const username =
      typeof node.attrs.username === "string" && node.attrs.username
        ? node.attrs.username
        : node.attrs.label;
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-mention-id": node.attrs.id,
        class: "community-mention",
      }),
      `@${username ?? "membro"}`,
    ];
  },
});
