const fs = require('fs');
const path = require('path');

const dirs = [
  path.join(__dirname, '../src/pages'),
  path.join(__dirname, '../src/components')
];

const replacements = [
  // Backgrounds
  { regex: /bg-slate-900\/90/g, replacement: 'bg-white/90 dark:bg-slate-900/90' },
  { regex: /bg-slate-900\/80/g, replacement: 'bg-white/80 dark:bg-slate-900/80' },
  { regex: /bg-slate-950\/70/g, replacement: 'bg-slate-50/70 dark:bg-slate-950/70' },
  { regex: /(?<!dark:)bg-slate-900/g, replacement: 'bg-white dark:bg-slate-900' },
  { regex: /(?<!dark:)bg-slate-950/g, replacement: 'bg-slate-50 dark:bg-slate-950' },
  { regex: /(?<!dark:)bg-slate-800/g, replacement: 'bg-slate-100 dark:bg-slate-800' },
  { regex: /(?<!dark:)bg-slate-950\/80/g, replacement: 'bg-slate-100/80 dark:bg-slate-950/80' },
  
  // Borders
  { regex: /(?<!dark:)border-slate-800/g, replacement: 'border-slate-200 dark:border-slate-800' },
  { regex: /(?<!dark:)border-slate-700/g, replacement: 'border-slate-300 dark:border-slate-700' },

  // Text
  { regex: /(?<!dark:)text-slate-100/g, replacement: 'text-slate-900 dark:text-slate-100' },
  { regex: /(?<!dark:)text-slate-200/g, replacement: 'text-slate-800 dark:text-slate-200' },
  { regex: /(?<!dark:)text-slate-300/g, replacement: 'text-slate-700 dark:text-slate-300' },
  { regex: /(?<!dark:)text-slate-400/g, replacement: 'text-slate-600 dark:text-slate-400' }
];

function processFile(filePath) {
  // Skip Sidebar and Navbar, we already engineered them specifically or they must remain dark
  if (filePath.includes('Sidebar.jsx') || filePath.includes('Navbar.jsx') || filePath.includes('Card.jsx')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  replacements.forEach(({ regex, replacement }) => {
    content = content.replace(regex, replacement);
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${path.basename(filePath)}`);
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      processFile(fullPath);
    }
  }
}

dirs.forEach(walkDir);
console.log("Migration complete!");
