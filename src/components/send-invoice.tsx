'use client';
import { useActionState } from 'react';
import { sendInvoice } from '@/app/mail-actions';
export function SendInvoice({id}:{id:string}){const [state,action,pending]=useActionState(sendInvoice,undefined);return <form action={action} className="panel inset"><input name="invoice" type="hidden" value={id}/><h2>Email invoice</h2><p>Send the invoice summary and portal link to the customer. Mail server acceptance does not guarantee delivery to their inbox.</p><button disabled={pending}>{pending?'Sending…':'Send invoice email'}</button>{state?.error&&<p role="alert" className="error">{state.error}</p>}{state?.success&&<p role="status" className="success">The mail server accepted the invoice email.</p>}</form>}
