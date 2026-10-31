'use client';
import { useFormAction } from './use-form-action';

import { requestReset, resetPassword } from '@/app/recovery-actions';
export function RecoveryForm({ token, purpose = 'reset' }: { token?: string; purpose?: string }) {
  const [state, action, pending, formRef] = useFormAction(
    token ? resetPassword : requestReset,
    undefined,
  );
  return (
    <form ref={formRef} action={action} className="form">
      {token ? (
        <>
          <input type="hidden" name="purpose" value={purpose} />
          <input name="token" value={token} type="hidden" />
          <label>
            New password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={9}
              maxLength={128}
              required
            />
          </label>
          <label>
            Confirm new password
            <input name="confirmation" type="password" autoComplete="new-password" required />
          </label>
        </>
      ) : (
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" required />
        </label>
      )}
      {state?.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="success" role="status">
          {state.success}
        </p>
      )}
      <button disabled={pending}>
        {pending ? 'Please wait…' : token ? 'Update password' : 'Request reset link'}
      </button>
    </form>
  );
}
