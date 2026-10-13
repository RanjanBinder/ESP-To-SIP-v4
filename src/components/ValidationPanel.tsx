import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from '../store/editorStore';
import { useSODStore } from '../store/sodStore';
import { runSODValidation } from '../lib/validation/sodValidator';
import { runPdfSODValidation } from '../lib/validation/pdfSodValidator';
import { runAdditionalValidations } from '../lib/validation/validationSources';
import { adaptSOD, displayValue, resultCount, validationCategories, validationStatuses, ValidationResult, ValidationStatus } from '../lib/validation/validationModel';
import { boundsOf } from '../lib/track/sceneQueries';
import './ValidationPanel.css';

type Filters = { search: string; status: string; severity: string; track: string; asset: string; type: string };
const emptyFilters: Filters = { search: '', status: '', severity: '', track: '', asset: '', type: '' };
const count = (results: ValidationResult[]) => results.reduce((n, r) => n + resultCount(r), 0);

export function ValidationIssueCard({ result: r, selected, onSelect }: { result: ValidationResult; selected: boolean; onSelect: () => void }) {
  const status = validationStatuses[r.status];
  return <button className="validation-card" aria-pressed={selected} onClick={onSelect}>
    <span className="validation-status" style={{ color: status.color }}><span aria-hidden="true">{status.icon}</span> {status.label}{r.severity ? ` · ${r.severity}` : ''}</span>
    <strong>{r.ruleId} · {r.ruleName}</strong>
    <span>{[r.trackName ?? r.trackId, r.metadata?.assetName as string ?? r.assetIds?.join(' → '), r.chainage != null ? `Ch: ${r.chainage} m` : r.startChainage != null ? `Ch: ${r.startChainage}–${r.endChainage ?? '?'} m` : undefined].filter(Boolean).join(' | ') || 'Layout-wide check'}</span>
  </button>;
}

export default function ValidationPanel() {
  const { objects, selectObjects, selectObject, getLayer } = useEditor();
  const sod = useSODStore();
  const { checkResult, setCheckResult, additionalResults, setAdditionalResults, selectedValidation, setSelectedValidation, activeViolationId, setActiveViolation, requestFocus, setPanelOpen } = sod;
  const [category, setCategory] = useState('all');
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState('Details');
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [notice, setNotice] = useState('');
  const [review, setReview] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const initialized = useRef(false);
  const lastAdditionalRun = useRef<string | undefined>(undefined);

  // Existing automatic SOD entry points continue to feed this panel.
  useEffect(() => {
    if (!checkResult || lastAdditionalRun.current === checkResult.ranAt) return;
    lastAdditionalRun.current = checkResult.ranAt;
    if (checkResult) setAdditionalResults([...additionalResults.filter(r => !['gradient_continuity', 'track_geometry', 'asset_completeness'].includes(r.validationType)), ...runAdditionalValidations(objects)]);
    // Scene edits deliberately retain the previous run until the user reruns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkResult?.ranAt]);
  const results = useMemo(() => Array.from(new Map([...adaptSOD(checkResult, objects), ...additionalResults].map(r => [r.id, r])).values()), [checkResult, objects, additionalResults]);
  const assetNames = useMemo(() => new Map(objects.map(o => [o.id, o.name])), [objects]);
  const categories = useMemo(() => [...validationCategories, ...Array.from(new Set(results.map(r => r.validationType))).filter(id => !validationCategories.some(c => c.id === id)).map(id => ({ id, label: id, name: id, icon: '◇' }))], [results]);
  const selected = results.find(r => r.id === selectedId);
  useEffect(() => {
    if (activeViolationId && results.some(r => r.id === activeViolationId)) {
      setSelectedId(activeViolationId); setDetailOpen(true);
      setSelectedValidation(results.find(r => r.id === activeViolationId)!);
    }
    // Only respond to canvas selection, not to result identity churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeViolationId]);
  useEffect(() => {
    if (selectedId && !selected) { setSelectedId(null); setDetailOpen(false); setSelectedValidation(null); }
    else if (selected && selectedValidation?.id === selected.id) setSelectedValidation(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkResult, additionalResults]);
  useEffect(() => {
    if (!initialized.current && results.length) {
      const first = results.find(r => ['failed', 'warning', 'needs_review'].includes(r.status));
      setExpanded(first ? { [first.validationType]: true } : {}); initialized.current = true;
    }
  }, [results]);
  const categoryResults = useMemo(() => results.filter(r => category === 'all' || r.validationType === category), [results, category]);
  const filtered = useMemo(() => categoryResults.filter(r => {
    const haystack = [r.ruleId, r.ruleName, r.message, r.trackId, r.trackName, r.assetIds?.join(' '), r.assetIds?.map(id => assetNames.get(id)).join(' '), r.chainage, r.startChainage, r.endChainage, r.metadata?.assetName].join(' ').toLowerCase();
    return (!filters.search || haystack.includes(filters.search.toLowerCase())) &&
      (!filters.status || r.status === filters.status) && (!filters.severity || r.severity === filters.severity) &&
      (!filters.track || (r.trackId ?? r.trackName) === filters.track) && (!filters.asset || r.assetType === filters.asset) && (!filters.type || r.validationType === filters.type);
  }), [categoryResults, filters, assetNames]);
  const groups = useMemo(() => categories.map(c => ({ ...c, items: filtered.filter(r => r.validationType === c.id) })).filter(c => c.items.length), [filtered, categories]);
  const setFilter = (key: keyof Filters, value: string) => { setLimits({}); setFilters(f => ({ ...f, [key]: value })); }; 
  const tracks = useMemo(() => Array.from(new Set(results.map(r => r.trackId ?? r.trackName).filter(Boolean))) as string[], [results]);
  const assetTypes = useMemo(() => Array.from(new Set(results.map(r => r.assetType).filter(Boolean))) as string[], [results]);
  const dirty = category !== 'all' || Object.values(filters).some(Boolean);

  const locate = (r: ValidationResult, zoom = true) => {
    const assets = objects.filter(o => r.assetIds?.includes(o.id));
    selectObjects(assets.map(a => a.id)); setSelectedValidation(r); setActiveViolation(r.validationType === 'sod' ? r.id : null);
    const hidden = assets.some(a => !a.visible || !getLayer(a.layerId)?.visible);
    const missing = (r.assetIds?.length ?? 0) > assets.length;
    setNotice(missing ? 'Some affected assets were deleted. Rerun validation.' : hidden ? 'Affected assets are hidden. Temporary outlines show their location; enable their layers to edit them.' : '');
    if (!zoom) return;
    if (assets.length) {
      const bounds = assets.map(boundsOf);
      const left = Math.min(...bounds.map(b => b.x));
      const top = Math.min(...bounds.map(b => b.y));
      const right = Math.max(...bounds.map(b => b.x + b.width));
      const bottom = Math.max(...bounds.map(b => b.y + b.height));
      requestFocus((left + right) / 2, (top + bottom) / 2, Math.max(0.05, Math.min(2.5, Math.max(160, window.innerWidth - 650) / (right - left + 160), Math.max(160, window.innerHeight - 220) / (bottom - top + 160))));
    } else if (typeof r.metadata?.canvasX === 'number' && typeof r.metadata?.canvasY === 'number') requestFocus(r.metadata.canvasX, r.metadata.canvasY, 2);
  };
  const choose = (r: ValidationResult) => { setSelectedId(r.id); setDetailOpen(true); setDetailTab('Details'); locate(r); };
  const run = async (scope: 'all' | 'rule' | 'asset' = 'all') => {
    if (runningRef.current) return;
    runningRef.current = true; setRunning(true); setNotice('');
    try {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const pdfAnchor = objects.find(o => o.sod?.sourceKind === 'pdf' && o.sod.sourceDrawingRef);
      const pdfFile = checkResult?.sourceKind === 'pdf' ? checkResult.sourceFileName : !checkResult ? pdfAnchor?.sod?.sourceDrawingRef : undefined;
      const pdfImage = objects.find(o => o.type === 'image' && o.sourceFileName === pdfFile);
      const nextSOD = pdfFile ? runPdfSODValidation(objects, { fileName: pdfFile, sourceUrl: checkResult?.sourceUrl ?? (pdfImage?.type === 'image' ? pdfImage.src : ''), page: checkResult?.sourcePage ?? pdfAnchor?.sod?.sourcePage }) : runSODValidation(objects, checkResult?.source ?? 'editor');
      const fresh = runAdditionalValidations(objects);
      // Neighbour-dependent rules evaluate the full track, then refresh the
      // selected category or affected assets. SOD keeps its legacy source-wide
      // snapshot consistent with canvas markers and PDF validation callers.
      const inScope = (r: ValidationResult) => scope === 'all' || !selected ||
        (scope === 'rule' ? r.validationType === selected.validationType : r.assetIds?.some(id => selected.assetIds?.includes(id)));
      const gradients = scope === 'all' ? fresh : [...additionalResults.filter(r => ['gradient_continuity', 'track_geometry', 'asset_completeness'].includes(r.validationType) && !inScope(r)), ...fresh.filter(inScope)];
      lastAdditionalRun.current = nextSOD.ranAt;
      setCheckResult(nextSOD); setAdditionalResults([...additionalResults.filter(r => !['gradient_continuity', 'track_geometry', 'asset_completeness'].includes(r.validationType)), ...gradients]);
      setNotice(`Validation completed · ${count(adaptSOD(nextSOD, objects)) + count(gradients)} results`);
    } catch (e) { setNotice(`Validation failed: ${e instanceof Error ? e.message : String(e)}`); }
    finally { runningRef.current = false; setRunning(false); }
  };
  const openProperties = (r: ValidationResult, id?: string) => {
    const asset = objects.find(o => o.id === (id ?? r.assetIds?.[0]));
    if (!asset) { setNotice('Affected asset no longer exists. Rerun validation.'); return; }
    if (asset.locked || asset.sod?.sourceKind === 'pdf' || !asset.visible || !getLayer(asset.layerId)?.visible) { setNotice('This asset is locked, hidden or a PDF source anchor. Enable its layer or edit its source drawing, then rerun validation.'); return; }
    selectObject(asset.id); setPanelOpen(false);
  };

  return <div className={`validation-center ${detailOpen && selected ? 'show-detail' : ''}`}>
    <div className="validation-top">
      <button className="validation-primary" disabled={running} onClick={() => void run()}>{running ? 'Running…' : 'Run Validation'}</button>
      <div className="validation-tabs" role="tablist" aria-label="Validation categories">
        {[{ id: 'all', label: 'All', name: 'All', icon: '' }, ...categories.slice(0, 4)].map(c => <button key={c.id} role="tab" aria-selected={category === c.id} onClick={() => { setCategory(c.id); setDetailOpen(false); if (c.id !== 'all') setExpanded(e => ({ ...e, [c.id]: true })); }}>{c.label} ({count(results.filter(r => c.id === 'all' || r.validationType === c.id))})</button>)}
        <select aria-label="More validation categories" value={categories.slice(4).some(c => c.id === category) ? category : ''} onChange={e => { if (e.target.value) { setCategory(e.target.value); setDetailOpen(false); setExpanded(s => ({ ...s, [e.target.value]: true })); } }}><option value="">More ({count(results.filter(r => categories.slice(4).some(c => c.id === r.validationType)))})</option>{categories.slice(4).map(c => <option key={c.id} value={c.id}>{c.label} ({count(results.filter(r => r.validationType === c.id))})</option>)}</select>
      </div>
      <div className="validation-summary">
        {['total', 'passed', 'failed', 'warning', 'needs_review', 'not_applicable'].map(key => {
          const s = key === 'total' ? { label: 'Total', color: '#374151', icon: 'Σ' } : validationStatuses[key as ValidationStatus];
          return <button key={key} aria-pressed={filters.status === (key === 'total' ? '' : key)} style={{ color: s.color }} onClick={() => { setFilter('status', key === 'total' || filters.status === key ? '' : key); setDetailOpen(false); }}><strong>{count(categoryResults.filter(r => key === 'total' || r.status === key))}</strong><span>{s.icon} {s.label}</span></button>;
        })}
      </div>
      <input aria-label="Search validation results" placeholder="Search rule ID, rule name, track, asset, chainage..." value={filters.search} onChange={e => setFilter('search', e.target.value)} />
      <details className="validation-filters"><summary>Filters{dirty ? ' · Applied' : ''}</summary><div>
        <label>Status<select value={filters.status} onChange={e => setFilter('status', e.target.value)}><option value="">All statuses</option>{Object.entries(validationStatuses).map(([value, s]) => <option key={value} value={value}>{s.label}</option>)}</select></label>
        <label>Severity<select value={filters.severity} onChange={e => setFilter('severity', e.target.value)}><option value="">All severities</option>{['critical', 'major', 'minor', 'info'].map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Track<select value={filters.track} onChange={e => setFilter('track', e.target.value)}><option value="">All tracks</option>{tracks.map(s => <option key={s} value={s}>{results.find(r => (r.trackId ?? r.trackName) === s)?.trackName ?? s}</option>)}</select></label>
        <label>Asset Type<select value={filters.asset} onChange={e => setFilter('asset', e.target.value)}><option value="">All asset types</option>{assetTypes.map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Validation Type<select value={filters.type} onChange={e => setFilter('type', e.target.value)}><option value="">All validation types</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      </div></details>
      {dirty && <button onClick={() => { setFilters(emptyFilters); setCategory('all'); }}>Clear filters</button>}
      {checkResult?.sourceKind === 'pdf' && <div className="validation-source">{checkResult.sourceFileName} · Page {checkResult.sourcePage ?? 1}{checkResult.sourceUrl && <a href={checkResult.sourceUrl} target="_blank" rel="noreferrer"> Open PDF</a>}</div>}
      <div role="status" aria-label="Validation activity" className="validation-notice">{notice}</div>
    </div>
    <div className="validation-content">
      <div className="validation-list">
        {!checkResult && !results.length && <p>No validation has been run yet.</p>}
        {(checkResult || results.length > 0) && !results.length && <p>No applicable rules found for this layout.</p>}
        {results.length > 0 && !filtered.length && <p>{!categoryResults.length && !Object.values(filters).some(Boolean) ? 'No applicable rules found for this layout.' : 'No validation results match the current filters.'}</p>}
        {filtered.length > 0 && categoryResults.every(r => r.status === 'passed' || r.status === 'not_applicable') && categoryResults.some(r => r.status === 'passed') && <p className="validation-success">✓ All applicable validations passed.</p>}
        {filtered.length > 0 && categoryResults.every(r => r.status === 'not_applicable') && <p>No applicable rules found for this layout.</p>}
        {groups.map(g => <section key={g.id}>
          <button className="validation-group" aria-expanded={!!expanded[g.id]} onClick={() => setExpanded(s => ({ ...s, [g.id]: !s[g.id] }))}><strong>{expanded[g.id] ? '▾' : '▸'} {g.icon} {g.name} ({count(g.items)})</strong><span>{Object.entries(validationStatuses).filter(([status]) => g.items.some(r => r.status === status)).map(([status, s]) => `${count(g.items.filter(r => r.status === status))} ${s.label}`).join(' | ')}</span></button>
          {expanded[g.id] && <>{g.items.slice(limits[g.id] ?? 0, (limits[g.id] ?? 0) + 50).map(r => <ValidationIssueCard key={r.id} result={r} selected={selectedId === r.id} onSelect={() => choose(r)} />)}{g.items.length > 50 && <div className="validation-pagination"><button disabled={(limits[g.id] ?? 0) === 0} onClick={() => setLimits(s => ({ ...s, [g.id]: Math.max(0, (s[g.id] ?? 0) - 50) }))}>Previous</button><span>{(limits[g.id] ?? 0) + 1}{'\u2013'}{Math.min((limits[g.id] ?? 0) + 50, g.items.length)} of {g.items.length}</span><button disabled={(limits[g.id] ?? 0) + 50 >= g.items.length} onClick={() => setLimits(s => ({ ...s, [g.id]: (s[g.id] ?? 0) + 50 }))}>Next 50</button></div>}</>}
        </section>)}
      </div>
      {selected && <div className="validation-detail" style={{ display: detailOpen ? undefined : 'none' }}>
        <button onClick={() => setDetailOpen(false)}>← Back to results</button>
        <h3>{selected.ruleId} · {selected.ruleName}</h3>
        <div className="validation-tabs" role="tablist" aria-label="Issue detail sections">{['Details', 'Affected Assets', 'Rule Info', 'Comments'].map(t => <button key={t} role="tab" aria-selected={detailTab === t} onClick={() => setDetailTab(t)}>{t}</button>)}</div>
        {detailTab === 'Details' && <dl>{[
          ['Rule ID', selected.ruleId], ['Rule name', selected.ruleName], ['Validation type', categories.find(c => c.id === selected.validationType)?.name],
          ['Status', validationStatuses[selected.status].label], ['Severity', selected.severity], ['Track', selected.trackName ?? selected.trackId], ['Asset', selected.assetIds?.join(' → ')],
          ['Chainage / range (m)', selected.chainage ?? (selected.startChainage == null ? undefined : `${selected.startChainage} → ${selected.endChainage ?? 'End'}`)],
          ['Expected value / From right', selected.expectedValue], ['Actual value / To left', selected.actualValue], ['Validation message', selected.message], ['Suggested action', selected.suggestedAction], ['Source / reference', selected.source],
          ...(selected.validationType === 'gradient_continuity' ? [['From Gradient Point', selected.metadata?.fromGradientPointId], ['From Chainage (m)', selected.metadata?.fromChainage], ['To Gradient Point', selected.metadata?.toGradientPointId], ['To Chainage (m)', selected.metadata?.toChainage], ['Expected condition', 'Outgoing/right gradient equals incoming/left gradient on the same track.'], ['Difference (signed slope)', selected.metadata?.difference]] : []),
        ].map(([label, value]) => <React.Fragment key={String(label)}><dt>{String(label)}</dt><dd>{displayValue(value)}</dd></React.Fragment>)}</dl>}
        {detailTab === 'Affected Assets' && <div>{!selected.assetIds?.length && <p>This is a layout-wide or legacy aggregate check.</p>}{selected.assetIds?.map(id => { const asset = objects.find(o => o.id === id); return <p key={id}>{asset?.name ?? id}{!asset ? ' (deleted)' : ''} <button disabled={!asset} onClick={() => openProperties(selected, id)}>Open Properties</button></p>; })}</div>}
        {detailTab === 'Rule Info' && <div><p>{selected.ruleId} · {selected.ruleName}</p><p>{selected.validationType === 'gradient_continuity' ? 'The gradient on the right side of one gradient change point must match the gradient on the left side of the next consecutive gradient change point on the same track.' : selected.expectedValue != null ? `Expected: ${displayValue(selected.expectedValue)}` : selected.message}</p><p>{selected.source}</p></div>}
        {detailTab === 'Comments' && <label>Session notes<textarea value={comments[selected.id] ?? ''} onChange={e => setComments(s => ({ ...s, [selected.id]: e.target.value }))} placeholder="Add a review note…" /></label>}
        {review[selected.id] && <p>⚑ Marked for review (session annotation; validation result unchanged).</p>}
        <footer className="validation-actions"><button onClick={() => locate(selected)}>Zoom to Issue</button><button onClick={() => locate(selected, false)}>Highlight Assets</button><button disabled={!selected.assetIds?.length} onClick={() => openProperties(selected)}>Open Properties</button><button onClick={() => setReview(s => ({ ...s, [selected.id]: !s[selected.id] }))}>{review[selected.id] ? 'Remove Review Mark' : 'Mark for Review'}</button><button disabled={running} title="Refreshes this validation category; SOD also refreshes its complete source snapshot" onClick={() => void run('rule')}>Re-run selected rule</button><button disabled={running || !selected.assetIds?.length} title="Rechecks affected assets and their neighbouring points; SOD also refreshes its complete source snapshot" onClick={() => void run('asset')}>Re-run selected assets</button><button onClick={() => { selectObjects([]); setSelectedValidation(null); setActiveViolation(null); setSelectedId(null); setDetailOpen(false); }}>Clear selection</button></footer>
      </div>}
    </div>
  </div>;
}
