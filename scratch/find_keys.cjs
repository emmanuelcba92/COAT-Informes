const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'dist', 'assets');
if (!fs.existsSync(assetsDir)) {
  console.log("dist/assets folder not found!");
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);
for (const file of files) {
  if (file.endsWith('.js')) {
    const content = fs.readFileSync(path.join(assetsDir, file), 'utf8');
    
    // Search for firebaseConfig or apiKey
    const fbMatch = content.match(/apiKey\s*:\s*"[^"]+",\s*authDomain\s*:\s*"[^"]+",\s*projectId\s*:\s*"[^"]+"/);
    if (fbMatch) {
      console.log(`Found Firebase config in ${file}:`);
      // Let's print the match plus surrounding characters to get the whole object
      const idx = fbMatch.index;
      console.log(content.substring(Math.max(0, idx - 50), Math.min(content.length, idx + 350)));
    }
    
    // Search for Supabase url
    const sbMatch = content.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
    if (sbMatch) {
      console.log(`Found Supabase URL in ${file}:`);
      const idx = sbMatch.index;
      console.log(content.substring(Math.max(0, idx - 10), Math.min(content.length, idx + 300)));
    }

    // Search for Gemini key
    const gemMatch = content.match(/AIzaSy[A-Za-z0-9_-]{33}/g);
    if (gemMatch) {
      console.log(`Found potential API Keys in ${file}:`, gemMatch);
    }
  }
}
