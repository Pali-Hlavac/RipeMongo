/** True while a dialog (modal or not) is open; global shortcuts should leave the page alone. */
export function isDialogOpen(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
}
