const fs = require('fs');

const logPath = 'C:\\Users\\Irehok\\.gemini\\antigravity\\brain\\dd3293d7-bead-408a-812c-3eba5c9ea320\\.system_generated\\logs\\transcript_full.jsonl';
const fileContent = fs.readFileSync(logPath, 'utf8');
const lines = fileContent.split('\n');

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const data = JSON.parse(line);
    // Let's print out any code snippets containing MailApp or GmailApp from model or user
    if (data.content && (data.content.includes('MailApp') || data.content.includes('GmailApp'))) {
      console.log(`=== STEP ${data.step_index} ===`);
      console.log(data.content);
      console.log("====================\n\n");
    }
  } catch (e) {
    // ignore
  }
}
