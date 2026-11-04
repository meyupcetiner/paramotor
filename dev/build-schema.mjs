// src/schema.sql -> src/schema.js (Worker içine gömülü şema)
import { readFileSync, writeFileSync } from 'node:fs';
const sql = readFileSync(new URL('../src/schema.sql', import.meta.url), 'utf8').trim();
writeFileSync(new URL('../src/schema.js', import.meta.url), '// Otomatik üretildi: npm run schema\nexport const SCHEMA = ' + JSON.stringify(sql) + ';\n');
console.log('schema.js yazıldı');
