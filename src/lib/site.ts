// Single source of truth for outbound links and credits.
// CONTRIBUTORS is intentionally empty: this is a solo project.

export const SITE_URL = 'https://tableau-lineage.com';
export const REPO_URL = 'https://github.com/andey0Saikiran/tableau-lineage';
export const NPM_URL = 'https://www.npmjs.com/package/tableau-lineage-mcp';

export interface Person {
  name: string;
  role: 'creator' | 'contributor';
  linkedin?: string;
  github?: string;
}

export const CREATOR: Person = {
  name: 'Sai Kiran Andey',
  role: 'creator',
  linkedin: 'https://www.linkedin.com/in/andeysaikiran/',
  github: 'https://github.com/andey0Saikiran',
};

export const CONTRIBUTORS: Person[] = [];
