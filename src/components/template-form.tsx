'use client';
import { useFormAction } from './use-form-action';

import { createRecord } from '@/app/actions';
export function TemplateForm({
  id,
  customers,
}: {
  id: string;
  customers: { id: string; name?: string }[];
}) {
  const [state, action, pending, formRef] = useFormAction(createRecord, undefined);
  return (
    <form ref={formRef} action={action} className="form narrow">
      <input type="hidden" name="kind" value="subscriptions" />
      <input type="hidden" name="template" value={id} />
      <label>
        Quotation name
        <input name="name" required />
      </label>
      <label>
        Customer
        <select name="customer" required>
          <option value="">Choose customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Start date
        <input type="date" name="start" required />
      </label>
      <label>
        Valid until
        <input type="date" name="validUntil" required />
      </label>
      <label>
        Expiry date
        <input type="date" name="end" />
      </label>
      <label>
        Payment terms (days)
        <input type="number" name="terms" defaultValue="14" min="0" max="365" />
      </label>
      {state?.error && <p role="alert">{state.error}</p>}
      {state?.success && (
        <p role="status">Draft created. Open subscriptions to review its copied lines.</p>
      )}
      <button disabled={pending}>Create draft from template</button>
    </form>
  );
}
