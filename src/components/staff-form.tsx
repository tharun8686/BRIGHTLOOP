'use client';
import { useFormAction } from './use-form-action';

import { createStaff } from '@/app/staff-actions';
export function StaffForm() {
  const [state, action, pending, formRef] = useFormAction(createStaff, undefined);
  return (
    <form ref={formRef} action={action} className="form narrow">
      <label>
        Full name
        <input name="name" required maxLength={160} />
      </label>
      <label>
        Email address
        <input name="email" type="email" required />
      </label>
      <small>An expiring invitation lets the staff member set their own password.</small>
      {state?.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="success" role="status">
          Invitation accepted by the mail server.
        </p>
      )}
      <button disabled={pending}>{pending ? 'Creating account…' : 'Invite staff'}</button>
    </form>
  );
}
