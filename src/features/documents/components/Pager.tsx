import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useId } from "react";

import { formatCount } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { NativeSelect } from "@/shared/ui/input";

import { PAGE_SIZES } from "../store/view";
import type { DocumentCount } from "../types";

interface PagerProps {
  skip: number;
  pageSize: number;
  /** Documents on the current page. */
  shown: number;
  hasMore: boolean;
  count: DocumentCount | undefined;
  onChange: (patch: { skip?: number; pageSize?: number }) => void;
}

/** "1–20 of 1,500", page size, previous / next. */
export function Pager({ skip, pageSize, shown, hasMore, count, onChange }: PagerProps) {
  const sizeId = useId();
  const range = shown === 0 ? "0" : `${formatCount(skip + 1)}–${formatCount(skip + shown)}`;
  const total =
    count?.count == null ? "" : ` of ${count.estimated ? "about " : ""}${formatCount(count.count)}`;

  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor={sizeId} className="sr-only">
        Documents per page
      </label>
      <NativeSelect
        id={sizeId}
        className="h-7 w-auto py-0 text-xs"
        value={pageSize}
        onChange={(event) => {
          onChange({ pageSize: Number(event.target.value), skip: 0 });
        }}
      >
        {PAGE_SIZES.map((size) => (
          <option key={size} value={size}>
            {size} per page
          </option>
        ))}
      </NativeSelect>
      <span aria-live="polite" className="whitespace-nowrap text-muted-foreground tabular-nums">
        {range}
        {total}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label="Previous page"
        disabled={skip === 0}
        onClick={() => {
          onChange({ skip: Math.max(0, skip - pageSize) });
        }}
      >
        <ChevronLeftIcon aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label="Next page"
        disabled={!hasMore}
        onClick={() => {
          onChange({ skip: skip + pageSize });
        }}
      >
        <ChevronRightIcon aria-hidden />
      </Button>
    </div>
  );
}
