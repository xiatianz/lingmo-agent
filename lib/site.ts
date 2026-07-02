export const siteConfig = {
  name: "灵墨",
  filingName: "声波小站",
  englishName: "Lingmo",
  subtitle: "AI 创意生图与图文创作工坊",
  description: "灵墨是一款以文生图为核心的 AI 视觉与图文创作工坊。支持 AI 智能绘画、文本至图像生成、多维度画幅比例与艺术风格选择、AI 提示词深度润色，同时兼备强大的 AI 智能写作、大纲生成与主题研究能力。",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001",
  keywords: [
    "灵墨",
    "Lingmo",
    "文生图",
    "AI 绘画",
    "AI 生图",
    "AI 智能生图",
    "AI 提示词润色",
    "AI 图像生成",
    "Stable Diffusion 在线",
    "Flux 在线生图",
    "AI 写作助手",
    "AI 内容创作",
    "图文创作工坊",
    "大纲生成",
    "SEO 优化"
  ],
};

export function getSiteUrl(path = "/") {
  const baseUrl = siteConfig.url.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return new URL(`${baseUrl}${normalizedPath}`);
}
