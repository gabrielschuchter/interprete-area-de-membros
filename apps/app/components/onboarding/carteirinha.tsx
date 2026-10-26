import { onboardingCopy as copy } from "@/lib/onboarding/copy";

export interface CarteirinhaProps {
  readonly avatarUrl: string;
  readonly blank?: boolean;
  readonly displayName: string;
  readonly institution: string;
  readonly memberSince: string;
  readonly occupation: string;
  readonly stamped?: boolean;
  readonly themes: readonly string[];
  readonly username: string;
}

// Pure function of its props, drawn with HTML and SVG (no background image).
export const Carteirinha = ({
  avatarUrl,
  blank = false,
  displayName,
  institution,
  memberSince,
  occupation,
  stamped = false,
  themes,
  username,
}: CarteirinhaProps) => {
  const name = displayName.trim();
  const context = [occupation.trim(), institution.trim()]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="ob-card" data-stamped={stamped || undefined}>
      <div className="ob-card-top">
        <span className="ob-card-brand">{copy.marca}</span>
        <span className="ob-mono ob-card-kind">{copy.carteirinha.tipo}</span>
      </div>
      <div aria-hidden="true" className="ob-meander ob-card-meander" />
      <div className="ob-card-body">
        <div className="ob-card-photo" data-has-photo={Boolean(avatarUrl)}>
          {avatarUrl ? (
            // biome-ignore lint/performance/noImgElement: private member-assets route.
            <img alt="" height={76} src={avatarUrl} width={76} />
          ) : (
            <span aria-hidden="true">
              {name ? name.charAt(0).toUpperCase() : ""}
            </span>
          )}
        </div>
        <div className="ob-card-id">
          {name ? (
            <div className="ob-card-name">{name}</div>
          ) : (
            <div className="ob-card-name ob-card-name-empty">
              {copy.carteirinha.nome}
            </div>
          )}
          <div className="ob-mono ob-card-user">
            {username ? `@${username}` : copy.carteirinha.username}
          </div>
          {context ? <div className="ob-card-context">{context}</div> : null}
        </div>
      </div>
      {!(blank || context || stamped) && themes.length === 0 ? (
        <div className="ob-card-context ob-card-pending">
          {copy.carteirinha.contexto}
        </div>
      ) : null}
      {themes.length > 0 ? (
        <div className="ob-card-tags">
          {themes.slice(0, 3).map((theme) => (
            <span className="ob-mono ob-tag" key={theme}>
              {theme}
            </span>
          ))}
          {themes.length > 3 ? (
            <span className="ob-card-more">+{themes.length - 3}</span>
          ) : null}
        </div>
      ) : null}
      <div className="ob-card-foot">
        {blank ? (
          <span className="ob-card-blank">{copy.carteirinha.legenda}</span>
        ) : (
          <span className="ob-mono ob-card-since">
            {copy.carteirinha.desde(memberSince)}
          </span>
        )}
        {stamped ? (
          <svg
            aria-label={copy.carteirinha.carimbo}
            className="ob-stamp"
            height="86"
            role="img"
            viewBox="0 0 86 86"
            width="86"
          >
            <g transform="rotate(-14 43 43)">
              <circle
                cx="43"
                cy="43"
                fill="none"
                r="40.5"
                stroke="currentColor"
                strokeWidth="2.5"
              />
              <circle
                cx="43"
                cy="43"
                fill="none"
                r="35"
                stroke="currentColor"
                strokeWidth="1"
              />
              <text
                className="ob-stamp-numeral"
                fill="currentColor"
                fontSize="22"
                textAnchor="middle"
                x="43"
                y="40"
              >
                I.
              </text>
              <text
                fill="currentColor"
                fontSize="8"
                letterSpacing="1.2"
                textAnchor="middle"
                x="43"
                y="54"
              >
                MATRICU-
              </text>
              <text
                fill="currentColor"
                fontSize="8"
                letterSpacing="1.2"
                textAnchor="middle"
                x="43"
                y="63"
              >
                LADO
              </text>
            </g>
          </svg>
        ) : (
          <span aria-hidden="true" className="ob-seal">
            I.
          </span>
        )}
      </div>
    </div>
  );
};

// The mobile strip that replaces the card on steps 2 to 6.
export const CarteirinhaStrip = ({
  avatarUrl,
  displayName,
  themes,
  username,
}: Pick<
  CarteirinhaProps,
  "avatarUrl" | "displayName" | "themes" | "username"
>) => (
  <div className="ob-strip">
    <div className="ob-strip-photo" data-has-photo={Boolean(avatarUrl)}>
      {avatarUrl ? (
        // biome-ignore lint/performance/noImgElement: private member-assets route.
        <img alt="" height={36} src={avatarUrl} width={36} />
      ) : (
        <span aria-hidden="true">
          {displayName.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </div>
    <div className="ob-strip-id">
      <div className="ob-strip-name">
        {displayName.trim() || copy.carteirinha.nome}
      </div>
      <div className="ob-mono ob-strip-user">
        {username ? `@${username}` : copy.carteirinha.username}
      </div>
    </div>
    {themes.length > 0 ? (
      <span className="ob-mono ob-tag">
        {copy.carteirinha.temas(themes.length)}
      </span>
    ) : null}
  </div>
);
