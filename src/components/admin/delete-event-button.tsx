'use client';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { deleteEvent } from '@/server/actions/event';
import type { FormState } from '@/server/actions/school';

const initialState: FormState = { status: 'idle' };

export function DeleteEventButton({ eventId }: { eventId: string }) {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const [, formAction, isPending] = useActionState(deleteEvent, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        // Native confirm keeps this interaction dependency-free; the server
        // action re-checks ownership regardless of what the client sends.
        if (!window.confirm(t('deleteEventConfirm'))) event.preventDefault();
      }}
    >
      <input type="hidden" name="eventId" value={eventId} />
      <Button type="submit" variant="ghost" size="sm" disabled={isPending}>
        <Trash2 aria-hidden />
        {tCommon('delete')}
      </Button>
    </form>
  );
}
