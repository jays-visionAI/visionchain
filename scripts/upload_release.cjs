#!/usr/bin/env node
/**
 * Vision Node Release Upload Script
 * 
 * Usage:
 *   node upload_release.js <version> [--notes "Release notes"]
 * 
 * Example:
 *   node upload_release.js 1.2.0 --notes "New dashboard, bug fixes"
 * 
 * This script:
 * 1. Gets signed upload URLs from the Cloud Function
 * 2. Uploads each platform binary to Firebase Storage
 * 3. Finalizes the release (makes files public, deletes old versions)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CF_HOST = 'us-central1-visionchain-d19ed.cloudfunctions.net';
const ADMIN_KEY = 'vcn-admin-2026';
const DIST_DIR = path.join(__dirname, '..', 'vision-node-app', 'dist');

// Parse args
const args = process.argv.slice(2);
const version = args[0];
const notesIdx = args.indexOf('--notes');
const releaseNotes = notesIdx >= 0 ? args[notesIdx + 1] : '';

if (!version) {
    console.error('Usage: node upload_release.js <version> [--notes "notes"]');
    process.exit(1);
}

// File mapping: platform -> { filename pattern in dist, remote filename }
const PLATFORMS = {
    mac_arm64: {
        patterns: [`Vision Node-${version}-arm64.dmg`, `Vision-Node-${version}-arm64.dmg`],
        remote: `Vision-Node-${version}-arm64.dmg`,
    },
    mac_x64: {
        patterns: [`Vision Node-${version}.dmg`, `Vision-Node-${version}-x64.dmg`, `Vision Node-${version}-x64.dmg`],
        remote: `Vision-Node-${version}-x64.dmg`,
    },
    windows: {
        patterns: [`Vision Node Setup ${version}.exe`, `Vision-Node-Setup-${version}.exe`],
        remote: `Vision-Node-Setup-${version}.exe`,
    },
};

function callCF(functionName, data) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ data });
        const opts = {
            hostname: CF_HOST,
            path: `/${functionName}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        };
        const req = https.request(opts, (res) => {
            let buf = '';
            res.on('data', (d) => buf += d);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(buf);
                    resolve(parsed.result || parsed);
                } catch (e) {
                    reject(new Error(`Parse error: ${buf.substring(0, 200)}`));
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function uploadFile(signedUrl, filePath) {
    return new Promise((resolve, reject) => {
        const fileSize = fs.statSync(filePath).size;
        const fileStream = fs.createReadStream(filePath);

        const url = new URL(signedUrl);
        const opts = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Length': fileSize,
            },
        };

        console.log(`  Uploading ${(fileSize / 1024 / 1024).toFixed(1)} MB...`);

        const req = https.request(opts, (res) => {
            let buf = '';
            res.on('data', (d) => buf += d);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve();
                } else {
                    reject(new Error(`Upload failed (${res.statusCode}): ${buf.substring(0, 200)}`));
                }
            });
        });
        req.on('error', reject);

        let uploaded = 0;
        fileStream.on('data', (chunk) => {
            uploaded += chunk.length;
            const pct = ((uploaded / fileSize) * 100).toFixed(1);
            process.stdout.write(`\r  Progress: ${pct}%  (${(uploaded / 1024 / 1024).toFixed(1)} / ${(fileSize / 1024 / 1024).toFixed(1)} MB)`);
        });

        fileStream.pipe(req);
    });
}

function findFile(patterns) {
    for (const p of patterns) {
        const fullPath = path.join(DIST_DIR, p);
        if (fs.existsSync(fullPath)) return fullPath;
    }
    return null;
}

async function main() {
    console.log(`\n=== Vision Node Release Upload v${version} ===\n`);

    // Find available files
    const availablePlatforms = {};
    for (const [platform, config] of Object.entries(PLATFORMS)) {
        const filePath = findFile(config.patterns);
        if (filePath) {
            availablePlatforms[platform] = { localPath: filePath, remoteName: config.remote };
            console.log(`  [OK] ${platform}: ${path.basename(filePath)}`);
        } else {
            console.log(`  [--] ${platform}: not found, skipping`);
        }
    }

    if (Object.keys(availablePlatforms).length === 0) {
        console.error('\nNo release files found in:', DIST_DIR);
        console.error('Expected files like: Vision Node-{version}-arm64.dmg, etc.');
        process.exit(1);
    }

    // Step 1: Get signed upload URLs
    console.log('\n--- Step 1: Getting upload URLs ---');
    const uploadUrls = {};
    for (const [platform, info] of Object.entries(availablePlatforms)) {
        console.log(`  ${platform}...`);
        const result = await callCF('adminGetUploadUrl', {
            adminKey: ADMIN_KEY,
            version,
            platform,
            filename: info.remoteName,
        });
        if (!result.success) {
            console.error(`  Failed for ${platform}:`, result.error);
            process.exit(1);
        }
        uploadUrls[platform] = result.uploadUrl;
        console.log(`  Got signed URL for ${platform}`);
    }

    // Step 2: Upload files
    console.log('\n--- Step 2: Uploading files ---');
    for (const [platform, info] of Object.entries(availablePlatforms)) {
        console.log(`\n  ${platform}: ${info.remoteName}`);
        await uploadFile(uploadUrls[platform], info.localPath);
        console.log(`\n  ${platform}: Upload complete!`);
    }

    // Step 3: Finalize release (make public, delete old versions)
    console.log('\n--- Step 3: Finalizing release ---');
    const platformFiles = {};
    for (const [platform, info] of Object.entries(availablePlatforms)) {
        platformFiles[platform] = info.remoteName;
    }
    // Also set linux = windows
    if (platformFiles.windows) {
        platformFiles.linux = platformFiles.windows;
    }

    const finalResult = await callCF('adminFinalizeRelease', {
        adminKey: ADMIN_KEY,
        version,
        releaseNotes,
        platforms: platformFiles,
    });

    if (finalResult.success) {
        console.log(`\n=== Release v${version} is LIVE! ===`);
        console.log('\nDownload URLs:');
        for (const [platform, url] of Object.entries(finalResult.downloads || {})) {
            console.log(`  ${platform}: ${url}`);
        }
        if (finalResult.deletedOldVersions?.length > 0) {
            console.log('\nDeleted old versions:', finalResult.deletedOldVersions.join(', '));
        }
        console.log('\nTest: curl -I "https://us-central1-visionchain-d19ed.cloudfunctions.net/nodeDownload?platform=windows"');
    } else {
        console.error('\nFinalization failed:', finalResult.error);
    }
}

main().catch((e) => {
    console.error('\nFatal error:', e.message);
    process.exit(1);
});
