'use client';
export function PrintButton() {
  return (
    <button className="secondary" onClick={() => window.print()}>
      Print / save PDF
    </button>
  );
}
