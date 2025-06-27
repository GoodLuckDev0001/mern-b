const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

function extractPlaceholdersFromXml(xml) {
  // Match Word form field names (e.g., <w:name w:val="Text1"/>)
  const nameRegex = /<w:name w:val="([^"]+)"/g;
  const matches = new Set();
  let match;
  while ((match = nameRegex.exec(xml)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches);
}

function extractPlaceholders(docxPath) {
  const zip = new AdmZip(docxPath);
  const xmlEntry = zip.getEntry('word/document.xml');
  if (!xmlEntry) {
    console.error('word/document.xml not found in DOCX');
    process.exit(1);
  }
  const xml = xmlEntry.getData().toString('utf8');
  const placeholders = extractPlaceholdersFromXml(xml);
  return placeholders;
}

if (require.main === module) {
  const docxPath = process.argv[2];
  if (!docxPath) {
    console.error('Usage: node extractPlaceholders.js path/to/template.docx');
    process.exit(1);
  }
  const placeholders = extractPlaceholders(docxPath);
  console.log('Placeholders found:', placeholders);
} 