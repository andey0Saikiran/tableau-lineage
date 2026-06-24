import { forwardRef } from 'react';

interface Props {
  html: string;
  title: string;
}

/**
 * Renders the self-contained report (the exact artifact users download) in a
 * sandboxed same-origin iframe. `allow-same-origin` is required so the app can
 * read the vis-network canvas for PNG export; `allow-downloads` lets the report's
 * own CSV/PNG buttons work.
 */
export const VisualizerFrame = forwardRef<HTMLIFrameElement, Props>(function VisualizerFrame(
  { html, title },
  ref,
) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-[0_40px_90px_-40px_rgba(15,23,42,0.4)]">
      <iframe
        ref={ref}
        srcDoc={html}
        title={title}
        className="block h-[82vh] min-h-[560px] w-full"
        sandbox="allow-scripts allow-same-origin allow-downloads allow-popups"
        loading="eager"
      />
    </div>
  );
});
