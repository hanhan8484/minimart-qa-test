import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestError,
  TestResult,
} from '@playwright/test/reporter';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { EXECUTIVE_REPORT_CONFIG } from './executive-report.config';

type Outcome =
  | 'normalPass'
  | 'expectedFailure'
  | 'skipped'
  | 'unexpectedFailure'
  | 'fixCandidate'
  | 'flaky';

type Layer = 'API' | 'UI' | 'Flow' | 'Other';

type TestRecord = {
  id: string;
  title: string;
  titlePath: string;
  file: string;
  line: number;
  project: string;
  layer: Layer;
  outcome: Outcome;
  expectedStatus: string;
  actualStatus: string;
  durationMs: number;
  retries: number;
  defectIds: string[];
  annotations: { type: string; description?: string }[];
  error: string;
};

type DefectSummary = {
  unresolved: number | null;
  verified: number | null;
  total: number | null;
  severity: Record<'S1' | 'S2' | 'S3' | 'S4', number | null>;
};

type ExecutiveSummary = {
  generatedAt: string;
  startedAt: string;
  durationMs: number;
  playwrightStatus: FullResult['status'];
  commit: string;
  product: string;
  sutVersion: string;
  baseURL: string;
  projects: string[];
  counts: Record<Outcome | 'total', number>;
  layers: Record<Layer, number>;
  uniqueDefects: string[];
  logicalCaseIds: string[];
  defects: DefectSummary;
  requirementCoverage: typeof EXECUTIVE_REPORT_CONFIG.requirementCoverage;
  globalErrors: string[];
  tests: TestRecord[];
};

const OUTCOME_LABELS: Record<Outcome, string> = {
  normalPass: 'Normal pass',
  expectedFailure: 'Expected failure / known-defect evidence',
  skipped: 'Skipped / blocked',
  unexpectedFailure: 'Unexpected failure',
  fixCandidate: 'Fix candidate / unexpected pass',
  flaky: 'Flaky',
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizePath(file: string): string {
  const normalized = file.replaceAll('\\', '/');
  const marker = '/tests/';
  const markerIndex = normalized.toLowerCase().lastIndexOf(marker);
  if (markerIndex >= 0) return normalized.slice(markerIndex + marker.length);
  return relative(process.cwd(), file).replaceAll('\\', '/');
}

function layerFor(file: string): Layer {
  if (file.startsWith('api/')) return 'API';
  if (file.startsWith('ui/')) return 'UI';
  if (file.startsWith('flows/')) return 'Flow';
  return 'Other';
}

function defectIdsFor(test: TestCase, result: TestResult | undefined): string[] {
  const text = [
    test.title,
    ...test.titlePath(),
    ...test.annotations.map((annotation) => annotation.description || ''),
    ...(result?.annotations || []).map((annotation) => annotation.description || ''),
  ].join(' ');
  return [...new Set(text.match(/DEF-\d{3}/g) || [])].sort();
}

function caseIdsFor(test: TestCase): string[] {
  const text = [test.title, ...test.titlePath()].join(' ');
  return [...new Set(text.match(/\b[A-Z]-[ABC]\d{2}\b/g) || [])].sort();
}

function classify(test: TestCase, result: TestResult | undefined): Outcome {
  const actual = result?.status || 'skipped';
  const outcome = test.outcome();

  if (test.expectedStatus === 'skipped' || actual === 'skipped') return 'skipped';
  if (test.expectedStatus === 'failed') {
    return actual === 'passed' ? 'fixCandidate' : 'expectedFailure';
  }
  if (outcome === 'flaky') return 'flaky';
  if (actual === 'passed' && outcome === 'expected') return 'normalPass';
  return 'unexpectedFailure';
}

function errorText(result: TestResult | undefined): string {
  if (!result) return '';
  return result.errors
    .map((error) => error.message || error.value || error.stack || '')
    .filter(Boolean)
    .join('\n\n');
}

function recordFor(test: TestCase): TestRecord {
  const result = test.results.at(-1);
  const file = normalizePath(test.location.file);
  return {
    id: test.id,
    title: test.title,
    titlePath: test.titlePath().filter(Boolean).join(' › '),
    file,
    line: test.location.line,
    project: test.parent.project()?.name || 'unknown',
    layer: layerFor(file),
    outcome: classify(test, result),
    expectedStatus: test.expectedStatus,
    actualStatus: result?.status || 'not-run',
    durationMs: test.results.reduce((sum, attempt) => sum + attempt.duration, 0),
    retries: Math.max(0, test.results.length - 1),
    defectIds: defectIdsFor(test, result),
    annotations: result?.annotations || test.annotations,
    error: errorText(result),
  };
}

function readGitCommit(): string {
  try {
    const dotGit = resolve('.git');
    const gitDir = statSync(dotGit).isDirectory()
      ? dotGit
      : resolve(dirname(dotGit), readFileSync(dotGit, 'utf8').trim().slice('gitdir:'.length).trim());
    const head = readFileSync(join(gitDir, 'HEAD'), 'utf8').trim();
    if (!head.startsWith('ref:')) return head.slice(0, 12);
    return readFileSync(join(gitDir, head.slice('ref:'.length).trim()), 'utf8').trim().slice(0, 12);
  } catch {
    return process.env.GITHUB_SHA?.slice(0, 12) || 'unknown';
  }
}

function numberFromTable(markdown: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(
    new RegExp(`\\|\\s*\\*{0,2}${escaped}\\*{0,2}\\s*\\|\\s*\\*{0,2}(\\d+)\\*{0,2}\\s*\\|`),
  );
  return match ? Number(match[1]) : null;
}

function readDefectSummary(): DefectSummary {
  try {
    const markdown = readFileSync(resolve('docs/defects.md'), 'utf8');
    const unresolved = numberFromTable(markdown, 'Open / Confirmed');
    const verified = numberFromTable(markdown, 'Verified（已關閉）');
    return {
      unresolved,
      verified,
      total: numberFromTable(markdown, '合計'),
      severity: {
        S1: numberFromTable(markdown, 'S1'),
        S2: numberFromTable(markdown, 'S2'),
        S3: numberFromTable(markdown, 'S3'),
        S4: numberFromTable(markdown, 'S4'),
      },
    };
  } catch {
    return {
      unresolved: null,
      verified: null,
      total: null,
      severity: { S1: null, S2: null, S3: null, S4: null },
    };
  }
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function percent(value: number, total: number): string {
  return total === 0 ? '0.0%' : `${((value / total) * 100).toFixed(1)}%`;
}

function renderOutcomeRows(summary: ExecutiveSummary): string {
  const order: Outcome[] = [
    'normalPass',
    'expectedFailure',
    'skipped',
    'unexpectedFailure',
    'fixCandidate',
    'flaky',
  ];
  return order
    .map((outcome) => {
      const count = summary.counts[outcome];
      const tone =
        outcome === 'normalPass'
          ? 'good'
          : outcome === 'expectedFailure' || outcome === 'skipped'
            ? 'warn'
            : count > 0
              ? 'bad'
              : 'muted';
      return `<div class="metric">
        <strong class="${tone}">${count}</strong>
        <span>${escapeHtml(OUTCOME_LABELS[outcome])}</span>
        <small>${percent(count, summary.counts.total)}</small>
      </div>`;
    })
    .join('');
}

function renderLayerBars(summary: ExecutiveSummary): string {
  const max = Math.max(...Object.values(summary.layers), 1);
  return (['API', 'UI', 'Flow', 'Other'] as Layer[])
    .filter((layer) => summary.layers[layer] > 0)
    .map(
      (layer) => `<div class="bar-row">
        <span>${layer}</span>
        <div class="track"><div class="bar" style="width:${(summary.layers[layer] / max) * 100}%"></div></div>
        <strong>${summary.layers[layer]}</strong>
      </div>`,
    )
    .join('');
}

function renderDefectRows(summary: ExecutiveSummary): string {
  const grouped = new Map<string, TestRecord[]>();
  for (const test of summary.tests) {
    for (const defectId of test.defectIds) {
      const rows = grouped.get(defectId) || [];
      rows.push(test);
      grouped.set(defectId, rows);
    }
  }
  if (grouped.size === 0) {
    return '<tr><td colspan="3">No DEF annotations found in this run.</td></tr>';
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([defectId, tests]) => `<tr>
        <td><strong>${escapeHtml(defectId)}</strong></td>
        <td>${tests.length}</td>
        <td>${tests
          .map(
            (test) =>
              `<div><code>${escapeHtml(`${test.file}:${test.line}`)}</code> ${escapeHtml(test.title)}</div>`,
          )
          .join('')}</td>
      </tr>`,
    )
    .join('');
}

function renderTestRows(records: TestRecord[]): string {
  if (records.length === 0) return '<tr><td colspan="5">None</td></tr>';
  return records
    .map(
      (test) => `<tr>
        <td><span class="pill ${test.outcome}">${escapeHtml(OUTCOME_LABELS[test.outcome])}</span></td>
        <td>${escapeHtml(test.layer)}</td>
        <td>
          <strong>${escapeHtml(test.title)}</strong>
          <div class="subtle"><code>${escapeHtml(`${test.file}:${test.line}`)}</code></div>
        </td>
        <td>${test.defectIds.map((id) => `<code>${escapeHtml(id)}</code>`).join(' ') || '—'}</td>
        <td>${formatDuration(test.durationMs)}</td>
      </tr>
      ${
        test.error
          ? `<tr class="error-row"><td colspan="5"><details><summary>Actual failure evidence</summary><pre>${escapeHtml(test.error)}</pre></details></td></tr>`
          : ''
      }`,
    )
    .join('');
}

function renderAttentionSections(summary: ExecutiveSummary): string {
  const groups: { title: string; tone: string; outcomes: Outcome[] }[] = [
    {
      title: 'Unexpected failures / 非預期失敗',
      tone: 'danger',
      outcomes: ['unexpectedFailure'],
    },
    {
      title: 'Fix candidates / 已知缺陷可能已修復',
      tone: 'info',
      outcomes: ['fixCandidate'],
    },
    { title: 'Flaky tests / 重試後通過', tone: 'warning', outcomes: ['flaky'] },
    { title: 'Skipped or blocked / 跳過或受阻', tone: 'warning', outcomes: ['skipped'] },
  ];
  return groups
    .map((group) => {
      const records = summary.tests.filter((test) => group.outcomes.includes(test.outcome));
      if (records.length === 0 && group.outcomes[0] !== 'unexpectedFailure') return '';
      return `<section>
        <h2>${escapeHtml(group.title)}</h2>
        <div class="callout ${group.tone}">
          ${
            records.length === 0
              ? 'None in this run.'
              : `${records.length} execution${records.length === 1 ? '' : 's'} require attention.`
          }
        </div>
        ${
          records.length
            ? `<table><thead><tr><th>Outcome</th><th>Layer</th><th>Test</th><th>DEF</th><th>Duration</th></tr></thead>
               <tbody>${renderTestRows(records)}</tbody></table>`
            : ''
        }
      </section>`;
    })
    .join('');
}

function renderHtml(summary: ExecutiveSummary): string {
  const coverage = summary.requirementCoverage;
  const releaseBlocked =
    summary.counts.unexpectedFailure > 0 ||
    summary.counts.fixCandidate > 0 ||
    (summary.defects.unresolved || 0) > 0;
  const verdict = summary.counts.unexpectedFailure
    ? 'Regression detected'
    : releaseBlocked
      ? 'Not release-ready — known defects remain'
      : summary.counts.skipped
        ? 'Conditional — blocked coverage remains'
        : 'Release signal is healthy';
  const expectedRecords = summary.tests.filter((test) => test.outcome === 'expectedFailure');

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(summary.product)} Executive Test Report</title>
  <style>
    :root{color-scheme:light dark;--bg:#f6f7f9;--surface:#fff;--alt:#eef1f5;--text:#182033;--muted:#667085;--border:#d9dee7;--accent:#2459d3;--good:#197347;--warn:#9a6700;--bad:#c53030;--info:#2463a7}
    @media(prefers-color-scheme:dark){:root{--bg:#101318;--surface:#181c23;--alt:#222833;--text:#eef2f8;--muted:#aab3c2;--border:#353d49;--accent:#80aaff;--good:#58c28b;--warn:#e6b94c;--bad:#ff7b7b;--info:#79b8ff}}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,"Noto Sans TC","Segoe UI",sans-serif;line-height:1.55}main{width:min(1180px,calc(100% - 32px));margin:auto;padding:42px 0 64px}h1{font-size:clamp(28px,4vw,42px);line-height:1.15;margin:4px 0 10px}h2{font-size:23px;margin:38px 0 14px}p{margin:7px 0}.eyebrow{color:var(--accent);font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.lead{font-size:17px;color:var(--muted);max-width:880px}.meta{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.meta span,.pill{display:inline-block;border:1px solid var(--border);border-radius:999px;padding:3px 9px;background:var(--surface);font-size:12px}.verdict{border-left:5px solid ${releaseBlocked ? 'var(--warn)' : 'var(--good)'};background:var(--surface);border-radius:8px;padding:18px 20px;margin:22px 0}.verdict strong{font-size:22px}.metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.metric{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:15px;min-height:112px}.metric strong{display:block;font-size:30px;line-height:1.15}.metric span{display:block;color:var(--muted);font-size:12px;margin-top:5px}.metric small{color:var(--muted)}.good{color:var(--good)}.warn{color:var(--warn)}.bad{color:var(--bad)}.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.panel{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:18px}.panel h3{margin:0 0 12px}.bar-row{display:grid;grid-template-columns:58px 1fr 38px;gap:10px;align-items:center;margin:10px 0}.track{height:14px;border-radius:999px;background:var(--alt);overflow:hidden}.bar{height:100%;border-radius:inherit;background:var(--info)}table{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--border);font-size:13px}th,td{padding:10px 12px;text-align:left;vertical-align:top;border-bottom:1px solid var(--border)}th{background:var(--alt);font-size:12px}tr:last-child td{border-bottom:0}.subtle{color:var(--muted);font-size:12px;margin-top:3px}.callout{padding:12px 14px;border-left:4px solid var(--info);background:var(--alt);border-radius:4px;margin:12px 0}.callout.warning{border-color:var(--warn)}.callout.danger{border-color:var(--bad)}.pill.normalPass{color:var(--good)}.pill.expectedFailure,.pill.skipped{color:var(--warn)}.pill.unexpectedFailure,.pill.fixCandidate{color:var(--bad)}.pill.flaky{color:var(--info)}code{font-family:"Cascadia Code",Consolas,monospace;font-size:.92em}pre{white-space:pre-wrap;max-height:320px;overflow:auto;background:var(--bg);padding:12px;border-radius:6px}.error-row td{background:var(--alt)}details summary{cursor:pointer;font-weight:600}.coverage strong{font-size:24px;display:block}.footer{margin-top:40px;border-top:1px solid var(--border);padding-top:14px;color:var(--muted);font-size:12px}
    @media(max-width:850px){.metrics{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}table{display:block;overflow:auto}}
    @media print{:root{--bg:#fff;--surface:#fff;--alt:#f2f4f7;--text:#111827;--muted:#4b5563;--border:#d1d5db}main{width:100%;padding:0}.panel,.metric,table{break-inside:avoid}details{display:block}details>summary{display:none}details>*{display:block}}
  </style>
</head>
<body>
<main>
  <header>
    <div class="eyebrow">Executive test report · 管理型測試報告</div>
    <h1>${escapeHtml(summary.product)} ${escapeHtml(summary.sutVersion)}</h1>
    <p class="lead">Separates healthy passes, expected defect evidence, blocked coverage, regressions, fix candidates and flaky outcomes. This is a release-decision summary; use the Playwright HTML report for step-level debugging.</p>
    <div class="meta">
      <span>Started ${escapeHtml(summary.startedAt)}</span>
      <span>Duration ${formatDuration(summary.durationMs)}</span>
      <span>Commit ${escapeHtml(summary.commit)}</span>
      <span>Projects ${escapeHtml(summary.projects.join(', '))}</span>
      <span>Base URL ${escapeHtml(summary.baseURL)}</span>
    </div>
  </header>

  <div class="verdict">
    <strong>${escapeHtml(verdict)}</strong>
    <p>Playwright run status: <code>${escapeHtml(summary.playwrightStatus)}</code>. Expected failures are evidence that known defects remain; they are not healthy passes.</p>
  </div>

  <section>
    <h2>Execution outcomes / 執行結果</h2>
    <div class="metrics">${renderOutcomeRows(summary)}</div>
    <div class="callout warning"><strong>${expectedRecords.length}</strong> expected-failure executions reference <strong>${summary.uniqueDefects.length}</strong> unique DEF IDs. Failure signatures are not automatically verified unless each test constrains its defect assertion.</div>
  </section>

  <section>
    <h2>Coverage and product health / 覆蓋與產品狀態</h2>
    <div class="grid">
      <div class="panel coverage">
        <h3>PRD requirement coverage</h3>
        <div class="grid">
          <div><strong>${coverage.mapped} / ${coverage.total}</strong><span>Mapped (${percent(coverage.mapped, coverage.total)})</span></div>
          <div><strong>${coverage.executable} / ${coverage.total}</strong><span>Nominal executable (${percent(coverage.executable, coverage.total)})</span></div>
          <div><strong>${coverage.conforming} / ${coverage.total}</strong><span>Positive unblocked evidence (${percent(coverage.conforming, coverage.total)})</span></div>
          <div><strong>Unknown</strong><span>Source-code coverage</span></div>
        </div>
        <p class="subtle">${escapeHtml(coverage.note)}</p>
      </div>
      <div class="panel">
        <h3>Defect log snapshot</h3>
        <div class="grid">
          <div><strong>${summary.defects.unresolved ?? 'Unknown'}</strong><div class="subtle">Open / Confirmed</div></div>
          <div><strong>${summary.defects.verified ?? 'Unknown'}</strong><div class="subtle">Verified</div></div>
          <div><strong>${summary.defects.severity.S2 ?? 'Unknown'}</strong><div class="subtle">Unresolved S2</div></div>
          <div><strong>${summary.uniqueDefects.length}</strong><div class="subtle">DEF IDs evidenced this run</div></div>
        </div>
      </div>
    </div>
  </section>

  <section>
    <h2>Test distribution / 測試分層</h2>
    <div class="panel">${renderLayerBars(summary)}
      <p class="subtle">${summary.logicalCaseIds.length} logical case IDs observed across ${summary.counts.total} Playwright executions.</p>
    </div>
  </section>

  ${renderAttentionSections(summary)}

  <section>
    <h2>Known-defect evidence / 已知缺陷證據</h2>
    <div class="callout warning">One defect may be validated by multiple tests. These rows show unique DEF IDs separately from execution count.</div>
    <table>
      <thead><tr><th>DEF</th><th>Executions</th><th>Affected tests</th></tr></thead>
      <tbody>${renderDefectRows(summary)}</tbody>
    </table>
  </section>

  <section>
    <h2>All executions / 全部案例</h2>
    <details>
      <summary>Show ${summary.tests.length} test executions</summary>
      <table>
        <thead><tr><th>Outcome</th><th>Layer</th><th>Test</th><th>DEF</th><th>Duration</th></tr></thead>
        <tbody>${renderTestRows(summary.tests)}</tbody>
      </table>
    </details>
  </section>

  ${
    summary.globalErrors.length
      ? `<section><h2>Global errors</h2><pre>${escapeHtml(summary.globalErrors.join('\n\n'))}</pre></section>`
      : ''
  }

  <div class="footer">
    Generated ${escapeHtml(summary.generatedAt)} by tests/reporters/executive-reporter.ts. Machine-readable data: summary.json.
  </div>
</main>
</body>
</html>`;
}

export default class ExecutiveReporter implements Reporter {
  private config: FullConfig | undefined;
  private suite: Suite | undefined;
  private startedAt = new Date();
  private globalErrors: string[] = [];

  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.suite = suite;
    this.startedAt = new Date();
  }

  onError(error: TestError): void {
    this.globalErrors.push(error.message || error.value || error.stack || 'Unknown global error');
  }

  onEnd(result: FullResult): void {
    if (!this.config || !this.suite) return;
    const tests = this.suite.allTests().map(recordFor);
    const counts: ExecutiveSummary['counts'] = {
      total: tests.length,
      normalPass: 0,
      expectedFailure: 0,
      skipped: 0,
      unexpectedFailure: 0,
      fixCandidate: 0,
      flaky: 0,
    };
    const layers: ExecutiveSummary['layers'] = { API: 0, UI: 0, Flow: 0, Other: 0 };
    for (const test of tests) {
      counts[test.outcome] += 1;
      layers[test.layer] += 1;
    }
    const uniqueDefects = [...new Set(tests.flatMap((test) => test.defectIds))].sort();
    const logicalCaseIds = [
      ...new Set(
        this.suite
          .allTests()
          .flatMap((test) => caseIdsFor(test)),
      ),
    ].sort();
    const baseURL = String(this.config.projects[0]?.use.baseURL || 'not configured');
    const summary: ExecutiveSummary = {
      generatedAt: new Date().toISOString(),
      startedAt: this.startedAt.toISOString(),
      durationMs: Date.now() - this.startedAt.getTime(),
      playwrightStatus: result.status,
      commit: readGitCommit(),
      product: EXECUTIVE_REPORT_CONFIG.product,
      sutVersion: process.env.SUT_VERSION || EXECUTIVE_REPORT_CONFIG.sutVersion,
      baseURL,
      projects: this.config.projects.map((project) => project.name),
      counts,
      layers,
      uniqueDefects,
      logicalCaseIds,
      defects: readDefectSummary(),
      requirementCoverage: EXECUTIVE_REPORT_CONFIG.requirementCoverage,
      globalErrors: this.globalErrors,
      tests,
    };

    const outputDir = resolve(EXECUTIVE_REPORT_CONFIG.outputDir);
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    writeFileSync(join(outputDir, 'index.html'), renderHtml(summary), 'utf8');

    const relativeOutput = relative(process.cwd(), outputDir).replaceAll('\\', '/');
    process.stdout.write(`\nExecutive report: ${relativeOutput}/index.html\n`);
  }
}
