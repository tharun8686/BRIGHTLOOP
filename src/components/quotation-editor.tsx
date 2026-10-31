'use client';
import { useFormAction } from './use-form-action';
import { useState } from 'react';
import { createRecord } from '@/app/actions';
export function QuotationEditor({
  kind,
  record,
  products,
  variants,
}: {
  kind: string;
  record: any;
  products: any[];
  variants: any[];
}) {
  const [state, action, pending, formRef] = useFormAction(createRecord, undefined);
  const [lines, setLines] = useState(record.lines.filter((l: any) => l.productId));
  return (
    <form ref={formRef} className="form narrow" action={action}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={record.id} />
      <input type="hidden" name="customer" value={record.customerId || ''} />
      <input type="hidden" name="plan" value={record.planId} />
      {kind === 'templates' && (
        <label>
          Quotation validity (days)
          <input
            name="validityDays"
            type="number"
            min="1"
            max="365"
            defaultValue={record.validityDays || 30}
            required
          />
        </label>
      )}
      <label>
        Name
        <input name="name" defaultValue={record.name} required />
      </label>
      {lines.map((l: any, i: number) => (
        <fieldset key={i}>
          <legend>Line {i + 1}</legend>
          <label>
            Product
            <select name="product" defaultValue={l.productId} required>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quantity
            <input name="lineQuantity" defaultValue={l.quantity} type="number" min="1" required />
          </label>
          <label>
            Variant
            <select name="variantId" defaultValue={l.variantId || ''}>
              <option value="">Base product</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="secondary"
            onClick={() => setLines((rows: any[]) => rows.filter((_, n) => n !== i))}
          >
            Remove line
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="secondary"
        onClick={() =>
          setLines((rows: any[]) => [...rows, { productId: products[0]?.id, quantity: 1 }])
        }
      >
        Add line
      </button>
      {['start', 'end', 'validUntil'].map((k) => (
        <label key={k}>
          {k}
          <input name={k} type="date" defaultValue={record[k]} required={k !== 'end'} />
        </label>
      ))}
      <label>
        Payment terms
        <input name="terms" type="number" min="0" max="365" defaultValue={record.terms} />
      </label>
      <p>Saving refreshes draft prices and taxes from current configuration.</p>
      {state?.error && <p role="alert">{state.error}</p>}
      {state?.success && <p role="status">Draft saved.</p>}
      <button disabled={pending}>Save draft</button>
    </form>
  );
}
