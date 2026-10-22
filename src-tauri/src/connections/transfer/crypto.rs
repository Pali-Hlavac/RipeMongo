//! Password-based encryption of exported secrets: Argon2id key derivation and
//! XChaCha20-Poly1305 authenticated encryption (ADR 0008).

use argon2::{Algorithm, Argon2, Params, Version};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use chacha20poly1305::aead::rand_core::RngCore;
use chacha20poly1305::aead::{Aead, AeadCore, KeyInit, OsRng};
use chacha20poly1305::{Key, XChaCha20Poly1305, XNonce};
use serde::{Deserialize, Serialize};

use super::TransferError;

const KDF_NAME: &str = "argon2id";
const CIPHER_NAME: &str = "xchacha20poly1305";
const KEY_BYTES: usize = 32;
const SALT_BYTES: usize = 16;
/// OWASP-recommended Argon2id parameters (19 MiB, 2 passes, 1 lane).
const MEMORY_KIB: u32 = 19 * 1024;
const ITERATIONS: u32 = 2;
const PARALLELISM: u32 = 1;
/// Upper bounds accepted from imported files, so a crafted file cannot exhaust memory/CPU.
const MAX_MEMORY_KIB: u32 = 256 * 1024;
const MAX_ITERATIONS: u32 = 10;
const MAX_PARALLELISM: u32 = 8;

/// Encrypted payload plus everything needed to derive the key again.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncryptedBlob {
    pub kdf: String,
    pub salt: String,
    pub memory_kib: u32,
    pub iterations: u32,
    pub parallelism: u32,
    pub cipher: String,
    pub nonce: String,
    pub ciphertext: String,
}

/// Encrypts `plaintext` with a key derived from `password`.
pub fn encrypt(plaintext: &[u8], password: &str) -> Result<EncryptedBlob, TransferError> {
    let mut salt = [0u8; SALT_BYTES];
    OsRng.fill_bytes(&mut salt);
    let key = derive_key(password, &salt, MEMORY_KIB, ITERATIONS, PARALLELISM)?;
    let cipher = XChaCha20Poly1305::new(Key::from_slice(&key));
    let nonce = XChaCha20Poly1305::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|_| TransferError::Crypto)?;
    Ok(EncryptedBlob {
        kdf: KDF_NAME.into(),
        salt: BASE64.encode(salt),
        memory_kib: MEMORY_KIB,
        iterations: ITERATIONS,
        parallelism: PARALLELISM,
        cipher: CIPHER_NAME.into(),
        nonce: BASE64.encode(nonce),
        ciphertext: BASE64.encode(ciphertext),
    })
}

/// Decrypts a blob; a wrong password and a tampered file are indistinguishable by design.
pub fn decrypt(blob: &EncryptedBlob, password: &str) -> Result<Vec<u8>, TransferError> {
    if blob.kdf != KDF_NAME || blob.cipher != CIPHER_NAME {
        return Err(TransferError::InvalidFile(format!(
            "unsupported encryption {}/{}",
            blob.kdf, blob.cipher
        )));
    }
    if blob.memory_kib > MAX_MEMORY_KIB
        || blob.iterations > MAX_ITERATIONS
        || blob.parallelism > MAX_PARALLELISM
    {
        return Err(TransferError::InvalidFile(
            "key derivation parameters are too large".into(),
        ));
    }
    let salt = decode(&blob.salt)?;
    let nonce = decode(&blob.nonce)?;
    if nonce.len() != XNonce::default().len() {
        return Err(TransferError::InvalidFile("invalid nonce".into()));
    }
    let key = derive_key(
        password,
        &salt,
        blob.memory_kib,
        blob.iterations,
        blob.parallelism,
    )?;
    XChaCha20Poly1305::new(Key::from_slice(&key))
        .decrypt(
            XNonce::from_slice(&nonce),
            decode(&blob.ciphertext)?.as_slice(),
        )
        .map_err(|_| TransferError::WrongPassword)
}

fn derive_key(
    password: &str,
    salt: &[u8],
    memory_kib: u32,
    iterations: u32,
    parallelism: u32,
) -> Result<[u8; KEY_BYTES], TransferError> {
    let params = Params::new(memory_kib, iterations, parallelism, Some(KEY_BYTES))
        .map_err(|_| TransferError::InvalidFile("invalid key derivation parameters".into()))?;
    let mut key = [0u8; KEY_BYTES];
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|_| TransferError::Crypto)?;
    Ok(key)
}

fn decode(value: &str) -> Result<Vec<u8>, TransferError> {
    BASE64
        .decode(value)
        .map_err(|_| TransferError::InvalidFile("invalid base64 data".into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_with_correct_password() {
        let blob = encrypt(b"secret data", "correct horse").unwrap();
        assert_eq!(decrypt(&blob, "correct horse").unwrap(), b"secret data");
    }

    #[test]
    fn wrong_password_and_tampering_fail() {
        let blob = encrypt(b"secret data", "correct horse").unwrap();
        assert!(matches!(
            decrypt(&blob, "wrong"),
            Err(TransferError::WrongPassword)
        ));

        let mut tampered = blob.clone();
        tampered.ciphertext = BASE64.encode(b"garbage that is long enough....");
        assert!(matches!(
            decrypt(&tampered, "correct horse"),
            Err(TransferError::WrongPassword)
        ));
    }

    #[test]
    fn rejects_excessive_kdf_parameters() {
        let mut blob = encrypt(b"x", "pw").unwrap();
        blob.memory_kib = u32::MAX;
        assert!(matches!(
            decrypt(&blob, "pw"),
            Err(TransferError::InvalidFile(_))
        ));
    }
}
