const DSML_BLOCK_PATTERN = /<[｜|]*DSML[｜|]*[^>]*>[\s\S]*?<\/[｜|]*DSML[｜|]*[^>]*>/g;
const DSML_TRAILING_PATTERN = /<[｜|]*DSML[\s\S]*/g;
const DSML_TAG_PATTERN = /<\/?(?:[|][|]DSML[|][|]|｜｜DSML｜｜|tool_calls|invoke|parameter)[^>]*>/g;

export function isSearchToolName(name) {
  return name === "web_search" || name === "search_web" || name === "search_topic";
}

export function normalizeGeneratedArticle(text) {
  return String(text || "")
    .replace(DSML_BLOCK_PATTERN, "")
    .replace(DSML_TRAILING_PATTERN, "")
    .replace(DSML_TAG_PATTERN, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function shouldFinalizeGeneratedArticle(text) {
  return normalizeGeneratedArticle(text).length > 0;
}

export function estimateWritingTokens(text) {
  const normalized = normalizeGeneratedArticle(text);
  if (!normalized) return 0;

  const chineseChars = normalized.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  if (chineseChars > 0) return Math.max(1, Math.ceil(chineseChars / 1.5));

  const words = normalized.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words * 1.35));
}
