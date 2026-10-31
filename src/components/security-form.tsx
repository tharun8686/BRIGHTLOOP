'use client';
import { useFormAction } from './use-form-action';

import { verificationAction, accountAction } from '@/app/security-actions';
export function SecurityForm({
  mode,
  token,
  purpose,
}: {
  mode: string;
  token?: string;
  purpose?: string;
}) {
  const [state, action, pending, formRef] = useFormAction(
    mode === 'verify' ? verificationAction : accountAction,
    undefined,
  );
  return (
    <form ref={formRef} className="form narrow" action={action}>
      <input type="hidden" name="action" value={mode} />
      {token ? (
        <>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="purpose" value={purpose || 'verify'} />
        </>
      ) : (
        mode !== 'revoke' && (
          <>
            {mode !== 'verify' && (
              <label>
                Current password
                <input
                  name="currentPassword"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </label>
            )}
            {mode === 'password' ? (
              <label>
                New password
                <input
                  name="password"
                  type="password"
                  required
                  minLength={9}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </label>
            ) : (
              <label>
                Email address
                <input type="email" name="email" required />
              </label>
            )}
          </>
        )
      )}
      {state?.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      {state?.success && <p role="status">{state.success}</p>}
      <button disabled={pending}>
        {pending
          ? 'Please wait…'
          : token
            ? 'Verify email'
            : mode === 'verify'
              ? 'Resend verification'
              : mode === 'email'
                ? 'Verify new address'
                : mode === 'revoke'
                  ? 'Sign out all sessions'
                  : 'Change password'}
      </button>
    </form>
  );
}
