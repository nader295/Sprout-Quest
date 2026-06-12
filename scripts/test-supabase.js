const fs = require('fs');
const envPath = '.env.local';

if (!fs.existsSync(envPath)) {
  console.error("Missing .env.local");
  process.exit(1);
}

const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  if (line && !line.startsWith('#') && line.includes('=')) {
    const parts = line.split('=');
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
    acc[k] = v;
  }
  return acc;
}, {});

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error("Missing URL or KEY in .env.local");
  process.exit(1);
}

async function test() {
  try {
    const romRes = await fetch(URL + '/rest/v1/roms?limit=1', {
      headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY }
    });
    const roms = await romRes.json();
    console.log("=== ROMS PREVIEW ===");
    console.log(JSON.stringify(roms, null, 2));

    const usrRes = await fetch(URL + '/rest/v1/users?limit=2', {
      headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY }
    });
    const users = await usrRes.json();
    console.log("=== USERS PREVIEW ===");
    console.log(JSON.stringify(users, null, 2));
    
  } catch(e) {
    console.error(e);
  }
}

test();
