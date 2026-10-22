# 0013. SSH tunnels via russh, forcing a direct connection

- Status: Accepted
- Date: 2026-10-22

## Context

Many MongoDB servers are only reachable through a bastion host. The driver has no SSH
support, and requiring an external `ssh` binary would break "no command line needed".

## Decision

- Use the pure-Rust **russh** client (0.64, `ring` crypto backend so no CMake/NASM is needed on
  Windows) to open a local port forward: `127.0.0.1:<random port>` → SSH server →
  `<mongo host>:<port>`.
- Authentication: password, or private key file (OpenSSH/PEM/PKCS#8) with optional passphrase.
  Secrets come from the keychain.
- **Host-key verification:** the user's `~/.ssh/known_hosts` is checked first, then RipeMongo's
  own `known_hosts` in the app-config directory. Unknown hosts are trusted on first use and
  recorded in RipeMongo's file; a changed key is always rejected with an explicit
  "possible man-in-the-middle" error. Host certificates are not supported yet.
- The driver connects to the loopback endpoint with `directConnection=true`, because a tunnel
  reaches exactly one member. Consequently:
  - `mongodb+srv://` and multi-host seed lists are rejected when SSH is enabled (validated in
    `connections/validation.rs`);
  - with TLS on, the certificate is issued for the real host name, not `127.0.0.1`, so host-name
    verification is relaxed for tunneled connections (the certificate chain is still verified).
- Timeouts: 15 s to establish and authenticate; 30 s keepalive. Dropping the connection stops
  the tunnel's accept loop; the SSH session closes with the last forwarded socket.

## Consequences

- Works on all platforms without extra software.
- Replica-set failover through a tunnel is not possible; users tunnel to the member they need.
- Verified against a real OpenSSH server in `tests/ssh_tunnel.rs` (password and key auth,
  wrong password, changed host key) with MongoDB reachable only on a private Docker network.
