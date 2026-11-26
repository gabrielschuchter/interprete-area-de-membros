import { LIBRARY_CATEGORY_LABELS } from "@/lib/library-categories";

/**
 * Marcação das estantes (categorias) de um material. Cada marcada vira um
 * valor de "categories" no formulário; o material aparece em todas elas.
 * Categorias já gravadas que não estão na lista editorial continuam
 * aparecendo, marcadas, para não se perderem ao salvar.
 */
export const LibraryCategoryPicker = ({
  autoFocus = false,
  form,
  idPrefix,
  legend = "Categorias",
  selected,
}: {
  readonly autoFocus?: boolean;
  readonly form?: string;
  readonly idPrefix: string;
  readonly legend?: string;
  readonly selected: readonly string[];
}) => {
  const known = new Set<string>(LIBRARY_CATEGORY_LABELS);
  const options = [
    ...LIBRARY_CATEGORY_LABELS,
    ...selected.filter((label) => !known.has(label)),
  ];
  const chosen = new Set(selected);

  return (
    <fieldset className="gk-checkgroup">
      <legend>{legend}</legend>
      <div className="gk-checkgrid">
        {options.map((label, index) => (
          <label className="gk-checkitem" key={label}>
            <input
              autoFocus={autoFocus && index === 0}
              defaultChecked={chosen.has(label)}
              form={form}
              id={`${idPrefix}-${index}`}
              name="categories"
              type="checkbox"
              value={label}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};
