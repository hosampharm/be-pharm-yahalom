import { mkdir, copyFile, cp, writeFile } from 'node:fs/promises';
import { validateConfig } from '../src/config.js';
const config = validateConfig(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
await mkdir('dist', { recursive: true });
await copyFile('index.html', 'dist/index.html');
await cp('src', 'dist/src', { recursive: true });
await cp('public', 'dist', { recursive: true });
await writeFile('dist/config.js', `export default ${JSON.stringify(config)};\n`);
console.log(config.url ? 'Built with public Supabase configuration.' : 'Built without credentials; kiosk will show setup message.');
