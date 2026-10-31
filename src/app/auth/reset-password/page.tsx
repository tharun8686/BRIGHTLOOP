import Link from 'next/link';
import { RecoveryForm } from '@/components/recovery-form';
export default async function Reset({searchParams}:{searchParams:Promise<{token?:string}>}){const {token}=await searchParams;return <main className="auth-wrap"><section className="auth"><h1>Set a new password</h1>{token?<RecoveryForm token={token}/>:<p>This link does not contain a reset token. Request another link.</p>}<div className="auth-links"><Link href="/auth/login">Sign in</Link><Link href="/auth/forgot-password">Request another link</Link></div></section></main>}
