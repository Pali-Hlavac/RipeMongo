# Finding documents

The query bar at the top of a collection tab finds the documents you need.

## Filter

Type a filter and press **Enter** (or click **Find**). Write it the way you would in the
MongoDB shell or Compass; quotes around field names are optional:

| You want                            | Type                                             |
| ----------------------------------- | ------------------------------------------------ |
| Active customers                    | `{ status: "active" }`                           |
| Adults                              | `{ age: { $gte: 18 } }`                          |
| One document by its id              | `{ _id: ObjectId("65a1b2c3d4e5f60718293a4b") }`  |
| Orders since January 1, 2024        | `{ createdAt: { $gte: ISODate("2024-01-01") } }` |
| Names starting with "an" (any case) | `{ name: /^an/i }`                               |
| Customers in Bratislava             | `{ "address.city": "Bratislava" }`               |

An empty filter shows every document. **Reset** clears the query.

## Suggestions as you type

While you type, RipeMongo suggests:

- **field names** from the documents on screen, including nested ones like `address.city`;
- **operators** such as `$gt`, `$in` or `$exists` after you type `$`;
- **values** such as `ObjectId("")` or `ISODate("")`, with the cursor placed between the quotes.

Use **↑** and **↓** to choose, **Enter** or **Tab** to accept, and **Esc** to close the list.
Press **Ctrl+Space** to see suggestions without typing.

## More options

Click **Options** to also set:

- **Project**: which fields to show, for example `{ name: 1, email: 1, _id: 0 }`.
- **Sort**: the order, for example `{ createdAt: -1 }` for newest first.
- **Collation**: language-aware comparison, for example `{ locale: "en", strength: 2 }` to
  ignore upper and lower case.
- **Skip** and **Limit**: leave out the first documents, or stop after a number of them.
- **Max time (ms)**: how long the server may work on one page before giving up (60 seconds by
  default; empty means no limit).

The **Options** button is highlighted when any of these is in use.

## If the query has a mistake

If RipeMongo cannot read your query, a message under the query bar says which part is wrong and
where, for example "Sort: … (line 1, column 5)". The field with the
mistake is outlined in red. Fix it and press **Enter** again.

## History and favorites

Click **History** to see:

- **Recent** queries that ran successfully on this collection, newest first;
- your **Favorites** for this collection.

Click one to run it again. To keep the query that is in the bar now, choose **Save as
favorite…** and give it a name. **Manage favorites…** lets you delete favorites.

History and favorites are stored on this computer only, separately for each connection and
collection. Deleting a connection also deletes its history and favorites.
