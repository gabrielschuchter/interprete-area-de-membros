interface CommunityPostShareOgCardProps {
  readonly authorName: string;
  readonly coverDataUrl?: string | null;
  readonly description: string;
  readonly title: string;
}

export const CommunityPostShareOgCard = ({
  authorName,
  coverDataUrl,
  description,
  title,
}: CommunityPostShareOgCardProps) => (
  <div
    style={{
      display: "flex",
      position: "relative",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      color: coverDataUrl ? "#fff" : "#40222f",
      background: coverDataUrl
        ? "#2b2026"
        : "linear-gradient(135deg, #fbf8f6 0%, #f2e9e6 100%)",
      ...(coverDataUrl
        ? {
            backgroundImage: `url("${coverDataUrl}")`,
            backgroundPosition: "center",
            backgroundSize: "cover",
          }
        : {}),
      fontFamily: "Arial, sans-serif",
    }}
  >
    {coverDataUrl ? (
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          background:
            "linear-gradient(90deg, rgba(24, 16, 22, 0.82) 0%, rgba(24, 16, 22, 0.65) 58%, rgba(24, 16, 22, 0.2) 100%)",
        }}
      />
    ) : (
      <>
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: -130,
            right: -95,
            width: 560,
            height: 560,
            border: "1px solid rgba(140, 21, 53, 0.16)",
            borderRadius: 280,
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: -40,
            right: -10,
            width: 380,
            height: 380,
            background: "rgba(140, 21, 53, 0.08)",
            borderRadius: 190,
          }}
        />
      </>
    )}
    <div
      style={{
        display: "flex",
        position: "relative",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        padding: "58px 72px 54px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span
          style={{
            fontSize: 34,
            fontWeight: 700,
            color: coverDataUrl ? "#fff" : "#8c1535",
          }}
        >
          Interprete.
        </span>
        <span
          style={{
            padding: "9px 13px",
            border: coverDataUrl
              ? "1px solid rgba(255, 255, 255, 0.55)"
              : "1px solid #d8c7c3",
            borderRadius: 20,
            color: coverDataUrl ? "#fff" : "#7a5a69",
            fontSize: 16,
            letterSpacing: 2,
          }}
        >
          COMUNIDADE
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          maxWidth: 900,
          gap: 20,
        }}
      >
        <span
          style={{
            color: coverDataUrl ? "#fff" : "#8c1535",
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: 3,
          }}
        >
          UMA IDEIA PARA CONTINUAR A CONVERSA
        </span>
        <div
          style={{
            display: "-webkit-box",
            overflow: "hidden",
            fontFamily: "Georgia, serif",
            fontSize: 54,
            fontWeight: 600,
            lineHeight: 1.18,
            textOverflow: "ellipsis",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
          }}
        >
          {title}
        </div>
        {description ? (
          <div
            style={{
              display: "-webkit-box",
              maxWidth: 820,
              overflow: "hidden",
              color: coverDataUrl ? "#fff" : "#7a5a69",
              fontSize: 24,
              lineHeight: 1.45,
              textOverflow: "ellipsis",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
            }}
          >
            {description}
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            width: 38,
            height: 2,
            background: coverDataUrl ? "#fff" : "#8c1535",
          }}
        />
        <span
          style={{
            fontSize: 19,
            color: coverDataUrl ? "#fff" : "#684f5a",
          }}
        >
          {authorName}
        </span>
      </div>
    </div>
  </div>
);
