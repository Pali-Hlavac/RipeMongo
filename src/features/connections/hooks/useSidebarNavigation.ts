/**
 * Keyboard navigation between the filter box and the sidebar rows. Rows are the main
 * buttons marked `data-sidebar-row`; rows the filter matched are also marked
 * `data-sidebar-match` with their kind (connection, database or collection).
 */
import { useRef, type KeyboardEvent } from "react";

const ROW = "[data-sidebar-row]";

export function useSidebarNavigation(clearFilter: () => void) {
  const treeRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rows = () => [...(treeRef.current?.querySelectorAll<HTMLElement>(ROW) ?? [])];

  const focusInput = () => {
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  /** Down arrow from the filter box. */
  const focusFirstRow = () => {
    rows()[0]?.focus();
  };

  /** Enter in the filter box: the first matching collection, else the first match. */
  const openFirstMatch = () => {
    const tree = treeRef.current;
    const first =
      tree?.querySelector<HTMLElement>('[data-sidebar-match="collection"]') ??
      tree?.querySelector<HTMLElement>("[data-sidebar-match]");
    first?.click();
  };

  /** Up/down between rows (up from the first row returns to the box); Escape clears. */
  const onTreeKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    // Menus rendered inside the tree handle their own keys.
    if (!target.matches(ROW)) return;
    const all = rows();
    const index = all.indexOf(target);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      all[index + 1]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index <= 0) focusInput();
      else all[index - 1]?.focus();
    } else if (event.key === "Escape" && inputRef.current?.value) {
      event.preventDefault();
      clearFilter();
      focusInput();
    }
  };

  return { treeRef, inputRef, focusInput, focusFirstRow, openFirstMatch, onTreeKeyDown };
}
