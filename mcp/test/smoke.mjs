// End-to-end smoke test: spawns the built server and speaks real MCP JSON-RPC
// over stdio against the repo's demo workbook. Run: npm test (in mcp/).
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(here, '..', 'dist', 'index.js');
const demoTwbx = path.join(here, '..', '..', 'public', 'demo.twbx');

const child = spawn(process.execPath, [serverPath], { stdio: ['pipe', 'pipe', 'pipe'] });
child.stderr.on('data', () => {}); // banner noise

let buf = '';
const pending = new Map();
child.stdout.on('data', (chunk) => {
  buf += chunk.toString();
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

let nextId = 1;
function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 15000);
    pending.set(id, (msg) => {
      clearTimeout(t);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}

let failures = 0;
function check(label, cond, detail = '') {
  console.log(`${cond ? '  ✅' : '  ❌'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!cond) failures++;
}
const textOf = (res) => res.content?.[0]?.text ?? '';
const jsonOf = (res) => JSON.parse(textOf(res));

console.log('\n=== tableau-lineage-mcp smoke test ===\n');
try {
  const init = await rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'smoke-test', version: '0.0.0' },
  });
  check('initialize handshake', init.serverInfo?.name === 'tableau-lineage', init.serverInfo?.name);
  notify('notifications/initialized', {});

  const tools = await rpc('tools/list', {});
  const names = tools.tools.map((t) => t.name).sort();
  check(
    'exposes all 6 tools',
    ['analyze_workbook', 'get_field', 'get_lineage_graph', 'list_calculated_fields', 'list_parameters', 'trace_dependencies']
      .every((n) => names.includes(n)),
    names.join(', '),
  );

  const analysis = jsonOf(await rpc('tools/call', { name: 'analyze_workbook', arguments: { path: demoTwbx } }));
  check('analyze_workbook parses the demo .twbx', analysis.stats?.total_fields > 0, JSON.stringify(analysis.stats));
  check('finds calculated fields', analysis.calculated_fields?.length > 0, `${analysis.calculated_fields?.length} calcs`);
  check('finds parameters', analysis.parameters?.length > 0, `${analysis.parameters?.length} params`);

  const someCalc = analysis.calculated_fields[0];
  const detail = jsonOf(await rpc('tools/call', { name: 'get_field', arguments: { path: demoTwbx, field: `[${someCalc}]` } }));
  check(`get_field("[${someCalc}]") resolves with brackets`, detail.matches?.[0]?.formula?.length > 0);

  const trace = jsonOf(await rpc('tools/call', { name: 'trace_dependencies', arguments: { path: demoTwbx, field: someCalc } }));
  check('trace_dependencies returns an upstream tree', trace.upstream?.field !== undefined, `downstream: ${trace.downstream_count}`);

  const params = jsonOf(await rpc('tools/call', { name: 'list_parameters', arguments: { path: demoTwbx } }));
  check('list_parameters includes used_by', params.parameters?.every((p) => Array.isArray(p.used_by)));

  const graph = jsonOf(await rpc('tools/call', { name: 'get_lineage_graph', arguments: { path: demoTwbx } }));
  check('lineage graph has nodes and edges', graph.node_count > 0 && graph.edge_count > 0, `${graph.node_count} nodes, ${graph.edge_count} edges`);

  const filtered = jsonOf(await rpc('tools/call', { name: 'list_calculated_fields', arguments: { path: demoTwbx, filter: someCalc.slice(0, 4) } }));
  check('list_calculated_fields filter works', filtered.count >= 1, `${filtered.count} match(es)`);

  const missing = await rpc('tools/call', { name: 'get_field', arguments: { path: demoTwbx, field: 'No Such Field Xyz' } });
  check('unknown field returns a clean error', missing.isError === true, textOf(missing).slice(0, 60));

  const badPath = await rpc('tools/call', { name: 'analyze_workbook', arguments: { path: '/nonexistent/nope.twbx' } });
  check('missing file returns a clean error', badPath.isError === true);
} catch (e) {
  console.error('  ❌ FATAL:', e.message);
  failures++;
}

child.kill();
console.log(failures === 0 ? '\nAll smoke checks passed ✅\n' : `\n${failures} check(s) FAILED ❌\n`);
process.exit(failures === 0 ? 0 : 1);
