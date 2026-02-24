const fs = require('fs');
const path = require('path');

const replacements = [
    { from: /\bMMAdminDashboard\b/g, to: 'TradingAdminDashboard' },
    { from: /\bMMAdmin\b/g, to: 'TradingAdmin' },
    { from: /\bmmAdmin\b/g, to: 'tradingAdmin' },
    { from: /\bmm-admin\b/g, to: 'trading-admin' },
    { from: /\bMM\sDashboard\b/g, to: 'Trading Dashboard' },
    { from: /\bMM\sOperations\b/g, to: 'Trading Operations' },
    { from: /\bMM\sAlpha\b/g, to: 'Trading Alpha' },
    { from: /\bMM\sBeta\b/g, to: 'Trading Beta' },
    { from: /\bMM\sConfig\b/g, to: 'Trading Config' },
    { from: /\bmmConfig\b/g, to: 'tradingConfig' },
    { from: /\bMMConfig\b/g, to: 'TradingConfig' },
    { from: /\bmmSettings\b/g, to: 'tradingSettings' },
    { from: /\bMMSettings\b/g, to: 'TradingSettings' },
    { from: /\bmm-settings\b/g, to: 'trading-settings' },
    { from: /\bmmPaused\b/g, to: 'tradingPaused' },
    { from: /\bmmAgents\b/g, to: 'tradingAgents' },
    { from: /\bMMAgents\b/g, to: 'TradingAgents' },
    { from: /\bisMMOrder\b/g, to: 'isTradingOrder' },
    { from: /\bgenerateMMOrders\b/g, to: 'generateTradingOrders' },
    { from: /\bmmMakerFeeRate\b/g, to: 'tradingMakerFeeRate' },
    { from: /\bmmTakerFeeRate\b/g, to: 'tradingTakerFeeRate' },
    { from: /\bmm_bull\b/g, to: 'trading_bull' },
    { from: /\bmm_bear\b/g, to: 'trading_bear' },
    { from: /\bMM\b/g, to: 'Trading' },
    { from: /\bmm\b/g, to: 'trading' }
];

function walk(dir) {
    let results = [];
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
                file.endsWith('.md') || file.endsWith('.json') ||
                file.endsWith('.html') || file.endsWith('.css')
            ) {
                if (!file.includes('package-lock.json')) {
                    results.push(file);
                }
            }
        }
    });
    return results;
}

const files = walk(process.cwd());

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Exclude DD-MM-YYYY which gets caught by \bMM\b
    // We can temporarily replace it with a placeholder
    content = content.replace(/DD-MM-YYYY/g, '__DATE_FMT__');

    replacements.forEach(({ from, to }) => {
        content = content.replace(from, to);
    });

    content = content.replace(/__DATE_FMT__/g, 'DD-MM-YYYY');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated:', file);
    }
});
