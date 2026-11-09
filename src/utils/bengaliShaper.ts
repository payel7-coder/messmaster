/**
 * Bengali (Bangla) Text Shaper for PDF Generation.
 * 
 * Reorders Unicode Bengali pre-base vowel signs (ি, ে, ৈ) and split vowels (ো, ৌ)
 * into their correct visual sequence for sequential PDF text rendering engines (like jsPDF),
 * ensuring that letters, matras, and vowels display in their proper positions.
 */

const BENGALI_CLUSTER_REGEX = "([\\u0985-\\u09B9\\u09CE\\u09DC-\\u09DF](?:\\u09CD[\\u0985-\\u09B9\\u09DC-\\u09DF])*)";

export function shapeBengaliText(input: any): any {
  if (typeof input !== 'string') {
    if (Array.isArray(input)) {
      return input.map(shapeBengaliText);
    }
    return input;
  }

  if (!input || !/[\u0980-\u09FF]/.test(input)) {
    return input;
  }

  let s = input;

  // 1. Decompose O-kar (ো \u09CB) -> e-kar (ে \u09C7) + aa-kar (া \u09BE)
  s = s.replace(new RegExp(BENGALI_CLUSTER_REGEX + "\\u09CB", "g"), "\\u09C7$1\\u09BE");

  // 2. Decompose Ou-kar (ৌ \u09CC) -> e-kar (ে \u09C7) + ou-length mark (ৗ \u09D7)
  s = s.replace(new RegExp(BENGALI_CLUSTER_REGEX + "\\u09CC", "g"), "\\u09C7$1\\u09D7");

  // 3. Move pre-base vowel signs (ি \u09BF, ে \u09C7, ৈ \u09C8) before the consonant cluster
  s = s.replace(new RegExp(BENGALI_CLUSTER_REGEX + "([\\u09BF\\u09C7\\u09C8])", "g"), "$2$1");

  return s;
}

export function shapeBengaliRow(row: (string | number)[]): (string | number)[] {
  return row.map(cell => (typeof cell === 'string' ? shapeBengaliText(cell) : cell));
}

export function shapeBengaliTableData(data: (string | number)[][]): (string | number)[][] {
  return data.map(shapeBengaliRow);
}
