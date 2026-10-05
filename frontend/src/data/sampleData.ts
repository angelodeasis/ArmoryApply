import type { JobApplication } from '../types/application'

// Fictional companies and people only. This file ships inside the public demo.
//
// Dates are computed relative to "now" so the demo never looks stale: there
// are always recent applications and upcoming interviews.

const DAY_MS = 24 * 60 * 60 * 1000

/** "YYYY-MM-DD" for N days ago (negative = in the future). */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10)
}

/** ISO date-time N days from now at the given local hour. */
function daysFromNow(n: number, hour: number): string {
  const d = new Date(Date.now() + n * DAY_MS)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function timestamp(daysBack: number): string {
  return new Date(Date.now() - daysBack * DAY_MS).toISOString()
}

export function buildSampleApplications(): JobApplication[] {
  return [
    {
      id: 'demo-1',
      company: 'Northwind Labs',
      position: 'Software Engineer II',
      status: 'interviewing',
      dateApplied: daysAgo(18),
      location: 'Seattle, WA',
      workMode: 'hybrid',
      salaryMin: 135000,
      salaryMax: 160000,
      jobUrl: 'https://example.com/jobs/northwind-swe2',
      resumeVersion: 'SWE v3 – backend focus',
      resumeFile: { fileName: 'resume-swe-v3.pdf', key: 'demo/resume-swe-v3.pdf', uploadedAt: timestamp(20) },
      interviews: [
        { id: 'demo-1-i1', scheduledAt: daysFromNow(-9, 10), type: 'phone', notes: 'Recruiter screen with Dana. Team works on billing services.' },
        { id: 'demo-1-i2', scheduledAt: daysFromNow(-2, 13), type: 'technical', notes: 'Live coding: rate limiter. Went well.' },
        { id: 'demo-1-i3', scheduledAt: daysFromNow(3, 11), type: 'onsite', notes: '4 rounds incl. system design.' },
      ],
      notes: 'Referred by a former teammate. Strong interest — good mentorship culture.',
      createdAt: timestamp(18),
      updatedAt: timestamp(2),
    },
    {
      id: 'demo-2',
      company: 'Bluepeak Analytics',
      position: 'Full Stack Developer',
      status: 'screening',
      dateApplied: daysAgo(9),
      location: 'Remote (US)',
      workMode: 'remote',
      salaryMin: 120000,
      salaryMax: 145000,
      jobUrl: 'https://example.com/jobs/bluepeak-fullstack',
      resumeVersion: 'Full stack v2',
      interviews: [{ id: 'demo-2-i1', scheduledAt: daysFromNow(1, 14), type: 'phone', notes: 'Hiring manager intro call.' }],
      notes: 'React + Node stack. Asked about AWS experience in the posting.',
      createdAt: timestamp(9),
      updatedAt: timestamp(4),
    },
    {
      id: 'demo-3',
      company: 'Cedar & Pine Health',
      position: 'Backend Engineer',
      status: 'applied',
      dateApplied: daysAgo(5),
      location: 'Austin, TX',
      workMode: 'onsite',
      salaryMin: 125000,
      jobUrl: 'https://example.com/jobs/cedarpine-backend',
      resumeVersion: 'SWE v3 – backend focus',
      interviews: [],
      notes: 'Healthcare data platform. Python + DynamoDB.',
      createdAt: timestamp(5),
      updatedAt: timestamp(5),
    },
    {
      id: 'demo-4',
      company: 'Lumen Freight',
      position: 'Cloud Engineer',
      status: 'offer',
      dateApplied: daysAgo(34),
      location: 'Denver, CO',
      workMode: 'hybrid',
      salaryMin: 150000,
      salaryMax: 150000,
      jobUrl: 'https://example.com/jobs/lumen-cloud',
      resumeVersion: 'Cloud v1',
      interviews: [
        { id: 'demo-4-i1', scheduledAt: daysFromNow(-27, 9), type: 'phone' },
        { id: 'demo-4-i2', scheduledAt: daysFromNow(-20, 15), type: 'technical', notes: 'Terraform + AWS networking questions.' },
        { id: 'demo-4-i3', scheduledAt: daysFromNow(-12, 10), type: 'final' },
      ],
      notes: 'Offer: $150k base + 10% bonus. Decision due next Friday.',
      createdAt: timestamp(34),
      updatedAt: timestamp(3),
    },
    {
      id: 'demo-5',
      company: 'Quillstone',
      position: 'Frontend Engineer',
      status: 'rejected',
      dateApplied: daysAgo(40),
      location: 'New York, NY',
      workMode: 'hybrid',
      salaryMin: 140000,
      salaryMax: 170000,
      jobUrl: 'https://example.com/jobs/quillstone-fe',
      resumeVersion: 'Full stack v2',
      interviews: [{ id: 'demo-5-i1', scheduledAt: daysFromNow(-30, 11), type: 'technical' }],
      notes: 'Rejected after technical. Feedback: brush up on accessibility.',
      createdAt: timestamp(40),
      updatedAt: timestamp(26),
    },
    {
      id: 'demo-6',
      company: 'Harborlight Games',
      position: 'Gameplay Tools Engineer',
      status: 'ghosted',
      dateApplied: daysAgo(52),
      location: 'Remote (US)',
      workMode: 'remote',
      jobUrl: 'https://example.com/jobs/harborlight-tools',
      resumeVersion: 'SWE v2',
      interviews: [],
      notes: 'No response after 7 weeks.',
      createdAt: timestamp(52),
      updatedAt: timestamp(52),
    },
    {
      id: 'demo-7',
      company: 'Vantage Robotics',
      position: 'Software Engineer, Platform',
      status: 'wishlist',
      location: 'Boston, MA',
      workMode: 'onsite',
      salaryMin: 145000,
      salaryMax: 175000,
      jobUrl: 'https://example.com/jobs/vantage-platform',
      interviews: [],
      notes: 'Opens to new grads in spring. Tailor resume toward embedded/platform.',
      createdAt: timestamp(3),
      updatedAt: timestamp(3),
    },
    {
      id: 'demo-8',
      company: 'Tidewater Financial',
      position: 'Associate Software Engineer',
      status: 'applied',
      dateApplied: daysAgo(12),
      location: 'Charlotte, NC',
      workMode: 'hybrid',
      salaryMin: 105000,
      salaryMax: 120000,
      jobUrl: 'https://example.com/jobs/tidewater-ase',
      resumeVersion: 'SWE v3 – backend focus',
      interviews: [],
      notes: '',
      createdAt: timestamp(12),
      updatedAt: timestamp(12),
    },
    {
      id: 'demo-9',
      company: 'Orbital Kitchen',
      position: 'Junior DevOps Engineer',
      status: 'withdrawn',
      dateApplied: daysAgo(25),
      location: 'Chicago, IL',
      workMode: 'onsite',
      salaryMin: 95000,
      resumeVersion: 'Cloud v1',
      interviews: [{ id: 'demo-9-i1', scheduledAt: daysFromNow(-19, 16), type: 'phone' }],
      notes: 'Withdrew — role was mostly on-call support.',
      createdAt: timestamp(25),
      updatedAt: timestamp(18),
    },
    {
      id: 'demo-10',
      company: 'Meridian Maps',
      position: 'Software Engineer – Geospatial',
      status: 'interviewing',
      dateApplied: daysAgo(14),
      location: 'Remote (US)',
      workMode: 'remote',
      salaryMin: 130000,
      salaryMax: 155000,
      jobUrl: 'https://example.com/jobs/meridian-geo',
      resumeVersion: 'Full stack v2',
      interviews: [
        { id: 'demo-10-i1', scheduledAt: daysFromNow(-6, 12), type: 'phone' },
        { id: 'demo-10-i2', scheduledAt: daysFromNow(6, 10), type: 'behavioral', notes: 'Prep STAR stories.' },
      ],
      notes: 'Small team, lots of ownership.',
      createdAt: timestamp(14),
      updatedAt: timestamp(6),
    },
  ]
}
