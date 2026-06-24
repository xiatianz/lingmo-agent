import test from "node:test";
import assert from "node:assert/strict";

import {
  enforcePlatformDailyQuota,
  getDailyRequestLimit,
  getPlatformUsageStatus,
  getRemainingRequests,
  parseRequestModelConfig,
} from "../lib/quota.mjs";

function createRequest(headers = {}, body = {}) {
  const normalized = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    body,
    headers: {
      get(name) {
        return normalized.get(String(name).toLowerCase()) ?? null;
      },
    },
  };
}

function createKv(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async get(key) {
      return values.get(key) ?? null;
    },
    async put(key, value) {
      values.set(key, value);
    },
  };
}

test("daily request limit defaults to 20 and accepts positive env overrides", () => {
  assert.equal(getDailyRequestLimit({}), 20);
  assert.equal(getDailyRequestLimit({ DEFAULT_DAILY_REQUEST_LIMIT: "7" }), 7);
  assert.equal(getDailyRequestLimit({ DEFAULT_DAILY_REQUEST_LIMIT: "0" }), 20);
  assert.equal(getDailyRequestLimit({ DEFAULT_DAILY_REQUEST_LIMIT: "abc" }), 20);
});

test("parses local BYOK config from request headers without persisting it", () => {
  const request = createRequest({
    "x-lingmo-api-key": " sk-user ",
    "x-lingmo-base-url": " https://api.example.com/v1/ ",
    "x-lingmo-model": " gpt-test ",
  });

  assert.deepEqual(parseRequestModelConfig(request), {
    apiKey: "sk-user",
    baseUrl: "https://api.example.com/v1",
    model: "gpt-test",
  });
});

test("ignores incomplete local BYOK config", () => {
  const request = createRequest({ "x-lingmo-api-key": "sk-user" });
  assert.equal(parseRequestModelConfig(request), null);
});

test("increments EdgeOne KV quota for platform API requests", async () => {
  const kv = createKv();
  const request = createRequest({ "x-forwarded-for": "203.0.113.10" });
  const env = { LINGMO_USAGE_KV: kv, DEFAULT_DAILY_REQUEST_LIMIT: "2" };

  const first = await enforcePlatformDailyQuota({ request, env });
  const second = await enforcePlatformDailyQuota({ request, env });
  const third = await enforcePlatformDailyQuota({ request, env });

  assert.equal(first.allowed, true);
  assert.equal(first.count, 1);
  assert.equal(second.allowed, true);
  assert.equal(second.count, 2);
  assert.equal(third.allowed, false);
  assert.equal(third.response.status, 429);

  const status = await getPlatformUsageStatus({ request, env });
  assert.equal(status.count, 2);
  assert.equal(status.limit, 2);
  assert.equal(getRemainingRequests(status), 0);
});

test("uses EdgeOne KV bindings exposed directly on context", async () => {
  const kv = createKv();
  const request = createRequest({ "x-forwarded-for": "203.0.113.11" });
  const context = { request, env: { DEFAULT_DAILY_REQUEST_LIMIT: "20" }, LINGMO_USAGE_KV: kv };

  const quota = await enforcePlatformDailyQuota(context);
  const status = await getPlatformUsageStatus(context);

  assert.equal(quota.allowed, true);
  assert.equal(status.configured, true);
  assert.equal(status.count, 1);
  assert.equal(status.remaining, 19);
});

test("reports remaining requests from limit minus used count", async () => {
  const kv = createKv();
  const request = createRequest({ "x-forwarded-for": "203.0.113.12" });
  const env = { LINGMO_USAGE_KV: kv, DEFAULT_DAILY_REQUEST_LIMIT: "20" };

  const initial = await getPlatformUsageStatus({ request, env });
  await enforcePlatformDailyQuota({ request, env });
  const afterOne = await getPlatformUsageStatus({ request, env });

  assert.equal(initial.remaining, 20);
  assert.equal(afterOne.remaining, 19);
  assert.equal(getRemainingRequests(afterOne), 19);
});
