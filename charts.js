(function () {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const nf = (x, dec = 0) => Number(x).toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const pct = (x, dec = 1) => (x == null || isNaN(x) ? '—' : nf(x * 100, dec) + ' %');
  const C = { s1: 'var(--series-1)', s2: 'var(--series-2)', s3: 'var(--series-3)', plan: 'var(--plan)', axis: 'var(--axis)', grid: 'var(--grid)', base: 'var(--base)', ink: 'var(--ink)', ink2: 'var(--ink-2)', ink3: 'var(--ink-3)', crit: 'var(--crit)' };
  const M = { l: 100, r: 120 };

  const niceMax = (v) => {
    const p = Math.pow(10, Math.floor(Math.log10(v || 1)));
    return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((k) => k * p).find((k) => k >= v) || v;
  };
  const tip = (title, body) => 'data-tip="' + esc(title) + '" data-tipbody="' + esc(body || '') + '"';

  function timeAxis({ w, h, shiftStart, top, bottom }) {
    const X = (t) => M.l + (t / 480) * (w - M.l - M.r);
    let s = '';
    for (let t = 0; t <= 480; t += 60) {
      s += '<line x1="' + X(t) + '" x2="' + X(t) + '" y1="' + top + '" y2="' + bottom + '" stroke="' + C.grid + '" stroke-width="1"/>';
      s += '<text x="' + X(t) + '" y="' + (bottom + 16) + '" text-anchor="middle" font-size="12" fill="' + C.ink3 + '">' + DATA.clockLabel(shiftStart + t) + '</text>';
    }
    return { X, s };
  }

  function cumulative({ w = 760, h = 230, sh, selLot }) {
    const top = 14, bottom = h - 26;
    const { X, s: ax } = timeAxis({ w, h, shiftStart: DATA.SHIFTS[sh.s].start, top, bottom });
    let acc = 0;
    const pts = [[0, 0]].concat(sh.buckets.map((b) => { acc += b.good; return [b.t + 10, acc]; }));
    const proj = sh.live ? sh.projection * sh.plan : null;
    const max = niceMax(Math.max(sh.plan, acc, proj || 0) * 1.05);
    const Y = (v) => bottom - (v / max) * (bottom - top);
    let g = ax;
    [0, 0.5, 1].forEach((k) => {
      const v = max * k;
      g += '<text x="' + (M.l - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="12" fill="' + C.ink3 + '">' + nf(v) + '</text>';
    });
    g += '<line x1="' + M.l + '" x2="' + X(480) + '" y1="' + bottom + '" y2="' + bottom + '" stroke="' + C.base + '"/>';
    if (selLot) g += '<rect x="' + X(selLot.start) + '" y="' + top + '" width="' + (X(selLot.end) - X(selLot.start)) + '" height="' + (bottom - top) + '" fill="#e7f0fb"/>';
    g += '<line x1="' + X(0) + '" y1="' + Y(0) + '" x2="' + X(480) + '" y2="' + Y(sh.plan) + '" stroke="' + C.plan + '" stroke-width="2" stroke-dasharray="1 0"/>';
    const endY = sh.live ? Y(proj) : Y(acc);
    const planLY = Math.abs(endY - Y(sh.plan)) < 16 ? (endY > Y(sh.plan) ? endY - 16 : endY + 16) : Y(sh.plan);
    g += '<text x="' + (X(480) + 8) + '" y="' + (planLY + 4) + '" font-size="12" fill="' + C.ink2 + '">Plan ' + nf(sh.plan) + '</text>';
    g += '<polyline fill="none" stroke="' + C.s1 + '" stroke-width="2.5" stroke-linejoin="round" points="' + pts.map((p) => X(p[0]) + ',' + Y(p[1])).join(' ') + '"/>';
    const last = pts[pts.length - 1];
    if (sh.live) {
      g += '<line x1="' + X(last[0]) + '" y1="' + Y(last[1]) + '" x2="' + X(480) + '" y2="' + Y(proj) + '" stroke="' + C.s1 + '" stroke-width="2" stroke-dasharray="5 4"/>';
      g += '<line x1="' + X(last[0]) + '" x2="' + X(last[0]) + '" y1="' + top + '" y2="' + bottom + '" stroke="' + C.ink + '" stroke-width="1" stroke-dasharray="2 3"/>';
      g += '<text x="' + (X(last[0]) + 4) + '" y="' + (top + 10) + '" font-size="12" fill="' + C.ink + '">Ahora ' + DATA.clockLabel(DATA.SHIFTS[sh.s].start + last[0]) + '</text>';
      g += '<circle cx="' + X(480) + '" cy="' + Y(proj) + '" r="4" fill="' + C.s1 + '" stroke="#fff" stroke-width="2"/>';
      g += '<text x="' + (X(480) + 8) + '" y="' + (Y(proj) + 4) + '" font-size="12" fill="' + C.ink + '">Proyección ' + nf(proj) + ' (' + pct(sh.projection) + ')</text>';
    } else {
      g += '<circle cx="' + X(last[0]) + '" cy="' + Y(last[1]) + '" r="4" fill="' + C.s1 + '" stroke="#fff" stroke-width="2"/>';
      g += '<text x="' + (X(480) + 8) + '" y="' + (Y(last[1]) + 4) + '" font-size="12" fill="' + C.ink + '">Real ' + nf(last[1]) + ' (' + pct(sh.compliance) + ')</text>';
    }
    let acc2 = 0;
    sh.buckets.forEach((b) => {
      acc2 += b.good;
      const planAt = (sh.plan * (b.t + 10)) / 480;
      g += '<rect class="hit" x="' + X(b.t) + '" y="' + top + '" width="' + (X(10) - X(0)) + '" height="' + (bottom - top) + '" ' + tip(DATA.shiftTime(sh.s, b.t + 10), 'Real acumulado ' + nf(acc2) + ' · Plan ' + nf(planAt) + (b.stopMin ? ' · Parada ' + b.stopMin + ' min' : '') + ' · Scrap ' + b.scrap) + '/>';
    });
    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Plan frente a real acumulado del turno">' + g + '</svg>';
  }

  function control({ w = 760, h = 230, sh, v, selLot, alerts = [], onlyFrom = 0 }) {
    const top = 14, bottom = h - 26;
    const S = sh.samples[v.id];
    const { X, s: ax } = timeAxis({ w, h, shiftStart: DATA.SHIFTS[sh.s].start, top, bottom });
    const lo = v.mean - 4 * v.sd, hi = v.mean + 4 * v.sd;
    const vmin = Math.min(lo, ...S.values), vmax = Math.max(hi, ...S.values);
    const Y = (x) => bottom - ((x - vmin) / (vmax - vmin)) * (bottom - top);
    let g = ax;
    if (selLot) g += '<rect x="' + X(selLot.start) + '" y="' + top + '" width="' + (X(selLot.end) - X(selLot.start)) + '" height="' + (bottom - top) + '" fill="#e7f0fb"/>';
    sh.lots.forEach((lot, i) => {
      if (i) g += '<line x1="' + X(lot.start) + '" x2="' + X(lot.start) + '" y1="' + top + '" y2="' + bottom + '" stroke="' + C.base + '" stroke-dasharray="2 2"/>';
    });
    g += '<rect x="' + M.l + '" y="' + Y(v.mean + 2 * v.sd) + '" width="' + (X(480) - M.l) + '" height="' + (Y(v.mean - 2 * v.sd) - Y(v.mean + 2 * v.sd)) + '" fill="#f0efec"/>';
    [[3, 'LCS'], [0, 'Media'], [-3, 'LCI']].forEach(([k, lb]) => {
      const y = Y(v.mean + k * v.sd);
      g += '<line x1="' + M.l + '" x2="' + X(480) + '" y1="' + y + '" y2="' + y + '" stroke="' + (k ? C.ink2 : C.axis) + '" stroke-width="1" stroke-dasharray="' + (k ? '6 3' : '1 0') + '"/>';
      g += '<text x="' + (X(480) + 8) + '" y="' + (y + 4) + '" font-size="12" fill="' + C.ink2 + '">' + lb + ' ' + nf(v.mean + k * v.sd, v.dec) + '</text>';
    });
    [v.mean - 3 * v.sd, v.mean + 3 * v.sd].forEach(() => {});
    g += '<text x="' + (M.l - 8) + '" y="' + (Y(v.mean) + 4) + '" text-anchor="end" font-size="12" fill="' + C.ink3 + '">' + esc(v.unit) + '</text>';
    const pts = S.values.map((x, i) => [i * 5 + 2.5, x]).filter((p) => p[0] >= onlyFrom);
    g += '<polyline fill="none" stroke="' + C.s1 + '" stroke-width="1.5" stroke-linejoin="round" points="' + pts.map((p) => X(p[0]) + ',' + Y(p[1])).join(' ') + '"/>';
    S.values.forEach((x, i) => {
      const t = i * 5 + 2.5;
      if (t < onlyFrom) return;
      const f = S.flags[i];
      if (f) {
        const cx = X(t), cy = Y(x);
        g += '<path d="M' + cx + ' ' + (cy - 7) + 'L' + (cx + 7) + ' ' + cy + 'L' + cx + ' ' + (cy + 7) + 'L' + (cx - 7) + ' ' + cy + 'Z" fill="' + C.crit + '" stroke="#fff" stroke-width="1.5"/>';
      }
      g += '<rect class="hit" x="' + (X(t) - (X(5) - X(0)) / 2) + '" y="' + top + '" width="' + (X(5) - X(0)) + '" height="' + (bottom - top) + '" ' + tip(DATA.shiftTime(sh.s, i * 5 + 5), nf(x, v.dec) + ' ' + v.unit + (f ? ' · Señal SPC (regla ' + f + ')' : '')) + '/>';
    });
    S.episodes.forEach((ep) => {
      const t = ep.start * 5 + 2.5;
      if (t < onlyFrom) return;
      const a = alerts.find((al) => al.type === 'spc' && al.var === v.id && Math.abs(al.t - (ep.start * 5 + 5)) < 1);
      const x = X(t), y = Y(S.values[ep.start]) - 14;
      const lbl = 'Señal · regla ' + ep.rule + (a ? ' · ' + a.id : '');
      g += '<g' + (a ? ' class="clickable" data-go="#/p5?a=' + a.id + '&from=p3" role="link" tabindex="0" aria-label="Abrir alerta ' + a.id + '"' : '') + '>';
      g += '<rect x="' + (x - 6) + '" y="' + (y - 14) + '" width="' + (lbl.length * 6.6 + 10) + '" height="20" rx="4" fill="#fff" stroke="' + C.crit + '"/>';
      g += '<text x="' + (x - 1) + '" y="' + (y + 1) + '" font-size="12" font-weight="600" fill="' + C.crit + '">' + esc(lbl) + (a ? ' ›' : '') + '</text></g>';
    });
    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Gráfico de control de ' + esc(v.name) + '">' + g + '</svg>';
  }

  function timeline({ w = 760, sh, overdue }) {
    const lanes = 2, lh = 30, top = 6, h = top + lanes * lh + 26, bottom = top + lanes * lh;
    const { X, s: ax } = timeAxis({ w, h, shiftStart: DATA.SHIFTS[sh.s].start, top, bottom });
    let g = ax;
    ['Paradas', 'Mantenimiento'].forEach((n, i) => {
      g += '<text x="' + (M.l - 8) + '" y="' + (top + i * lh + 19) + '" text-anchor="end" font-size="12" fill="' + C.ink2 + '">' + n + '</text>';
      g += '<line x1="' + M.l + '" x2="' + X(480) + '" y1="' + (top + (i + 1) * lh) + '" y2="' + (top + (i + 1) * lh) + '" stroke="' + C.grid + '"/>';
    });
    sh.stops.forEach((st) => {
      const x = X(st.start), wd = Math.max(4, X(st.start + st.dur) - x);
      g += '<rect x="' + x + '" y="' + (top + 6) + '" width="' + wd + '" height="' + (lh - 12) + '" rx="3" fill="' + C.s2 + '" ' + tip('Parada no planificada', DATA.shiftTime(sh.s, st.start) + ' · ' + st.dur + ' min' + (st.ongoing ? ' (en curso)' : '') + ' · ' + st.cause) + '/>';
      if (wd > 40) g += '<text x="' + (x + 4) + '" y="' + (top + 19) + '" font-size="11" fill="#fff" pointer-events="none">' + st.dur + ' min</text>';
    });
    if (overdue) {
      g += '<rect x="' + M.l + '" y="' + (top + lh + 8) + '" width="' + (X(sh.elapsed) - M.l) + '" height="' + (lh - 16) + '" fill="none" stroke="' + C.crit + '" stroke-width="1.5" stroke-dasharray="4 3" ' + tip('Preventivo vencido', overdue.ot + ' · ' + overdue.equip + ' · ' + overdue.task) + '/>';
      g += '<text x="' + (M.l + 6) + '" y="' + (top + lh + 19) + '" font-size="12" font-weight="600" fill="' + C.crit + '">Preventivo vencido: ' + esc(overdue.equip) + ' (' + overdue.ot + ')</text>';
    } else {
      g += '<text x="' + (M.l + 6) + '" y="' + (top + lh + 19) + '" font-size="12" fill="' + C.ink3 + '">Sin preventivo vencido en equipos críticos</text>';
    }
    if (!sh.stops.length) g += '<text x="' + (M.l + 6) + '" y="' + (top + 19) + '" font-size="12" fill="' + C.ink3 + '">Sin paradas no planificadas</text>';
    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Paradas y mantenimiento del turno">' + g + '</svg>';
  }

  function decomposition({ w = 560, rows }) {
    const rh = 34, top = 4, labelW = 70, right = 70;
    const h = top + rows.length * rh + 4;
    const max = niceMax(Math.max(1, ...rows.map((r) => r.parada + r.ritmo + r.scrap)));
    const W = (v) => (v / max) * (w - labelW - right);
    let g = '';
    rows.forEach((r, i) => {
      const y = top + i * rh;
      g += '<g class="clickable" data-go="' + r.href + '" role="link" tabindex="0" aria-label="Analizar ' + esc(r.name) + '">';
      g += '<rect x="0" y="' + y + '" width="' + w + '" height="' + rh + '" fill="transparent"/>';
      g += '<text x="0" y="' + (y + 21) + '" font-size="13" font-weight="600" fill="' + C.ink + '">' + esc(r.name) + '</text>';
      let x = labelW;
      [['parada', C.s1, 'Parada'], ['ritmo', C.s2, 'Ritmo'], ['scrap', C.s3, 'Scrap']].forEach(([k, col, lb]) => {
        const ww = W(r[k]);
        if (ww >= 1) {
          g += '<rect x="' + x + '" y="' + (y + 8) + '" width="' + Math.max(0, ww - 2) + '" height="18" rx="3" fill="' + col + '" ' + tip(r.name + ' · ' + lb, nf(r[k]) + ' unidades') + '/>';
          x += ww;
        }
      });
      g += '<text x="' + (x + 6) + '" y="' + (y + 21) + '" font-size="12" fill="' + C.ink2 + '">' + nf(r.parada + r.ritmo + r.scrap) + ' u</text>';
      g += '</g>';
    });
    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Descomposición de la brecha por tipo de pérdida">' + g + '</svg>';
  }

  function pareto({ w = 420, items }) {
    const rh = 30, labelW = 200, right = 86;
    const tot = items.reduce((a, x) => a + x[1], 0) || 1;
    const h = items.length * rh + 4;
    const max = Math.max(1, ...items.map((x) => x[1]));
    let cum = 0, g = '';
    items.forEach(([c, n], i) => {
      cum += n;
      const y = i * rh;
      const ww = (n / max) * (w - labelW - right);
      g += '<text x="' + (labelW - 8) + '" y="' + (y + 19) + '" text-anchor="end" font-size="12" fill="' + C.ink + '">' + esc(c) + '</text>';
      g += '<rect x="' + labelW + '" y="' + (y + 6) + '" width="' + Math.max(2, ww) + '" height="18" rx="3" fill="' + C.s1 + '" ' + tip(c, n + ' unidades · ' + pct(n / tot) + ' del total') + '/>';
      g += '<text x="' + (labelW + ww + 6) + '" y="' + (y + 19) + '" font-size="12" fill="' + C.ink2 + '">' + n + ' · ' + pct(cum / tot, 0) + ' acum.</text>';
    });
    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Pareto de scrap por causa">' + g + '</svg>';
  }

  function spark({ w = 96, h = 40, values, target, better = 1 }) {
    const vs = values.filter((x) => x != null);
    const lo = Math.min(...vs, target), hi = Math.max(...vs, target);
    const pad = (hi - lo) * 0.15 || 0.01;
    const Y = (v) => h - 4 - ((v - lo + pad) / (hi - lo + 2 * pad)) * (h - 8);
    const X = (i) => 4 + (i / (values.length - 1)) * (w - 12);
    let g = '<line x1="2" x2="' + (w - 2) + '" y1="' + Y(target) + '" y2="' + Y(target) + '" stroke="' + C.axis + '" stroke-dasharray="3 3"/>';
    g += '<polyline fill="none" stroke="' + C.s1 + '" stroke-width="2" points="' + values.map((v, i) => X(i) + ',' + Y(v)).join(' ') + '"/>';
    g += '<circle cx="' + X(values.length - 1) + '" cy="' + Y(values[values.length - 1]) + '" r="3.5" fill="' + C.s1 + '"/>';
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Tendencia de cuatro semanas; la línea discontinua es el objetivo">' + g + '</svg>';
  }

  function projectionMini({ w = 760, h = 200, sh, upto, threshold }) {
    const top = 14, bottom = h - 26;
    const { X, s: ax } = timeAxis({ w, h, shiftStart: DATA.SHIFTS[sh.s].start, top, bottom });
    const pts = sh.buckets.filter((b) => b.t + 10 <= upto && b.t >= 50).map((b) => [b.t + 10, sh.projAt(b.t + 10)]);
    const lo = Math.min(0.4, ...pts.map((p) => p[1])), hi = Math.max(1.05, ...pts.map((p) => p[1]));
    const Y = (v) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
    let g = ax;
    [[1, 'Plan 100 %', C.plan, '1 0'], [threshold, 'Umbral ' + pct(threshold, 0), C.crit, '6 3']].forEach(([v, lb, col, da]) => {
      g += '<line x1="' + M.l + '" x2="' + X(480) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + col + '" stroke-dasharray="' + da + '"/>';
      g += '<text x="' + (X(480) + 8) + '" y="' + (Y(v) + 4) + '" font-size="12" fill="' + C.ink2 + '">' + lb + '</text>';
    });
    g += '<polyline fill="none" stroke="' + C.s1 + '" stroke-width="2.5" points="' + pts.map((p) => X(p[0]) + ',' + Y(p[1])).join(' ') + '"/>';
    pts.forEach((p) => { g += '<rect class="hit" x="' + (X(p[0]) - 6) + '" y="' + top + '" width="12" height="' + (bottom - top) + '" ' + tip(DATA.shiftTime(sh.s, p[0]), 'Proyección al cierre ' + pct(p[1])) + '/>'; });
    const last = pts[pts.length - 1];
    if (last) {
      g += '<circle cx="' + X(last[0]) + '" cy="' + Y(last[1]) + '" r="4" fill="' + C.crit + '" stroke="#fff" stroke-width="2"/>';
      g += '<text x="' + (X(last[0]) + 8) + '" y="' + (Y(last[1]) + 16) + '" font-size="12" font-weight="600" fill="' + C.crit + '">' + pct(last[1]) + '</text>';
    }
    g += '<text x="' + (M.l - 8) + '" y="' + (Y(1) + 4) + '" text-anchor="end" font-size="12" fill="' + C.ink3 + '">%</text>';
    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Evolución de la proyección de cumplimiento">' + g + '</svg>';
  }

  window.CH = { cumulative, control, timeline, decomposition, pareto, spark, projectionMini, nf, pct, esc };
})();
