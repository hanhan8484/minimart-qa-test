export const EXECUTIVE_REPORT_CONFIG = {
  product: 'MiniMart',
  sutVersion: 'v2.1',
  outputDir: process.env.EXECUTIVE_REPORT_DIR || 'executive-report',
  requirementCoverage: {
    total: 164,
    mapped: 164,
    executable: 162,
    conforming: 126,
    note: 'Requirement coverage from PRD R-1.1 through R-18.x; not source-code coverage.',
  },
} as const;
