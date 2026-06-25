import { NextRequest, NextResponse } from 'next/server';
import { enforcePlatformDailyQuota, getPlatformUsageStatus, parseRequestModelConfig, QUOTA_CHECKED_HEADER } from './lib/quota.mjs';

const AGENT_PATHS = ['/outline', '/create', '/create-lite', '/refine', '/suggest-keywords', '/stop', '/research', '/optimize'];
const QUOTA_PATHS = ['/outline', '/create', '/create-lite', '/refine', '/suggest-keywords', '/research', '/optimize'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === '/usage') {
    const usage = await getPlatformUsageStatus({ request });
    return NextResponse.json({ usage });
  }

  if (!AGENT_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const newHeaders = new Headers(request.headers);

  const shouldCheckQuota = QUOTA_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (shouldCheckQuota && !parseRequestModelConfig(request)) {
    const quota = await enforcePlatformDailyQuota({ request });
    if (!quota.allowed) {
      return quota.response ?? new Response(JSON.stringify({ error: 'Daily request quota exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      });
    }
    newHeaders.set(QUOTA_CHECKED_HEADER, '1');
  }

  if (!newHeaders.get('makers-conversation-id')) {
    newHeaders.set('makers-conversation-id', crypto.randomUUID());
  }

  return NextResponse.next({ request: { headers: newHeaders } });
}
