import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string | undefined;
  placeholder?: string;
}

/** Labelled single-line text input used throughout the editor. */
export function TextField({ label, value, onChange, description, placeholder }: TextFieldProps) {
  return (
    <FormField label={label} description={description}>
      {(control) => (
        <Input
          {...control}
          spellCheck={false}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      )}
    </FormField>
  );
}
