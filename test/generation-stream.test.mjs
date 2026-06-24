import test from "node:test";
import assert from "node:assert/strict";

import {
  isSearchToolName,
  normalizeGeneratedArticle,
  shouldFinalizeGeneratedArticle,
} from "../lib/generation-stream.mjs";

test("recognizes EdgeOne web_search events as research work", () => {
  assert.equal(isSearchToolName("web_search"), true);
  assert.equal(isSearchToolName("search_web"), true);
  assert.equal(isSearchToolName("search_topic"), true);
  assert.equal(isSearchToolName("write_section"), false);
});

test("does not finalize an article when the stream returns no visible content", () => {
  assert.equal(shouldFinalizeGeneratedArticle(""), false);
  assert.equal(shouldFinalizeGeneratedArticle("   \n  "), false);
  assert.equal(shouldFinalizeGeneratedArticle("<||DSML||invoke><parameter name=\"query\">test</parameter>"), false);
});

test("normalizes generated article text without deleting real markdown", () => {
  const raw = "  # 标题\n\n正文\n<||DSML||invoke>hidden</||DSML||invoke>  ";

  assert.equal(normalizeGeneratedArticle(raw), "# 标题\n\n正文");
  assert.equal(shouldFinalizeGeneratedArticle(raw), true);
});
