import * as bip39 from 'bip39';
import { ethers } from 'ethers';

const ENCRYPTION_KEY_SALT = 'vcn-platform-v1';

export class WalletService {
    /**
     * Generates a 15-word mnemonic (160-bit entropy)
     */
    static generateMnemonic(): string {
        return bip39.generateMnemonic(160);
    }

    /**
     * Validates a mnemonic
     */
    static validateMnemonic(mnemonic: string): boolean {
        return bip39.validateMnemonic(mnemonic);
    }

    /**
     * Derives an EOA (Externally Owned Account) from mnemonic
     */
    static deriveEOA(mnemonic: string) {
        const wallet = ethers.Wallet.fromPhrase(mnemonic);
        return {
            address: wallet.address,
            privateKey: wallet.privateKey
        };
    }

    /**
     * Encrypts data using AES-GCM with a user-provided password
     */
    static async encrypt(data: string, password: string): Promise<string> {
        const encoder = new TextEncoder();
        const dataUint8 = encoder.encode(data);

        const key = await this.deriveKey(password);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        const encrypted = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            dataUint8
        );

        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);

        return btoa(String.fromCharCode(...combined));
    }

    /**
     * Decrypts AES-GCM encrypted data
     */
    static async decrypt(encryptedBase64: string, password: string): Promise<string> {
        const combined = new Uint8Array(
            atob(encryptedBase64).split('').map(char => char.charCodeAt(0))
        );

        const iv = combined.slice(0, 12);
        const dataUint8 = combined.slice(12);

        const key = await this.deriveKey(password);

        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            dataUint8
        );

        return new TextDecoder().decode(decrypted);
    }

    /**
     * Derives a cryptographic key from a password using PBKDF2
     */
    private static async deriveKey(password: string): Promise<CryptoKey> {
        const encoder = new TextEncoder();
        const passwordUint8 = encoder.encode(password);
        const saltUint8 = encoder.encode(ENCRYPTION_KEY_SALT);

        const baseKey = await window.crypto.subtle.importKey(
            "raw",
            passwordUint8,
            "PBKDF2",
            false,
            ["deriveBits", "deriveKey"]
        );

        return await window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: saltUint8,
                iterations: 100000,
                hash: "SHA-256"
            },
            baseKey,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    }

    /**
     * Stores encrypted seed in Local Storage
     */
    static saveEncryptedWallet(encryptedWallet: string) {
        localStorage.setItem('vcn_encrypted_wallet', encryptedWallet);
    }

    /**
     * Retrieves encrypted seed from Local Storage
     */
    static getEncryptedWallet(): string | null {
        return localStorage.getItem('vcn_encrypted_wallet');
    }

    /**
     * Checks if a wallet already exists
     */
    static hasWallet(): boolean {
        return !!this.getEncryptedWallet();
    }
}
