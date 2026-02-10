#!/usr/bin/env node
/**
 * Next 16: next/navigation.js is empty; the real implementation is in
 * dist/client/components/navigation.js. This script patches navigation.js
 * to re-export so "next/navigation" resolves correctly (fixes useRouter etc).
 * Run automatically on npm install via postinstall.
 */
const path = require('path');
const fs = require('fs');

let nextPkg;
try {
  nextPkg = path.dirname(require.resolve('next/package.json'));
} catch {
  process.exit(0); // next not installed (e.g. backend-only install)
}

const navPath = path.join(nextPkg, 'navigation.js');
const content = `'use strict';
// Next 16: top-level file is empty; re-export from actual implementation
module.exports = require('./dist/client/components/navigation.js');
`;

fs.writeFileSync(navPath, content, 'utf8');
console.log('Patched next/navigation.js');
