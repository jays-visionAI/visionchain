# VisionChain Password & Security Update

## What's New

### Separate Login & Wallet Passwords
Your account now has **two independent passwords**:

- **Login Password** -- Used to sign in to your VisionChain account via email.
- **Wallet Password** -- Used to encrypt/decrypt your wallet and for cloud backup & recovery. You can now change each password independently from **Settings > Password**.

### Cloud Backup Uses Your Wallet Password
When you use **Sync to Cloud**, the system encrypts your wallet with your **wallet password** (not your login password). Keep this in mind:

- To back up your wallet, enter your **wallet password**.
- To restore your wallet on a new device, you will need your **wallet password**.
- If you change your wallet password, the cloud backup is automatically updated with the new password.

### 2FA (Google Authenticator) Is Required for Password Changes
To protect your account, **Two-Factor Authentication (2FA) via Google Authenticator is mandatory** before you can change either password. If you have not yet enabled 2FA, you will be prompted to do so in the Security tab.

### 2FA Is Required for Wallet Recovery
When restoring your wallet from the cloud on a new device, **2FA verification is required** in addition to your wallet password. This ensures that even if someone obtains your password, they cannot access your wallet without your authenticator code.

---

## Important Notice

> **All users are strongly advised to enable Two-Factor Authentication (2FA).**
>
> If you choose not to enable 2FA and subsequently lose access to your password, **you bear full responsibility** for any loss of funds or inability to access your wallet.
>
> VisionChain **cannot recover passwords, wallets, or funds** without proper authentication. There is no password reset mechanism for wallet encryption — your wallet password and 2FA are the only ways to access your assets.

---

## Quick Reference

| Action | Password Used | 2FA Required? |
|--------|--------------|---------------|
| Sign in to account | Login Password | No |
| Change login password | Login Password + OTP | **Yes** |
| Change wallet password | Wallet Password + OTP | **Yes** |
| Sync wallet to cloud | Wallet Password | No |
| Restore wallet from cloud | Wallet Password + OTP | **Yes** |
| Send transactions | Wallet Password | No |

---

## How to Get Started

1. Go to **Settings > Security** and enable **Google Authenticator (2FA)**.
2. Save your **backup codes** in a safe place.
3. Go to **Settings > Password** to manage your login and wallet passwords separately.
4. Use **Settings > Security > Sync to Cloud** to back up your wallet with your wallet password.
