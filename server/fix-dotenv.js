const fs = require('fs');

// Read the index.js file
let content = fs.readFileSync('index.js', 'utf8');

// Remove the old dotenv.config() call if it exists anywhere
content = content.replace(/\ndotenv\.config\(\);?\n/g, '\n');

// Find the import section and add dotenv.config() right after all imports
const lines = content.split('\n');
let newLines = [];
let foundLastImport = false;

for (let i = 0; i < lines.length; i++) {
    newLines.push(lines[i]);

    // Check if this is an import line and the next line is NOT an import
    if (lines[i].startsWith('import ') && i < lines.length - 1 && !lines[i + 1].startsWith('import ')) {
        if (!foundLastImport) {
            // Add dotenv.config() after last import
            newLines.push('');
            newLines.push('// CRITICAL: Load environment variables BEFORE any other code runs');
            newLines.push('dotenv.config();');
            newLines.push('');
            foundLastImport = true;
        }
    }
}

fs.writeFileSync('index.js', newLines.join('\n'));
console.log('✅ Fixed dotenv import order');
