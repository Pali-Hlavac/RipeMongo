import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import { DEFAULT_PORT } from "../../lib/defaults";
import type { HostPort, Scheme } from "../../types";

interface HostsEditorProps {
  scheme: Scheme;
  hosts: HostPort[];
  onChange: (hosts: HostPort[]) => void;
}

const MAX_PORT = 65535;

function parsePort(raw: string): number | null {
  const port = Number.parseInt(raw, 10);
  return Number.isInteger(port) && port > 0 && port <= MAX_PORT ? port : null;
}

/** Seed list editor. SRV connections take exactly one host name and no port. */
export function HostsEditor({ scheme, hosts, onChange }: HostsEditorProps) {
  const srv = scheme === "srv";
  const update = (index: number, patch: Partial<HostPort>) => {
    onChange(hosts.map((host, i) => (i === index ? { ...host, ...patch } : host)));
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium">{srv ? "SRV host name" : "Hosts"}</legend>
      {hosts.map((host, index) => (
        // Index keys are fine: hosts have no identity besides their position.
        <div key={index} className="flex gap-2">
          <Input
            aria-label={`Host ${index + 1}`}
            placeholder={srv ? "cluster0.example.mongodb.net" : "localhost"}
            spellCheck={false}
            value={host.host}
            onChange={(event) => {
              update(index, { host: event.target.value });
            }}
          />
          {!srv && (
            <Input
              aria-label={`Port of host ${index + 1}`}
              className="w-28"
              inputMode="numeric"
              placeholder={String(DEFAULT_PORT)}
              value={host.port ?? ""}
              onChange={(event) => {
                update(index, { port: parsePort(event.target.value) });
              }}
            />
          )}
          {hosts.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label={`Remove host ${index + 1}`}
              onClick={() => {
                onChange(hosts.filter((_, i) => i !== index));
              }}
            >
              <Trash2Icon aria-hidden />
            </Button>
          )}
        </div>
      ))}
      {!srv && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => {
            onChange([...hosts, { host: "", port: DEFAULT_PORT }]);
          }}
        >
          <PlusIcon aria-hidden />
          Add host
        </Button>
      )}
    </fieldset>
  );
}
