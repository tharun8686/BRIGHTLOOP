import { requireUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { health } from '@/lib/data-operations';
import { backupAction } from '@/app/data-actions';
import { db } from '@/lib/db';
export default async function Data(){const u=await requireUser();if(u.role!=='Admin')notFound();const result=health();return <main className="page"><h1>Local data management</h1><section className="panel inset"><h2>Database health</h2><pre>{JSON.stringify(result,null,2)}</pre><form action={backupAction}><button>Create consistent backup</button></form><p>Backups are stored in the configured backup directory. Restore is available only through the documented offline command.</p><h2>Recent backups</h2><ul>{(db().prepare("SELECT id,created FROM events WHERE action='Created database backup' ORDER BY id DESC LIMIT 10").all() as any[]).map(e=><li key={e.id}>{e.created}</li>)}</ul></section></main>}
