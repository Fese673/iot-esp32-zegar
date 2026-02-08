const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const file = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;

// Check duplicate IDs
const all = Array.from(doc.querySelectorAll('[id]'));
const ids = all.map(n => n.id);
const dup = ids.filter((v, i) => ids.indexOf(v) !== i);

console.log('IDs found:', ids.length);
if (dup.length) {
  console.warn('Duplicate IDs detected:', [...new Set(dup)].join(', '));
} else {
  console.log('No duplicate IDs detected.');
}

// Check images without alt
const imgs = Array.from(doc.querySelectorAll('img'));
const imgsMissingAlt = imgs.filter(i => !i.hasAttribute('alt') || i.getAttribute('alt').trim() === '');
if (imgsMissingAlt.length) {
  console.warn('Images without alt text:', imgsMissingAlt.map(i => i.src).join(', '));
} else {
  console.log('All images have alt text.');
}

// Basic readability: file length
const size = html.split('\n').length;
console.log('index.html lines:', size);
if (size > 2000) console.warn('Large HTML file - consider splitting templates.');

// Report success status
console.log('Auto-diagnostics completed.');
process.exit(0);
