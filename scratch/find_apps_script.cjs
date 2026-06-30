const fs = require('fs');

const logPath = 'C:\\Users\\Irehok\\.gemini\\antigravity\\brain\\dd3293d7-bead-408a-812c-3eba5c9ea320\\.system_generated\\logs\\transcript.jsonl';
const fileContent = fs.readFileSync(logPath, 'utf8');
const lines = fileContent.split('\n');

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const data = JSON.parse(line);
    // Ignore the current steps (greater than 430)
    if (data.step_index >= 430) continue;
    
    // Look for indicators of code like mailApp, MailApp, DriveApp, getFolderById, etc.
    const searchTerms = ['MailApp', 'GmailApp', 'createFolder', 'getFolderById', 'appsScriptUrl'];
    const matched = searchTerms.find(term => data.content && data.content.includes(term));
    if (matched) {
      console.log(`=== STEP ${data.step_index} (${data.type}) MATCHED '${matched}' ===`);
      // print first 500 chars
      console.log(data.content.substring(0, 800) + '...');
    }
  } catch (e) {
    // ignore
  }
}
