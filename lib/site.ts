export const siteConfig = {
  name: "灵墨",
  englishName: "Lingmo",
  subtitle: "AI 内容创作工作台",
  description: "灵墨是一款 AI 内容创作工作台，支持主题研究、大纲生成、文章写作、润色改写、历史版本管理和 SEO 优化。",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001",
  keywords: [
    "灵墨",
    "Lingmo",
    "AI 写作",
    "AI 内容创作",
    "文章生成器",
    "SEO 优化",
    "内容创作工作台",
    "大纲生成",
  ],
};

export function getSiteUrl(path = "/") {
  const baseUrl = siteConfig.url.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return new URL(`${baseUrl}${normalizedPath}`);
}
