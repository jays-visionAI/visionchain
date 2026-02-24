const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const fileReplacements = [
    { from: /\bMMAdmin/g, to: 'TradingAdmin' },
    { from: /\bMMAdminPages\b/g, to: 'TradingAdminPages' },
    { from: /components\/mm-admin/g, to: 'components/trading-admin' },
    { from: /pages\/MMAdminPages/g, to: 'pages/TradingAdminPages' },
];

function processFiles() {
    const dir = process.cwd();
    function walk(dir) {
        let results = [];
        if (!fs.existsSync(dir)) return results;
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            file = path.join(dir, file);
            const stat = fs.statSync(file);
            if (stat && stat.isDirectory()) {
                if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('dist') && !file.includes('artifacts')) {
                    results = results.concat(walk(file));
                }
            } else {
                if (
                    file.endsWith('.ts') || file.endsWith('.tsx') ||
                    file.endsWith('.js') || file.endsWith('.jsx') ||
                    file.endsWith('.md')
                ) {
                    results.push(file);
                }
            }
        });
        return results;
    }

    const files = walk(dir);
    files.forEach(file => {
        // skip the script itself
        if (file.includes('rename_mm_2.cjs') || file.includes('rename_mm.cjs')) return;

        let content = fs.readFileSync(file, 'utf8');
        let original = content;

        fileReplacements.forEach(({ from, to }) => {
            content = content.replace(from, to);
        });

        if (content !== original) {
            fs.writeFileSync(file, content, 'utf8');
            console.log('Updated content in:', file);
        }
    });
}

processFiles();

const renames = [
    ['components/mm-admin/MMActivityLog.tsx', 'components/trading-admin/TradingActivityLog.tsx'],
    ['components/mm-admin/MMAdminDashboard.tsx', 'components/trading-admin/TradingAdminDashboard.tsx'],
    ['components/mm-admin/MMAdminLayout.tsx', 'components/trading-admin/TradingAdminLayout.tsx'],
    ['components/mm-admin/MMAdminLogin.tsx', 'components/trading-admin/TradingAdminLogin.tsx'],
    ['components/mm-admin/MMAgents.tsx', 'components/trading-admin/TradingAgents.tsx'],
    ['components/mm-admin/MMInventory.tsx', 'components/trading-admin/TradingInventory.tsx'],
    ['components/mm-admin/MMPriceDirection.tsx', 'components/trading-admin/TradingPriceDirection.tsx'],
    ['components/mm-admin/MMRiskControls.tsx', 'components/trading-admin/TradingRiskControls.tsx'],
    ['components/mm-admin/MMSpreadLayers.tsx', 'components/trading-admin/TradingSpreadLayers.tsx'],
    ['pages/MMAdminPages.tsx', 'pages/TradingAdminPages.tsx'],
    ['docs/MM-ADMIN-DESIGN.md', 'docs/TRADING-ADMIN-DESIGN.md'],
    ['docs/MM-ADMIN-IMPLEMENTATION-STATUS.md', 'docs/TRADING-ADMIN-IMPLEMENTATION-STATUS.md'],
    ['docs/SOTA-MM-ARCHITECTURE.md', 'docs/SOTA-TRADING-ARCHITECTURE.md'],
    ['scripts/check-mm.js', 'scripts/check-trading.js']
];

try {
    execSync('mkdir -p components/trading-admin');
} catch (e) { }

renames.forEach(([oldPath, newPath]) => {
    if (fs.existsSync(oldPath)) {
        try {
            execSync(`git mv "${oldPath}" "${newPath}" || mv "${oldPath}" "${newPath}"`);
            console.log('Moved', oldPath, 'to', newPath);
        } catch (e) {
            console.log('Failed moving', oldPath);
        }
    }
});

// Since the components/mm-admin folder is now empty (if it existed), it can be deleted
if (fs.existsSync('components/mm-admin') && fs.readdirSync('components/mm-admin').length === 0) {
    try {
        execSync('rm -rf components/mm-admin');
    } catch (e) { }
}
