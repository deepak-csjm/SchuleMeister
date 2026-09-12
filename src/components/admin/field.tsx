'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

export interface FieldProps {
  name: string;
  label: string;
  errors?: Record<string, string>;
  hint?: string;
  children: (props: { id: string; invalid: boolean; describedBy?: string }) => ReactNode;
}

/**
 * Label + control + error message, wired up for screen readers.
 * Error values are message keys inside `admin.validation`.
 */
export function Field({ name, label, errors, hint, children }: FieldProps) {
  const t = useTranslations('admin.validation');
  const errorKey = errors?.[name];
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const describedBy = [errorKey ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children({ id: name, invalid: Boolean(errorKey), describedBy: describedBy || undefined })}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {errorKey && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {/* Unknown keys fall back to the generic required message. */}
          {t.has(errorKey) ? t(errorKey) : t('required')}
        </p>
      )}
    </div>
  );
}
