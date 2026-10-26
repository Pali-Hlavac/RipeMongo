import { cn } from "@/shared/lib/cn";

interface SegmentedFieldProps<T extends string> {
  legend: string;
  /** Radio group name; unique per dialog. */
  name: string;
  value: T;
  labels: Record<T, string>;
  /** Shown under the choice, for the selected value. */
  descriptions?: Record<T, string>;
  onChange: (value: T) => void;
}

/** A small set of mutually exclusive choices shown as a segmented control (radio inputs). */
export function SegmentedField<T extends string>({
  legend,
  name,
  value,
  labels,
  descriptions,
  onChange,
}: SegmentedFieldProps<T>) {
  const values = Object.keys(labels) as T[];
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-md bg-muted p-1">
        {values.map((option) => (
          <label
            key={option}
            className={cn(
              "cursor-pointer rounded-sm px-2 py-1 text-center text-sm text-muted-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              value === option && "bg-background text-foreground shadow-sm",
            )}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              value={option}
              checked={value === option}
              onChange={() => {
                onChange(option);
              }}
            />
            {labels[option]}
          </label>
        ))}
      </div>
      {descriptions && <p className="text-xs text-muted-foreground">{descriptions[value]}</p>}
    </fieldset>
  );
}
