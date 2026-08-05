// SQL extraction from Tableau workbooks: Custom SQL relations, Initial SQL
// (run at connection open), stored-procedure references, and RAWSQL_* calcs.
//
// Honest scope note: a workbook only STORES SQL the author wrote. The queries
// Tableau generates at runtime for live connections are not in the file.

import { unzipSync } from 'fflate';
import { TableauExtractionError } from './extractor';

export interface SqlConnection {
  class: string;
  server: string | null;
  dbname: string | null;
}

export interface CustomSqlQuery {
  datasource: string;
  relation_name: string;
  connection: SqlConnection | null;
  sql: string;
}

export interface InitialSql {
  datasource: string;
  connection: SqlConnection;
  sql: string;
}

export interface StoredProcRef {
  datasource: string;
  name: string;
  connection: SqlConnection | null;
  parameters: { name: string; value: string }[];
}

export interface RawSqlField {
  datasource: string;
  field_name: string;
  formula: string;
}

export interface SqlExtractResult {
  custom_sql: CustomSqlQuery[];
  initial_sql: InitialSql[];
  stored_procedures: StoredProcRef[];
  rawsql_calculations: RawSqlField[];
  has_sql: boolean;
  fileLabel: string;
}

const RAWSQL_RE = /\bRAWSQL\w*\s*\(/i;

function connInfo(el: Element): SqlConnection {
  return {
    class: el.getAttribute('class') ?? 'unknown',
    server: el.getAttribute('server') || null,
    dbname: el.getAttribute('dbname') || null,
  };
}

function stripBrackets(name: string): string {
  return name.replace(/^\[|\]$/g, '');
}

/** Top-level <datasource> elements only (skips nested/federated inner ones). */
function topLevelDatasources(root: Element): Element[] {
  const all = Array.from(root.getElementsByTagName('datasource'));
  return all.filter((ds) => {
    const parent = ds.parentNode as Element | null;
    return parent != null && parent.nodeName === 'datasources';
  });
}

export function extractSqlFromXml(
  xmlString: string,
  fileLabel = 'Tableau Workbook',
): SqlExtractResult {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new TableauExtractionError('Could not parse the workbook XML (.twb).');
  }
  const root = doc.documentElement;
  if (!root) throw new TableauExtractionError('Empty or invalid workbook XML.');

  const result: SqlExtractResult = {
    custom_sql: [],
    initial_sql: [],
    stored_procedures: [],
    rawsql_calculations: [],
    has_sql: false,
    fileLabel,
  };

  for (const ds of topLevelDatasources(root)) {
    const dsLabel = ds.getAttribute('caption') || ds.getAttribute('name') || 'Unknown datasource';

    // Map named-connection name -> its physical connection element, so relations
    // (which reference the named connection) can report where their SQL runs.
    const connByName = new Map<string, SqlConnection>();
    for (const nc of Array.from(ds.getElementsByTagName('named-connection'))) {
      const name = nc.getAttribute('name');
      const inner = nc.getElementsByTagName('connection')[0];
      if (name && inner) connByName.set(name, connInfo(inner));
    }

    // Initial SQL lives as an attribute on the physical connection element.
    // Tableau has used both `one-time-sql` and `initial-sql` across versions.
    for (const conn of Array.from(ds.getElementsByTagName('connection'))) {
      const sql = conn.getAttribute('one-time-sql') || conn.getAttribute('initial-sql');
      if (sql && sql.trim()) {
        result.initial_sql.push({ datasource: dsLabel, connection: connInfo(conn), sql: sql.trim() });
      }
    }

    for (const rel of Array.from(ds.getElementsByTagName('relation'))) {
      const type = rel.getAttribute('type');
      const connection = connByName.get(rel.getAttribute('connection') ?? '') ?? null;

      // Custom SQL: <relation type='text'> whose text content IS the query.
      if (type === 'text') {
        const sql = (rel.textContent ?? '').trim();
        if (sql) {
          result.custom_sql.push({
            datasource: dsLabel,
            relation_name: rel.getAttribute('name') || 'Custom SQL Query',
            connection,
            sql,
          });
        }
      }

      if (type === 'stored-proc') {
        const parameters: { name: string; value: string }[] = [];
        for (const p of Array.from(rel.getElementsByTagName('column'))) {
          parameters.push({
            name: p.getAttribute('name') ?? '',
            value: p.getAttribute('value') ?? '',
          });
        }
        result.stored_procedures.push({
          datasource: dsLabel,
          name: rel.getAttribute('name') || 'Stored procedure',
          connection,
          parameters,
        });
      }
    }

    // RAWSQL_* / RAWSQLAGG_* calculated fields pass SQL fragments through to the
    // database — they count as SQL the workbook runs.
    for (const col of Array.from(ds.getElementsByTagName('column'))) {
      const calc = col.getElementsByTagName('calculation')[0];
      const formula = calc?.getAttribute('formula');
      if (formula && RAWSQL_RE.test(formula)) {
        result.rawsql_calculations.push({
          datasource: dsLabel,
          field_name: stripBrackets(col.getAttribute('caption') || col.getAttribute('name') || ''),
          formula,
        });
      }
    }
  }

  result.has_sql =
    result.custom_sql.length > 0 ||
    result.initial_sql.length > 0 ||
    result.stored_procedures.length > 0 ||
    result.rawsql_calculations.length > 0;
  return result;
}

const MAX_TWB_BYTES = 250 * 1024 * 1024; // guardrail on the decompressed .twb XML only

export function extractSqlFromTwbx(buffer: ArrayBuffer, filename = 'workbook.twbx'): SqlExtractResult {
  const bytes = new Uint8Array(buffer);
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, { filter: (file) => file.name.toLowerCase().endsWith('.twb') });
  } catch {
    throw new TableauExtractionError('This file is not a valid .twbx archive.');
  }
  const twbName = Object.keys(entries)[0];
  if (!twbName) throw new TableauExtractionError('No .twb workbook was found inside the .twbx archive.');
  const twbBytes = entries[twbName];
  if (twbBytes.length > MAX_TWB_BYTES) {
    throw new TableauExtractionError('This workbook is unusually large to parse. Try a smaller .twbx.');
  }
  const xml = new TextDecoder('utf-8').decode(twbBytes);
  return extractSqlFromXml(xml, filename.replace(/\.twbx$/i, ''));
}
