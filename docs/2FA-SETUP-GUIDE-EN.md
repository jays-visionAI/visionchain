# Vision Chain Two-Factor Authentication (2FA) Setup Guide

## Introduction

Vision Chain Wallet supports Two-Factor Authentication (2FA) using Google Authenticator. When 2FA is enabled, an additional security code is required when restoring your wallet from the cloud, protecting your assets even if your phone is lost or compromised.

---

## 1. Install Google Authenticator

### iOS (iPhone/iPad)
1. Open the App Store
2. Search for "Google Authenticator"
3. Tap **Install**

### Android
1. Open Google Play Store
2. Search for "Google Authenticator"
3. Tap **Install**

---

## 2. Enable 2FA

### Step 1: Access Settings
1. Open the Vision Chain Wallet app
2. Navigate to **Settings**
3. Select **Security Settings** > **Two-Factor Authentication**

### Step 2: Scan QR Code
1. Tap "Enable 2FA" button
2. A **QR code** will appear on screen
3. Open Google Authenticator and tap the **+** button
4. Select **Scan QR Code**
5. Scan the QR code displayed in the Vision Chain app

> **Can't scan the QR code?**
> Use the manual entry key shown on screen with the **Manual Entry** option in Google Authenticator.

### Step 3: Verify Authentication Code
1. Find **Vision Chain** in Google Authenticator
2. Note the displayed **6-digit code**
3. Enter the code in the Vision Chain app
4. Tap **Activate**

### Step 4: Save Backup Codes (Important!)
1. Upon successful activation, **8 backup codes** will be displayed
2. **Store these codes in a safe place**:
   - Write them on paper
   - Save in an encrypted note
   - Store in a password manager
3. Backup codes will also be sent to your email

> **Warning**: Backup codes are used when you cannot access Google Authenticator.
> Each backup code can only be used **once**.

---

## 3. Restore Wallet from Cloud (Using 2FA)

### When 2FA is Enabled
1. Select **Restore from Cloud**
2. Enter your wallet password
3. **Google Authenticator Code** screen will appear
4. Open Google Authenticator and find Vision Chain's 6-digit code
5. Enter the code and tap **Confirm**
6. Wallet restoration complete!

### If You Cannot Enter a Code
1. Select **Use Backup Code** option
2. Enter one of your saved 8-character backup codes
3. Wallet restoration complete (used backup code cannot be reused)

---

## 4. Disable 2FA

> **Warning**: Disabling 2FA will lower your security level.

1. Go to **Settings** > **Security Settings** > **Two-Factor Authentication**
2. Tap **Disable 2FA** button
3. Enter the current 6-digit code from Google Authenticator
4. Deactivation complete

---

## 5. Frequently Asked Questions (FAQ)

### Q: I lost my phone. What do I do?
**A**: Use your saved backup codes to restore your wallet. After restoration, set up 2FA again on your new phone.

### Q: I deleted Google Authenticator.
**A**: Log in with a backup code, disable 2FA, and set it up again.

### Q: I lost my backup codes too.
**A**: Contact customer support. We will help recover your account through identity verification.

### Q: The code is correct but says "Invalid code".
**A**: 
- Make sure your phone's time is accurate (automatic time setting recommended)
- Run time sync in Google Authenticator:
  - Settings > Time correction for codes > Sync now

### Q: How often does the 2FA code change?
**A**: A new code is generated every 30 seconds.

### Q: Can I use the same 2FA on multiple devices?
**A**: Yes! Scan the QR code on multiple devices during setup to generate identical codes.

---

## 6. Security Recommendations

1. **Keep Backup Codes Safe**: Do not store them online
2. **Be Careful with Screenshots**: Never screenshot QR codes or backup codes
3. **Check Regularly**: Periodically check how many backup codes you have left
4. **If Device Lost**: Immediately reset 2FA from another device
5. **Suspicious Activity**: If you receive a new device login alert, verify immediately

---

## 7. Technical Support

If your issue is not resolved, contact our support team:
- Email: support@visionchain.co
- Official Website: https://visionchain.co

---

*Last Updated: February 2026*
