#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const libDir = path.join(root, 'lib');
const pluginDir = path.join(root, 'expo-plugin');
const supportSrc = path.join(pluginDir, 'support');

function run(cmd) {
  console.log('> ' + cmd);
  execSync(cmd, { stdio: 'inherit' });
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const file of fs.readdirSync(src)) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) copyRecursive(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

console.log('🏗️ Building Expo Config Plugin...');

// Clean output folders
run(
  'del-cli lib/typescript/expo-plugin lib/commonjs/expo-plugin lib/module/expo-plugin'
);

// Step 1️⃣ Build ESNext version (for types/module)
run('tsc --project expo-plugin/tsconfig.json');

// Step 2️⃣ Build CommonJS version (for Expo prebuild)
const cjsOutDir = path.join(libDir, 'commonjs/expo-plugin');
run(
  `tsc --project expo-plugin/tsconfig.json --module commonjs --outDir ${cjsOutDir} --declaration false --declarationMap false`
);

// Step 3️⃣ Copy ESNext output to module/
const moduleDir = path.join(libDir, 'module/expo-plugin');
copyRecursive(path.join(libDir, 'typescript/expo-plugin'), moduleDir);

// Step 4️⃣ Copy support files to all targets
const supportDestCommon = path.join(cjsOutDir, 'support');
const supportDestModule = path.join(moduleDir, 'support');
const supportDestTypes = path.join(libDir, 'typescript/expo-plugin/support');

copyRecursive(supportSrc, supportDestCommon);
copyRecursive(supportSrc, supportDestModule);
copyRecursive(supportSrc, supportDestTypes);

// Step 5️⃣ Generate top-level app.plugin.js (CJS)
const entry = path.join(cjsOutDir, 'withScreenRecorder.js'); // change if main entry differs
const appPluginPath = path.join(root, 'app.plugin.js');
if (fs.existsSync(entry)) {
  fs.writeFileSync(
    appPluginPath,
    `module.exports = require('./lib/commonjs/expo-plugin/withScreenRecorder');\n`
  );
  console.log('🧩 Generated CommonJS app.plugin.js for Expo prebuild');
}

console.log('✅ Expo plugin compiled and placed in:');
console.log('   - lib/typescript/expo-plugin');
console.log('   - lib/module/expo-plugin');
console.log('   - lib/commonjs/expo-plugin');
