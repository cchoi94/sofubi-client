export const SITE_URL = "https://sofubi.art";

export const META_CONFIG = {
  title: "Sofubi",
  description: "Paint them sofubis!",
  siteName: "Sofubi",
  videoUrl: `${SITE_URL}/assets/videos/og_video2.mp4`,
  thumbnailUrl: `${SITE_URL}/favicon.ico`,
  video: {
    width: "1200",
    height: "630",
  },
};

export function getMetaTags() {
  const { title, description, siteName, videoUrl, thumbnailUrl, video } =
    META_CONFIG;

  return [
    { title },
    { name: "description", content: description },
    // Open Graph basic
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "video.other" },
    { property: "og:url", content: SITE_URL },
    { property: "og:site_name", content: siteName },
    // Open Graph video
    { property: "og:video", content: videoUrl },
    { property: "og:video:secure_url", content: videoUrl },
    { property: "og:video:type", content: "video/mp4" },
    { property: "og:video:width", content: video.width },
    { property: "og:video:height", content: video.height },
    // Fallback image
    { property: "og:image", content: thumbnailUrl },
    { property: "og:image:width", content: video.width },
    { property: "og:image:height", content: video.height },
    // Twitter Card (video)
    { name: "twitter:card", content: "player" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:player", content: videoUrl },
    { name: "twitter:player:width", content: video.width },
    { name: "twitter:player:height", content: video.height },
    { name: "twitter:image", content: thumbnailUrl },
  ];
}
