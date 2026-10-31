export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  ) {
    const { validateConfiguration } = await import('./lib/configuration');
    validateConfiguration();
    const { startScheduler } = await import('./lib/scheduling');
    startScheduler();
  }
}
