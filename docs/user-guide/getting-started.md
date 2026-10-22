# Getting started

## Install

Installers for Windows, macOS and Linux will be available on the releases page. Until the
first release, RipeMongo can be built from source (see the main [README](../../README.md)).

RipeMongo includes everything it needs. You do not have to install the MongoDB shell or the
MongoDB database tools.

## Connect to your first database

1. Start RipeMongo. The **Welcome** tab opens.
2. Click **New connection**.
3. Paste your connection string into **Connection string**, for example
   `mongodb://localhost:27017` or the `mongodb+srv://…` string from MongoDB Atlas.
   The fields below fill in automatically. If the string contains a password, RipeMongo moves it
   into the secure **Password** field.
4. Click **Test connection** to check the settings. You see the server version when it works,
   or an explanation of what went wrong.
5. Optionally give the connection a **Name**, a **Folder** and a **Color label**.
6. Click **Save & connect**.

The connection appears in the sidebar on the left and opens in its own tab.

## What's next

- Learn the [interface](interface.md).
- Organize and secure your [connections](connections.md).
