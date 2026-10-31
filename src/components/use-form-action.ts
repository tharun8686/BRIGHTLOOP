'use client';
import { useActionState, useEffect, useRef } from 'react';
/** Restore uncontrolled input after React resets a completed action that returned validation errors. */
type FormState = { error?: string; success?: string | boolean } | undefined;
export function useFormAction(
  action: (previous: unknown, data: FormData) => Promise<FormState>,
  initial: FormState,
) {
  const formRef = useRef<HTMLFormElement>(null),
    submitted = useRef<FormData | null>(null);
  const [state, dispatch, pending] = useActionState(async (previous: FormState, data: FormData) => {
    submitted.current = data;
    return action(previous, data);
  }, initial);
  useEffect(() => {
    if (!state?.error || !submitted.current) return;
    const frame = requestAnimationFrame(() => {
      const form = formRef.current,
        data = submitted.current;
      if (!form || !data) return;
      const positions: Record<string, number> = {};
      for (const element of Array.from(form.elements)) {
        if (
          !(
            element instanceof HTMLInputElement ||
            element instanceof HTMLSelectElement ||
            element instanceof HTMLTextAreaElement
          ) ||
          !element.name
        )
          continue;
        const values = data.getAll(element.name);
        if (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)) {
          element.checked = values.includes(element.value);
          continue;
        }
        if (
          element instanceof HTMLInputElement &&
          ['file', 'submit', 'button', 'hidden'].includes(element.type)
        )
          continue;
        const index = positions[element.name] || 0;
        positions[element.name] = index + 1;
        element.value = String(values[index] ?? '');
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [state]);
  return [state, dispatch, pending, formRef] as const;
}
