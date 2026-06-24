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

export interface LineageStats {
  datasources: number;
  calculated_fields: number;
  raw_fields: number;
  parameters: number;
  lod_fields: number;
  table_calcs: number;
  total_fields: number;
}

export interface ExtractResult {
  fields: CalculatedField[];
  parameters: Parameter[];
  rawFields: string[];
  stats: LineageStats;
  /** Source workbook filename, without extension. */
  fileLabel: string;
}
