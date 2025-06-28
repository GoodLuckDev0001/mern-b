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

function extractPlaceholdersFromDocx(docxPath) {
  try {
    const zip = new AdmZip(docxPath);
    const xmlEntry = zip.getEntry('word/document.xml');
    
    if (!xmlEntry) {
      console.error('word/document.xml not found in DOCX');
      return [];
    }
    
    const xml = xmlEntry.getData().toString('utf8');
    return extractPlaceholdersFromXml(xml);
  } catch (error) {
    console.error('Error reading DOCX file:', error.message);
    return [];
  }
}

function extractPlaceholdersFromXmlFile(xmlPath) {
  try {
    const xml = fs.readFileSync(xmlPath, 'utf8');
    return extractPlaceholdersFromXml(xml);
  } catch (error) {
    console.error('Error reading XML file:', error.message);
    return [];
  }
}

function extractPlaceholders(filePath) {
  try {
    // Resolve the path to handle relative paths and special characters
    const resolvedPath = path.resolve(filePath);
    
    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      console.error(`File not found: ${resolvedPath}`);
      return [];
    }
    
    console.log(`Reading file: ${resolvedPath}`);
    
    // Check file extension to determine how to process it
    const ext = path.extname(resolvedPath).toLowerCase();
    
    if (ext === '.docx') {
      return extractPlaceholdersFromDocx(resolvedPath);
    } else if (ext === '.xml') {
      return extractPlaceholdersFromXmlFile(resolvedPath);
    } else {
      console.error(`Unsupported file type: ${ext}. Please use .docx or .xml files.`);
      return [];
    }
  } catch (error) {
    console.error('Error processing file:', error.message);
    return [];
  }
}

if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node extractPlaceholders.js path/to/template.docx or path/to/document.xml');
    process.exit(1);
  }
  const placeholders = extractPlaceholders(filePath);
  console.log('Placeholders found:', placeholders);
} 