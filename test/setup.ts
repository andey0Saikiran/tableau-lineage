// The extractors call `new DOMParser()` at runtime. In the browser that is
// native; in Node (tests and the MCP server) it comes from @xmldom/xmldom.
import { DOMParser } from '@xmldom/xmldom';

(globalThis as unknown as { DOMParser: unknown }).DOMParser = DOMParser;
