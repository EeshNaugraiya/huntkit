import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';
// Vite copies the worker to dist and returns its URL — required for Chrome extension CSP compliance
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function extractTextFromFile(file) {
  console.log(`File selected: ${file.name}`);
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'docx') return extractFromDocx(file);
  if (ext === 'pdf') return extractFromPdf(file);
  throw new Error(`Unsupported file type: .${ext}. Use .pdf or .docx`);
}

async function extractFromDocx(file) {
  console.log('Extraction started (DOCX)');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value.trim();
  console.log(`Extraction complete: ${text.slice(0, 100)}`);
  return text;
}

async function extractFromPdf(file) {
  console.log('Extraction started (PDF)');
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(' '));
  }
  const text = pages.join('\n').trim();
  console.log(`Extraction complete: ${text.slice(0, 100)}`);
  return text;
}
