import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();

function walk(dir, predicate, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, result);
    else if (predicate(full)) result.push(full);
  }
  return result;
}

for (const file of walk(root, file => file.endsWith('.html'))) {
  const source = fs.readFileSync(file, 'utf8');
  const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1].trim())
    .filter(Boolean);
  for (const script of scripts) {
    const temp = path.join(root, '.inline-script-check.tmp.mjs');
    fs.writeFileSync(temp, script, 'utf8');
    try {
      execFileSync(process.execPath, ['--check', temp], { stdio: 'pipe' });
    } catch (error) {
      console.error(`Invalid inline JavaScript in ${path.relative(root, file)}`);
      console.error(error.stdout?.toString() || error.stderr?.toString() || error.message);
      process.exitCode = 1;
    } finally {
      fs.rmSync(temp, { force: true });
    }
  }
}

const functionsDir = path.join(root, 'supabase', 'functions');
const folders = fs.readdirSync(functionsDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && entry.name !== '_shared')
  .map(entry => entry.name)
  .sort();
const manifest = fs.readFileSync(path.join(functionsDir, '..', 'deploy-functions.ps1'), 'utf8');
const manifestBlock = manifest.match(/\$functions\s*=\s*@\(([\s\S]*?)\n\)/)?.[1] || '';
const listed = [...manifestBlock.matchAll(/'([^']+)'/g)].map(match => match[1]).sort();
const missing = folders.filter(name => !listed.includes(name));
const stale = listed.filter(name => !folders.includes(name));
if (missing.length || stale.length) {
  if (missing.length) console.error(`Functions missing from deploy manifest: ${missing.join(', ')}`);
  if (stale.length) console.error(`Stale functions in deploy manifest: ${stale.join(', ')}`);
  process.exitCode = 1;
}
