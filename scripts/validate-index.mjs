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

if (!html.includes('const SUPABASE_URL=')) throw new Error('Supabase configuration missing');
if (/service[_-]?role|SUPABASE_SERVICE_ROLE_KEY/i.test(html)) {
  throw new Error('Potential service-role secret detected in frontend');
}

console.log(`Vehicle Lifebook validation OK: ${scripts.length} inline script(s)`);
