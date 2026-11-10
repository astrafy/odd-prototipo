(function () {
  const mulberry = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const hash = (s) => {
    let h = 2166136261;
    for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  const gauss = (r) => {
    let u = 0;
    while (!u) u = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  };
  const pick = (r, items, weights) => {
    const tot = weights.reduce((a, b) => a + b, 0);
    let x = r() * tot;
    for (let i = 0; i < items.length; i++) { x -= weights[i]; if (x <= 0) return items[i]; }
    return items[items.length - 1];
  };

  const TODAY = new Date(2026, 10, 10);
  const CLOCK = { d: 0, s: 1, min: 280 };
  const SHIFT_MIN = 480;
  const DAYS = 30;

  const SHIFTS = [
    { id: 'N', name: 'Noche', start: -120 },
    { id: 'M', name: 'Mañana', start: 360 },
    { id: 'T', name: 'Tarde', start: 840 },
  ];

  const SCRAP_CAUSES = ['Dimensional fuera de tolerancia', 'Defecto superficial', 'Fallo de sellado', 'Material no conforme', 'Ajuste de arranque', 'Otros'];
  const STOP_CAUSES = ['Atasco en alimentador', 'Fallo eléctrico', 'Falta de material', 'Cambio no previsto', 'Fallo de sensor de presencia'];
  const ALERT_CAUSES = ['Deriva de proceso: ajuste de parámetros', 'Fallo de equipo', 'Material no conforme', 'Arranque o cambio de referencia', 'Falta de material o personal', 'Falsa alarma', 'Otra causa'];

  const LINES = [
    { id: 'L1', name: 'Línea 1', rate: 126, refs: ['REF-A', 'REF-B'], scrap: 0.013, causeW: [3, 4, 1, 2, 2, 1],
      vars: [{ id: 'pres', name: 'Presión de prensado', unit: 'bar', mean: 120, sd: 1.5, dec: 1 }, { id: 'tmat', name: 'Temperatura de matriz', unit: '°C', mean: 210, sd: 2, dec: 1 }] },
    { id: 'L2', name: 'Línea 2', rate: 135, refs: ['REF-C'], scrap: 0.014, causeW: [3, 2, 2, 2, 2, 1],
      vars: [{ id: 'th2', name: 'Temperatura del horno T2', unit: '°C', mean: 180, sd: 1.2, dec: 1 }, { id: 'vcin', name: 'Velocidad de cinta', unit: 'm/min', mean: 12, sd: 0.15, dec: 2 }] },
    { id: 'L3', name: 'Línea 3', rate: 114, refs: ['REF-D', 'REF-E'], scrap: 0.011, causeW: [2, 2, 4, 1, 2, 1],
      vars: [{ id: 'par', name: 'Par de apriete', unit: 'N·m', mean: 35, sd: 0.4, dec: 2 }, { id: 'tsel', name: 'Temperatura de sellado', unit: '°C', mean: 160, sd: 1.5, dec: 1 }] },
    { id: 'L4', name: 'Línea 4', rate: 150, refs: ['REF-F'], scrap: 0.015, causeW: [2, 4, 1, 2, 2, 1],
      vars: [{ id: 'esp', name: 'Espesor de recubrimiento', unit: 'µm', mean: 80, sd: 1.2, dec: 1 }, { id: 'tsec', name: 'Temperatura de secado', unit: '°C', mean: 95, sd: 1.0, dec: 1 }] },
  ];
  const lineById = Object.fromEntries(LINES.map((l) => [l.id, l]));

  const TARGETS = {
    cumplimiento: { ok: 0.95, warn: 0.90, dir: 1 },
    proyeccion: { ok: 0.95, warn: 0.90, dir: 1 },
    scrap: { ok: 0.02, warn: 0.03, dir: -1 },
    fpy: { ok: 0.96, warn: 0.94, dir: 1 },
  };
  const PROJ_ALERT = 0.92;

  const dateOf = (d) => { const x = new Date(TODAY); x.setDate(x.getDate() - d); return x; };
  const weekday = (d) => dateOf(d).getDay();
  const isProdDay = (d) => { const w = weekday(d); return w >= 1 && w <= 5; };
  const WD = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const dayLabel = (d, short) => {
    const x = dateOf(d);
    const dm = String(x.getDate()).padStart(2, '0') + '/' + String(x.getMonth() + 1).padStart(2, '0');
    if (short) return dm;
    if (d === 0) return 'Hoy, ' + WD[x.getDay()] + ' ' + dm;
    if (d === 1) return 'Ayer, ' + WD[x.getDay()] + ' ' + dm;
    return WD[x.getDay()].replace(/^./, (c) => c.toUpperCase()) + ' ' + dm;
  };
  const clockLabel = (min) => {
    const m = ((min % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  };
  const shiftTime = (s, t) => clockLabel(SHIFTS[s].start + t);
  const weekOf = (d) => {
    const daysSinceMon = (weekday(0) + 6) % 7;
    return d <= daysSinceMon ? 0 : Math.floor((d - daysSinceMon - 1) / 7) + 1;
  };
  const isoWeek = (date) => {
    const t = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const n = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - n);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 86400000 + 1) / 7);
  };
  const weekNumber = (w) => isoWeek(dateOf((weekday(0) + 6) % 7 + 7 * w));

  const SCRIPT = {
    '0|1|L2': { stops: [{ start: 100, dur: 25, cause: 'Atasco en alimentador' }], drift: { var: 'th2', from: 222, slope: 0.36, scrapTo: 0.16 }, speed: 0.995 },
    '0|1|L4': { stops: [{ start: 272, dur: 8, cause: 'Fallo de sensor de presencia', ongoing: true }], speed: 1.03 },
    '0|1|L1': { stops: [{ start: 205, dur: 6, cause: 'Falta de material' }], speed: 1.0 },
    '0|1|L3': { stops: [], speed: 1.005 },
    '0|0|L3': { stops: [{ start: 250, dur: 58, cause: 'Fallo en prensa P3-02' }], speed: 0.99 },
    '1|1|L1': { stops: [{ start: 60, dur: 7, cause: 'Atasco en alimentador' }], drift: { var: 'pres', from: 150, slope: 0.22, scrapTo: 0.12, until: 300 }, speed: 0.99 },
  };

  const cache = new Map();

  function signalsOf(values, mean, sd) {
    const z = values.map((v) => (v - mean) / sd);
    const flags = z.map(() => null);
    for (let i = 0; i < z.length; i++) {
      if (Math.abs(z[i]) > 3) { flags[i] = 1; continue; }
      const side = Math.sign(z[i]);
      if (i >= 2 && Math.abs(z[i]) > 2) {
        const c = [z[i - 2], z[i - 1], z[i]].filter((x) => Math.sign(x) === side && Math.abs(x) > 2).length;
        if (c >= 2) { flags[i] = 2; continue; }
      }
      if (i >= 4 && Math.abs(z[i]) > 1) {
        const c = z.slice(i - 4, i + 1).filter((x) => Math.sign(x) === side && Math.abs(x) > 1).length;
        if (c >= 4) { flags[i] = 3; continue; }
      }
    }
    const episodes = [];
    flags.forEach((f, i) => {
      if (!f) return;
      const last = episodes[episodes.length - 1];
      if (last && last.end >= i - 2) { last.end = i; } else episodes.push({ start: i, end: i, rule: f });
    });
    return { flags, episodes };
  }

  function shift(d, s, l) {
    const key = d + '|' + s + '|' + l;
    if (cache.has(key)) return cache.get(key);
    let res = null;
    const future = d === CLOCK.d && s > CLOCK.s;
    if (isProdDay(d) && !future && d < DAYS) res = build(d, s, l, key);
    cache.set(key, res);
    return res;
  }

  function build(d, s, l, key) {
    const line = lineById[l];
    const r = mulberry(hash('odd-' + key));
    const sc = SCRIPT[key] || {};
    const live = d === CLOCK.d && s === CLOCK.s;
    const elapsed = live ? CLOCK.min : SHIFT_MIN;
    const nB = elapsed / 10;

    let stops = sc.stops;
    if (!stops) {
      const x = r();
      const k = x < 0.45 ? 0 : x < 0.8 ? 1 : x < 0.95 ? 2 : 3;
      stops = [];
      for (let i = 0; i < k; i++) {
        const dur = Math.min(60, Math.round(3 + -Math.log(1 - r()) * 10));
        stops.push({ start: Math.round(r() * (SHIFT_MIN - dur - 10)), dur, cause: STOP_CAUSES[Math.floor(r() * STOP_CAUSES.length)] });
      }
      stops.sort((a, b) => a.start - b.start);
    }
    stops = stops.filter((st) => st.start < elapsed).map((st) => ({ ...st, dur: Math.min(st.dur, elapsed - st.start) }));

    const ref = line.refs[(d + s) % line.refs.length];
    const speedBias = sc.speed != null ? sc.speed : 1 + 0.012 * gauss(r);
    const drift = sc.drift;
    const buckets = [];
    for (let b = 0; b < nB; b++) {
      const t0 = b * 10;
      let stopMin = 0;
      stops.forEach((st) => { stopMin += Math.max(0, Math.min(t0 + 10, st.start + st.dur) - Math.max(t0, st.start)); });
      const speed = speedBias + 0.02 * gauss(r);
      const processed = Math.max(0, Math.round((line.rate / 60) * (10 - stopMin) * speed + (r() - 0.5)));
      let sr = line.scrap * Math.exp(0.35 * gauss(r));
      let driftOn = false;
      if (drift && t0 >= drift.from + 15 && (!drift.until || t0 < drift.until)) {
        const k = Math.min(1, (t0 - drift.from - 15) / 25);
        sr = sr + (drift.scrapTo - sr) * k;
        driftOn = true;
      }
      const scrap = Math.min(processed, Math.floor(processed * sr + r()));
      const rework = Math.min(processed - scrap, Math.floor(processed * (driftOn ? 0.03 : 0.012) + r()));
      const causes = {};
      for (let i = 0; i < scrap; i++) {
        const c = driftOn && r() < 0.85 ? SCRAP_CAUSES[0] : pick(r, SCRAP_CAUSES, line.causeW);
        causes[c] = (causes[c] || 0) + 1;
      }
      buckets.push({ t: t0, stopMin, processed, scrap, rework, good: processed - scrap, causes });
    }

    const samples = {};
    line.vars.forEach((v) => {
      const vals = [];
      for (let i = 0; i < nB * 2; i++) {
        const t = i * 5;
        let x = v.mean + 0.6 * v.sd * gauss(r);
        if (drift && drift.var === v.id && t >= drift.from && (!drift.until || t < drift.until)) {
          x += Math.min(2.8, ((t - drift.from) / 5) * drift.slope) * v.sd;
        }
        vals.push(+x.toFixed(v.dec + 1));
      }
      samples[v.id] = { values: vals, ...signalsOf(vals, v.mean, v.sd) };
    });

    const shiftDateTag = dateOf(d);
    const tag = String(shiftDateTag.getDate()).padStart(2, '0') + String(shiftDateTag.getMonth() + 1).padStart(2, '0');
    const orderNo = 'OF-' + (24000 + (hash(key) % 9000));
    const lots = [0, 1, 2, 3].map((k) => ({ id: l + '-' + tag + SHIFTS[s].id + (k + 1), start: k * 120, end: Math.min((k + 1) * 120, elapsed), order: orderNo, ref }))
      .filter((lot) => lot.start < elapsed);
    lots.forEach((lot) => {
      const bs = buckets.filter((b) => b.t >= lot.start && b.t < lot.end);
      lot.processed = sum(bs, 'processed'); lot.scrap = sum(bs, 'scrap'); lot.rework = sum(bs, 'rework');
      lot.fpy = lot.processed ? (lot.processed - lot.scrap - lot.rework) / lot.processed : null;
      lot.signals = line.vars.reduce((acc, v) => acc + samples[v.id].episodes.filter((e) => e.start * 5 >= lot.start && e.start * 5 < lot.end).length, 0);
      lot.live = live && lot.end === elapsed && elapsed < (lots.indexOf(lot) + 1) * 120;
    });

    const plan = line.rate * 8;
    const planToDate = (line.rate / 60) * elapsed;
    const processed = sum(buckets, 'processed');
    const scrap = sum(buckets, 'scrap');
    const rework = sum(buckets, 'rework');
    const good = processed - scrap;
    const stopMin = sum(buckets, 'stopMin');
    const losses = {
      parada: (line.rate / 60) * stopMin,
      ritmo: Math.max(0, (line.rate / 60) * (elapsed - stopMin) - processed),
      scrap,
    };
    const causes = {};
    buckets.forEach((b) => Object.entries(b.causes).forEach(([c, n]) => { causes[c] = (causes[c] || 0) + n; }));
    const signals = line.vars.reduce((acc, v) => acc + samples[v.id].episodes.length, 0);

    const projAt = (t) => {
      const upto = buckets.filter((b) => b.t < t);
      const G = sum(upto, 'good');
      const recent = upto.slice(-6);
      const rate = sum(recent, 'good') / (recent.length * 10 || 1);
      return (G + rate * (SHIFT_MIN - t)) / plan;
    };

    return {
      key, d, s, l, line, ref, live, elapsed, buckets, stops, samples, lots, plan, planToDate, processed, scrap, rework, good,
      fpy: processed ? (processed - scrap - rework) / processed : null,
      scrapRate: processed ? scrap / processed : null,
      compliance: good / (live ? planToDate : plan),
      projection: live ? projAt(elapsed) : null,
      projAt, stopMin, losses, causes, signals,
      ongoingStop: stops.find((st) => st.ongoing) || null,
    };
  }

  const sum = (arr, k) => arr.reduce((a, x) => a + (x[k] || 0), 0);

  function aggregate(list) {
    const xs = list.filter(Boolean);
    if (!xs.length) return null;
    const plan = xs.reduce((a, x) => a + (x.live ? x.planToDate : x.plan), 0);
    const processed = sum(xs, 'processed');
    const scrap = sum(xs, 'scrap');
    const rework = sum(xs, 'rework');
    const good = processed - scrap;
    const losses = { parada: 0, ritmo: 0, scrap: 0 };
    const causes = {};
    xs.forEach((x) => {
      Object.keys(losses).forEach((k) => { losses[k] += x.losses[k]; });
      Object.entries(x.causes).forEach(([c, n]) => { causes[c] = (causes[c] || 0) + n; });
    });
    return { n: xs.length, plan, processed, scrap, rework, good, compliance: good / plan, scrapRate: processed ? scrap / processed : null, fpy: processed ? (processed - scrap - rework) / processed : null, losses, causes, signals: sum(xs, 'signals'), stopMin: sum(xs, 'stopMin') };
  }

  const shiftsOfDay = (d, l) => [0, 1, 2].map((s) => shift(d, s, l));
  const daysOfWeek = (w) => { const out = []; for (let d = 0; d < DAYS; d++) if (weekOf(d) === w) out.push(d); return out; };
  const week = (w, lines) => aggregate(daysOfWeek(w).flatMap((d) => (lines || LINES.map((x) => x.id)).flatMap((l) => shiftsOfDay(d, l))));
  const day = (d, lines) => aggregate((lines || LINES.map((x) => x.id)).flatMap((l) => shiftsOfDay(d, l)));
  const prodDays = (n) => { const out = []; for (let d = 0; d < DAYS && out.length < n; d++) if (isProdDay(d)) out.push(d); return out; };

  function firstSignal(sh, varId, fromMin) {
    const ep = sh.samples[varId].episodes.find((e) => e.start * 5 >= (fromMin || 0));
    return ep || null;
  }

  function lotAt(sh, t) { return sh.lots.find((lot) => t >= lot.start && t < lot.end) || sh.lots[sh.lots.length - 1]; }

  function makeAlerts() {
    const out = [];
    const spc = (id, d, s, l, varId, from) => {
      const sh = shift(d, s, l);
      const ep = firstSignal(sh, varId, from);
      const v = sh.line.vars.find((x) => x.id === varId);
      const t = ep.start * 5 + 5;
      const val = sh.samples[varId].values[ep.start];
      out.push({ id, type: 'spc', d, s, l, var: varId, t, rule: ep.rule, value: val, mean: v.mean, sd: v.sd, lot: lotAt(sh, t - 1), kpi: 'scrap' });
    };
    const proy = (id, d, s, l, t) => {
      const sh = shift(d, s, l);
      out.push({ id, type: 'proy', d, s, l, t, value: sh.projAt(t), threshold: PROJ_ALERT, lot: lotAt(sh, t - 1), kpi: 'cumplimiento' });
    };
    spc('ALR-100', 4, 1, 'L2', 'vcin', 0);
    spc('ALR-101', 1, 1, 'L1', 'pres', 150);
    proy('ALR-102', 0, 0, 'L3', 310);
    spc('ALR-103', 0, 1, 'L2', 'th2', 222);
    proy('ALR-104', 0, 1, 'L2', 278);
    return out;
  }
  const ALERTS = makeAlerts();

  const INITIAL_HISTORY = {
    'ALR-100': (a) => [
      { state: 'emitida', d: a.d, s: a.s, t: a.t, who: 'Activator' },
      { state: 'reconocida', d: a.d, s: a.s, t: a.t + 3, who: 'Jefe de turno · Mañana' },
      { state: 'causa', d: a.d, s: a.s, t: a.t + 12, who: 'Jefe de turno · Mañana', cause: 'Deriva de proceso: ajuste de parámetros', note: 'Ajuste del variador de la cinta.' },
      { state: 'cerrada', d: a.d, s: a.s, t: a.t + 14, who: 'Jefe de turno · Mañana' },
    ],
    'ALR-101': (a) => [
      { state: 'emitida', d: a.d, s: a.s, t: a.t, who: 'Activator' },
      { state: 'reconocida', d: a.d, s: a.s, t: a.t + 7, who: 'Jefe de turno · Mañana' },
    ],
    'ALR-102': (a) => [
      { state: 'emitida', d: a.d, s: a.s, t: a.t, who: 'Activator' },
      { state: 'reconocida', d: a.d, s: a.s, t: a.t + 4, who: 'Jefe de turno · Noche' },
      { state: 'causa', d: a.d, s: a.s, t: a.t + 21, who: 'Jefe de turno · Noche', cause: 'Fallo de equipo', note: 'Parada en prensa P3-02. Aviso a mantenimiento por el canal habitual.' },
      { state: 'cerrada', d: a.d, s: a.s, t: a.t + 150, who: 'Jefe de turno · Noche' },
    ],
    'ALR-103': (a) => [{ state: 'emitida', d: a.d, s: a.s, t: a.t, who: 'Activator' }],
    'ALR-104': (a) => [{ state: 'emitida', d: a.d, s: a.s, t: a.t, who: 'Activator' }],
  };

  const OVERDUE = [
    { ot: 'OT-48213', l: 'L3', equip: 'Prensa P3-02', task: 'Lubricación y revisión de guías', since: 6, critical: true },
    { ot: 'OT-48377', l: 'L1', equip: 'Prensa P1-01', task: 'Calibración del transductor de presión', since: 2, critical: true },
  ];

  const DEFS = {
    cumplimiento: 'Unidades buenas producidas / unidades planificadas, por turno × línea; agregado por día, semana y planta',
    proyeccion: 'Producción acumulada + ritmo reciente × tiempo restante, comparado con el plan del turno',
    scrap: 'Unidades rechazadas / unidades procesadas, por línea, referencia y turno',
    fpy: 'Unidades buenas sin retrabajo / unidades iniciadas',
    spc: 'Número y duración de señales fuera de control (reglas de Western Electric) por variable crítica y línea',
    paradas: 'Minutos de parada no planificada por línea y turno',
    preventivo: 'Órdenes de preventivo vencidas en equipos críticos de las líneas del piloto',
    pareto: 'Pareto de scrap por causa codificada, línea y referencia',
    brecha: 'Brecha del turno atribuida a parada, ritmo inferior o scrap',
  };

  window.DATA = {
    TODAY, CLOCK, SHIFT_MIN, SHIFTS, LINES, lineById, TARGETS, PROJ_ALERT, SCRAP_CAUSES, ALERT_CAUSES, ALERTS, INITIAL_HISTORY, OVERDUE, DEFS,
    shift, shiftsOfDay, day, week, aggregate, daysOfWeek, weekOf, weekNumber, prodDays, isProdDay, dayLabel, clockLabel, shiftTime, dateOf, signalsOf,
  };
})();
