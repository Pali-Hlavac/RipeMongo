import {
  columnResizingFeature,
  columnSizingFeature,
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef } from "react";

import { cn } from "@/shared/lib/cn";

import { getField, type BsonValue } from "../lib/bson";
import { columnNames } from "../lib/columns";
import { findPrefix } from "../lib/find";
import type { LoadedDocument } from "../types";
import { useDocumentActions } from "./actions/context";
import { useFind } from "./find/context";
import { ValueText } from "./ValueText";

const ROW_HEIGHT = 32;
const OVERSCAN_ROWS = 10;
const COLUMN_WIDTH = { size: 200, minSize: 60, maxSize: 800 };
/** Width of the row-number column, in pixels. */
const NUMBER_COLUMN_WIDTH = 56;
/** Lets the virtualizer render rows before the first layout (and in tests). */
const INITIAL_RECT = { width: 1024, height: 640 };

const features = tableFeatures({ columnSizingFeature, columnResizingFeature });
const column = createColumnHelper<typeof features, LoadedDocument>();

/** Documents as a spreadsheet-like grid; only visible rows are rendered. */
export function TableView({
  documents,
  firstRow,
}: {
  documents: LoadedDocument[];
  firstRow: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const actions = useDocumentActions();
  const canEdit = !actions.readOnly && !actions.projected;
  const columns = useMemo(
    () =>
      column.columns(
        columnNames(documents).map((name) =>
          column.accessor((row): BsonValue | undefined => getField(row.value, name), {
            id: name,
            header: name,
            cell: (info) => {
              const value = info.getValue();
              return value ? (
                <ValueText
                  value={value}
                  mode="preview"
                  className="block truncate"
                  findPrefix={findPrefix(info.row.original.key, name, "cell")}
                />
              ) : (
                <span className="text-muted-foreground/60" aria-label="No value">
                  —
                </span>
              );
            },
          }),
        ),
      ),
    [documents],
  );
  const table = useTable({
    features,
    data: documents,
    columns,
    getRowId: (row) => row.key,
    defaultColumn: COLUMN_WIDTH,
    columnResizeMode: "onChange",
  });
  const rows = table.getRowModel().rows;
  // TanStack Virtual returns fresh functions each render, so the React Compiler skips this
  // component; that is expected and harmless here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN_ROWS,
    initialRect: INITIAL_RECT,
  });
  const width = table.getTotalSize() + NUMBER_COLUMN_WIDTH;
  // "Find on this page": render the row of the current hit; its mark then scrolls into view.
  const { currentDocument } = useFind();
  useEffect(() => {
    if (currentDocument === null) return;
    const rendered = virtualizer.getVirtualItems().some((item) => item.index === currentDocument);
    if (!rendered) virtualizer.scrollToIndex(currentDocument, { align: "auto" });
  }, [currentDocument, virtualizer]);

  return (
    <div ref={scrollRef} className="h-full overflow-auto">
      <div
        role="table"
        aria-label="Documents"
        aria-rowcount={rows.length + 1}
        className="text-sm"
        style={{ width }}
      >
        <div role="rowgroup" className="sticky top-0 z-10 bg-muted">
          {table.getHeaderGroups().map((group) => (
            <div
              key={group.id}
              role="row"
              aria-rowindex={1}
              className="flex border-b border-border"
            >
              <div
                role="columnheader"
                className="shrink-0 px-2 py-1.5 text-right text-muted-foreground"
                style={{ width: NUMBER_COLUMN_WIDTH }}
              >
                #
              </div>
              {group.headers.map((header) => (
                <div
                  key={header.id}
                  role="columnheader"
                  className="relative shrink-0 truncate border-l border-border px-2 py-1.5 font-mono font-medium"
                  style={{ width: header.getSize() }}
                  title={header.column.id}
                >
                  <table.FlexRender header={header} />
                  <div
                    aria-hidden
                    onMouseDown={header.getResizeHandler()}
                    className={cn(
                      "absolute inset-y-0 right-0 w-1.5 cursor-col-resize hover:bg-ring/60",
                      header.column.getIsResizing() && "bg-ring",
                    )}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div role="rowgroup" className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index];
            if (!row) return null;
            return (
              <div
                key={row.id}
                role="row"
                aria-rowindex={item.index + 2}
                title={canEdit ? "Double-click to edit" : undefined}
                // Focusable without adding hundreds of tab stops; editing is also in List view.
                tabIndex={-1}
                onDoubleClick={() => {
                  if (canEdit) actions.edit(row.original);
                }}
                onKeyDown={(event) => {
                  if (canEdit && event.key === "Enter") actions.edit(row.original);
                }}
                className="absolute inset-x-0 flex border-b border-border outline-none hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                style={{ height: ROW_HEIGHT, transform: `translateY(${item.start}px)` }}
              >
                <div
                  role="cell"
                  className="shrink-0 px-2 py-1.5 text-right text-muted-foreground tabular-nums"
                  style={{ width: NUMBER_COLUMN_WIDTH }}
                >
                  {firstRow + item.index}
                </div>
                {row.getAllCells().map((cell) => (
                  <div
                    key={cell.id}
                    role="cell"
                    className="shrink-0 border-l border-border px-2 py-1.5"
                    style={{ width: cell.column.getSize() }}
                  >
                    <table.FlexRender cell={cell} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
