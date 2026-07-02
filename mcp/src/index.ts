#!/usr/bin/env node
// MCP server for Tableau workbook lineage. Wraps the same extractor that powers
// tableau-lineage.com, reading .twbx/.twb files from the local disk — the
// workbook is parsed in-process and never leaves the machine.

import fs from 'node:fs';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { DOMParser } from '@xmldom/xmldom';

// The extractor calls `new DOMParser()` at runtime — provide one for Node.
(globalThis as unknown as { DOMParser: unknown }).DOMParser = DOMParser;

import { extractFromTwbx, extractFromXml, TableauExtractionError } from '../../src/lib/extractor';
import type { CalculatedField, ExtractResult } from '../../src/lib/types';

const VERSION = '0.1.0';

// ── Workbook loading (cached by path + mtime + size) ──────────────────────────

const cache = new Map<string, { mtimeMs: number; size: number; result: ExtractResult }>();

function loadWorkbook(inputPath: string): ExtractResult {
  const abs = path.resolve(inputPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`File not found: ${abs}`);
  }
  const st = fs.statSync(abs);
  const hit = cache.get(abs);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit.result;

  const lower = abs.toLowerCase();
  let result: ExtractResult;
  if (lower.endsWith('.twb')) {
    result = extractFromXml(fs.readFileSync(abs, 'utf8'), path.basename(abs).replace(/\.twb$/i, ''));
  } else if (lower.endsWith('.twbx')) {
    const buf = fs.readFileSync(abs);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    result = extractFromTwbx(ab, path.basename(abs));
  } else {
    throw new Error(`Unsupported file type (expected .twbx or .twb): ${abs}`);
  }
  cache.set(abs, { mtimeMs: st.mtimeMs, size: st.size, result });
  return result;
}

// ── Field lookup helpers ───────────────────────────────────────────────────────

/** "[Profit Ratio]" / "profit ratio" → canonical comparable form. */
function norm(name: string): string {
  return name.trim().replace(/^\[|\]$/g, '').toLowerCase();
}

function findFields(r: ExtractResult, name: string): CalculatedField[] {
  const n = norm(name);
  return r.fields.filter((f) => norm(f.field_name) === n);
}

function isRawField(r: ExtractResult, name: string): boolean {
  const n = norm(name);
  return r.rawFields.some((f) => norm(f) === n);
}

function isParameter(r: ExtractResult, name: string): boolean {
  const n = norm(name);
  return r.parameters.some((p) => norm(p.name) === n);
}

interface TraceNode {
  field: string;
  kind: 'calculated' | 'lod' | 'table_calc' | 'raw' | 'parameter' | 'unknown';
  depends_on?: TraceNode[];
}

function traceUpstream(r: ExtractResult, name: string, seen: Set<string>, depth: number): TraceNode {
  const key = norm(name);
  const matches = findFields(r, name);
  const kind: TraceNode['kind'] = matches.length
    ? matches[0].field_type
    : isParameter(r, name)
      ? 'parameter'
      : isRawField(r, name)
        ? 'raw'
        : 'unknown';
  const node: TraceNode = { field: matches[0]?.field_name ?? name.replace(/^\[|\]$/g, ''), kind };
  if (!matches.length || depth <= 0 || seen.has(key)) return node;
  seen.add(key);
  const deps: TraceNode[] = [];
  for (const m of matches) {
    for (const ing of m.ingredients) deps.push(traceUpstream(r, ing, seen, depth - 1));
    for (const p of m.parameter_dependencies) deps.push({ field: p, kind: 'parameter' });
  }
  if (deps.length) node.depends_on = deps;
  return node;
}

/** Every calculated field whose ingredients or parameter deps include `name`. */
function directDependents(r: ExtractResult, name: string): CalculatedField[] {
  const n = norm(name);
  return r.fields.filter(
    (f) =>
      f.ingredients.some((i) => norm(i) === n) ||
      f.parameter_dependencies.some((p) => norm(p) === n),
  );
}

function traceDownstream(r: ExtractResult, name: string, seen: Set<string>): string[] {
  const out: string[] = [];
  const queue = [name];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const dep of directDependents(r, cur)) {
      const key = norm(dep.field_name);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(dep.field_name);
      queue.push(dep.field_name);
    }
  }
  return out;
}

// ── Tool plumbing ──────────────────────────────────────────────────────────────

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(err: unknown) {
  const msg =
    err instanceof TableauExtractionError
      ? `Not a readable Tableau workbook: ${err.message}`
      : err instanceof Error
        ? err.message
        : String(err);
  return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true as const };
}

const pathArg = z
  .string()
  .describe('Absolute (or cwd-relative) path to a local Tableau workbook: .twbx or .twb');

const server = new McpServer({ name: 'tableau-lineage', version: VERSION });

server.registerTool(
  'analyze_workbook',
  {
    title: 'Analyze a Tableau workbook',
    description:
      'Parse a local Tableau workbook (.twbx or .twb) and return an overview: field counts, datasources, calculated-field names by type, parameter names, and raw fields. Parsing happens locally; the file is never uploaded. Start here, then use the other tools for details.',
    inputSchema: { path: pathArg },
  },
  async ({ path: p }) => {
    try {
      const r = loadWorkbook(p);
      const datasources = [...new Set(r.fields.map((f) => f.datasource))];
      return ok({
        workbook: r.fileLabel,
        stats: r.stats,
        datasources,
        calculated_fields: r.fields
          .filter((f) => f.field_type === 'calculated')
          .map((f) => f.field_name),
        lod_fields: r.fields.filter((f) => f.field_type === 'lod').map((f) => f.field_name),
        table_calcs: r.fields
          .filter((f) => f.field_type === 'table_calc')
          .map((f) => f.field_name),
        parameters: r.parameters.map((p2) => p2.name),
        raw_fields: r.rawFields,
      });
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'list_calculated_fields',
  {
    title: 'List calculated fields with formulas',
    description:
      'List every calculated field in the workbook with its formula, type (calculated / LOD / table calc), datasource, and what it directly depends on. Optionally filter by a case-insensitive substring of the field name or formula.',
    inputSchema: {
      path: pathArg,
      filter: z
        .string()
        .optional()
        .describe('Optional case-insensitive substring to match against field names and formulas'),
    },
  },
  async ({ path: p, filter }) => {
    try {
      const r = loadWorkbook(p);
      const q = filter?.toLowerCase();
      const fields = r.fields
        .filter(
          (f) =>
            !q || f.field_name.toLowerCase().includes(q) || f.formula.toLowerCase().includes(q),
        )
        .map((f) => ({
          field_name: f.field_name,
          datasource: f.datasource,
          field_type: f.field_type,
          lod_type: f.lod_type,
          is_table_calc: f.is_table_calc,
          formula: f.formula,
          depends_on_fields: f.ingredients,
          depends_on_parameters: f.parameter_dependencies,
        }));
      return ok({ workbook: r.fileLabel, count: fields.length, fields });
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'get_field',
  {
    title: 'Get one field in full detail',
    description:
      'Full detail for a single field by name (brackets optional, case-insensitive): formula, type, direct dependencies, and every field that directly uses it.',
    inputSchema: {
      path: pathArg,
      field: z.string().describe('Field name, e.g. "Profit Ratio" or "[Profit Ratio]"'),
    },
  },
  async ({ path: p, field }) => {
    try {
      const r = loadWorkbook(p);
      const matches = findFields(r, field);
      if (!matches.length) {
        if (isParameter(r, field)) {
          const prm = r.parameters.find((x) => norm(x.name) === norm(field))!;
          return ok({
            workbook: r.fileLabel,
            kind: 'parameter',
            parameter: prm,
            used_by: directDependents(r, field).map((f) => f.field_name),
          });
        }
        if (isRawField(r, field)) {
          return ok({
            workbook: r.fileLabel,
            kind: 'raw',
            field: field.replace(/^\[|\]$/g, ''),
            used_by: directDependents(r, field).map((f) => f.field_name),
          });
        }
        return fail(new Error(`No field, parameter, or raw column named "${field}" in ${r.fileLabel}`));
      }
      return ok({
        workbook: r.fileLabel,
        matches: matches.map((f) => ({
          ...f,
          used_by: directDependents(r, f.field_name).map((d) => d.field_name),
        })),
      });
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'trace_dependencies',
  {
    title: 'Trace a field’s lineage',
    description:
      'Trace what a field is built from (upstream, recursive tree down to raw columns and parameters) and everything that would be affected if it changed (downstream, transitive). The impact-analysis tool: use before editing a calculation.',
    inputSchema: {
      path: pathArg,
      field: z.string().describe('Field name, e.g. "Profit Ratio" or "[Profit Ratio]"'),
      max_depth: z
        .number()
        .int()
        .min(1)
        .max(25)
        .optional()
        .describe('Maximum upstream recursion depth (default 10)'),
    },
  },
  async ({ path: p, field, max_depth }) => {
    try {
      const r = loadWorkbook(p);
      if (!findFields(r, field).length && !isParameter(r, field) && !isRawField(r, field)) {
        return fail(new Error(`No field, parameter, or raw column named "${field}" in ${r.fileLabel}`));
      }
      const upstream = traceUpstream(r, field, new Set(), max_depth ?? 10);
      const downstream = traceDownstream(r, field, new Set([norm(field)]));
      return ok({
        workbook: r.fileLabel,
        upstream,
        downstream_affected_fields: downstream,
        downstream_count: downstream.length,
      });
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'list_parameters',
  {
    title: 'List parameters',
    description:
      'List every parameter in the workbook: current value, datatype, allowed values, and which calculated fields use each one.',
    inputSchema: { path: pathArg },
  },
  async ({ path: p }) => {
    try {
      const r = loadWorkbook(p);
      return ok({
        workbook: r.fileLabel,
        count: r.parameters.length,
        parameters: r.parameters.map((prm) => ({
          ...prm,
          used_by: directDependents(r, prm.name).map((f) => f.field_name),
        })),
      });
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'get_lineage_graph',
  {
    title: 'Get the full lineage graph',
    description:
      'The complete dependency graph as JSON: one node per field/parameter (with type) and one directed edge per dependency (source feeds target). Suitable for rendering or graph analysis.',
    inputSchema: { path: pathArg },
  },
  async ({ path: p }) => {
    try {
      const r = loadWorkbook(p);
      const nodes = new Map<string, { id: string; type: string }>();
      for (const f of r.fields) nodes.set(norm(f.field_name), { id: f.field_name, type: f.field_type });
      for (const prm of r.parameters) {
        if (!nodes.has(norm(prm.name))) nodes.set(norm(prm.name), { id: prm.name, type: 'parameter' });
      }
      const edges: { source: string; target: string }[] = [];
      for (const f of r.fields) {
        for (const ing of f.ingredients) {
          if (!nodes.has(norm(ing))) nodes.set(norm(ing), { id: ing, type: isRawField(r, ing) ? 'raw' : 'unknown' });
          edges.push({ source: nodes.get(norm(ing))!.id, target: f.field_name });
        }
        for (const prm of f.parameter_dependencies) {
          if (!nodes.has(norm(prm))) nodes.set(norm(prm), { id: prm, type: 'parameter' });
          edges.push({ source: nodes.get(norm(prm))!.id, target: f.field_name });
        }
      }
      return ok({
        workbook: r.fileLabel,
        node_count: nodes.size,
        edge_count: edges.length,
        nodes: [...nodes.values()],
        edges,
      });
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Start ──────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`tableau-lineage-mcp v${VERSION} ready (stdio). Workbooks are parsed locally; nothing is uploaded.`);
