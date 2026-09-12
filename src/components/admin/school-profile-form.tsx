'use client';

import { Check, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { Field } from '@/components/admin/field';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { updateSchoolProfile } from '@/server/actions/school';
import type { FormState } from '@/server/actions/school';

export interface SchoolProfileFormValues {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  headmaster: string;
  description: string;
  registrationNotes: string;
  hasOGS: boolean;
  languages: string;
  facilities: string;
}

const initialState: FormState = { status: 'idle' };

export function SchoolProfileForm({ values }: { values: SchoolProfileFormValues }) {
  const t = useTranslations('admin');
  const tFields = useTranslations('admin.fields');
  const tCommon = useTranslations('common');
  const [state, formAction, isPending] = useActionState(updateSchoolProfile, initialState);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">{t('profileTitle')}</legend>

        <div className="sm:col-span-2">
          <Field name="name" label={tFields('name')} errors={state.errors}>
            {({ id, invalid, describedBy }) => (
              <Input
                id={id}
                name={id}
                defaultValue={values.name}
                required
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field name="address" label={tFields('address')} errors={state.errors}>
            {({ id, invalid, describedBy }) => (
              <Input
                id={id}
                name={id}
                defaultValue={values.address}
                required
                autoComplete="street-address"
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </Field>
        </div>

        <Field name="postalCode" label={tFields('postalCode')} errors={state.errors}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name={id}
              defaultValue={values.postalCode}
              required
              inputMode="numeric"
              pattern="\d{5}"
              maxLength={5}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <Field name="city" label={tFields('city')} errors={state.errors}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name={id}
              defaultValue={values.city}
              required
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <Field name="phone" label={tFields('phone')} errors={state.errors}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name={id}
              type="tel"
              defaultValue={values.phone}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <Field name="email" label={tFields('email')} errors={state.errors}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name={id}
              type="email"
              defaultValue={values.email}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <div className="sm:col-span-2">
          <Field name="website" label={tFields('website')} errors={state.errors} hint="https://…">
            {({ id, invalid, describedBy }) => (
              <Input
                id={id}
                name={id}
                type="url"
                defaultValue={values.website}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field name="headmaster" label={tFields('headmaster')} errors={state.errors}>
            {({ id, invalid, describedBy }) => (
              <Input
                id={id}
                name={id}
                defaultValue={values.headmaster}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field name="description" label={tFields('description')} errors={state.errors}>
            {({ id, invalid, describedBy }) => (
              <Textarea
                id={id}
                name={id}
                rows={5}
                defaultValue={values.description}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </Field>
        </div>

        <Field name="languages" label={tFields('languages')} errors={state.errors}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name={id}
              defaultValue={values.languages}
              placeholder="Englisch, Französisch"
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <Field name="facilities" label={tFields('facilities')} errors={state.errors}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name={id}
              defaultValue={values.facilities}
              placeholder="Mensa, Sporthalle"
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <div className="sm:col-span-2">
          <Field
            name="registrationNotes"
            label={tFields('registrationNotes')}
            errors={state.errors}
          >
            {({ id, invalid, describedBy }) => (
              <Textarea
                id={id}
                name={id}
                rows={4}
                defaultValue={values.registrationNotes}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </Field>
        </div>

        <label htmlFor="hasOGS" className="flex items-center gap-2.5 text-sm sm:col-span-2">
          <input
            id="hasOGS"
            type="checkbox"
            name="hasOGS"
            defaultChecked={values.hasOGS}
            className="size-5 rounded border-input accent-[var(--primary)]"
          />
          {tFields('hasOGS')}
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          <Save aria-hidden />
          {isPending ? tCommon('saving') : tCommon('save')}
        </Button>
        {state.status === 'success' && (
          <p role="status" className="flex items-center gap-1.5 text-sm text-success">
            <Check aria-hidden className="size-4" />
            {t('saved')}
          </p>
        )}
        {state.status === 'error' && state.errors?._form && (
          <p role="alert" className="text-sm text-destructive">
            {tCommon('unexpectedError')}
          </p>
        )}
      </div>
    </form>
  );
}
