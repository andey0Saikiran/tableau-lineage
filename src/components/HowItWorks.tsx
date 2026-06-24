import { FileUp, Cpu, Share2 } from 'lucide-react';

const STEPS = [
  {
    Icon: FileUp,
    title: 'Drop a .twbx',
    body: 'Pick any Tableau packaged workbook from your device.',
  },
  {
    Icon: Cpu,
    title: 'Parsed in your browser',
    body: 'It is unzipped and read locally. The file never leaves your machine.',
  },
  {
    Icon: Share2,
    title: 'Explore the lineage',
    body: 'Walk the dependency graph and dictionary, then export a shareable report.',
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="mx-auto mt-12 max-w-3xl animate-slide-up">
      <h2 id="how-heading" className="sr-only">
        How it works
      </h2>
      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map(({ Icon, title, body }, i) => (
          <li
            key={title}
            className="rounded-2xl border border-border bg-white/70 p-5 backdrop-blur"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-leaf text-white">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-muted">Step {i + 1}</span>
            </div>
            <h3 className="text-sm font-bold text-ink">{title}</h3>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
