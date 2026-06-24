import { getPlatformUsageStatus } from '../../lib/quota.mjs';
import { createLogger } from '../_logger';

const logger = createLogger('usage');

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
  });
}

export async function onRequestPost(context: any) {
  try {
    const usage = await getPlatformUsageStatus(context);
    return json({ usage });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(message);
    return json({ error: message }, 500);
  }
}
