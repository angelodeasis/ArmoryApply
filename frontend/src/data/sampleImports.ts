import type { ImportResult } from '../types/import'

// The demo's "Import from link": a few sample postings with pre-saved results,
// so visitors see the real experience without the demo ever calling AWS.
// The companies are fictional; .example is a domain reserved for examples.

export const SAMPLE_IMPORTS: { label: string; result: ImportResult }[] = [
  {
    label: 'Greenhouse job',
    result: {
      source: 'greenhouse',
      job: {
        jobUrl: 'https://job-boards.greenhouse.io/skylinestudio/jobs/4815162342',
        company: 'Skyline Studio',
        position: 'Frontend Engineer',
        location: 'New York, NY',
        workMode: 'hybrid',
        salaryMin: 140000,
        salaryMax: 175000,
      },
    },
  },
  {
    label: 'Lever job',
    result: {
      source: 'lever',
      job: {
        jobUrl: 'https://jobs.lever.co/brightwave/7c1e2f9a-3b4d-4e5f-8a9b-0c1d2e3f4a5b',
        company: 'Brightwave',
        position: 'Cloud Engineer',
        location: 'Remote (US)',
        workMode: 'remote',
        salaryMin: 130000,
        salaryMax: 160000,
      },
    },
  },
  {
    label: 'Company careers page',
    result: {
      source: 'structured-data',
      job: {
        jobUrl: 'https://careers.fernandfog.example/jobs/data-analyst',
        company: 'Fern & Fog Coffee',
        position: 'Data Analyst',
        location: 'Portland, OR',
        workMode: 'onsite',
        salaryMin: 85000,
        salaryMax: 100000,
      },
    },
  },
]
