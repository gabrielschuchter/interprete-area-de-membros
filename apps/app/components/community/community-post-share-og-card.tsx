interface CommunityPostShareOgCardProps {
  readonly authorName: string;
  readonly category: string;
  readonly commentCount: number | null;
  readonly coverDataUrl?: string | null;
  readonly description: string;
  readonly title: string;
}

const whitespacePattern = /\s+/;

const authorInitials = (name: string) =>
  name
    .trim()
    .split(whitespacePattern)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR") || "I";

export const CommunityPostShareOgCard = ({
  authorName,
  category,
  commentCount,
  coverDataUrl,
  description,
  title,
}: CommunityPostShareOgCardProps) => {
  const hasCover = Boolean(coverDataUrl);

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        color: "#fffaf5",
        background: hasCover
          ? "#2b2026"
          : "linear-gradient(120deg, #8c1535 0%, #650f30 55%, #410230 100%)",
        ...(coverDataUrl
          ? {
              backgroundImage: `url("${coverDataUrl}")`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }
          : {}),
        fontFamily: "Inter, sans-serif",
      }}
    >
      {hasCover ? (
        <div
          style={{
            display: "flex",
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(24, 16, 22, 0.86) 0%, rgba(24, 16, 22, 0.67) 58%, rgba(24, 16, 22, 0.22) 100%)",
          }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: -172,
            right: -28,
            color: "rgba(255, 250, 245, 0.055)",
            fontFamily: "Source Serif 4, serif",
            fontSize: 510,
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          C
        </div>
      )}

      <div
        style={{
          display: "flex",
          position: "relative",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          padding: "58px 66px 48px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <span
            style={{
              fontFamily: "Source Serif 4, serif",
              fontSize: 38,
              fontWeight: 600,
              letterSpacing: -1,
            }}
          >
            Interprete.
          </span>
          <span
            style={{
              maxWidth: 430,
              overflow: "hidden",
              color: "rgba(255, 250, 245, 0.9)",
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: 2.1,
              textOverflow: "ellipsis",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            {category || "Comunidade"}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            maxWidth: 950,
            gap: hasCover ? 16 : 19,
          }}
        >
          <div
            style={{
              display: "-webkit-box",
              overflow: "hidden",
              fontFamily: "Source Serif 4, serif",
              fontSize: hasCover ? 52 : 48,
              fontWeight: 600,
              lineHeight: 1.12,
              textOverflow: "ellipsis",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
            }}
          >
            {title}
          </div>
          {hasCover && description ? (
            <div
              style={{
                display: "-webkit-box",
                maxWidth: 820,
                overflow: "hidden",
                color: "rgba(255, 250, 245, 0.9)",
                fontSize: 23,
                lineHeight: 1.4,
                textOverflow: "ellipsis",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
              }}
            >
              {description}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: hasCover ? 4 : 0,
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 38,
                height: 38,
                flexShrink: 0,
                border: "1px solid rgba(255, 250, 245, 0.58)",
                borderRadius: 19,
                background: "rgba(255, 250, 245, 0.94)",
                color: "#650f30",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {authorInitials(authorName)}
            </span>
            <span style={{ fontSize: 19, fontWeight: 500 }}>{authorName}</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 17,
            borderTop: "1px solid rgba(255, 250, 245, 0.46)",
            fontSize: 18,
            fontWeight: 500,
          }}
        >
          <span>Entre na discussão</span>
          {commentCount === null ? null : (
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {commentCount} {commentCount === 1 ? "resposta" : "respostas"}
              <span style={{ fontSize: 24, lineHeight: 1 }}>›</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
