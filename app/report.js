// Nutrient report used on the food screen and for each diary day:
// energy ring, macro targets, highlighted targets, nutrient scores and the
// full grouped summary. Every nutrient row can be tapped for an explanation.

const Report = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MACRO_COLORS = { protein: 'var(--c-protein)', netcarbs: 'var(--c-carbs)', fat: 'var(--c-fat)', alcohol: 'var(--c-alcohol)' };

  // Remember which sections are open (per device, best effort).
  function isOpen(id, def) {
    try { const v = localStorage.getItem('dp-open-' + id); return v == null ? def : v === '1'; } catch (_) { return def; }
  }
  function rememberOpen(id, open) {
    try { localStorage.setItem('dp-open-' + id, open ? '1' : '0'); } catch (_) {}
  }

  function section(id, title, body, defOpen = true) {
    return `<details class="rsec" data-sec="${id}" ${isOpen(id, defOpen) ? 'open' : ''}>
      <summary><span>${title}</span><span class="chev" aria-hidden="true"></span></summary>
      <div class="rsec-body">${body}</div></details>`;
  }

  const pctOf = (v, g) => (g ? (v / g) * 100 : null);

  function bar(n, v, goal, opts = {}) {
    const pct = pctOf(v || 0, goal);
    const over = pct != null && pct > 100;
    const cls = over && (n.limit || n.key === 'kcal') ? 'bad' : '';
    const color = opts.color ? `style="width:${Math.min(100, pct || 0)}%;background:${opts.color}"` : `style="width:${Math.min(100, pct || 0)}%"`;
    return `<button type="button" class="nrow ind${n.indent || 0}${opts.compact ? ' compact' : ''}" data-info="${n.key}">
      <span class="nrow-top"><span class="nname">${esc(opts.label || n.label)}${opts.compact ? '' : ` <span class="namt">${fmt(v, n.unit)} / ${fmt(goal, n.unit)} ${n.unit}</span>`}${n.limit && !opts.compact ? ' <span class="nlimit">max</span>' : ''}</span>
      <span class="npct ${cls}">${pct == null ? '' : Math.round(pct) + '%'}</span></span>
      <span class="ntrack"><span class="nfill ${cls}" ${color}></span></span></button>`;
  }

  function plain(n, v) {
    return `<button type="button" class="nrow plain ind${n.indent || 0}" data-info="${n.key}">
      <span class="nrow-top"><span class="nname">${esc(n.label)}</span><span class="namt">${v == null ? 'not listed' : fmt(v, n.unit) + ' ' + n.unit}</span></span></button>`;
  }

  function ring(t) {
    const parts = [
      ['protein', 'Protein', (t.protein || 0) * 4, t.protein],
      ['netcarbs', 'Net carbs', (t.netcarbs || 0) * 4, t.netcarbs],
      ['fat', 'Fat', (t.fat || 0) * 9, t.fat],
      ['alcohol', 'Alcohol', (t.alcohol || 0) * 7, t.alcohol],
    ].filter(p => p[2] > 0 || p[0] !== 'alcohol');
    const total = parts.reduce((a, p) => a + p[2], 0);
    const R = 52, C = 2 * Math.PI * R;
    let offset = 0;
    const arcs = total ? parts.map(([k, , kcal]) => {
      const len = (kcal / total) * C;
      const gap = len > 4 ? 2 : 0;
      const s = `<circle r="${R}" cx="64" cy="64" fill="none" stroke="${MACRO_COLORS[k]}" stroke-width="14" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-offset}" transform="rotate(-90 64 64)"/>`;
      offset += len;
      return s;
    }).join('') : `<circle r="${R}" cx="64" cy="64" fill="none" stroke="var(--track)" stroke-width="14"/>`;
    const legend = parts.map(([k, label, kcal, g]) => `<button type="button" class="legend-row" data-info="${k}">
        <span class="dot" style="background:${MACRO_COLORS[k]}"></span>
        <span>${label} <span class="hint">${total ? Math.round((kcal / total) * 100) : 0}%</span></span>
        <strong>${fmt(g || 0, 'g')} g</strong></button>`).join('');
    return `<div class="energy">
      <svg viewBox="0 0 128 128" class="ring" role="img" aria-label="${fmt(t.kcal || 0, 'kcal')} kcal">
        ${arcs}<text x="64" y="62" text-anchor="middle" class="ring-num">${fmt(t.kcal || 0, 'kcal')}</text>
        <text x="64" y="80" text-anchor="middle" class="ring-unit">kcal</text></svg>
      <div class="legend">${legend}<p class="hint">Share of calories from each source.</p></div></div>`;
  }

  function scores(t, goals) {
    const groups = [['All targets', null], ['Vitamins', 'Vitamins'], ['Minerals', 'Minerals'], ['Amino acids', 'Protein']];
    const rows = groups.map(([label, g]) => {
      const list = NUTRIENTS.filter(n => (!g || n.group === g) && goals[n.key] && !n.limit && t[n.key] != null && (g !== 'Protein' || n.indent));
      if (!list.length) return '';
      const avg = list.reduce((a, n) => a + Math.min(100, (t[n.key] / goals[n.key]) * 100), 0) / list.length;
      return `<div class="score"><span class="nrow-top"><span class="nname">${label}</span><span class="npct">${Math.round(avg)}%</span></span>
        <span class="ntrack"><span class="nfill" style="width:${Math.min(100, avg)}%"></span></span>
        <span class="hint">average of ${list.length} target${list.length > 1 ? 's' : ''} this lists (each capped at 100%)</span></div>`;
    }).join('');
    return rows || '<p class="hint">Not enough nutrient data for scores.</p>';
  }

  // render(el, totals, {goals, showMissing, sections})
  function render(el, rawTotals, opts = {}) {
    const goals = opts.goals || {};
    const t = withDerived(rawTotals || {});
    const sections = opts.sections || ['energy', 'macros', 'highlight', 'scores', 'full'];
    const html = [];
    if (sections.includes('energy')) html.push(section('energy', 'Energy summary', ring(t)));
    if (sections.includes('macros')) {
      const macro = [['kcal', 'Energy', 'var(--accent)'], ['protein', 'Protein', MACRO_COLORS.protein], ['netcarbs', 'Net carbs', MACRO_COLORS.netcarbs], ['fat', 'Fat', MACRO_COLORS.fat]];
      html.push(section('macros', 'Macronutrient targets', macro.map(([k, label, color]) => {
        const goal = k === 'netcarbs' ? goals.carbs : goals[k];
        return bar(NUTRIENT_BY_KEY[k], t[k] || 0, goal, { label, color });
      }).join('')));
    }
    if (sections.includes('highlight')) {
      const list = HIGHLIGHTED.filter(k => t[k] != null && goals[k]);
      html.push(section('highlight', 'Highlighted targets', list.length
        ? `<div class="hgrid">${list.map(k => bar(NUTRIENT_BY_KEY[k], t[k], goals[k], { compact: true })).join('')}</div>`
        : '<p class="hint">This food doesn\'t list these vitamins and minerals.</p>'));
    }
    if (sections.includes('scores')) html.push(section('scores', 'Nutrient scores', scores(t, goals), false));
    if (sections.includes('full')) {
      const body = NUTRIENT_GROUPS.map(g => {
        const rows = NUTRIENTS.filter(n => n.group === g && (opts.showMissing || t[n.key] != null))
          .map(n => (goals[n.key] && t[n.key] != null ? bar(n, t[n.key], goals[n.key]) : plain(n, t[n.key]))).join('');
        return rows ? `<h4 class="rgroup">${g}</h4>${rows}` : '';
      }).join('');
      const listed = NUTRIENTS.filter(n => !n.derived && rawTotals && rawTotals[n.key] != null).length;
      html.push(section('full', 'Complete nutrient summary', `${body}
        <label class="inline hint showmissing"><input type="checkbox" ${opts.showMissing ? 'checked' : ''} data-showmissing> Show nutrients not listed (${NUTRIENTS.filter(n => !n.derived).length - listed})</label>
        <p class="hint">Tap any nutrient to learn what it is and why it matters.</p>`));
    }
    el.innerHTML = html.join('');
    el.querySelectorAll('details.rsec').forEach(d => d.addEventListener('toggle', () => rememberOpen(d.dataset.sec, d.open)));
    el.querySelectorAll('[data-info]').forEach(b => b.addEventListener('click', () => showInfo(b.dataset.info, t, goals)));
    const sm = el.querySelector('[data-showmissing]');
    if (sm) sm.addEventListener('change', () => render(el, rawTotals, { ...opts, showMissing: sm.checked }));
  }

  // ---------- info sheet ----------
  function showInfo(key, totals, goals) {
    const n = NUTRIENT_BY_KEY[key] || { key, label: key === 'netcarbs' ? 'Net carbs' : key, unit: 'g' };
    const info = NUTRIENT_INFO[key];
    const d = document.getElementById('info-dialog');
    const goal = key === 'netcarbs' ? null : goals && goals[key];
    const v = totals && totals[key];
    document.getElementById('info-title').textContent = n.label;
    document.getElementById('info-body').innerHTML = `
      <p class="hint">${v != null ? `Here: <strong>${fmt(v, n.unit)} ${n.unit}</strong>` : 'Not listed for this food'}${goal ? ` · Your daily ${n.limit ? 'limit' : 'target'}: <strong>${fmt(goal, n.unit)} ${n.unit}</strong>` : ''}</p>
      ${info ? `<h3>What it is</h3><p>${esc(info.what)}</p><h3>Why it matters</h3><p>${esc(info.why)}</p>
      <h3>Sources</h3><ul class="srcs">${info.sources.map(([label, url]) => `<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a></li>`).join('')}</ul>` : '<p>No description yet.</p>'}
      <p class="hint disclaimer">${esc(NUTRIENT_INFO_DISCLAIMER)}</p>`;
    if (!d.open) d.showModal();
  }

  return { render, showInfo };
})();
