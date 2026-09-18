// Single source of truth for outbound links and credits.
// CONTRIBUTORS is intentionally empty: this is a solo project.

export const SITE_URL = 'https://tableau-lineage.com';
/** Bare host, for prose and exported artifacts where a full URL reads badly. */
export const SITE_HOST = 'tableau-lineage.com';
export const REPO_URL = 'https://github.com/andey0Saikiran/tableau-lineage';
export const NPM_URL = 'https://www.npmjs.com/package/tableau-lineage-mcp';
/** Always resolves to the newest release asset, so it never needs a version bump. */
export const MCPB_DOWNLOAD_URL =
  'https://github.com/andey0Saikiran/tableau-lineage/releases/latest/download/tableau-lineage.mcpb';

export interface Person {
  name: string;
  role: 'creator' | 'contributor';
  linkedin?: string;
  github?: string;
}

// `satisfies` rather than `: Person`, so linkedin and github stay required
// strings here: exports and the byline interpolate them directly.
export const CREATOR = {
  name: 'Sai Kiran Andey',
  role: 'creator',
  linkedin: 'https://www.linkedin.com/in/andeysaikiran/',
  github: 'https://github.com/andey0Saikiran',
} as const satisfies Person;

export const CONTRIBUTORS: Person[] = [];
