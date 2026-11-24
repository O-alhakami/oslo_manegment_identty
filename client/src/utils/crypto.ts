import type { VaultPayload } from "../types";

const PBKDF2_ITERATIONS = 600_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
type WebCryptoBytes = Uint8Array<ArrayBuffer>;

export interface DerivedKeys {
  encryptionKey: CryptoKey;
  authKey: string;
}

function toBase64(bytes: WebCryptoBytes): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: string): WebCryptoBytes {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toBase64Url(bytes: WebCryptoBytes): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function createSalt(): WebCryptoBytes {
  return crypto.getRandomValues(new Uint8Array(16));
}

export function encodeSalt(salt: WebCryptoBytes): string {
  return toBase64(salt);
}

export function decodeSalt(salt: string): WebCryptoBytes {
  const decoded = fromBase64(salt);
  if (decoded.length !== 16) {
    throw new Error("تعذر قراءة بيانات الاشتقاق الآمنة.");
  }
  return decoded;
}

export async function deriveKeys(
  masterPassword: string,
  salt: WebCryptoBytes,
): Promise<DerivedKeys> {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterPassword),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const masterBits = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt,
        iterations: PBKDF2_ITERATIONS,
      },
      passwordKey,
      256,
    ),
  );

  try {
    const hkdfKey = await crypto.subtle.importKey(
      "raw",
      masterBits,
      "HKDF",
      false,
      ["deriveKey", "deriveBits"],
    );
    const encryptionKey = await crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt,
        info: encoder.encode("zero-knowledge-manager:v1:encryption"),
      },
      hkdfKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    const authBits = new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: "HKDF",
          hash: "SHA-256",
          salt,
          info: encoder.encode("zero-knowledge-manager:v1:authentication"),
        },
        hkdfKey,
        256,
      ),
    );
    const authKey = toBase64Url(authBits);
    authBits.fill(0);
    return { encryptionKey, authKey };
  } finally {
    masterBits.fill(0);
  }
}

export async function encryptPayload(
  payload: VaultPayload,
  key: CryptoKey,
): Promise<{ encrypted_data: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(payload)),
  );
  return {
    encrypted_data: toBase64(new Uint8Array(ciphertext)),
    iv: toBase64(iv),
  };
}

export async function decryptPayload(
  encryptedData: string,
  encodedIv: string,
  key: CryptoKey,
): Promise<VaultPayload> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(encodedIv) },
    key,
    fromBase64(encryptedData),
  );
  const value: unknown = JSON.parse(decoder.decode(plaintext));
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as Record<string, unknown>).title !== "string"
  ) {
    throw new Error("تعذر فك تشفير أحد عناصر الخزنة.");
  }
  return value as VaultPayload;
}
