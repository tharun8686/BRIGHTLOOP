'use server';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db, passwordHash, list, get, save, audit } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { nextDate, totals, type Line } from '@/lib/billing';
const text = (f:FormData,k:string) => String(f.get(k)||'').trim();
const passwordSchema = z.string().min(9).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[^A-Za-z0-9]/);
export async function authenticate(_:unknown, form:FormData) {
  const email = text(form,'email').toLowerCase(), password=String(form.get('password')||''), mode=text(form,'mode');
  if (!z.email().safeParse(email).success) return {error:'Enter a valid email address.'};
  if (mode==='signup' || mode==='setup') {
    if (!passwordSchema.safeParse(password).success) return {error:'Use at least 9 characters with uppercase, lowercase and a special character.'};
    if (!text(form,'name')) return {error:'Enter your full name.'};
    if (mode==='setup' && db().prepare('SELECT id FROM users LIMIT 1').get()) return {error:'The workspace already has an administrator.'};
    try { db().prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(randomUUID(),email,text(form,'name'),mode==='setup'?'Admin':'Customer',passwordHash(password)); }
    catch { return {error:'An account with this email already exists.'}; }
  }
  const user=db().prepare('SELECT * FROM users WHERE email=?').get(email) as {id:string;password:string}|undefined;
  const [salt,hash] = (user?.password || passwordHash('invalid')).split(':');
  const valid=timingSafeEqual(scryptSync(password,salt,64),Buffer.from(hash,'hex'));
  if (!user || !valid) return {error:'Email or password is incorrect.'};
  const token=randomBytes(32).toString('hex');
  db().prepare('INSERT INTO sessions VALUES(?,?,?)').run(token,user.id,Date.now()+86400000);
  (await cookies()).set('brightloop_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:86400});
  redirect('/app');
}
export async function logout() { const jar=await cookies(); const token=jar.get('brightloop_session')?.value; if(token) db().prepare('DELETE FROM sessions WHERE token=?').run(token); jar.delete('brightloop_session'); redirect('/auth/login'); }
const allowed=['customers','products','plans','templates','subscriptions','taxes','discounts'];
export async function createRecord(_:unknown,f:FormData) {
  const user=await requireUser(); const kind=text(f,'kind');
  if(user.role==='Customer'||!allowed.includes(kind)) return {error:'You do not have permission to create this record.'};
  if(['products','plans','templates','taxes','discounts'].includes(kind)&&user.role!=='Admin') return {error:'Only administrators can change configuration.'};
  const name=text(f,'name'); if(!name || name.length>160) return {error:'Enter a name of up to 160 characters.'};
  const amount=Number(f.get('amount')||0),quantity=Number(f.get('quantity')||1),tax=Number(f.get('tax')||0);
  if(!Number.isFinite(amount)||amount<0||amount>1e9||!Number.isInteger(quantity)||quantity<1||quantity>100000||!Number.isFinite(tax)||tax<0||tax>100) return {error:'Check the amount, quantity and tax. Values must be within the allowed range.'};
  const data:any={id:randomUUID(),name,status:'Active',created:new Date().toISOString(),notes:text(f,'notes')};
  if(kind==='customers') { if(!z.email().safeParse(text(f,'email')).success) return {error:'Enter a valid customer email.'}; Object.assign(data,{email:text(f,'email').toLowerCase(),company:text(f,'company')}); }
  if(kind==='products') Object.assign(data,{amount:Math.round(amount*100),cost:Math.round(Number(f.get('cost')||0)*100),type:text(f,'type')||'Service',variant:text(f,'variant'),adjustment:Math.round(Number(f.get('adjustment')||0)*100)});
  if(kind==='plans') Object.assign(data,{amount:Math.round(amount*100),cycle:text(f,'cycle')||'Monthly',quantity,start:text(f,'start'),end:text(f,'end'),pause:f.has('pause'),renew:f.has('renew'),closeEarly:f.has('closeEarly'),autoClose:f.has('autoClose')});
  if(kind==='taxes') Object.assign(data,{rate:tax});
  if(kind==='discounts') { const end=text(f,'end'),start=text(f,'start'); if(!start||!end||end<start) return {error:'Provide a valid start and end date.'}; if(text(f,'discountType')==='Percentage'&&amount>100)return {error:'A percentage discount cannot exceed 100%.'}; Object.assign(data,{discountType:text(f,'discountType'),amount:text(f,'discountType')==='Percentage'?amount:Math.round(amount*100),quantity,minPurchase:Math.round(Number(f.get('minPurchase')||0)*100),limit:Number(f.get('limit')||1),used:0,start,end}); }
  if(kind==='subscriptions'||kind==='templates') {
    const plan=get(text(f,'plan'),'plans'); const product=get(text(f,'product'),'products'); if(!plan||!product) return {error:'Select an existing plan and product.'};
    if(quantity<(plan.quantity||1)) return {error:`This plan requires at least ${plan.quantity} units.`};
    const start=text(f,'start'); if(!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return {error:'Choose a start date.'};
    if((plan.start&&start<plan.start)||(plan.end&&start>plan.end)) return {error:'The plan is not available on the selected date.'};
    const customer=get(text(f,'customer'),'customers'); if(kind==='subscriptions'&&!customer)return {error:'Choose a customer.'};
    const lines:Line[]=[{name:product.name||'',quantity,price:product.amount+(product.adjustment||0),tax}];
    Object.assign(data,{planId:plan.id,plan:plan.name,cycle:plan.cycle,customerId:customer?.id,customer:customer?.name,customerEmail:customer?.email,start,nextBilling:start,end:text(f,'end'),terms:Number(f.get('terms')||14),lines,status:'Draft',reference:'SUB-'+randomBytes(3).toString('hex').toUpperCase(),...totals(lines)});
  }
  if(data.end&&data.start&&data.end<data.start)return {error:'The end date must follow the start date.'};
  save(kind,data);audit(user.name,'Created '+kind,data.id);revalidatePath('/app','layout');return {success:true};
}
export async function transition(f:FormData) {
  const user=await requireUser(); const id=text(f,'id'),action=text(f,'action'); const kind=db().prepare('SELECT kind FROM records WHERE id=?').get(id) as {kind:string}|undefined; if(!kind||!['subscriptions','invoices'].includes(kind.kind))return; const r=get(id,kind.kind); if(!r) return;
  const customer=user.role==='Customer'; if(customer&&r.customerEmail!==user.email) throw new Error('Access denied');
  const plan=r.planId?get(r.planId):undefined;
  if(['status','pause','resume','close'].includes(action)&&kind.kind!=='subscriptions')return; if(['confirm','cancel'].includes(action)&&kind.kind!=='invoices')return;
  if(action==='status') {
    const next:Record<string,string>={Draft:'Quotation',Quotation:'Confirmed',Confirmed:'Active'};
    if(customer) throw new Error('Access denied');
    const status=next[r.status||'']; if(status) save('subscriptions',{...r,status});
  } else if(action==='pause'&&plan?.pause&&r.status==='Active') save('subscriptions',{...r,status:'Paused'});
  else if(action==='resume'&&r.status==='Paused') save('subscriptions',{...r,status:'Active'});
  else if(action==='close'&&plan?.closeEarly) save('subscriptions',{...r,status:'Closed'});
  else if(!customer&&action==='confirm'&&r.status==='Draft') save('invoices',{...r,status:'Confirmed'});
  else if(!customer&&action==='cancel'&&!r.paid) save('invoices',{...r,status:'Cancelled'});
  audit(user.name,action,id); revalidatePath('/app','layout');
}
export async function runBilling() {
  const user=await requireUser();if(user.role==='Customer')throw new Error('Access denied');
  const today=new Date().toISOString().slice(0,10);let created=0,skipped=0;const failures:string[]=[];
  for(const sub of list('subscriptions').filter(s=>s.status==='Active'&&s.nextBilling<=today)) {
    db().exec('BEGIN IMMEDIATE');
    try {
      if(sub.end&&sub.nextBilling>sub.end) { const p=get(sub.planId); if(p?.autoClose)save('subscriptions',{...sub,status:'Closed'}); skipped++;db().exec('COMMIT');continue; }
      if(db().prepare('SELECT invoice FROM billing_keys WHERE subscription=? AND period=?').get(sub.id,sub.nextBilling)){skipped++;db().exec('COMMIT');continue;}
      let discount=0;const applied:string[]=[];const subtotal=totals(sub.lines).subtotal;
      for(const d of list('discounts')) if(d.start<=sub.nextBilling&&d.end>=sub.nextBilling&&d.used<d.limit&&sub.lines.reduce((n:number,l:Line)=>n+l.quantity,0)>=d.quantity&&subtotal>=(d.minPurchase||0)) { discount=d.discountType==='Percentage'?Math.round(subtotal*d.amount/100):d.amount; applied.push(d.id);break; }
      const inv={id:randomUUID(),name:'INV-'+randomBytes(3).toString('hex').toUpperCase(),subscriptionId:sub.id,customerId:sub.customerId,customer:sub.customer,customerEmail:sub.customerEmail,period:sub.nextBilling,due:new Date(new Date(sub.nextBilling).getTime()+sub.terms*86400000).toISOString().slice(0,10),lines:sub.lines,...totals(sub.lines,discount),paid:0,status:'Draft',created:new Date().toISOString()};
      save('invoices',inv);db().prepare('INSERT INTO billing_keys VALUES(?,?,?)').run(sub.id,sub.nextBilling,inv.id);
      for(const id of applied){const d=get(id)!;save('discounts',{...d,used:d.used+1});}
      save('subscriptions',{...sub,nextBilling:nextDate(sub.nextBilling,sub.cycle)});audit(user.name,'Generated invoice',inv.id);db().exec('COMMIT');created++;
    }catch(e){db().exec('ROLLBACK');failures.push(`${sub.name}: ${e instanceof Error?e.message:'Billing failed'}`);}
  }
  save('runs',{id:randomUUID(),name:'Billing run',created:new Date().toISOString(),count:created,skipped,failures,status:failures.length?'Needs attention':'Completed'});revalidatePath('/app','layout');
}
export async function recordPayment(_:unknown,f:FormData){
 const u=await requireUser();if(u.role==='Customer')return {error:'Access denied.'};const invoice=get(text(f,'invoice'),'invoices');const amount=Math.round(Number(f.get('amount'))*100);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(text(f,'date'))||!['Bank transfer','UPI','Cash','Card (externally collected)'].includes(text(f,'method')))return {error:'Choose a valid payment date and method.'};
 if(!invoice||invoice.status!=='Confirmed'||!Number.isSafeInteger(amount)||amount<=0)return {error:'Choose a confirmed invoice and enter a positive amount.'};
 db().exec('BEGIN IMMEDIATE');try{const current=get(invoice.id)!;if(amount>current.total-current.paid) {db().exec('ROLLBACK');return {error:'The amount exceeds the outstanding balance.'};}save('payments',{id:randomUUID(),name:'PAY-'+randomBytes(3).toString('hex').toUpperCase(),invoice:invoice.id,invoiceName:invoice.name,customer:invoice.customer,customerEmail:invoice.customerEmail,amount,method:text(f,'method'),date:text(f,'date'),notes:text(f,'notes'),status:'Recorded'});const paid=current.paid+amount;save('invoices',{...current,paid,status:paid===current.total?'Paid':'Confirmed'});audit(u.name,'Recorded payment',invoice.id);db().exec('COMMIT');}catch{db().exec('ROLLBACK');return {error:'Payment could not be saved.'};}revalidatePath('/app','layout');return {success:true};
}
