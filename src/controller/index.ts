import express from 'express';
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import DocxTemplate from 'docxtemplater';
import { exec } from 'child_process';
import { encryptionService } from '../utils/encryption';

// Whitelist of allowed templates
const TEMPLATE_MAP: Record<string, string> = {
  '902.1e': '902.1e (Identification).docx',
  '902.4e': '902.4e (Risk Profile).docx', // Add your new template here
};

function getTemplatePath(templateId: string): string {
  const filename = TEMPLATE_MAP[templateId];
  if (!filename) throw new Error('Invalid template identifier');
  return path.join(__dirname, '../templates', filename);
}

// Utility to get current server-side timestamp in ISO format
function getServerTimestamp(): string {
  return new Date().toISOString();
}

export const submitForm = async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const submissionTimestamp = getServerTimestamp();
    // Sanitize timestamp for filenames (replace ':' and '.' with '-')
    const safeTimestamp = submissionTimestamp.replace(/[:.]/g, '-');
    // Accept template identifier from request (body or query)
    const templateId = req.body.template || req.query.template || '902.1e'; // default fallback
    let templatePath;
    try {
      templatePath = getTemplatePath(templateId);
    } catch (err) {
      res.status(400).json({ error: 'Invalid template identifier' });
      return;
    }

    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    const doc = new DocxTemplate(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' }
    });
    // Remove template from data before rendering
    const renderData = { ...req.body };
    delete renderData.template;
    doc.render(renderData);
    const xmlFile = zip.file('word/document.xml');
    if (!xmlFile) {
      res.status(500).json({ error: 'XML file not found' });
      return;
    }
    let xmlContent = xmlFile.asText();
    const rowRegex = /<w:tr[\s\S]*?<\/w:tr>/g;
    const rows = xmlContent.match(rowRegex) || [];
    const updatedRows = rows.map((row, index) => {
      const cellRegex = /<w:tc[\s\S]*?<\/w:tc>/g;
      const cells = row.match(cellRegex) || [];
      if (cells.length >= 2) {
        const label = cells[0]?.replace(/<[^>]+>/g, '').trim();
        if (label !== '') {
          const checkboxRegex = /(<w:checkBox[^>]*>[\s\S]*?<\/w:checkBox>)([\s\S]*?<w:t>(.*?)<\/w:t>)/g;
          let cellContent = cells[1], match;
          let count = 1;
          while ((match = checkboxRegex.exec(cellContent)) !== null) {
            const shouldBeChecked: boolean = renderData[`${index}:${count}`] === 'true' ? true : false;
            const newCheckboxTag = !shouldBeChecked
              ? '<w:checkBox><w:checked/><w:default/><w:sizeAuto/></w:checkBox>'
              : '<w:checkBox><w:default/><w:sizeAuto/></w:checkBox>';
            cellContent = cellContent.replace(match[1], newCheckboxTag);
            count++;
          }
          if (cellContent !== cells[1]) {
            return row.replace(cells[1], cellContent);
          }
        }
        for (const key of Object.keys(renderData)) {
          if (index === Number(key)) {
            const updatedCell = cells[1].replace(/<w:t>.*?<\/w:t>/, `<w:t>${renderData[key]}</w:t>`);
            return row.replace(cells[1], updatedCell);
          }
        }
      }
      return row;
    });
    rows.forEach((row, index) => {
      xmlContent = xmlContent.replace(row, updatedRows[index]);
    });
    zip.file('word/document.xml', xmlContent);
    const updatedOutput = zip.generate({ type: 'nodebuffer' });
    // Output file names are based on template
    const outputDocx = path.join(__dirname, `../templates/GeneratedForm_${templateId}_${safeTimestamp}.docx`);
    fs.writeFileSync(outputDocx, updatedOutput);
    const pdfPath = path.join(__dirname, `../templates/GeneratedForm_${templateId}_${safeTimestamp}.pdf`);
    exec(`soffice --headless --convert-to pdf --outdir "${path.dirname(pdfPath)}" "${outputDocx}"`, async (err) => {
      if (err) {
        console.error('Error converting to PDF:', err);
        res.status(500).json({ error: 'Failed to convert to PDF', submissionTimestamp });
        return;
      }
      console.log(`PDF created at: ${pdfPath}`);
      try {
        // Encrypt the generated PDF file
        const encryptedPdfPath = await encryptionService.encryptFile(pdfPath);
        // Log the timestamp and file path
        console.log(`Form submitted at: ${submissionTimestamp}, Encrypted PDF: ${encryptedPdfPath}`);
        res.status(200).json({ message: 'success', pdfPath: encryptedPdfPath, submissionTimestamp });
      } catch (encryptionError) {
        console.error('Error encrypting PDF:', encryptionError);
        res.status(500).json({ error: 'Failed to encrypt PDF', submissionTimestamp });
      }
      return;
    });
    return;
  } catch (error) {
    const submissionTimestamp = getServerTimestamp();
    console.error('Error submitting form:', error);
    res.status(500).json({ error: 'Failed to submit form', submissionTimestamp });
    return;
  }
}
