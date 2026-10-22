# Connections

A connection stores how to reach a MongoDB deployment: hosts, authentication, TLS and an
optional SSH tunnel.

## Create a connection

Click **+** in the sidebar header (or **New connection** on the Welcome tab, or in the command
palette). You can either:

- paste a **connection string**: the form fills in automatically, or
- fill in the form: the connection string updates as you type.

Both views always show the same settings. Click **Test connection** at any time to try the
settings without saving them.

### General

- **Name**: shown in the sidebar. Leave it empty to use the host name.
- **Folder**: groups connections in the sidebar, for example "Production" or "Customer A".
- **Color label**: a colored marker, for example red for production servers.
- **Favorite**: shows the connection at the top of the sidebar.
- **Connection type**: _Standard_ (`mongodb://`) with one or more hosts, or _DNS seed list_
  (`mongodb+srv://`, used by MongoDB Atlas) with a single host name.

### Authentication

| Method                      | Use it for                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| None                        | Local development servers without users                                                    |
| Username / password (SCRAM) | Most self-hosted servers and MongoDB Atlas database users                                  |
| X.509 client certificate    | Certificate-based login; choose the certificate on the **TLS** tab                         |
| LDAP (PLAIN)                | MongoDB Enterprise with LDAP                                                               |
| AWS IAM                     | MongoDB Atlas with AWS IAM roles; leave the key empty to use the machine's AWS credentials |
| OIDC (cloud environment)    | Workloads running in Azure, Google Cloud or Kubernetes                                     |

Interactive browser sign-in (OIDC for people) and Kerberos are not supported yet.

### TLS

- **TLS / SSL**: _Default_ turns TLS on for `mongodb+srv://` connections and off otherwise.
- **Certificate authority (CA) file**: needed only when your server uses a private CA.
- **Client certificate and key**: needed for X.509 login or when the server requires client
  certificates. If the key is password protected, enter the password too.
- **Allow invalid certificates / host names**: only for testing. RipeMongo shows a warning
  because this makes it possible to intercept your connection.

### SSH tunnel

Use this when the database is only reachable through a jump host (bastion).

1. Tick **Connect through an SSH tunnel**.
2. Enter the SSH host, port (usually 22) and user name.
3. Choose **Password** or **Private key**. For a key, pick the key file and enter its
   passphrase if it has one.

The first time you connect to an SSH server, RipeMongo remembers its identity. If the identity
changes later, RipeMongo refuses to connect and warns you, because someone may be intercepting
the connection.

An SSH tunnel reaches one MongoDB server, so it cannot be combined with `mongodb+srv://` or
several hosts. Use the host name of the server you want to work with.

### Advanced

Replica set name, read preference, direct connection, default database, application name, and
any other connection-string option (for example `retryWrites` = `false`).

## Passwords are kept safe

RipeMongo stores passwords, passphrases and tokens in your operating system's secure storage
(Windows Credential Manager, macOS Keychain, or the Linux keyring), never in plain files. When you
edit a connection, the password field says **Saved in keychain**. Type to replace the password,
or click **Remove** to delete it.

On Linux you need a keyring service such as GNOME Keyring or KWallet. Without one, RipeMongo
explains how to fix it; connections without passwords still work.

## Connect and disconnect

- Double-click a connection, press **Enter** on it, or choose **Connect** from its **⋯** menu.
- The connection's tab shows the server version, the type of deployment (standalone, replica set
  or sharded cluster) and its members.
- Choose **Disconnect** from the **⋯** menu or the tab to close the connection.

You can be connected to several servers at the same time.

If connecting fails, the tab explains why and what to check, for example a wrong password, an
unreachable host, or a blocked port.

## Organize connections

Use the **⋯** menu next to a connection to:

- **Edit…** the settings,
- **Duplicate** it (passwords are copied too),
- **Add to favorites** / **Remove from favorites**,
- **Delete…** it. This removes the saved settings and passwords from your computer only; data on
  the server is not touched.

## Share connections: export and import

Open the **⋮** menu in the sidebar header.

**Export connections…**

1. Select the connections to export.
2. To include their passwords, tick **Include passwords, encrypted with a password** and choose
   a password of at least 8 characters. Without it, the file contains no passwords at all.
3. Click **Export…** and choose where to save the file.

**Import connections…**

1. Click **Choose file…** and select a RipeMongo export file.
2. If the file contains encrypted passwords, enter the export password to import them, or leave
   the field empty to import the connections without passwords.
3. Click **Import**.

Imported connections are always added as new connections; existing ones are never overwritten.
