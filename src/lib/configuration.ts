export function validateConfiguration() {
  if (process.env.NODE_ENV !== 'production') return;
  const required = [
    'APP_URL',
    'SQLITE_PATH',
    'APP_OPERATOR',
    'SUPPORT_EMAIL',
    'JURISDICTION',
    'BUSINESS_RETENTION_DETAILS',
    'CRON_SECRET',
    'SMTP_HOST',
    'MAIL_FROM',
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) throw new Error('Set production environment fields: ' + missing.join(', '));
  if (!process.env.APP_URL?.startsWith('https://'))
    throw new Error('APP_URL must use HTTPS in production.');
  if ((process.env.CRON_SECRET || '').length < 32)
    throw new Error('CRON_SECRET must contain at least 32 random characters.');
}
