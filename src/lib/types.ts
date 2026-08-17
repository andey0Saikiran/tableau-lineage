// Data model — mirrors the original backend `lineage/models.py` exactly so the
// generated report (and any CSV/JSON export) stays byte-for-byte compatible with
// what the Python service produced.

export type FieldType = 'calculated' | 'lod' | 'table_calc' | 'raw';
export type LodType = 'FIXED' | 'INCLUDE' | 'EXCLUDE' | null;

export interface CalculatedField {
  datasource: string;
  field_name: string;
  formula: string;
  ingredients: string[];
  parameter_dependencies: string[];
  field_type: FieldType;
  is_table_calc: boolean;
  lod_type: LodType;
}

export interface Parameter {
  name: string;
  internal_name: string;
  value: string;
  datatype: string;
  allowed_values: { value: string; alias?: string }[] | null;
}

/**
 * Every column declared in the workbook, whether or not any calculation
 * references it. The lineage extractor's `rawFields` only ever contained
 * columns mentioned inside a formula, so columns that exist but are used
 * nowhere were invisible — precisely the ones an unused-field audit must find.
 */
export interface WorkbookColumn {
  /** Caption when present, otherwise the de-bracketed internal name. */
  name: string;
  /** Raw bracketed internal name, e.g. `[Calculation_123]`. */
  internal_name: string;
  datasource: string;
  datatype: string;
  /** 'dimension' | 'measure' | '' when unstated. */
  role: string;
  hidden: boolean;
  is_calculated: boolean;
}

export interface LineageStats {
  datasources: number;
  calculated_fields: number;
  raw_fields: number;
  parameters: number;
  lod_fields: number;
  table_calcs: number;
  total_fields: number;
}

export interface WorksheetFilterRef {
  field: string;
  kind: string;
  is_context: boolean;
}

/** Per-worksheet usage: which fields a sheet uses and which filters it applies. */
export interface WorksheetUsage {
  name: string;
  fields: string[];
  filters: WorksheetFilterRef[];
}

export interface ExtractResult {
  fields: CalculatedField[];
  parameters: Parameter[];
  rawFields: string[];
  stats: LineageStats;
  /** Source workbook filename, without extension. */
  fileLabel: string;
  /** Every declared column, including ones no formula references. */
  allColumns: WorkbookColumn[];
  /** Optional worksheet integration (additive; populated by the app shell). */
  worksheets?: WorksheetUsage[];
}
