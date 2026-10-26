# Finding connections and collections

## Filter the sidebar

The box at the top of the sidebar finds connections, databases and collections by name. Click
it or press **Ctrl+Shift+F** (**⌘⇧F** on macOS) and start typing.

- Only what matches stays visible. Databases and connections that contain a match open by
  themselves, and the matching letters are highlighted.
- You do not have to type the whole name, or even one piece of it: `oi` finds `orderItems`
  and `uspro` finds `user_profiles` (the first letters of each word).
- A connection also matches by its folder, its server address or its color (type `red`).
- To find a collection in a certain database, type the database, a dot and the collection:
  `shop.ord` finds collections like `orders` in databases like `shop`. `shop.` lists every
  collection in `shop`.

Databases and collections are only searched in connections you are connected to. On servers
with very many databases, RipeMongo searches the collections of the first 100 and says how many
it left out; type `database.collection` to search the others.

### With the keyboard

| Key   | What it does                                                      |
| ----- | ----------------------------------------------------------------- |
| ↓     | From the filter box, go to the first row                          |
| ↑ / ↓ | Move between rows (↑ on the first row goes back to the box)       |
| Enter | In the box: open the first matching collection. On a row: open it |
| Esc   | Clear the filter                                                  |

You can still open and close rows while filtering. Clearing the filter brings the sidebar back
exactly as it was.

## Jump to any collection

Press **Ctrl+P** (**⌘P** on macOS), or choose **Go to collection…** in the command palette, and
type part of a collection's name. The list covers every collection and view of the connections
you are connected to and shows which database (and connection) each one belongs to. Press
**Enter** to open the highlighted one.

The collections you opened most recently are at the top, so switching back to one is usually
just **Ctrl+P** and **Enter**. As in the sidebar, `shop.ord` finds collections like `orders` in
databases like `shop`.
