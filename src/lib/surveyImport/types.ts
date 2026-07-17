export type SurveyFileFormat = "raw" | "gerencia-report" | "unknown";

export interface AreaParticipation {
  area: string;
  respondents: number;
  invited: number;
  participationRate: number;
}

export interface SectionFavorability {
  section: string;
  positivePct: number;
}

/** Overall perception split for the key indicator: negative / neutral / positive %. */
export interface FavorabilityBreakdown {
  desfavorable: number;
  neutral: number;
  favorable: number;
}

/** eNPS respondent split, as percentages. */
export interface NpsBreakdown {
  detractores: number;
  neutrales: number;
  promotores: number;
}

/** A survey section (dimension) together with how many questions it holds. */
export interface SectionDetail {
  name: string;
  questionCount: number;
}

/** A detected question and the section (dimension) it belongs to, when known. */
export interface QuestionDetail {
  text: string;
  section: string | null;
}

export interface ParsedSurveyFile {
  fileName: string;
  format: SurveyFileFormat;
  /** True for the consolidated/company-wide report (e.g. "QUILLAYES SURLAT (total)") */
  isConsolidatedTotal: boolean;
  /** Best-guess survey name, e.g. "Encuesta de Clima" */
  surveyName: string | null;
  /** Year extracted from filename or in-file metadata */
  surveyYear: number | null;
  /** Respondents who completed the survey (Finalizadas / answers row count) */
  respondents: number | null;
  /** People invited/eligible (Total / colaboradores row count) */
  invited: number | null;
  /** Dimension/section names detected (e.g. "Liderazgo", "Seguridad") */
  sections: string[];
  /** Question texts detected */
  questions: string[];
  /** Demographic category names detected (e.g. "Rango edad", "Sede") */
  demographics: string[];
  /** Overall % positive perception for the main "Clima"/key indicator, when available */
  favorabilityPositivePct: number | null;
  /** True eNPS (promoters% - detractors%) computed from raw 0-10 scores */
  enps: number | null;
  /** % positive perception of the recommendation question — only used when `enps` is null */
  enpsApproxPositivePct: number | null;
  /** Report generation date found in-sheet (e.g. "Fecha: 26-MAR-2026"), when available */
  reportDate: Date | null;
  /** Per-area/department participation, when this file's report breaks it down (e.g. "Comercial", "Dependencias comercial") */
  areaBreakdown: AreaParticipation[];
  /** Per-dimension % positive perception (e.g. "Seguridad": 82.9), when available */
  sectionFavorability: SectionFavorability[];
  /** Negative/neutral/positive split for the key "Clima" indicator, when available */
  favorabilityBreakdown: FavorabilityBreakdown | null;
  /** Detractores/neutrales/promotores split for eNPS, when available */
  npsBreakdown: NpsBreakdown | null;
  /** Each detected section with its question count */
  sectionDetails: SectionDetail[];
  /** Each detected question with the section it belongs to, when known */
  questionDetails: QuestionDetail[];
}

export interface DetectedSurveyAnalysis {
  participationRate: number | null;
  totalRespondents: number | null;
  totalInvited: number | null;
  enps: number | null;
  /** Whether `enps` is a real eNPS score or an approximation from bucketed percentages */
  enpsIsApproximate: boolean;
  favorability: number | null;
  demographics: string[];
  questionsCount: number;
  /** Full question text, not just the count */
  questions: string[];
  sections: string[];
  /** Real per-area/department participation breakdown, one entry per department file */
  areaBreakdown: AreaParticipation[];
  /** Real per-dimension favorability, weighted across departments when combined */
  sectionFavorability: SectionFavorability[];
  /** Negative/neutral/positive split for the key "Clima" indicator, when available */
  favorabilityBreakdown: FavorabilityBreakdown | null;
  /** Detractores/neutrales/promotores split for eNPS, when available */
  npsBreakdown: NpsBreakdown | null;
  /** Each detected section with how many questions it holds */
  sectionDetails: SectionDetail[];
  /** Each detected question with the section it belongs to, for filtering */
  questionDetails: QuestionDetail[];
}

export interface SurveyImportWarning {
  fileName: string;
  reason: string;
}

/** One distinct survey wave detected in the uploaded batch (e.g. "2025" vs "2024"). */
export interface DetectedSurveyGroup {
  /** Grouping key, currently the survey year (or "unknown-year") */
  groupKey: string;
  suggestedSurveyName: string;
  surveyYear: number | null;
  /** Best-effort start/end date suggestion — always a guess, meant to be reviewed and adjusted */
  suggestedStartDate: Date | null;
  suggestedEndDate: Date | null;
  fileNames: string[];
  analysis: DetectedSurveyAnalysis;
}

export interface SurveyImportResult {
  /** One entry per distinct survey wave detected — never merged across years/waves */
  groups: DetectedSurveyGroup[];
  /** Files whose format could not be recognized at all */
  unrecognizedFiles: SurveyImportWarning[];
}
