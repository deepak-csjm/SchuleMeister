import { TriangleAlert } from 'lucide-react';

/**
 * Shown in place of legally required details while they are still placeholders.
 * Publishing an Impressum with invented details would be worse than admitting
 * it is not filled in yet.
 */
export function UnconfiguredNotice({
  title,
  body,
  fields,
}: {
  title: string;
  body: string;
  fields: string[];
}) {
  return (
    <div
      role="alert"
      className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
    >
      <h2 className="flex items-center gap-2 text-base font-semibold text-destructive">
        <TriangleAlert aria-hidden className="size-4" />
        {title}
      </h2>
      <p className="text-sm">{body}</p>
      {fields.length > 0 && (
        <ul className="list-inside list-disc text-sm text-muted-foreground">
          {fields.map((field) => (
            <li key={field}>
              <code>{field}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A label/value row used by the Impressum. */
export function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[14rem_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
