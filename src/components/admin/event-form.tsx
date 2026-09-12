'use client';

import { Check, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { Field } from '@/components/admin/field';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { createEvent, updateEvent } from '@/server/actions/event';
import type { FormState } from '@/server/actions/school';

const EVENT_TYPES = ['OPEN_HOUSE', 'INFO_EVENING', 'REGISTRATION', 'OTHER'] as const;

export interface EventFormValues {
  id?: string;
  title: string;
  description: string;
  /** `YYYY-MM-DD` */
  eventDate: string;
  startTime: string;
  endTime: string;
  location: string;
  eventType: (typeof EVENT_TYPES)[number];
  targetGrade: string;
  isPublished: boolean;
}

const initialState: FormState = { status: 'idle' };

export function EventForm({
  values,
  onSaved,
}: {
  values: EventFormValues;
  /** Rendered after a successful save, e.g. a link back to the list. */
  onSaved?: React.ReactNode;
}) {
  const t = useTranslations('admin');
  const tFields = useTranslations('admin.fields');
  const tCommon = useTranslations('common');
  const tType = useTranslations('eventType');

  const isEdit = Boolean(values.id);
  const [state, formAction, isPending] = useActionState(
    isEdit ? updateEvent : createEvent,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {values.id && <input type="hidden" name="eventId" value={values.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field name="title" label={tFields('title')} errors={state.errors}>
            {({ id, invalid, describedBy }) => (
              <Input
                id={id}
                name={id}
                defaultValue={values.title}
                required
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </Field>
        </div>

        <Field name="eventType" label={tFields('eventType')} errors={state.errors}>
          {({ id, invalid, describedBy }) => (
            <Select
              id={id}
              name={id}
              defaultValue={values.eventType}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            >
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {tType(type)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field name="eventDate" label={tFields('eventDate')} errors={state.errors}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name={id}
              type="date"
              defaultValue={values.eventDate}
              required
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <Field
          name="startTime"
          label={tFields('startTime')}
          errors={state.errors}
          hint={tCommon('optional')}
        >
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name={id}
              type="time"
              defaultValue={values.startTime}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <Field
          name="endTime"
          label={tFields('endTime')}
          errors={state.errors}
          hint={tCommon('optional')}
        >
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name={id}
              type="time"
              defaultValue={values.endTime}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <Field name="location" label={tFields('location')} errors={state.errors}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name={id}
              defaultValue={values.location}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <Field name="targetGrade" label={tFields('targetGrade')} errors={state.errors}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name={id}
              defaultValue={values.targetGrade}
              placeholder="Klasse 4"
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <div className="sm:col-span-2">
          <Field name="description" label={tFields('eventDescription')} errors={state.errors}>
            {({ id, invalid, describedBy }) => (
              <Textarea
                id={id}
                name={id}
                rows={4}
                defaultValue={values.description}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </Field>
        </div>

        <label htmlFor="isPublished" className="flex items-center gap-2.5 text-sm sm:col-span-2">
          <input
            id="isPublished"
            type="checkbox"
            name="isPublished"
            defaultChecked={values.isPublished}
            className="size-5 rounded border-input accent-[var(--primary)]"
          />
          {t('publishLabel')}
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          <Save aria-hidden />
          {isPending ? tCommon('saving') : isEdit ? tCommon('save') : tCommon('create')}
        </Button>
        {state.status === 'success' && (
          <p role="status" className="flex items-center gap-1.5 text-sm text-success">
            <Check aria-hidden className="size-4" />
            {isEdit ? t('eventUpdated') : t('eventCreated')}
          </p>
        )}
        {state.status === 'success' && onSaved}
        {state.status === 'error' && state.errors?._form && (
          <p role="alert" className="text-sm text-destructive">
            {tCommon('unexpectedError')}
          </p>
        )}
      </div>
    </form>
  );
}
