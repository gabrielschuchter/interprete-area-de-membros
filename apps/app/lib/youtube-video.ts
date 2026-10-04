const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
const youtubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

export const getYoutubeVideoId = (value: string) => {
  const input = value.trim();
  if (videoIdPattern.test(input)) {
    return input;
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || !youtubeHosts.has(url.hostname)) {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  let videoId = "";
  if (url.hostname.endsWith("youtu.be")) {
    videoId = parts[0] ?? "";
  } else if (url.pathname === "/watch") {
    videoId = url.searchParams.get("v") ?? "";
  } else if (["embed", "shorts", "live"].includes(parts[0] ?? "")) {
    videoId = parts[1] ?? "";
  }

  return videoIdPattern.test(videoId) ? videoId : null;
};

export const getYoutubeWatchUrl = (videoId: string) =>
  videoIdPattern.test(videoId)
    ? `https://www.youtube.com/watch?v=${videoId}`
    : null;
