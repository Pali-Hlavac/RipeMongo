//! Checks a profile for contradictions before saving or connecting.

use super::{AuthConfig, ConnectionConfig, ConnectionProfile, Scheme, SshAuthMethod};

/// Returns a user-facing explanation of the first problem found.
pub fn validate_profile(profile: &ConnectionProfile) -> Result<(), String> {
    if profile.name.trim().is_empty() {
        return Err("Give the connection a name.".into());
    }
    validate_config(&profile.config)
}

/// Validates connection settings independent of the profile metadata.
pub fn validate_config(config: &ConnectionConfig) -> Result<(), String> {
    if config.hosts.is_empty() || config.hosts.iter().any(|h| h.host.trim().is_empty()) {
        return Err("Enter at least one host.".into());
    }
    if config.scheme == Scheme::Srv {
        if config.hosts.len() != 1 || config.hosts.iter().any(|h| h.port.is_some()) {
            return Err("SRV connections take exactly one host name and no port.".into());
        }
        if config.direct_connection == Some(true) {
            return Err("SRV connections cannot use a direct connection.".into());
        }
    }
    validate_auth(&config.auth)?;
    if let Some(ssh) = &config.ssh {
        if config.scheme == Scheme::Srv {
            return Err("SSH tunnels do not support mongodb+srv:// connections. Use the host name of one member instead.".into());
        }
        if config.hosts.len() != 1 {
            return Err("SSH tunnels support exactly one MongoDB host.".into());
        }
        if ssh.host.trim().is_empty() || ssh.username.trim().is_empty() {
            return Err("Enter the SSH host and user name.".into());
        }
        if let SshAuthMethod::PrivateKey { key_file } = &ssh.auth {
            if key_file.trim().is_empty() {
                return Err("Choose the SSH private key file.".into());
            }
        }
    }
    Ok(())
}

fn validate_auth(auth: &AuthConfig) -> Result<(), String> {
    match auth {
        AuthConfig::Scram { username, .. } | AuthConfig::Ldap { username }
            if username.trim().is_empty() =>
        {
            Err("Enter a user name for this authentication method.".into())
        }
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::connections::{HostPort, SshConfig};

    fn profile(config: ConnectionConfig) -> ConnectionProfile {
        ConnectionProfile {
            id: String::new(),
            name: "Local".into(),
            folder: None,
            favorite: false,
            color: None,
            config,
        }
    }

    #[test]
    fn default_config_is_valid() {
        assert_eq!(
            validate_profile(&profile(ConnectionConfig::default())),
            Ok(())
        );
    }

    #[test]
    fn rejects_blank_name_and_hosts() {
        let mut blank = profile(ConnectionConfig::default());
        blank.name = " ".into();
        assert!(validate_profile(&blank).is_err());

        let no_hosts = ConnectionConfig {
            hosts: vec![],
            ..ConnectionConfig::default()
        };
        assert!(validate_config(&no_hosts).is_err());
    }

    #[test]
    fn rejects_ssh_with_srv_or_many_hosts() {
        let ssh = Some(SshConfig {
            host: "bastion".into(),
            port: 22,
            username: "me".into(),
            auth: SshAuthMethod::Password,
        });
        let srv = ConnectionConfig {
            scheme: Scheme::Srv,
            hosts: vec![HostPort {
                host: "c.net".into(),
                port: None,
            }],
            ssh: ssh.clone(),
            ..ConnectionConfig::default()
        };
        assert!(validate_config(&srv).is_err());

        let many = ConnectionConfig {
            hosts: vec![
                HostPort {
                    host: "a".into(),
                    port: None,
                },
                HostPort {
                    host: "b".into(),
                    port: None,
                },
            ],
            ssh,
            ..ConnectionConfig::default()
        };
        assert!(validate_config(&many).is_err());
    }

    #[test]
    fn rejects_scram_without_username() {
        let config = ConnectionConfig {
            auth: AuthConfig::Scram {
                username: String::new(),
                auth_source: None,
                variant: crate::connections::ScramVariant::Auto,
            },
            ..ConnectionConfig::default()
        };
        assert!(validate_config(&config).is_err());
    }
}
