export type VaultCategory = "password" | "identity" | "note";

export interface VaultPayload {
  title: string;
  username: string;
  password: string;
  url: string;
  idNumber: string;
  notes: string;
}

export interface VaultItem {
  id: string;
  category: VaultCategory;
  encrypted_data: string;
  iv: string;
  updated_at: string;
  payload: VaultPayload;
}

export interface EncryptedItemInput {
  category: VaultCategory;
  encrypted_data: string;
  iv: string;
}
