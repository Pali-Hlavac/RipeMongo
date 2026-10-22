import { documentsPhrase, sampleText } from "../../lib/bulk";
import type { DocumentCount } from "../../types";

interface Sample {
  before: string;
  after: string | null;
}

interface PreviewSamplesProps {
  matched: DocumentCount;
  samples: Sample[];
  /** Update previews: whether `after` was computed (needs a replica set). */
  simulated?: boolean;
  /** The inputs changed since this preview ran. */
  stale: boolean;
}

/** Match count and the first matching documents (before / after for updates). */
export function PreviewSamples({ matched, samples, simulated, stale }: PreviewSamplesProps) {
  const phrase = documentsPhrase(matched);
  const showAfter = simulated === true;
  return (
    <section aria-label="Preview" className="grid gap-2 text-sm">
      <p className="font-medium" role="status">
        {phrase.charAt(0).toUpperCase() + phrase.slice(1)}{" "}
        {matched.count === 1 ? "matches" : "match"} the filter.
        {samples.length > 0 && samples.length < (matched.count ?? 0)
          ? ` Showing the first ${samples.length}.`
          : ""}
      </p>
      {stale && (
        <p className="text-destructive">
          The filter or update changed since this preview. Preview again before applying.
        </p>
      )}
      {simulated === false && samples.length > 0 && (
        <p className="text-muted-foreground">
          This server is standalone (no transactions), so the result cannot be previewed. These are
          the matching documents as they are now.
        </p>
      )}
      <ol className="grid gap-2">
        {samples.map((sample, index) => (
          <li
            // Samples have no stable key besides their position in this preview.
            key={index}
            aria-label={`Sample ${index + 1}`}
            className={showAfter ? "grid grid-cols-2 gap-2" : "grid"}
          >
            <SampleBlock title={showAfter ? "Before" : undefined} json={sample.before} />
            {showAfter && sample.after && <SampleBlock title="After" json={sample.after} />}
          </li>
        ))}
      </ol>
    </section>
  );
}

function SampleBlock({ title, json }: { title: string | undefined; json: string }) {
  return (
    <figure className="min-w-0 rounded-md border border-border bg-muted/40">
      {title && (
        <figcaption className="border-b border-border px-3 py-1 text-xs text-muted-foreground">
          {title}
        </figcaption>
      )}
      <pre className="overflow-x-auto px-3 py-2 font-mono text-xs select-text">
        {sampleText(json)}
      </pre>
    </figure>
  );
}
