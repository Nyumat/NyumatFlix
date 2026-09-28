type JsonLdScriptProps = {
  data: Record<string, unknown> | Record<string, unknown>[];
};

const jsonLdHtml = (data: JsonLdScriptProps["data"]): string =>
  JSON.stringify(data).replace(/</g, "\\u003c");

export function JsonLdScript({ data }: JsonLdScriptProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdHtml(data) }}
    />
  );
}
