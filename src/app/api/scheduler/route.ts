import { validSchedulerSecret, scheduledRun } from '@/lib/scheduling';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!validSchedulerSecret((request.headers.get('authorization') || '').replace(/^Bearer /, '')))
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return Response.json(await scheduledRun());
}
