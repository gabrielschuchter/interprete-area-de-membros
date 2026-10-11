import { beforeEach, describe, expect, test } from "vitest";
import {
  focusMemberRouteHeading,
  memberRouteAnnouncementLabel,
} from "./member-route-focus";

describe("member route focus", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  test("focuses the destination heading and ignores the inert outgoing page", () => {
    const main = document.createElement("section");
    main.tabIndex = -1;
    main.innerHTML = `
      <div class="member-route-page" aria-hidden="true" inert>
        <h1>Planejamento anterior</h1>
      </div>
      <div class="member-route-page">
        <h1>Ferramentas</h1>
      </div>
    `;
    document.body.append(main);

    const label = focusMemberRouteHeading(main);
    const heading = main.querySelectorAll("h1")[1];

    expect(label).toBe("Ferramentas");
    expect(heading.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(heading);
  });

  test("falls back to the main region when a destination has no heading", () => {
    const main = document.createElement("section");
    main.tabIndex = -1;
    document.body.append(main);

    expect(focusMemberRouteHeading(main)).toBeNull();
    expect(document.activeElement).toBe(main);
  });

  test("announces the section name or the subpage heading", () => {
    expect(memberRouteAnnouncementLabel("/planejamento", "Meu plano")).toBe(
      "Planejamento"
    );
    expect(
      memberRouteAnnouncementLabel("/planejamento/tarefas", "Minhas tarefas")
    ).toBe("Minhas tarefas");
    expect(memberRouteAnnouncementLabel("/", "Olá, Ana")).toBe("Início");
  });
});
