/**
 * Renders a JSON-LD block.
 *
 * `JSON.stringify` escapes quotes and backslashes; the `<` replacement closes
 * the one remaining hole, a `</script>` sequence inside school-supplied text.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
