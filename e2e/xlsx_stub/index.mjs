export const utils = {
  book_new: () => ({ SheetNames: [], Sheets: {} }),
  aoa_to_sheet: (aoa) => ({ __aoa: aoa }),
  book_append_sheet: (wb, ws, name) => { wb.SheetNames.push(name); wb.Sheets[name] = ws; },
  encode_range: () => "A1:A1",
};
export let lastWrittenWorkbook = null;
export const writeFile = (wb) => { lastWrittenWorkbook = wb; };
