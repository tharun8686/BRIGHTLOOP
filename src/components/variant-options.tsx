'use client';
import { useState } from 'react';
import { useFormAction } from './use-form-action';
import { updateVariantOptions } from '@/app/catalog-actions';
export function VariantOptions({
  id,
  product,
  options,
}: {
  id: string;
  product: string;
  options: { name: string; value: string }[];
}) {
  const [rows, setRows] = useState(options.length ? options : [{ name: '', value: '' }]);
  const [state, action, pending, formRef] = useFormAction(updateVariantOptions, undefined);
  return (
    <form ref={formRef} action={action} className="form narrow">
      <input name="id" value={id} type="hidden" />
      <input name="product" value={product} type="hidden" />
      {rows.map((r, i) => (
        <div className="fields" key={i}>
          <label>
            Option name
            <input name="optionName" defaultValue={r.name} placeholder="Brand" maxLength={80} />
          </label>
          <label>
            Option value
            <input name="optionValue" defaultValue={r.value} placeholder="Odoo" maxLength={100} />
          </label>
        </div>
      ))}
      <button
        className="secondary"
        type="button"
        disabled={rows.length >= 12}
        onClick={() => setRows((r) => [...r, { name: '', value: '' }])}
      >
        Add option
      </button>
      <small>
        Clear both fields to remove an option. These options describe this specific combination; the
        variant adjustment is added once.
      </small>
      {state?.error && <p role="alert">{state.error}</p>}
      {state?.success && <p role="status">Variant options saved.</p>}
      <button disabled={pending}>Save options</button>
    </form>
  );
}
