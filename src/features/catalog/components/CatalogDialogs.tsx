import { CreateCollectionDialog } from "./dialogs/CreateCollectionDialog";
import { CreateDatabaseDialog } from "./dialogs/CreateDatabaseDialog";
import { DropCollectionDialog, DropDatabaseDialog } from "./dialogs/DropDialogs";
import { RenameCollectionDialog } from "./dialogs/RenameCollectionDialog";

/** Every dialog of the catalog feature; mount once at the app root. */
export function CatalogDialogs() {
  return (
    <>
      <CreateDatabaseDialog />
      <CreateCollectionDialog />
      <RenameCollectionDialog />
      <DropDatabaseDialog />
      <DropCollectionDialog />
    </>
  );
}
