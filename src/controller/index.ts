import express from 'express';
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import DocxTemplate from 'docxtemplater';
import { exec } from 'child_process';
import { encryptionService } from '../utils/encryption';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

// Whitelist of allowed templates
const TEMPLATE_MAP: Record<string, string> = {
  '902.1e': '902.1e (Identification).docx',
  '902.4e': '902.4e (Risk Profile).docx', // Add your new template here
  '902.5e': '902.5e (Customer Profile).docx',
  '902.9e': '902.9e (Form-A).docx',
  '902.11e': '902.11e(Form-K).docx',
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

// Example mapping function for 902.1e (Identification)
function mapTo9021ePlaceholders(formState: any) {
  const today = new Date();
  const formattedDate = `${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getDate().toString().padStart(2, '0')}/${today.getFullYear()}`;
  return {
    '5': formattedDate,
    '6': formState.companyInfo?.name || '',
    '7': formState.companyInfo?.address || '',
    '8': formState.companyInfo?.phone || '',
    '9': formState.companyInfo?.email || '',
    '10': '  ',
    '11': ' ',
    '12': ' ',
    '12:1': formState.entityInfo?.registerFile == null ? 'false' : 'true',
    '13': formState.companyInfo?.name || '',
    '14': formState.companyInfo?.address || '',
    '15': ' ',
    '15:1': formState.entityInfo?.articlesFile == null ? 'false' : 'true',
    '16': formState.companyInfo?.name || '',
    '17': `${formState.companyInfo?.canton || ''} ${formState.companyInfo?.city || ''} ${formState.companyInfo?.address || ''} ${formState.companyInfo?.postal || ''}`,
    '18': ' ',
    '19': formState.companyInfo?.phone || '',
    '20': formState.companyInfo?.email || '',
    '21': ' ',
    '23': formState.establishingPersons?.[0]?.name || '',
    '24': formState.establishingPersons?.[0]?.address || '',
    '25': formState.establishingPersons?.[0]?.dob || '',
    '26': formState.establishingPersons?.[0]?.nationality || '',
    '27': formState.establishingPersons?.[0]?.toa || '',
    '28': formState.establishingPersons?.[0]?.iddoc == null ? 'false' : 'true',
    '29': ' ',
    '29:1': 'false',
    '29:2': 'false',
    '29:3': formState.establishingPersons?.[0]?.poa == null ? 'false' : 'true',
    '31': ' ',
    '31:1': 'false',
    '31:2': 'true',
    '31:3': 'false',
    '31:4': 'false',
    '32': ' ',
    '32:1': 'false',
    '32:2': 'false',
    '32:3': 'false',
    '32:4': 'true',
    '34': 'No information',
    '35:5': 'false',
    '35:1': 'true',
    '35:2': 'false',
    '35:3': 'false',
    '35:4': 'false',
    '36': 'false',
    '39': formState.transactionInfo?.businessPurposes?.[0] || '',
  };
}

// Example mapping function for 902.4e (Risk Profile)
function mapTo9024ePlaceholders(formState: any) {
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0];

  // Helper function to determine risk level based on country
  const getCountryRiskLevel = (country: string): number => {
    const highRiskCountries = formState.sanctionsInfo?.sanctionedCountries || [];
    return highRiskCountries.includes(country) ? 2 : 0;
  };

  // Determine industry risk level
  let industryRisk = 0;
  const industry = formState.companyInfo?.industry || '';
  if (['casino', 'arms_dealer', 'precious_metals'].includes(industry)) {
    industryRisk = 2;
  } else if (['financial_services', 'real_estate'].includes(industry)) {
    industryRisk = 1;
  }

  // Determine product risk level
  let productRisk = 0;
  const purposes = formState.transactionInfo?.businessPurposes || [];
  if (purposes.includes('international_trade') || purposes.includes('cryptocurrency')) {
    productRisk = 2;
  } else if (purposes.includes('high_value_transactions')) {
    productRisk = 1;
  }

  // Determine payment volume risk
  let paymentVolumeRisk = 0;
  const monthlyVolume = formState.transactionInfo?.monthlyVolume || 0;
  if (monthlyVolume > 100000) {
    paymentVolumeRisk = 2;
  } else if (monthlyVolume > 10000) {
    paymentVolumeRisk = 1;
  }

  // Determine smurfing risk
  let smurfingRisk = 0;
  if (monthlyVolume > 50000) {
    smurfingRisk = 2;
  } else if (monthlyVolume > 2000) {
    smurfingRisk = 1;
  }


  let contactRisk = 0;
  if (formState.clientType === 'swiss_assoc' && formState.establishingPersons?.length > 0) {
    contactRisk = 0;
  } else if (formState.clientType === 'foreign_entity') {
    contactRisk = 2;
  } else {
    contactRisk = 1;
  }

  const isHighRisk = formState.sanctionsInfo?.isPep ||
    formState.sanctionsInfo?.sanctionedCountries?.length > 0 ||
    industryRisk === 2 ||
    productRisk === 2 ||
    (industryRisk === 1 && productRisk === 1);

  return {
    'VQF_Member_No': '100809',
    'AMLA_File_No': '',
    'Completed_By': formState.establishingPersons?.[0]?.name || 'Automated System',
    '5': formattedDate,

    '6': formState.sanctionsInfo?.isPep ? 'Yes' : 'No',
    '7': formState.sanctionsInfo?.pepType === 'domestic' ? 'Yes' : 'No',
    '9': 'n.a. - not needed',
    '10': formState.sanctionsInfo?.sanctionedCountries?.length > 0 ? 'Yes' : 'No',
    '11': 'n.a. - not needed, the customer is here in Switzerland',

    // Country Risk
    '12': getCountryRiskLevel(formState.companyInfo?.canton || ''),
    '13': getCountryRiskLevel(formState.establishingPersons?.[0]?.country || ''),
    '14': getCountryRiskLevel(formState.businessActivity?.mainCountries?.[0] || ''),
    '15': getCountryRiskLevel(formState.transactionInfo?.assetOriginCountry || ''),

    // Other Risk Categories
    '16': industryRisk,
    '17': contactRisk,
    '18': productRisk,
    '19': paymentVolumeRisk,
    '20': smurfingRisk,

    '21': isHighRisk ?
      'Business relationship with increased risk' :
      'Business relationship without increased risk',
    '22': isHighRisk ?
      'Automated assessment identified one or more high-risk factors' :
      'No significant risk factors identified',

    '23': 'CHF 100,000',
    '24': 'CHF 5,000',
    '25': formState.sanctionsInfo?.sanctionedCountries?.length > 0 ? 'Yes' : 'No',
    '26': 'Defined in SOP-003 Continuous Client and Transaction Monitoring',

    '27:1': formState.sanctionsInfo?.isPep,
    '27:2': !formState.sanctionsInfo?.isPep,
    '28:1': formState.sanctionsInfo?.pepType === 'domestic',
    '28:2': formState.sanctionsInfo?.pepType !== 'domestic',
    '29:1': formState.sanctionsInfo?.sanctionedCountries?.length > 0,
    '29:2': formState.sanctionsInfo?.sanctionedCountries?.length === 0,
    '30:1': isHighRisk,
    '31:2': !isHighRisk
  };
}

function mapTo9025ePlaceholders(formState: any) {
  const today = new Date();
  const formattedDate = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
  return {
    '2': formState.businessActivity?.businessDescription || '',
    '3': formState.businessActivity?.targetClients || '',
    '4': (formState.businessActivity?.mainCountries || []).join(', '),
    '5': formState.controllingInfo.managingDirector?.lastName + " " + formState.controllingInfo.managingDirector?.firstName || '',
    '6': formattedDate || '',
    '7': formState.businessActivity?.professionActivity || '' + formState.businessActivity?.businessDescription || '' + formState.businessActivity?.targetClients || '' + formState.businessActivity?.mailOptions || '',
    '8': formState.financialInfo?.annualRevenue || '' + formState.financialInfo?.totalAssets || '',
    '9': formState.transactionInfo?.assetOrigin || '',
    '10': formState.transactionInfo?.assetCategory || '',
    '11': formState.transactionInfo?.monthlyVolume?.toString() || '',
    '12': (formState.transactionInfo?.businessPurposes || []).join(', '),
  };
}

function mapTo9029ePlaceholders(formState: any) {
  const today = new Date();
  const formattedDate = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;

  const beneficialOwners = formState.beneficialInfo?.beneficialOwners || [];
  const isSoleOwner = formState.beneficialInfo?.isSoleOwner || false;

  const defaultOwner = {
    lastName: '',
    firstName: '',
    dob: '',
    nationality: '',
    address: '',
    postal: '',
    city: '',
    country: ''
  };
  const owner = beneficialOwners[0] || defaultOwner;

  if (isSoleOwner && beneficialOwners.length === 0 && formState.establishingPersons?.length > 0) {
    const establishingPerson = formState.establishingPersons[0];
    owner.lastName = establishingPerson.name?.split(' ')[0] || '';
    owner.firstName = establishingPerson.name?.split(' ').slice(1).join(' ') || '';
    owner.dob = establishingPerson.dob || '';
    owner.nationality = establishingPerson.nationality || '';
    owner.address = [
      establishingPerson.address,
      establishingPerson.postal,
      establishingPerson.city,
      establishingPerson.country
    ].filter(Boolean).join(', ');
  }

  return {
    // Header
    'VQF_Member_No': '100809',
    'AMLA_File_No': '',
    '9': owner.lastName || 'Not provided',
    '10': owner.firstName || 'Not provided',

    '11': owner.dob ? formatDate(owner.dob) : 'Not provided',

    '12': owner.nationality,
    '13': owner.address,
    'Date': formattedDate
  };
}
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? dateString :
      `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
  } catch {
    return dateString;
  }
}
function mapTo90211ePlaceholders(formState: any) {
  const today = new Date();
  const formattedDate = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;

  const defaultPerson = {
    lastName: '',
    firstName: '',
    address: '',
    postal: '',
    city: '',
    country: ''
  };

  let controllingPerson = defaultPerson;
  if (formState.controllingInfo?.controllingPersons?.length > 0) {
    controllingPerson = formState.controllingInfo.controllingPersons[0];
  } else if (formState.controllingInfo?.managingDirector) {
    controllingPerson = formState.controllingInfo.managingDirector;
  }


  return {
    '26': controllingPerson.lastName,
    '27:': controllingPerson.firstName,
    '28:': controllingPerson.address || '',

    '29': !formState.beneficialInfo?.hasThirdPartyOwner,
    '30': formState.beneficialInfo?.hasThirdPartyOwner,
    '20': formattedDate,
    '': ''
  };
}

function generateReferenceNumber() {
  const now = Date.now();
  const random = crypto.randomBytes(3).toString('hex');
  return `CENTI-${now}-${random}`;
}

export const submitForm = async (req: express.Request, res: express.Response): Promise<void> => {

  try {
    const submissionTimestamp = getServerTimestamp();
    const referenceNumber = generateReferenceNumber();
    const filesArray = Array.isArray(req.files) ? req.files : [];
    const fileUploadTimestamps = filesArray.map((file: Express.Multer.File) => ({
      originalname: file.originalname,
      uploadTimestamp: getServerTimestamp(),
    }));
    if (fileUploadTimestamps.length > 0) {
      console.log('File upload timestamps:', fileUploadTimestamps);
    }

    const safeTimestamp = submissionTimestamp.replace(/[:.]/g, '-');

    const templateId = req.body.template || req.query.template || '902.1e'
    let templatePath;
    try {
      templatePath = getTemplatePath(templateId);
    } catch (err) {
      res.status(400).json({ error: 'Invalid template identifier' });
      return;
    }

    const formState = req.body.formState ? req.body.formState : req.body;
    let renderData: Record<string, any> = {};
    if (templateId === '902.1e') {
      renderData = mapTo9021ePlaceholders(formState);
    } else if (templateId === '902.4e') {
      renderData = mapTo9024ePlaceholders(formState);
    } else if (templateId === '902.5e') {
      renderData = mapTo9025ePlaceholders(formState);
    } else if (templateId === '902.9e') {
      renderData = mapTo9029ePlaceholders(formState);
    } else if (templateId === '902.11e') {
      renderData = mapTo90211ePlaceholders(formState);
    } else {
      renderData = { ...formState };
    }

    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    const doc = new DocxTemplate(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' }
    });
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
        res.status(500).json({ error: 'Failed to convert to PDF', submissionTimestamp, fileUploadTimestamps, referenceNumber });
        return;
      }
      console.log(`PDF created at: ${pdfPath}`);
      try {
        // Encrypt the generated PDF file
        const encryptedPdfPath = await encryptionService.encryptFile(pdfPath);
        // Bundle all PDFs, JSON data, and uploads for email package
        const attachments = [
          { filename: path.basename(outputDocx), path: outputDocx },
          { filename: path.basename(pdfPath), path: pdfPath },
          { filename: path.basename(encryptedPdfPath), path: encryptedPdfPath },
          {
            filename: `form-data-${referenceNumber}.json`,
            content: Buffer.from(JSON.stringify(formState, null, 2)),
            contentType: 'application/json',
          },
          // Add uploaded files
          ...filesArray.map((file: Express.Multer.File) => ({
            filename: file.originalname,
            path: file.path
          }))
        ];
        // Send email with attachments
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '465', 10),
          secure: true,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
        const mailOptions = {
          from: 'no-reply@centi.ch',
          to: 'compliance@centi.ch',
          subject: `Centi Onboarding Submission [${referenceNumber}]`,
          text: `Submission Reference: ${referenceNumber}\nTimestamp: ${submissionTimestamp}\n\nSee attached PDFs, JSON, and uploads.`,
          attachments,
        };
        await transporter.sendMail(mailOptions);
        // After successful send, delete all files
        for (const att of attachments) {
          if (att.path) {
            fs.unlink(att.path, (err) => {
              if (err) console.error('Failed to delete file:', att.path, err);
            });
          }
        }
        res.status(200).json({ message: 'success', referenceNumber });
      } catch (emailError) {
        console.error('Error sending email or cleaning up:', emailError);
        res.status(500).json({ error: 'Failed to send email or cleanup', submissionTimestamp, fileUploadTimestamps, referenceNumber });
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