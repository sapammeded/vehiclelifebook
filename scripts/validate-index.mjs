import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(source => source.trim());

if (!scripts.length) throw new Error('No inline JavaScript found in index.html');

for (const [index, source] of scripts.entries()) {
  try {
    new Function(source);
  } catch (error) {
    throw new Error(`Inline script #${index + 1} has invalid JavaScript: ${error.message}`);
  }
}

const localScripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi)]
  .map(match => match[1])
  .filter(src => !/^https?:\/\//i.test(src));

for (const src of localScripts) {
  const path = src.split('?')[0];
  if (!fs.existsSync(path)) throw new Error(`Local script missing: ${path}`);
  try {
    new Function(fs.readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Local script ${path} has invalid JavaScript: ${error.message}`);
  }
}

if (!html.includes('const SUPABASE_URL=')) throw new Error('Supabase configuration missing');
if (/SUPABASE_SERVICE_ROLE_KEY\s*[:=]|service[_-]?role[_-]?key\s*[:=]/i.test(html)) {
  throw new Error('Potential service-role secret detected in frontend');
}
if (!html.includes('js/automotive-core.js')) throw new Error('Automotive core is not loaded');
if (!fs.existsSync('js/automotive-core.js')) throw new Error('Automotive core file missing');

console.log(`Vehicle Lifebook validation OK: ${scripts.length} inline + ${localScripts.length} local script(s)`);
