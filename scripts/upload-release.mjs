import https from 'https';
import { execSync } from 'child_process';
import fs from 'fs';

// Get token from git credential helper
const creds = execSync('printf "protocol=https\\nhost=github.com\\n\\n" | git credential fill').toString();
const token = creds.split('\n').find(l => l.startsWith('password=')).split('=')[1];
console.log('Token:', token.slice(0, 8) + '...');

const repo = 'jays-visionAI/visionchain';
const tag = 'node-v1.0.0';

function apiRequest(method, urlPath, body, contentType) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlPath.startsWith('http') ? urlPath : 'https://api.github.com' + urlPath);
        const opts = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method,
            headers: {
                'Authorization': 'token ' + token,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'VisionChain-CI'
            }
        };
        if (body) {
            opts.headers['Content-Type'] = contentType || 'application/json';
            opts.headers['Content-Length'] = Buffer.byteLength(body);
        }
        const req = https.request(opts, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                if (res.statusCode >= 400) reject(new Error(res.statusCode + ': ' + data.slice(0, 300)));
                else resolve(JSON.parse(data || '{}'));
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

function uploadFile(uploadUrl, name, data) {
    return new Promise((resolve, reject) => {
        const url = new URL(uploadUrl + '?name=' + name);
        const opts = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Authorization': 'token ' + token,
                'Content-Type': 'application/octet-stream',
                'Content-Length': data.length,
                'User-Agent': 'VisionChain-CI'
            }
        };
        const req = https.request(opts, res => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                if (res.statusCode >= 400) reject(new Error(res.statusCode + ': ' + body.slice(0, 200)));
                else resolve(JSON.parse(body));
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function main() {
    let release;
    try {
        release = await apiRequest('GET', `/repos/${repo}/releases/tags/${tag}`);
        console.log('Release exists, id:', release.id);
    } catch (e) {
        console.log('Creating release...');
        release = await apiRequest('POST', `/repos/${repo}/releases`, JSON.stringify({
            tag_name: tag,
            name: 'Vision Node v1.0.0',
            body: '## Vision Node Desktop App v1.0.0\n\n### Downloads\n- **macOS (Apple Silicon)**: VisionNode-arm64.dmg\n- **macOS (Intel)**: VisionNode-x64.dmg\n- **Windows**: VisionNode-Setup.exe (building via CI)\n\n### Installation\n1. Download the installer for your OS\n2. macOS: Open .dmg, drag to Applications\n3. Windows: Run VisionNode-Setup.exe\n4. Launch and enter your email to start',
            draft: false,
            prerelease: false
        }));
        console.log('Release created, id:', release.id);
    }

    const uploadBase = `https://uploads.github.com/repos/${repo}/releases/${release.id}/assets`;

    const files = [
        { name: 'VisionNode-arm64.dmg', path: 'vision-node-app/dist/VisionNode-arm64.dmg' },
        { name: 'VisionNode-x64.dmg', path: 'vision-node-app/dist/VisionNode-x64.dmg' }
    ];

    for (const f of files) {
        if (!fs.existsSync(f.path)) { console.log('Skip:', f.path); continue; }
        const data = fs.readFileSync(f.path);
        console.log(`Uploading ${f.name} (${(data.length / 1024 / 1024).toFixed(1)} MB)...`);

        const existing = (release.assets || []).find(a => a.name === f.name);
        if (existing) {
            console.log('  Deleting existing asset...');
            await apiRequest('DELETE', `/repos/${repo}/releases/assets/${existing.id}`);
        }

        const result = await uploadFile(uploadBase, f.name, data);
        console.log('  OK:', result.browser_download_url);
    }
    console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
