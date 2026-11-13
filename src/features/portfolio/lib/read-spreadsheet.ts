// src/features/portfolio/lib/read-spreadsheet.ts

export interface SheetRows {
  name: string;
  rows: unknown[][];
}

/** Text files exported on Windows are often Latin-1, which breaks accents and the peso sign. */
function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

function splitRecord(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

/** Reads delimited text (comma, semicolon or tab), keeping every value as written. */
export function parseDelimitedText(text: string): unknown[][] {
  const lines = text.split(/\r?\n/);
  const sample = lines.filter((line) => line.trim()).slice(0, 20);
  const delimiter = [';', '\t', ','].map((candidate) => ({
    candidate,
    // The delimiter that gives the most consistent number of columns wins.
    columns: sample.reduce((total, line) => total + Math.min(splitRecord(line, candidate).length, 30), 0),
  })).sort((left, right) => right.columns - left.columns)[0].candidate;
  return lines.map((line) => splitRecord(line, delimiter));
}

/**
 * Reads CSV, TXT, XLSX and XLS (including the HTML tables some brokers save as .xls). Excel files
 * keep numbers as numbers, so their decimals never depend on the computer's language settings.
 */
export async function readSpreadsheet(file: File): Promise<SheetRows[]> {
  const buffer = await file.arrayBuffer();
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (extension === 'csv' || extension === 'txt') {
    return [{ name: file.name, rows: parseDelimitedText(decodeText(buffer)) }];
  }
  // Loaded only when someone imports a spreadsheet: the library is large.
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  return workbook.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, raw: true, defval: '', blankrows: true }),
  }));
}
