'use client';
export default function ErrorPage({reset}:{reset:()=>void}) { return <main className="auth"><h1>Unable to load this page</h1><p>Your saved records have not been changed. Try loading the page again.</p><button onClick={reset}>Try again</button></main>; }
