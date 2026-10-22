import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";

import { KEEP, inputValue, updateFromInput } from "../../lib/secrets";
import type { SecretUpdate } from "../../types";

interface SecretFieldProps {
  label: string;
  /** Whether a value is already saved in the keychain. */
  stored: boolean;
  update: SecretUpdate;
  onChange: (update: SecretUpdate) => void;
  description?: string;
}

/**
 * Password-style input for a keychain-backed secret. Saved values are never shown: the field
 * stays empty with a "saved" placeholder, typing replaces the value and "Remove" clears it.
 */
export function SecretField({ label, stored, update, onChange, description }: SecretFieldProps) {
  const [visible, setVisible] = useState(false);
  const cleared = update.action === "clear";
  const placeholder = cleared
    ? "Will be removed when you save"
    : stored
      ? "Saved in keychain — type to replace"
      : "";

  return (
    <FormField label={label} description={description}>
      {(control) => (
        <div className="flex gap-2">
          <Input
            {...control}
            type={visible ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            value={inputValue(update)}
            onChange={(event) => {
              onChange(updateFromInput(event.target.value));
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9"
            aria-label={visible ? `Hide ${label}` : `Show ${label}`}
            onClick={() => {
              setVisible((value) => !value);
            }}
          >
            {visible ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
          </Button>
          {stored && (
            <Button
              type="button"
              variant="outline"
              className="h-9"
              onClick={() => {
                onChange(cleared ? KEEP : { action: "clear" });
              }}
            >
              {cleared ? "Undo" : "Remove"}
            </Button>
          )}
        </div>
      )}
    </FormField>
  );
}
