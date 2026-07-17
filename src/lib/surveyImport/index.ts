export * from "./types";
export { parseSurveyFile } from "./parseFile";
export { aggregateParsedFiles } from "./aggregate";
export { inferDateRangeFromName } from "./inferDates";

import type { SurveyImportResult } from "./types";
import { parseSurveyFile } from "./parseFile";
import { aggregateParsedFiles } from "./aggregate";

export async function parseSurveyFiles(files: File[]): Promise<SurveyImportResult> {
  const parsed = await Promise.all(files.map((file) => parseSurveyFile(file)));
  return aggregateParsedFiles(parsed);
}
