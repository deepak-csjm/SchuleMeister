'use client';

import { Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { requestMagicLink, type SignInState } from '@/server/actions/auth';

const initialState: SignInState = { status: 'idle' };

export function SignInForm() {
  const t = useTranslations('auth');
  const [state, formAction, isPending] = useActionState(requestMagicLink, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="email">{t('emailLabel')}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder={t('emailPlaceholder')}
          aria-invalid={state.status === 'error' || undefined}
          aria-describedby={state.error ? 'signin-error' : undefined}
          className="mt-1.5"
        />
      </div>

      {state.error && (
        <p id="signin-error" role="alert" className="text-sm text-destructive">
          {t(state.error)}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        <Mail aria-hidden />
        {isPending ? t('sending') : t('sendLink')}
      </Button>
    </form>
  );
}
