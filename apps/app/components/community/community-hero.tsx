export const CommunityHero = () => (
  <section aria-labelledby="community-hero-title" className="community-hero">
    <span
      aria-hidden="true"
      className="community-hero__letter community-hero__letter--i"
    >
      I
    </span>
    <span
      aria-hidden="true"
      className="community-hero__letter community-hero__letter--c"
    >
      C
    </span>
    <svg
      aria-hidden="true"
      className="community-hero__texture"
      focusable="false"
      preserveAspectRatio="none"
      viewBox="0 0 1200 420"
    >
      <filter id="community-hero-grain">
        <feTurbulence
          baseFrequency="0.82"
          numOctaves="3"
          seed="19"
          stitchTiles="stitch"
          type="fractalNoise"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect
        filter="url(#community-hero-grain)"
        height="100%"
        opacity="0.32"
        width="100%"
      />
    </svg>
    <div className="community-hero__copy">
      <h1 className="community-hero__title" id="community-hero-title">
        <span>Interprete.</span>
        <em>comunidade</em>
      </h1>
    </div>
  </section>
);
