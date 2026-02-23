/**
 * Notarize the macOS app after signing.
 * 
 * Required environment variables:
 *   APPLE_ID              - Apple ID email
 *   APPLE_APP_SPECIFIC_PASSWORD - App-specific password (NOT your Apple ID password)
 *   APPLE_TEAM_ID         - Developer Team ID
 * 
 * If any of these are missing, notarization is skipped (useful for local dev builds).
 */
const { notarize } = require('@electron/notarize');
const path = require('path');

exports.default = async function notarizing(context) {
    const { electronPlatformName, appOutDir } = context;

    // Only notarize macOS builds
    if (electronPlatformName !== 'darwin') {
        return;
    }

    // Skip if credentials not set
    if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD || !process.env.APPLE_TEAM_ID) {
        console.log('  • Skipping notarization: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, or APPLE_TEAM_ID not set');
        return;
    }

    const appName = context.packager.appInfo.productFilename;
    const appPath = path.join(appOutDir, `${appName}.app`);

    console.log(`  • Notarizing ${appName}...`);

    await notarize({
        appPath,
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID,
    });

    console.log(`  • Notarization complete!`);
};
