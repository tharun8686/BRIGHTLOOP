'use client';
import { useFormAction } from './use-form-action';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { authenticate, createRecord, recordPayment } from '@/app/actions';
type Option = { id: string; name?: string };
function Submit({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save record'}
    </button>
  );
}
export function AuthForm({ mode }: { mode: string }) {
  const [state, action, pending, formRef] = useFormAction(authenticate, undefined);
  return (
    <form ref={formRef} action={action} className="form">
      <input type="hidden" name="mode" value={mode} />
      {mode !== 'login' && (
        <label>
          Full name
          <input name="name" required autoComplete="name" maxLength={160} />
        </label>
      )}
      <label>
        Email address
        <input type="email" name="email" required autoComplete="email" />
      </label>
      <label>
        Password
        <input
          type="password"
          name="password"
          required
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={mode === 'login' ? 1 : 9}
          maxLength={128}
        />
      </label>
      {mode !== 'login' && (
        <small>
          At least 9 characters, including uppercase, lowercase and a special character.
        </small>
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
          : mode === 'login'
            ? 'Sign in'
            : mode === 'setup'
              ? 'Create administrator'
              : 'Create account'}
      </button>
    </form>
  );
}
export function RecordForm({ kind, options }: { kind: string; options: Record<string, Option[]> }) {
  const [lineCount, setLineCount] = useState(1);
  const [open, setOpen] = useState(false);
  const [state, action, pending, formRef] = useFormAction(createRecord, undefined);
  const [version, setVersion] = useState(0);
  const labels: Record<string, string> = {
    customers: 'customer',
    products: 'product',
    plans: 'plan',
    subscriptions: 'subscription',
    templates: 'quotation template',
    taxes: 'tax rule',
    discounts: 'discount rule',
  };
  const select = (name: string, title: string, items: Option[]) => (
    <label>
      {title}
      <select name={name} required>
        <option value="">Select {title.toLowerCase()}</option>
        {items.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setVersion((n) => n + 1);
      }}
    >
      <Dialog.Trigger asChild>
        <button>Create {labels[kind]}</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog" aria-describedby="form-description">
          <div className="dialog-head">
            <Dialog.Title>Create {labels[kind]}</Dialog.Title>
            <Dialog.Close className="quiet">Close</Dialog.Close>
          </div>
          <Dialog.Description id="form-description">
            Enter the details below. Changes are saved to your workspace.
          </Dialog.Description>
          <form ref={formRef} key={version} action={action} className="form">
            <input type="hidden" name="kind" value={kind} />
            <label>
              Name
              <input name="name" required maxLength={160} />
            </label>
            {kind === 'customers' && (
              <>
                <label>
                  Email
                  <input type="email" name="email" required />
                </label>
                <label>
                  Company
                  <input name="company" />
                </label>
              </>
            )}
            {['products', 'plans', 'discounts'].includes(kind) && (
              <label>
                {kind === 'discounts' ? 'Discount value' : 'Price (INR)'}
                <input name="amount" type="number" min="0" step="0.01" required />
              </label>
            )}
            {kind === 'products' && (
              <>
                <div className="fields">
                  <label>
                    Cost price (INR)
                    <input name="cost" type="number" min="0" step="0.01" />
                  </label>
                  <label>
                    Type
                    <select name="type">
                      <option>Service</option>
                      <option>Software</option>
                      <option>Goods</option>
                    </select>
                  </label>
                </div>
                <div className="fields">
                  <label>
                    Variant name
                    <input name="variant" placeholder="e.g. Odoo" />
                  </label>
                  <label>
                    Variant surcharge (INR)
                    <input name="adjustment" type="number" min="0" step="0.01" />
                  </label>
                </div>
              </>
            )}
            {kind === 'plans' && (
              <>
                <label>
                  Billing frequency
                  <select name="cycle">
                    {['Daily', 'Weekly', 'Monthly', 'Yearly'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Minimum quantity
                  <input name="quantity" type="number" min="1" defaultValue="1" required />
                </label>
                <div className="fields">
                  <label>
                    Available from
                    <input type="date" name="start" />
                  </label>
                  <label>
                    Available until
                    <input type="date" name="end" />
                  </label>
                </div>
                <fieldset>
                  <legend>Permitted lifecycle actions</legend>
                  {[
                    ['pause', 'Pause'],
                    ['renew', 'Renew'],
                    ['closeEarly', 'Close early'],
                    ['autoClose', 'Close automatically at expiry'],
                  ].map(([key, label]) => (
                    <label className="check" key={key}>
                      <input type="checkbox" name={key} defaultChecked />
                      {label}
                    </label>
                  ))}
                </fieldset>
              </>
            )}
            {kind === 'templates' && (
              <label>
                Quotation validity (days)
                <input
                  name="validityDays"
                  type="number"
                  min="1"
                  max="365"
                  defaultValue="30"
                  required
                />
              </label>
            )}
            {['subscriptions', 'templates'].includes(kind) && (
              <>
                {kind === 'subscriptions' && select('customer', 'Customer', options.customers)}
                {select('plan', 'Plan', options.plans)}
                {Array.from({ length: lineCount }, (_, i) => (
                  <fieldset key={i}>
                    <legend>Product line {i + 1}</legend>
                    {select('product', 'Product', options.products)}
                    <label>
                      Quantity
                      <input name="lineQuantity" type="number" min="1" defaultValue="1" required />
                    </label>
                    <label>
                      Variant
                      <select name="variantId">
                        <option value="">Base product</option>
                        {(options.variants || []).map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </fieldset>
                ))}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setLineCount((n) => Math.min(30, n + 1))}
                >
                  Add product line
                </button>
                <div className="fields">
                  <label>
                    Quantity
                    <input name="quantity" type="number" min="1" defaultValue="1" required />
                  </label>
                  <small>Active tax rules are applied automatically.</small>
                </div>
                <div className="fields">
                  <label>
                    Start date
                    <input
                      type="date"
                      name="start"
                      required
                      defaultValue={new Date().toISOString().slice(0, 10)}
                    />
                  </label>
                  <label>
                    Expiry date
                    <input type="date" name="end" />
                  </label>
                </div>
                <label>
                  Payment terms (days)
                  <input name="terms" type="number" min="0" max="365" defaultValue="14" />
                </label>
                <small>
                  Each product uses its base price plus the selected variant. The plan price is a
                  single additional fee per period.
                </small>
              </>
            )}
            {kind === 'taxes' && (
              <label>
                Rate (%)
                <input name="tax" type="number" min="0" max="100" step="0.01" required />
              </label>
            )}
            {kind === 'discounts' && (
              <>
                <label>
                  Type
                  <select name="discountType">
                    <option>Percentage</option>
                    <option>Fixed</option>
                  </select>
                </label>
                <div className="fields">
                  <label>
                    Minimum quantity
                    <input name="quantity" type="number" min="1" defaultValue="1" required />
                  </label>
                  <label>
                    Minimum purchase (INR)
                    <input name="minPurchase" type="number" min="0" step="0.01" defaultValue="0" />
                  </label>
                </div>
                <div className="fields">
                  <label>
                    Starts
                    <input name="start" type="date" required />
                  </label>
                  <label>
                    Ends
                    <input name="end" type="date" required />
                  </label>
                </div>
                <label>
                  Priority
                  <input name="priority" type="number" step="1" defaultValue="0" />
                </label>
                <label>
                  Product scope
                  <select name="discountProduct">
                    <option value="">Whole subscription</option>
                    {options.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Usage limit
                  <input name="limit" type="number" min="1" defaultValue="100" required />
                </label>
                <small>
                  The lowest priority number wins; ties use the rule ID. One rule applies per
                  invoice.
                </small>
              </>
            )}
            <label>
              Notes
              <textarea name="notes" rows={3} maxLength={2000} />
            </label>
            {state?.error && (
              <p role="alert" className="error">
                {state.error}
              </p>
            )}
            {state?.success && (
              <p role="status" className="success">
                Record saved. You can close this form or add another record.
              </p>
            )}
            <Submit pending={pending} />
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function PaymentForm({ invoices }: { invoices: Option[] }) {
  const [state, action, pending, formRef] = useFormAction(recordPayment, undefined);
  return (
    <form ref={formRef} action={action} className="form narrow">
      {invoices.length >= 100 && (
        <small>
          Shows the 100 most recent confirmed invoices. To pay another invoice, open its detail
          page.
        </small>
      )}
      <label>
        Confirmed invoice
        <select name="invoice" required>
          <option value="">Choose invoice</option>
          {invoices.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      <div className="fields">
        <label>
          Amount (INR)
          <input name="amount" type="number" min="0.01" step="0.01" required />
        </label>
        <label>
          Payment date
          <input
            name="date"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </label>
      </div>
      <label>
        Method
        <select name="method">
          <option>Bank transfer</option>
          <option>UPI</option>
          <option>Cash</option>
          <option>Card (externally collected)</option>
        </select>
      </label>
      <label>
        Note
        <textarea name="notes" rows={3} />
      </label>
      {state?.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="success" role="status">
          Payment recorded.
        </p>
      )}
      <Submit pending={pending} />
    </form>
  );
}
