import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { noteEditorExtensions } from "./note-editor-extensions";

describe("note editor schema", () => {
  it("registers every node needed by tables and nested task lists", () => {
    const schema = getSchema([StarterKit, ...noteEditorExtensions]);
    for (const name of [
      "table",
      "tableRow",
      "tableCell",
      "tableHeader",
      "taskList",
      "taskItem",
    ]) {
      expect(schema.nodes[name]).toBeDefined();
    }
    const cell = schema.nodes.tableCell.createAndFill();
    const row = schema.nodes.tableRow.createChecked(null, cell);
    expect(schema.nodes.table.createChecked(null, row).childCount).toBe(1);
  });
});
