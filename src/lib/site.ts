// Single source of truth for outbound links & credits.
// Update REPO_URL once you create the GitHub repo, and add Mourya's LinkedIn
// when available (leave `linkedin` undefined to render the name without a link).

export const SITE_URL = 'https://www.tableau-lineage.com';
export const REPO_URL = 'https://github.com/andey0Saikiran/tableau-lineage';

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
