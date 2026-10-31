import type { DatabaseSync } from 'node:sqlite';
import { saveWith } from './db';
type Entity = {
  table: string;
  fields: Record<string, string>;
  booleans?: string[];
  lines?: string;
};
const text = 'TEXT',
  money = 'INTEGER CHECK(VALUE>=0)',
  integer = 'INTEGER';
const common = { name: text, status: text, created: text, notes: text };
const customer = {
  customerId: 'TEXT REFERENCES customers(id)',
  customer: text,
  customerEmail: text,
};
const amounts = { subtotal: money, discount: money, tax: money, total: money };
const contract = {
  ...common,
  ...customer,
  planId: 'TEXT REFERENCES plans(id)',
  plan: text,
  cycle: text,
  start: text,
  end: text,
  nextBilling: text,
  anchor: text,
  validUntil: text,
  terms: 'INTEGER CHECK(VALUE BETWEEN 0 AND 365)',
  reference: 'TEXT UNIQUE',
  ...amounts,
};
export const entities: Record<string, Entity> = {
  customers: {
    table: 'customers',
    fields: { ...common, email: text, company: text, userId: 'TEXT UNIQUE REFERENCES users(id)' },
  },
  products: {
    table: 'products',
    fields: { ...common, amount: money, cost: money, type: text, variant: text, adjustment: money },
  },
  plans: {
    table: 'plans',
    fields: {
      ...common,
      amount: money,
      cycle: "TEXT CHECK(VALUE IN ('Daily','Weekly','Monthly','Yearly'))",
      quantity: 'INTEGER CHECK(VALUE>=1)',
      start: text,
      end: text,
      pause: integer,
      renew: integer,
      closeEarly: integer,
      autoClose: integer,
    },
    booleans: ['pause', 'renew', 'closeEarly', 'autoClose'],
  },
  taxes: { table: 'taxes', fields: { ...common, rate: 'REAL CHECK(VALUE BETWEEN 0 AND 100)' } },
  discounts: {
    table: 'discount_rules',
    fields: {
      ...common,
      discountType: "TEXT CHECK(VALUE IN ('Fixed','Percentage'))",
      amount: money,
      quantity: 'INTEGER CHECK(VALUE>=1)',
      minPurchase: money,
      limit: 'INTEGER CHECK(VALUE>=1)',
      used: 'INTEGER CHECK(VALUE>=0)',
      start: text,
      end: text,
      priority: integer,
      productId: 'TEXT REFERENCES products(id)',
    },
  },
  templates: { table: 'quotation_templates', fields: contract, lines: 'quotation_template_lines' },
  subscriptions: {
    table: 'subscriptions',
    fields: {
      ...contract,
      status: "TEXT CHECK(VALUE IN ('Draft','Quotation','Confirmed','Active','Paused','Closed'))",
    },
    lines: 'subscription_lines',
  },
  invoices: {
    table: 'invoices',
    fields: {
      ...common,
      ...customer,
      subscriptionId: 'TEXT REFERENCES subscriptions(id)',
      period: text,
      due: text,
      paid: money,
      ...amounts,
      status: "TEXT CHECK(VALUE IN ('Draft','Confirmed','Paid','Cancelled'))",
    },
    lines: 'invoice_lines',
  },
  payments: {
    table: 'payments',
    fields: {
      ...common,
      ...customer,
      invoice: 'TEXT REFERENCES invoices(id)',
      invoiceName: text,
      amount: 'INTEGER CHECK(VALUE>0)',
      method: text,
      date: text,
      reversedAt: text,
      reversalReason: text,
    },
  },
  runs: {
    table: 'billing_runs',
    fields: { ...common, count: integer, skipped: integer, finished: text, initiator: text },
  },
  deliveries: {
    table: 'email_deliveries',
    fields: {
      ...common,
      recipient: text,
      recordId: text,
      messageId: text,
      error: text,
      type: text,
      attempt: integer,
    },
  },
};
export function migrate(c: DatabaseSync) {
  c.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied TEXT NOT NULL)',
  );
  if (c.prepare('SELECT 1 FROM schema_migrations WHERE version=1').get()) {
    migrateAudit(c);
    migrateLineDetails(c);
    return;
  }
  c.exec('BEGIN IMMEDIATE');
  try {
    c.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('Admin','Staff','Customer')),password TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT NOT NULL,action TEXT NOT NULL,record TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE record_index(id TEXT PRIMARY KEY,kind TEXT NOT NULL);`);
    c.exec(
      'ALTER TABLE users ADD COLUMN verified INTEGER NOT NULL DEFAULT 0; ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1; ALTER TABLE sessions ADD COLUMN last_seen INTEGER NOT NULL DEFAULT 0;',
    );
    c.exec("UPDATE users SET verified=1 WHERE role='Admin'; DELETE FROM sessions;");
    for (const e of Object.values(entities)) {
      c.exec(
        `CREATE TABLE ${e.table}(id TEXT PRIMARY KEY,${Object.entries(e.fields)
          .map(([k, v]) => `"${k}" ${v.replaceAll('VALUE', `"${k}"`)}`)
          .join(',')})`,
      );
      if (e.lines)
        c.exec(
          `CREATE TABLE ${e.lines}(parent_id TEXT NOT NULL REFERENCES ${e.table}(id),position INTEGER NOT NULL,productId TEXT REFERENCES products(id),variantId TEXT,name TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>0),price INTEGER NOT NULL CHECK(price>=0),tax REAL NOT NULL CHECK(tax BETWEEN 0 AND 100),taxName TEXT NOT NULL,discountAmount INTEGER NOT NULL CHECK(discountAmount>=0),taxAmount INTEGER NOT NULL CHECK(taxAmount>=0),amount INTEGER NOT NULL CHECK(amount>=0),PRIMARY KEY(parent_id,position))`,
        );
    }
    c.exec(`CREATE TABLE IF NOT EXISTS billing_keys(subscription TEXT NOT NULL,period TEXT NOT NULL,invoice TEXT NOT NULL,PRIMARY KEY(subscription,period));
 CREATE TABLE product_variant_definitions(id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id),name TEXT NOT NULL);
 CREATE TABLE product_variants(id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id),name TEXT NOT NULL,adjustment INTEGER NOT NULL CHECK(adjustment>=0),active INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE security_tokens(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),purpose TEXT NOT NULL CHECK(purpose IN ('verify','reset','invite','email')),email TEXT,expires INTEGER NOT NULL,UNIQUE(user_id,purpose));
 CREATE TABLE security_rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset_at INTEGER NOT NULL);
 CREATE TABLE permissions(user_id TEXT NOT NULL REFERENCES users(id),permission TEXT NOT NULL,PRIMARY KEY(user_id,permission));
 CREATE TABLE discount_usage(discount_id TEXT NOT NULL REFERENCES discount_rules(id),invoice_id TEXT NOT NULL REFERENCES invoices(id),PRIMARY KEY(discount_id,invoice_id));
 CREATE TABLE billing_run_items(id INTEGER PRIMARY KEY,run_id TEXT NOT NULL REFERENCES billing_runs(id),subscription_id TEXT NOT NULL REFERENCES subscriptions(id),period TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('Created','Skipped','Failed')),reason TEXT,invoice_id TEXT REFERENCES invoices(id));
 CREATE TABLE reminder_events(id TEXT PRIMARY KEY,event_key TEXT NOT NULL UNIQUE,record_id TEXT NOT NULL,recipient TEXT NOT NULL,type TEXT NOT NULL,status TEXT NOT NULL,created TEXT NOT NULL);
 CREATE UNIQUE INDEX invoice_period ON invoices(subscriptionId,period);
 CREATE INDEX due_subscriptions ON subscriptions(status,nextBilling);
 CREATE INDEX overdue_invoices ON invoices(status,due);
 CREATE INDEX customers_owner ON customers(userId);
 CREATE INDEX tokens_expiry ON security_tokens(expires);
 CREATE INDEX sessions_user ON sessions(user_id);
 CREATE INDEX audit_record ON events(record,id);
 CREATE INDEX run_items ON billing_run_items(run_id,status);`);
    for (const kind of ['subscriptions', 'invoices', 'payments'])
      c.exec(`CREATE INDEX ${kind}_customer ON ${entities[kind].table}(customerId,status)`);
    for (const e of Object.values(entities))
      c.exec(`CREATE INDEX ${e.table}_name ON ${e.table}(name COLLATE NOCASE)`);
    if (c.prepare("SELECT 1 FROM sqlite_master WHERE name='records'").get()) {
      const old = c.prepare('SELECT id,kind,data FROM records ORDER BY rowid').all() as any[];
      for (const kind of Object.keys(entities))
        for (const r of old.filter((r) => r.kind === kind)) {
          const data = JSON.parse(r.data);
          data.id = r.id;
          if (kind === 'subscriptions') {
            data.anchor = data.start;
            data.validUntil = data.start;
          }
          if (kind === 'payments') {
            const inv = old.find((i) => i.id === data.invoice);
            data.customerId = inv ? JSON.parse(inv.data).customerId : null;
          }
          saveWith(c, kind, data);
        }
      c.exec('ALTER TABLE records RENAME TO legacy_records_archive');
    }
    c.prepare('INSERT INTO schema_migrations VALUES(1,?)').run(new Date().toISOString());
    c.exec('COMMIT');
  } catch (e) {
    c.exec('ROLLBACK');
    throw e;
  }
  migrateAudit(c);
  migrateLineDetails(c);
}
function migrateAudit(c: DatabaseSync) {
  if (c.prepare('SELECT 1 FROM schema_migrations WHERE version=2').get()) return;
  c.exec('BEGIN IMMEDIATE');
  try {
    c.exec(`ALTER TABLE events ADD COLUMN before_summary TEXT;ALTER TABLE events ADD COLUMN after_summary TEXT;
CREATE UNIQUE INDEX normalized_user_email ON users(lower(trim(email)));
CREATE TRIGGER valid_user_role_insert BEFORE INSERT ON users WHEN NEW.role NOT IN ('Admin','Staff','Customer') BEGIN SELECT RAISE(ABORT,'Invalid role'); END;
CREATE TRIGGER valid_user_role_update BEFORE UPDATE OF role ON users WHEN NEW.role NOT IN ('Admin','Staff','Customer') BEGIN SELECT RAISE(ABORT,'Invalid role'); END;
ALTER TABLE quotation_templates ADD COLUMN validityDays INTEGER NOT NULL DEFAULT 30 CHECK(validityDays BETWEEN 1 AND 365);
`);
    c.prepare('INSERT INTO schema_migrations VALUES(2,?)').run(new Date().toISOString());
    c.exec('COMMIT');
  } catch (e) {
    c.exec('ROLLBACK');
    throw e;
  }
}
function migrateLineDetails(c: DatabaseSync) {
  if (c.prepare('SELECT 1 FROM schema_migrations WHERE version=3').get()) return;
  c.exec('BEGIN IMMEDIATE');
  try {
    c.exec(
      'CREATE TABLE variant_option_values(variant_id TEXT NOT NULL REFERENCES product_variants(id),definition_id TEXT NOT NULL REFERENCES product_variant_definitions(id),value TEXT NOT NULL,PRIMARY KEY(variant_id,definition_id));CREATE UNIQUE INDEX variant_definition_name ON product_variant_definitions(product_id,name);',
    );
    for (const table of ['quotation_template_lines', 'subscription_lines', 'invoice_lines'])
      c.exec(
        `CREATE TABLE ${table}_taxes(parent_id TEXT NOT NULL,position INTEGER NOT NULL,rule_id TEXT NOT NULL,name TEXT NOT NULL,rate REAL NOT NULL CHECK(rate BETWEEN 0 AND 100),amount INTEGER NOT NULL CHECK(amount>=0),FOREIGN KEY(parent_id,position) REFERENCES ${table}(parent_id,position) ON DELETE CASCADE,PRIMARY KEY(parent_id,position,rule_id));INSERT INTO ${table}_taxes SELECT parent_id,position,'legacy',taxName,tax,taxAmount FROM ${table} WHERE tax>0;`,
      );
    c.prepare('INSERT INTO schema_migrations VALUES(3,?)').run(new Date().toISOString());
    c.exec('COMMIT');
  } catch (e) {
    c.exec('ROLLBACK');
    throw e;
  }
}
