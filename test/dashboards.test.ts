import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  extractDashboardsFromTwbx,
  extractProvenanceFromTwbx,
  extractProvenanceFromXml,
} from '../src/lib/dashboardExtractor';

const DEMO = path.join(__dirname, '..', 'public', 'demo.twbx');
const FIXTURES = path.join(__dirname, 'fixtures');

function load(file: string) {
  const abs = file.startsWith('/') ? file : path.join(FIXTURES, file);
  const buf = fs.readFileSync(abs);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  return {
    dashboards: extractDashboardsFromTwbx(ab, path.basename(abs)),
    provenance: extractProvenanceFromTwbx(ab, path.basename(abs)),
  };
}

describe('dashboards', () => {
  it('maps zones to the worksheets placed on each dashboard', () => {
    const { dashboards } = load(DEMO);
    expect(dashboards.dashboards).toHaveLength(1);
    const d = dashboards.dashboards[0];
    expect(d.worksheets.length).toBe(12);
    expect(d.worksheets).toContain('Total Patients');
  });

  it('reads the fixed canvas size', () => {
    const { dashboards } = load(DEMO);
    expect(dashboards.dashboards[0].size).toEqual({ width: 1000, height: 800 });
  });

  it('lists worksheets that sit on no dashboard', () => {
    // custom-sql.twbx has worksheets but no dashboard at all.
    const { dashboards } = load('custom-sql.twbx');
    expect(dashboards.dashboards).toHaveLength(0);
    expect(dashboards.orphanWorksheets.sort()).toEqual(['Overview', 'Trends']);
  });

  it('does not mistake layout containers for worksheets', () => {
    const { dashboards } = load(DEMO);
    // Layout zones carry no name; only real sheets should be listed.
    for (const w of dashboards.dashboards[0].worksheets) {
      expect(w).not.toMatch(/^layout-/);
      expect(w.length).toBeGreaterThan(0);
    }
  });
});

describe('provenance', () => {
  // Regression: every worksheet carries a <datasources> reference block, so a
  // naive "parent is <datasources>" check counted one data source thirteen
  // times on a twelve-sheet workbook.
  it('counts each data source once, not once per worksheet', () => {
    const { provenance } = load(DEMO);
    expect(provenance.datasources).toHaveLength(1);
  });

  // This test previously asserted `true`, which encoded a bug rather than the
  // truth: demo.twbx bundles a CSV and contains no <extract> element at all, so
  // labelling it "Extract" told the reader the opposite of what the workbook
  // does. A CSV or Excel connection is a live connection to a file.
  it('does not call a packaged CSV an extract', () => {
    const { provenance } = load(DEMO);
    expect(provenance.datasources[0].isExtract).toBe(false);
  });

  it('treats a disabled extract as live', () => {
    // Toggling "Use Extract" off leaves <extract enabled='false'> in the file
    // while the workbook queries the source live.
    const xml = `<?xml version='1.0' encoding='utf-8' ?>
<workbook version='18.1'><datasources>
  <datasource caption='DS' name='ds.a'>
    <connection class='postgres' dbname='db' server='h' />
    <extract enabled='false'><connection class='dataengine' /></extract>
    <column caption='C' datatype='real' name='[c]' />
  </datasource>
</datasources></workbook>`;
    expect(extractProvenanceFromXml(xml, 'x').datasources[0].isExtract).toBe(false);
  });

  it('reports connection class and database for live sources', () => {
    const { provenance } = load('custom-sql.twbx');
    const names = provenance.datasources.map((d) => d.name).sort();
    expect(names).toEqual(['Legacy Warehouse (Stored Proc)', 'Sales (Custom SQL)']);
    const sales = provenance.datasources.find((d) => d.name.startsWith('Sales'))!;
    expect(sales.connections[0].class).toBe('postgres');
    expect(sales.connections[0].dbname).toBe('analytics');
  });

  it('flags a published data source', () => {
    const { provenance } = load('published-ds.twbx');
    expect(provenance.datasources[0].connections.some((c) => c.published)).toBe(true);
  });

  it('reports missing refresh history as null rather than implying freshness', () => {
    const { provenance } = load(DEMO);
    expect(provenance.datasources[0].lastRefresh).toBeNull();
  });

  it('excludes the Parameters pseudo data source', () => {
    const { provenance } = load('with-params.twbx');
    expect(provenance.datasources.map((d) => d.name.toLowerCase())).not.toContain('parameters');
  });
});
