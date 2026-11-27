#!/usr/bin/env node
const path = require('path');
const { spawn } = require('child_process');

const tty = process.stdout.isTTY;
const paint = code => s => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = paint('38;5;203'), bold = paint('1'), dim = paint('2'), green = paint('38;5;114');

const mark = ['╭─┼─╮', '┼ ● ┼', '╰─┼─╯'];
const word1 = ['█   █ ▀█▀ █▄  █ █▀▀▀▄ ▄▀▀▀▄ █   █', '█▄▀▄█  █  █ ▀▄█ █   █ █   █ █▄▀▄█', '▀   ▀ ▀▀▀ ▀   ▀ ▀▀▀▀   ▀▀▀  ▀   ▀'];
const word2 = ['▄▀▀▀▀ █▄  █ ▀█▀ █▀▀▀▄ █▀▀▀▀ █▀▀▀▄', ' ▀▀▀▄ █ ▀▄█  █  █▀▀▀  █▀▀▀  █▀▀█ ', '▀▀▀▀  ▀   ▀ ▀▀▀ ▀     ▀▀▀▀▀ ▀   ▀'];

console.log('');
for (let i = 0; i < 3; i++) console.log(`  ${red(mark[i])}  ${bold(word1[i])}   ${red(word2[i])}`);
console.log(`\n         ${bold('Shoot a window. It closes.')}\n`);

let electronBinary;
try {
  electronBinary = require('electron');
} catch {
  console.error(red('  ✗ Electron is missing. Run the install command again.'));
  process.exit(1);
}

const child = spawn(electronBinary, [path.resolve(__dirname, '..'), ...process.argv.slice(2)], {
  detached: true,
  stdio: 'ignore',
  windowsHide: true,
});
child.on('error', err => {
  console.error(red(`  ✗ WindowSniper didn't start: ${err.message}`));
  process.exit(1);
});
child.unref();

const mac = process.platform === 'darwin';
console.log(`  ${green('✓')} Running in your ${mac ? 'menu bar' : 'tray'}.`);
console.log(`  ${green('✓')} Press ${bold(mac ? '⌘⌥G' : 'Ctrl+Alt+G')} to draw the gun. Click to shoot, ${bold('Esc')} to put it away.`);
console.log(dim('\n  You can close this window.\n'));
