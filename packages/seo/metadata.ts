import merge from "lodash.merge";
import type { Metadata } from "next";

type MetadataGenerator = Omit<Metadata, "description" | "title"> & {
  title: string;
  description: string;
  image?: string;
};

const applicationName = "Interprete";
const canonicalProductionHost = "interprete-area-de-membros-app.vercel.app";
const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
const configuredUrl =
  process.env.NODE_ENV === "production"
    ? (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? canonicalProductionHost)
    : (process.env.NEXT_PUBLIC_APP_URL ?? "localhost:3000");
const normalizedUrl = configuredUrl.replace(
  "interprete-area-de-membros.vercel.app",
  canonicalProductionHost
);
const metadataBase = new URL(
  normalizedUrl.startsWith("http")
    ? normalizedUrl
    : `${protocol}://${normalizedUrl}`
);
const defaultSocialImage = "/brand/meta/interprete-social-v2.png";

export const createMetadata = ({
  title,
  description,
  image,
  ...properties
}: MetadataGenerator): Metadata => {
  const parsedTitle = `${title} | ${applicationName}`;
  const defaultMetadata: Metadata = {
    title: parsedTitle,
    description,
    applicationName,
    metadataBase,
    formatDetection: {
      telephone: false,
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: parsedTitle,
    },
    alternates: {
      canonical: "/",
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
        { url: "/icon.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      title: parsedTitle,
      description,
      url: "/",
      type: "website",
      siteName: applicationName,
      locale: "pt_BR",
      images: [
        {
          url: defaultSocialImage,
          width: 1200,
          height: 630,
          alt: "Interprete. — perguntas melhores, decisões mais humanas.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: parsedTitle,
      description,
      images: [defaultSocialImage],
    },
  };

  const metadata: Metadata = merge(defaultMetadata, properties);

  if (image && metadata.openGraph) {
    metadata.openGraph.images = [
      {
        url: image,
        width: 1200,
        height: 630,
        alt: title,
      },
    ];
  }

  if (image && metadata.twitter) {
    metadata.twitter.images = [image];
  }

  return metadata;
};
