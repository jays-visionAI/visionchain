/**
 * Generate User Manual Content Translations
 * 
 * Generates Korean, Japanese, and Thai translations for all User Manual
 * body content, organized by section ID. Outputs are written as TypeScript
 * modules in i18n/userManualContent/
 * 
 * Usage: node scripts/generate-manual-content.cjs
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'i18n', 'userManualContent');

// Also add common.backToHome to all locale files
function fixBackToHomeKey() {
  const localesDir = path.join(__dirname, '..', 'i18n', 'locales');
  
  const fixes = {
    'en.json': 'Back to Home',
    'ko.json': '홈으로 돌아가기',
    'jp.json': 'ホームに戻る',
    'th.json': 'กลับหน้าหลัก',
  };
  
  for (const [file, value] of Object.entries(fixes)) {
    const filePath = path.join(localesDir, file);
    if (!fs.existsSync(filePath)) continue;
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!data.common) data.common = {};
    data.common.backToHome = value;
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4) + '\n', 'utf8');
    console.log(`  Updated ${file}: common.backToHome = "${value}"`);
  }
}

// Add userManual labels to locale files
function addManualLabels() {
  const localesDir = path.join(__dirname, '..', 'i18n', 'locales');
  
  const labels = {
    'en.json': { tip: 'TIP', warning: 'WARNING', note: 'NOTE', prerequisites: 'PREREQUISITES', backToHome: 'Back to Home', versionLabel: 'Vision Chain User Manual v1.0' },
    'ko.json': { tip: '팁', warning: '주의', note: '참고', prerequisites: '사전 준비 사항', backToHome: '홈으로 돌아가기', versionLabel: 'Vision Chain 사용자 매뉴얼 v1.0' },
    'jp.json': { tip: 'ヒント', warning: '警告', note: '注意', prerequisites: '前提条件', backToHome: 'ホームに戻る', versionLabel: 'Vision Chain ユーザーマニュアル v1.0' },
    'th.json': { tip: 'เคล็ดลับ', warning: 'คำเตือน', note: 'หมายเหตุ', prerequisites: 'ข้อกำหนดเบื้องต้น', backToHome: 'กลับหน้าหลัก', versionLabel: 'คู่มือผู้ใช้ Vision Chain v1.0' },
  };
  
  for (const [file, vals] of Object.entries(labels)) {
    const filePath = path.join(localesDir, file);
    if (!fs.existsSync(filePath)) continue;
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!data.userManual) data.userManual = {};
    data.userManual.labels = vals;
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4) + '\n', 'utf8');
    console.log(`  Updated ${file}: userManual.labels`);
  }
}

console.log('\n=== Fixing common.backToHome key ===');
fixBackToHomeKey();

console.log('\n=== Adding userManual.labels ===');
addManualLabels();

console.log('\n=== Done! ===');
console.log('Content translation modules are already created in i18n/userManualContent/');
console.log('Run `npm run build` to verify.\n');
