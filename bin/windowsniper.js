#!/usr/bin/env node
const path = require('path');
const { spawn } = require('child_process');

let electronBinary;
try {
  electronBinary = require('electron');
} catch {
  console.error('Could not load Electron. Try: npm install');
  process.exit(1);
}

const child = spawn(electronBinary, [path.resolve(__dirname, '..'), ...process.argv.slice(2)], {
  detached: true,
  stdio: 'ignore',
  windowsHide: true,
});
child.on('error', err => {
  console.error('Failed to start WindowSniper:', err.message);
  process.exit(1);
});
child.unref();
const keys = process.platform === 'darwin' ? '⌘⌥G (Cmd+Option+G)' : 'Ctrl+Alt+G';
console.log(`WindowSniper is running in your ${process.platform === 'darwin' ? 'menu bar' : 'tray'}. Press ${keys} to draw the gun.`);
console.log('You can close this window.');
