'use client';
import { useFormAction } from './use-form-action';

import { createRecord } from '@/app/actions';
import { addVariant } from '@/app/catalog-actions';
export function CatalogEditor({ kind, record }: { kind: string; record: any }) {
  const [state, action, pending, formRef] = useFormAction(createRecord, undefined);
  const fields: Record<string, string[]> = {
    customers: ['name', 'email', 'company', 'notes'],
    products: ['name', 'amount', 'cost', 'type', 'notes'],
    plans: ['name', 'amount', 'cycle', 'quantity', 'start', 'end', 'notes'],
    taxes: ['name', 'tax', 'notes'],
    discounts: [
      'name',
      'discountType',
      'amount',
      'quantity',
      'minPurchase',
      'start',
      'end',
      'limit',
      'priority',
      'notes',
    ],
  };
  return (
    <form ref={formRef} action={action} className="form narrow">
      <input type="hidden" name="id" value={record.id} />
      <input type="hidden" name="kind" value={kind} />
      {(fields[kind] || []).map((k) => {
        let value = record[k === 'tax' ? 'rate' : k] ?? '';
        if (
          ['amount', 'cost', 'minPurchase'].includes(k) &&
          !(kind === 'discounts' && record.discountType === 'Percentage' && k === 'amount')
        )
          value = Number(value) / 100;
        return (
          <label key={k}>
            {k}
            {k === 'cycle' ? (
              <select name={k} defaultValue={value}>
                {['Daily', 'Weekly', 'Monthly', 'Yearly'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            ) : k === 'discountType' ? (
              <select name={k} defaultValue={value}>
                <option>Fixed</option>
                <option>Percentage</option>
              </select>
            ) : (
              <input
                name={k}
                defaultValue={value}
                type={
                  ['start', 'end'].includes(k)
                    ? 'date'
                    : [
                          'amount',
                          'cost',
                          'quantity',
                          'tax',
                          'minPurchase',
                          'limit',
                          'priority',
                        ].includes(k)
                      ? 'number'
                      : 'text'
                }
                step="any"
                required={['name', 'amount', 'tax', 'quantity', 'limit'].includes(k)}
              />
            )}
          </label>
        );
      })}
      {kind === 'plans' &&
        ['pause', 'renew', 'closeEarly', 'autoClose'].map((k) => (
          <label className="check" key={k}>
            <input type="checkbox" name={k} defaultChecked={record[k]} />
            {k}
          </label>
        ))}
      {kind === 'discounts' && (
        <input type="hidden" name="discountProduct" value={record.productId || ''} />
      )}
      <small>Amounts are INR. Existing invoices retain their original values.</small>
      {state?.error && <p role="alert">{state.error}</p>}
      {state?.success && <p role="status">Changes saved.</p>}
      <button disabled={pending}>Save changes</button>
    </form>
  );
}
export function VariantForm({ product }: { product: string }) {
  const [state, action, pending, formRef] = useFormAction(addVariant, undefined);
  return (
    <form ref={formRef} action={action} className="form narrow">
      <input type="hidden" name="product" value={product} />
      <label>
        Variant or combination name
        <input name="name" required placeholder="Size: large / Colour: white" />
      </label>
      <label>
        Price adjustment (INR)
        <input name="adjustment" type="number" min="0" step="0.01" required />
      </label>
      {state?.error && <p role="alert">{state.error}</p>}
      {state?.success && <p role="status">Variant saved.</p>}
      <button disabled={pending}>Add variant</button>
    </form>
  );
}
