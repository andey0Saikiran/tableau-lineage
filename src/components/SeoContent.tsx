import { ChevronDown } from 'lucide-react';

// Plain-English, keyword-rich answers to the questions people actually search.
// Keep this copy in sync with the FAQPage JSON-LD in index.html (Google requires
// the structured-data answers to match the visible text).
const FAQS = [
  {
    q: 'What is a .twbx file?',
    a: 'A .twbx is a Tableau packaged workbook. It is a single ZIP archive that bundles the workbook definition (a .twb XML file) together with its data extracts, images, and other resources, so an entire dashboard can be shared as one file.',
  },
  {
    q: 'How do I see calculated field dependencies in a Tableau workbook?',
    a: 'Drop the .twbx here and the tool reads every calculated field, parameter, and data source, then draws the dependencies as an interactive graph. You can trace which fields feed a calculation, follow a parameter through the logic, and search the full data dictionary instead of clicking through the workbook by hand.',
  },
  {
    q: 'Is it safe to open or upload a .twbx file online?',
    a: 'With this tool there is no upload at all. The file is read and parsed entirely in your browser, so your workbook and any data inside it never leave your computer. Because the project is open source, you can verify for yourself that there is no server to send the file to.',
  },
  {
    q: 'Can I view a Tableau workbook without Tableau Desktop?',
    a: 'Yes. You do not need a Tableau license or any installation to inspect the structure of a workbook. This tool opens the packaged workbook in any modern browser and shows its fields, calculations, parameters, and lineage.',
  },
  {
    q: 'What does the dependency graph show?',
    a: 'Every field becomes a node: raw fields, calculated fields, parameters, level-of-detail (LOD) expressions, and table calculations, with edges showing what depends on what. Click a category to highlight just those nodes, or open the searchable dictionary to read each formula.',
  },
  {
    q: 'Is it free, and how is it different from Tableau Catalog?',
    a: 'It is completely free and open source. Tableau Catalog is a strong option for organization-wide lineage if you have Data Management licensed and your content is published to Tableau Server or Cloud. This tool covers a narrower job: calculated-field and parameter lineage for a single .twbx file on your own machine, with nothing uploaded.',
  },
];

export function SeoContent() {
  return (
    <section className="mx-auto max-w-4xl px-5 pb-20 pt-2" aria-labelledby="learn-heading">
      <div className="rounded-2xl border border-border bg-white/60 p-6 backdrop-blur-sm sm:p-9">
        <h2
          id="learn-heading"
          className="text-balance text-2xl font-extrabold tracking-tight text-ink sm:text-[1.7rem]"
        >
          Understand any Tableau workbook in seconds
        </h2>
        <p className="mt-3 max-w-2xl text-pretty text-[15px] leading-relaxed text-muted">
          Inheriting a Tableau dashboard usually means an afternoon of double-clicking fields to work out
          where a number comes from. Tableau Lineage Visualizer reads the calculated-field dependencies,
          parameters, and metadata inside any{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm text-ink">.twbx</code> and lays them
          out as an interactive lineage graph and a searchable data dictionary, all in your browser, with
          nothing uploaded.
        </p>
        <p className="mt-3 max-w-2xl text-pretty text-[15px] leading-relaxed text-muted">
          It helps when you inherit a workbook you did not build, audit a calculation before changing it,
          document a dashboard ahead of a migration, or onboard onto an unfamiliar report, without a Tableau
          license and without sending a client file to a third-party server.
        </p>

        <h3 className="mt-9 text-lg font-bold text-ink">Frequently asked questions</h3>
        <div className="mt-4 space-y-3">
          {FAQS.map(({ q, a }) => (
            <details
              key={q}
              className="group rounded-xl border border-border bg-white px-5 py-4 shadow-sm transition-colors open:border-brand-400"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-brand-600 transition-transform duration-300 group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
