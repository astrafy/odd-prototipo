(function () {
  const D = window.DATA;
  const { nf, pct, esc } = CH;
  const app = document.getElementById('app');
  const pop = document.getElementById('pop');

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
    sget(k) { try { return sessionStorage.getItem(k); } catch (e) { return store.mem[k] ?? null; } },
    sset(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { store.mem[k] = v; } },
    mem: {},
  };
  const KEY = 'odd-prototipo-v1';
  const initial = () => {
    const hist = {};
    D.ALERTS.forEach((a) => { hist[a.id] = D.INITIAL_HISTORY[a.id](a); });
    return { hist, tick: 0 };
  };
  let S;
  try { S = JSON.parse(store.get(KEY)) || initial(); } catch (e) { S = initial(); }
  if (!S.hist || D.ALERTS.some((a) => !S.hist[a.id])) S = initial();
  const save = () => store.set(KEY, JSON.stringify(S));

  const alertById = (id) => D.ALERTS.find((a) => a.id === id);
  const hist = (id) => S.hist[id];
  const stateOf = (id) => hist(id)[hist(id).length - 1].state;
  const isOpen = (id) => stateOf(id) !== 'cerrada';
  const causeOf = (id) => (hist(id).find((h) => h.state === 'causa') || {});
  const act = (id, state, extra) => {
    S.tick += 1;
    hist(id).push({ state, d: 0, s: D.CLOCK.s, t: D.CLOCK.min + 2 * S.tick, who: 'Jefe de turno · Mañana', ...extra });
    save();
  };
  const absMin = (d, s, t) => -d * 1440 + D.SHIFTS[s].start + t;
  const NOW = absMin(D.CLOCK.d, D.CLOCK.s, D.CLOCK.min);
  const ageMin = (a) => NOW - absMin(a.d, a.s, a.t);

  const STATE_LABEL = { emitida: 'Emitida', reconocida: 'Reconocida', causa: 'Causa registrada', cerrada: 'Cerrada' };
  const pill = (id) => { const st = stateOf(id); return '<span class="pill ' + st + '">' + STATE_LABEL[st] + '</span>'; };
  const RULES = { 1: '1 punto fuera de los límites de control (±3σ)', 2: '2 de 3 puntos consecutivos más allá de 2σ del mismo lado', 3: '4 de 5 puntos consecutivos más allá de 1σ del mismo lado' };

  const varOf = (a) => D.lineById[a.l].vars.find((v) => v.id === a.var);
  const alertTitle = (a) => (a.type === 'spc' ? 'A2 · Señal SPC · ' + varOf(a).name : 'A1 · Turno en riesgo de no cumplir el plan');
  const alertValue = (a) => (a.type === 'spc' ? nf(a.value, varOf(a).dec) + ' ' + varOf(a).unit : pct(a.value));
  const alertCond = (a) => (a.type === 'spc' ? 'Regla ' + a.rule + ' de Western Electric: ' + RULES[a.rule] : 'Proyección al cierre del turno por debajo del ' + pct(a.threshold, 0) + ' del plan (U1) en dos evaluaciones consecutivas');
  const alertRef = (a) => (a.type === 'spc'
    ? 'Media ' + nf(a.mean, varOf(a).dec) + ' · LCS ' + nf(a.mean + 3 * a.sd, varOf(a).dec) + ' ' + varOf(a).unit
    : 'Umbral ' + pct(a.threshold, 0));
  const prio = (a) => (a.type === 'proy' || a.rule === 1 ? 'crit' : 'warn');
  const PRIO_LABEL = { crit: 'Prioridad alta', warn: 'Prioridad media' };
  const when = (h) => {
    const t = D.shiftTime(h.s, h.t);
    if (h.d === 0) return 'hoy ' + t;
    if (h.d === 1) return 'ayer ' + t;
    return D.dayLabel(h.d).toLowerCase() + ' ' + t;
  };
  const durTxt = (m) => (m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60 ? (m % 60) + ' min' : '') : m + ' min').trim();

  const ICON = {
    ok: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.8 8.2l2.2 2.2 4.2-4.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warn: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5l7 13H1z" fill="var(--warn)" stroke="var(--warn-ink)" stroke-width="1" stroke-linejoin="round"/><path d="M8 6v4" stroke="#0b0b0b" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="12.2" r="1" fill="#0b0b0b"/></svg>',
    crit: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7.5" fill="var(--crit)"/><path d="M8 4v5" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="11.8" r="1.1" fill="#fff"/></svg>',
  };
  const ST_LABEL = { ok: 'En rango', warn: 'Atención', crit: 'Crítico' };
  const status = (kind, v) => {
    if (v == null) return 'ok';
    v = Math.round(v * 1000) / 1000;
    const T = D.TARGETS[kind];
    if (kind === 'scrap') return v <= T.ok ? 'ok' : v <= T.warn ? 'warn' : 'crit';
    return v >= T.ok ? 'ok' : v >= T.warn ? 'warn' : 'crit';
  };
  const badge = (st, label) => '<span class="st st-' + st + '">' + ICON[st] + '<span>' + (label || ST_LABEL[st]) + '</span></span>';
  const icon = (st) => '<span class="st st-' + st + '">' + ICON[st] + '<span class="sr">' + ST_LABEL[st] + '</span></span>';
  const TNAME = { cumplimiento: 'Cumplimiento de plan', proyeccion: 'Proyección al cierre del turno', scrap: 'Tasa de scrap', fpy: 'FPY', spc: 'Señales SPC', paradas: 'Paradas no planificadas', preventivo: 'Preventivo vencido', pareto: 'Scrap por causa', brecha: 'Descomposición de la brecha' };
  const info = (k) => '<button type="button" class="info" data-def="' + k + '" aria-label="Definición: ' + TNAME[k] + '">i</button>';
  const targetTxt = (kind) => { const T = D.TARGETS[kind]; return 'Objetivo ' + (kind === 'scrap' ? '≤ ' : '≥ ') + pct(T.ok, 0); };
  const devPP = (kind, v) => {
    const d = Math.round((v - D.TARGETS[kind].ok) * 1000) / 10;
    return (d >= 0 ? '+' : '−') + nf(Math.abs(d), 1) + ' pp';
  };

  /* Routing */
  function parse() {
    const h = location.hash.replace(/^#\/?/, '');
    const [route, q] = h.split('?');
    return { route: route || 'home', p: new URLSearchParams(q || '') };
  }
  const isBare = () => parse().p.get('bare') === '1';
  const withBare = (href) => (isBare() && href.startsWith('#/') ? href + (href.includes('?') ? '&' : '?') + 'bare=1' : href);
  const q = (obj) => { const u = new URLSearchParams(); Object.entries(obj).forEach(([k, v]) => { if (v != null && v !== '') u.set(k, v); }); const s = u.toString(); return s ? '?' + s : ''; };

  const SCREENS = {
    p1: { id: 'P1', name: 'Excepciones de la semana', who: 'Dirección', dev: 'mobile', render: renderP1 },
    p2: { id: 'P2', name: 'Planta: resumen del día', who: 'Responsable de planta', dev: 'desktop', render: renderP2 },
    p3: { id: 'P3', name: 'Planta: análisis de desviación', who: 'Responsable de planta', dev: 'desktop', render: renderP3 },
    p4: { id: 'P4', name: 'Mi turno', who: 'Jefe de turno', dev: 'tablet', render: renderP4 },
    p5: { id: 'P5', name: 'Detalle de alerta', who: 'Jefe de turno / responsable de planta', dev: 'tablet', render: renderP5 },
    teams: { id: 'Teams', name: 'Tarjeta de alerta en Teams (simulación)', who: 'Jefe de turno', dev: 'tablet', render: renderTeams },
  };
  const DEV = { mobile: { W: 390, H: 844, label: 'Móvil, vertical' }, tablet: { W: 1180, H: 820, label: 'Tablet, horizontal' }, desktop: { W: 1366, H: 860, label: 'Escritorio' } };

  const TOUR = [
    { n: 1, href: '#/p4', who: 'Sistema', text: 'Activator detecta dos condiciones en la línea 2: una señal SPC en la temperatura del horno T2 y una proyección de cumplimiento por debajo del umbral. Aparecen como alertas activas del turno.' },
    { n: 2, href: '#/teams?a=ALR-103', who: 'Jefe de turno · Teams en la tablet', text: 'Recibe la tarjeta con la alerta, la línea, el valor y un enlace. Pulse «Reconocer».' },
    { n: 3, href: '#/p5?a=ALR-103&from=p4', who: 'Jefe de turno · tablet', text: 'Ve la alerta en contexto: la variable que la disparó, el lote afectado y el historial de estados.' },
    { n: 3, href: '#/teams?a=ALR-103', who: 'Jefe de turno · Teams en la tablet', text: 'Tras actuar en la línea, registra la causa en la tarjeta y la cierra. El estado se refleja en P1 a P4.' },
    { n: 4, href: '#/p2', who: 'Responsable de planta · escritorio', text: 'En la reunión diaria ve la brecha del día por línea y tipo de pérdida. Pulse la celda «Línea 2 · Mañana» para analizarla.' },
    { n: 4, href: '#/p3?l=L2&d=0&s=1', who: 'Responsable de planta · escritorio', text: 'Baja de la línea a la orden, el lote y la variable, y cruza con paradas y mantenimiento. Pulse un lote para ver su tramo.' },
    { n: 5, href: '#/p1', who: 'Dirección · móvil', text: 'En la revisión semanal ve solo las excepciones, su tendencia y el estado de las alertas. Pulse una excepción para ver el detalle.' },
  ];
  const tourIdx = () => { const v = store.sget('odd-tour'); return v == null ? null : +v; };

  /* Shell */
  function render() {
    const { route, p } = parse();
    const bare = p.get('bare') === '1';
    document.body.classList.toggle('bare', bare);
    hidePop();
    const sc = SCREENS[route];
    if (bare && sc) {
      app.innerHTML = '<div class="screen">' + sc.render(p) + '</div><div class="foot">Prototipo Astrafy · datos ficticios · ' + sc.id + ' ' + esc(sc.name) + ' · <a href="#/' + route + '">Ver con marco</a></div>';
      after(route);
      return;
    }
    const ti = tourIdx();
    let h = '<header class="topbar"><div class="brand">Oficina del Dato<span>Prototipo del caso práctico</span></div><nav aria-label="Pantallas">';
    h += '<a href="#/" ' + (route === 'home' ? 'aria-current="page"' : '') + '>Inicio</a>';
    [['p1', 'P1 Dirección'], ['p2', 'P2 Planta'], ['p3', 'P3 Desviación', '?l=L2&d=0&s=1'], ['p4', 'P4 Turno'], ['p5', 'P5 Alerta', '?a=ALR-103&from=p4'], ['teams', 'Teams', '?a=ALR-103']].forEach(([r, n, qq]) => {
      h += '<a href="#/' + r + (qq || '') + '" ' + (route === r ? 'aria-current="page"' : '') + '>' + n + '</a>';
    });
    h += '</nav><div class="tb-actions">';
    if (sc) h += '<a class="tb-btn" href="' + location.hash + (location.hash.includes('?') ? '&' : '?') + 'bare=1" target="_blank" rel="noopener">Abrir sin marco</a>';
    h += '<button class="tb-btn" data-act="reset">Reiniciar demo</button></div></header>';
    if (ti != null && sc) {
      const st = TOUR[ti];
      h += '<div class="tour" role="region" aria-label="Recorrido guiado"><div class="step">Paso ' + st.n + '/5</div><div class="txt"><strong>' + esc(st.who) + '.</strong> ' + esc(st.text) + '</div><div class="tb">' +
        '<button class="btn sm" data-act="tour-prev" ' + (ti === 0 ? 'disabled' : '') + '>Anterior</button>' +
        '<button class="btn sm primary" data-act="tour-next">' + (ti === TOUR.length - 1 ? 'Terminar' : 'Siguiente') + '</button>' +
        '<button class="btn sm" data-act="tour-exit">Salir del recorrido</button></div></div>';
    }
    if (!sc) {
      h += renderHome();
    } else {
      const devKey = route === 'p5' && ['p2', 'p3'].includes(p.get('from')) ? 'desktop' : sc.dev;
      const dv = DEV[devKey];
      h += '<main class="stage"><div class="stage-cap"><strong>' + sc.id + ' · ' + esc(sc.name) + '</strong><span>' + esc(sc.who) + '</span><span>' + dv.label + ' (' + dv.W + ' × ' + dv.H + ')</span></div>' +
        '<div class="device-wrap" data-w="' + dv.W + '" data-h="' + dv.H + '" data-dev="' + devKey + '"><div class="device ' + devKey + '"><div class="screen" style="width:' + dv.W + 'px;height:' + dv.H + 'px">' + sc.render(p) + '</div></div></div></main>';
    }
    h += '<div class="foot">Prototipo Astrafy · datos ficticios · hora simulada: ' + D.dayLabel(0).toLowerCase() + ', 10:40 · objetivos y umbrales supuestos</div>';
    app.innerHTML = h;
    after(route);
  }

  function after(route) {
    fit();
    if (route === 'teams') {
      const f = app.querySelector('.acard.focus');
      const feed = app.querySelector('.feed');
      if (f && feed) feed.scrollTop = f.closest('.msg').offsetTop - feed.offsetTop - 16;
    }
  }

  function fit() {
    const wrap = app.querySelector('.device-wrap');
    if (!wrap) return;
    const dev = wrap.querySelector('.device');
    const fw = dev.offsetWidth, fh = dev.offsetHeight;
    const aw = window.innerWidth - 32;
    const top = wrap.getBoundingClientRect().top + window.scrollY;
    const ah = window.innerHeight - top - 40;
    const s = Math.min(1, aw / fw, Math.max(0.78, ah / fh));
    dev.style.transform = 'scale(' + s + ')';
    wrap.style.width = fw * s + 'px';
    wrap.style.height = fh * s + 'px';
  }

  function renderHome() {
    const st = [
      ['1', 'Sistema', 'Activator detecta una señal SPC en una variable crítica o una proyección de cumplimiento por debajo del umbral del turno.', '—', '#/p4'],
      ['2', 'Jefe de turno · Teams en la tablet', 'Recibe una tarjeta con la alerta, la línea, el valor y un enlace.', 'Reconoce la alerta', '#/teams?a=ALR-103'],
      ['3', 'Jefe de turno · tablet (P4 → P5)', 'Ve la alerta en contexto: plan frente a real del turno y evolución de la variable que la disparó.', 'Actúa en la línea, registra la causa y la cierra', '#/p5?a=ALR-103&from=p4'],
      ['4', 'Responsable de planta · escritorio (P2 → P3)', 'Ve la brecha acumulada del día y baja de línea a orden, lote y variable, cruzando con paradas y preventivo vencido.', 'Replanifica, prioriza mantenimiento o abre una acción de mejora', '#/p2'],
      ['5', 'Dirección · móvil (P1)', 'En la revisión semanal ve solo las excepciones, su tendencia y el estado de las alertas.', 'Decide dónde intervenir', '#/p1'],
    ];
    let h = '<main class="home"><h1>Detección temprana de desviaciones en planta</h1>' +
      '<p class="lead">Prototipo navegable del caso práctico (Anexo D, §4.4). Reproduce el recorrido principal sobre una planta piloto con datos ficticios: de la alerta en el turno a la decisión semanal de dirección.</p>' +
      '<div class="cta"><button class="btn primary" data-act="tour-start">Iniciar recorrido guiado</button><a class="btn" href="#/p4">Explorar libremente</a><button class="btn" data-act="reset">Reiniciar demo</button></div>' +
      '<h2>Recorrido principal</h2><div class="steps">';
    st.forEach(([n, w, t, dcs, href]) => { h += '<a class="stp" href="' + href + '" style="text-decoration:none;color:inherit"><div class="n">Paso ' + n + '</div><div class="w">' + esc(w) + '</div><p>' + esc(t) + '</p><div class="dec">' + esc(dcs) + '</div></a>'; });
    h += '</div><h2>Pantallas</h2><table class="scrs"><thead><tr><th>Id</th><th>Pantalla</th><th>Dispositivo</th><th>Pregunta que responde</th><th>Decisión</th><th>Sin marco</th></tr></thead><tbody>';
    [['p1', 'P1', 'Excepciones de la semana', 'Móvil', '¿Qué se ha desviado y dónde?', 'D6', ''],
      ['p2', 'P2', 'Planta: resumen del día', 'Escritorio', '¿Qué líneas están en riesgo hoy y por qué tipo de pérdida?', 'D2, D5', ''],
      ['p3', 'P3', 'Planta: análisis de desviación', 'Escritorio', '¿Cuál es la causa de esta desviación?', 'D2, D4', '?l=L2&d=0&s=1'],
      ['p4', 'P4', 'Mi turno', 'Tablet', '¿Llego al plan del turno? ¿Qué requiere acción ahora?', 'D1, D3', ''],
      ['p5', 'P5', 'Detalle de alerta', 'Tablet y escritorio', '¿Qué ha disparado la alerta y en qué estado está?', 'D1, D3', '?a=ALR-103&from=p4'],
      ['teams', '—', 'Tarjeta de alerta en Teams (simulación)', 'Tablet', 'Reconocer, registrar la causa y cerrar', 'D1, D3', '?a=ALR-103']].forEach(([r, id, n, dv, qq, dc, qs]) => {
      h += '<tr><td>' + id + '</td><td><a href="#/' + r + qs + '">' + esc(n) + '</a></td><td>' + dv + '</td><td>' + esc(qq) + '</td><td>' + dc + '</td><td><a href="#/' + r + (qs ? qs + '&' : '?') + 'bare=1" target="_blank" rel="noopener">Abrir</a></td></tr>';
    });
    h += '</tbody></table><h2>Supuestos del prototipo</h2><ul class="notes">' +
      '<li>Datos ficticios de una planta piloto con cuatro líneas y tres turnos. No representan la producción de ninguna planta real.</li>' +
      '<li>Hora simulada fija: ' + D.dayLabel(0).toLowerCase() + ', 10:40, turno de mañana (06:00–14:00).</li>' +
      '<li>Objetivos supuestos: cumplimiento ≥ 95 %, scrap ≤ 2 %, FPY ≥ 96 %. Umbral de alerta de proyección: 92 %. Se acuerdan en el discovery.</li>' +
      '<li>Señales SPC con las reglas 1 a 3 de Western Electric sobre límites por referencia. El diseño (§6) aplica las reglas 1 a 4.</li>' +
      '<li>Se muestran dos tipos de alerta de §7: A1 (turno en riesgo) y A2 (señal SPC). U1 = 92 % es un valor de ejemplo; los umbrales se fijan en el discovery.</li>' +
      '<li>La tarjeta de Teams es una simulación. En el servicio la emite Activator vía Power Automate y el estado queda registrado en la plataforma.</li>' +
      '<li>El estado de las alertas se guarda solo en este navegador. «Reiniciar demo» lo restablece.</li></ul></main>';
    return h;
  }

  /* P1 */
  function renderP1(p) {
    const w = +(p.get('w') || 0);
    const ag = D.week(w);
    const trend = (k) => [w + 3, w + 2, w + 1, w].map((x) => D.week(x)[k]);
    const days = D.daysOfWeek(w).filter(D.isProdDay).sort((a, b) => b - a);
    const range = days.length ? D.dayLabel(days[0], true) + ' – ' + D.dayLabel(days[days.length - 1], true) : '';
    let h = '<div class="scr p1"><div class="scr-head"><div><h1>Excepciones de la semana</h1><div class="ctx">Planta piloto · Semana ' + D.weekNumber(w) + ' · ' + range + (w === 0 ? ' (en curso)' : '') + '</div></div></div><div class="scr-body">';
    h += '<div class="seg" role="group" aria-label="Semana" style="margin-bottom:12px"><button data-go="#/p1" aria-pressed="' + (w === 0) + '">Semana en curso</button><button data-go="#/p1?w=1" aria-pressed="' + (w === 1) + '">Semana anterior</button></div>';
    h += '<div class="hero">';
    [['cumplimiento', 'compliance', 'Cumplimiento de plan'], ['scrap', 'scrapRate', 'Scrap'], ['fpy', 'fpy', 'FPY']].forEach(([kind, k, lb]) => {
      const v = ag[k], st = status(kind, v);
      h += '<div class="hk"><div class="lbl">' + lb + ' ' + info(kind) + '</div><div class="val num">' + pct(v) + '</div><div class="dev">' + badge(st) + ' <span class="muted">' + devPP(kind, v) + '</span></div><div class="dev muted">' + targetTxt(kind) + '</div>' + CH.spark({ values: trend(k), target: D.TARGETS[kind].ok }) + '</div>';
    });
    h += '</div>';
    const stale = D.ALERTS.filter((a) => isOpen(a.id) && ageMin(a) > 1440);
    h += stale.length
      ? '<div class="flag">' + ICON.crit + '<span>' + stale.length + (stale.length > 1 ? ' alertas sin cerrar' : ' alerta sin cerrar') + ' desde hace más de 24 h: ' + stale.map((a) => a.l + ' · ' + alertTitle(a)).join('; ') + '</span></div>'
      : '<div class="flag ok">' + ICON.ok + '<span>Ninguna alerta sin cerrar desde hace más de 24 h</span></div>';
    const ex = exceptions(w);
    h += '<h2 style="font-size:16px;margin:4px 0 8px">Excepciones por impacto</h2>';
    if (!ex.length) h += '<p class="muted">Sin excepciones esta semana.</p>';
    ex.forEach((e) => {
      h += '<button class="exc" data-go="#/p1' + q({ w: w || null, x: e.l + '|' + e.kind }) + '">' + icon(e.st) + '<div class="grow" style="flex:1"><div class="t1">' + e.l + ' · ' + e.label + ' ' + pct(e.v) + '</div><div class="t2">' + devPP(e.kind, e.v) + ' frente al objetivo · ' + nf(e.impact) + ' u afectadas</div>' + (e.alert ? '<div class="t2" style="margin-top:4px">Alerta ' + e.alert.id + ' ' + pill(e.alert.id) + '</div>' : '<div class="t2" style="margin-top:4px">Sin alerta asociada</div>') + '</div><span class="chev" aria-hidden="true">›</span></button>';
    });
    h += '<p class="muted" style="font-size:12px;margin-top:12px">Solo lectura. Las acciones operativas se registran en el turno.</p></div>';
    const x = p.get('x');
    if (x) {
      const e = ex.find((y) => y.l + '|' + y.kind === x);
      if (e) h += sheetP1(e, w);
    }
    return h + '</div>';
  }

  function exceptions(w) {
    const out = [];
    D.LINES.forEach((L) => {
      const ag = D.week(w, [L.id]);
      if (!ag) return;
      const days = D.daysOfWeek(w);
      const alerts = D.ALERTS.filter((a) => a.l === L.id && days.includes(a.d));
      [['cumplimiento', 'compliance', 'Cumplimiento', (v) => ag.plan * D.TARGETS.cumplimiento.ok - ag.good],
        ['scrap', 'scrapRate', 'Scrap', () => ag.scrap - ag.processed * D.TARGETS.scrap.ok],
        ['fpy', 'fpy', 'FPY', () => ag.processed * (D.TARGETS.fpy.ok - ag.fpy)]].forEach(([kind, k, label, imp]) => {
        const v = ag[k], st = status(kind, v);
        if (st === 'ok') return;
        const al = alerts.filter((a) => (kind === 'cumplimiento' ? a.kpi === 'cumplimiento' : a.kpi === 'scrap')).sort((a, b) => absMin(b.d, b.s, b.t) - absMin(a.d, a.s, a.t));
        out.push({ l: L.id, kind, k, label, v, st, impact: Math.max(0, imp()), alert: al[0] || null, alerts: al });
      });
    });
    return out.sort((a, b) => b.impact - a.impact);
  }

  function sheetP1(e, w) {
    const vals = [w + 3, w + 2, w + 1, w].map((x) => D.week(x, [e.l])[e.k]);
    let h = '<div class="sheet-bg" data-go="#/p1' + q({ w: w || null }) + '"><div class="sheet" role="dialog" aria-label="Detalle de la excepción" data-stop="1">';
    h += '<h3>' + e.l + ' · ' + e.label + '</h3><div class="muted" style="font-size:13px;margin-bottom:12px">Semana ' + D.weekNumber(w) + ' · ' + targetTxt(e.kind) + '</div>';
    h += '<div style="display:flex;gap:12px;align-items:center;margin-bottom:12px"><div style="font-size:30px;font-weight:700" class="num">' + pct(e.v) + '</div>' + badge(e.st) + '</div>';
    h += '<div style="font-size:13px;color:var(--ink-2);margin-bottom:4px">Tendencia de cuatro semanas (S' + D.weekNumber(w + 3) + '–S' + D.weekNumber(w) + ')</div>' + CH.spark({ w: 320, h: 70, values: vals, target: D.TARGETS[e.kind].ok });
    h += '<table class="tbl" style="margin:10px 0 14px"><thead><tr><th>Semana</th><th class="r">' + e.label + '</th></tr></thead><tbody>' + vals.map((v, i) => '<tr><td>S' + D.weekNumber(w + 3 - i) + '</td><td class="r num">' + pct(v) + '</td></tr>').join('') + '</tbody></table>';
    h += '<div style="font-weight:650;margin-bottom:6px">Causa registrada</div>';
    if (!e.alerts.length) h += '<p class="muted" style="margin:0 0 10px">Sin alertas en la semana. La desviación procede del agregado de turnos.</p>';
    e.alerts.forEach((a) => {
      const c = causeOf(a.id);
      h += '<div style="border:1px solid var(--line);border-radius:8px;padding:10px;margin-bottom:8px;font-size:14px"><div><b>' + a.id + '</b> · ' + esc(alertTitle(a)) + ' ' + pill(a.id) + '</div><div class="muted" style="font-size:13px">' + when(a) + '</div><div style="margin-top:4px">' + (c.cause ? esc(c.cause) + (c.note ? '. ' + esc(c.note) : '') : '<span class="muted">Sin causa registrada todavía</span>') + '</div></div>';
    });
    h += '<a class="btn" style="width:100%;margin-top:8px" href="#/p1' + q({ w: w || null }) + '">Cerrar</a></div></div>';
    return h;
  }

  /* P2 */
  function recsFor(d, lines, ref) {
    return lines.flatMap((l) => D.shiftsOfDay(d, l)).filter((r) => r && (!ref || r.ref === ref));
  }
  function renderP2(p) {
    const days = D.prodDays(5);
    const d = +(p.get('d') || 0);
    const lf = p.get('l') || '';
    const ref = p.get('ref') || '';
    const lines = D.LINES.filter((L) => !lf || L.id === lf).map((L) => L.id);
    const recs = recsFor(d, lines, ref);
    const ag = D.aggregate(recs);
    const refs = [...new Set(D.LINES.flatMap((L) => L.refs))];
    let h = '<div class="scr"><div class="scr-head"><div><h1>Planta: resumen del día</h1><div class="crumbs"><span>Planta piloto</span></div></div><div class="spacer"></div>' +
      '<div class="filters"><label>Día<select data-filter="d">' + days.map((x) => '<option value="' + x + '"' + (x === d ? ' selected' : '') + '>' + D.dayLabel(x) + '</option>').join('') + '</select></label>' +
      '<label>Línea<select data-filter="l"><option value="">Todas</option>' + D.LINES.map((L) => '<option value="' + L.id + '"' + (L.id === lf ? ' selected' : '') + '>' + L.name + '</option>').join('') + '</select></label>' +
      '<label>Referencia<select data-filter="ref"><option value="">Todas</option>' + refs.map((r) => '<option' + (r === ref ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></label></div></div><div class="scr-body grid">';
    h += '<div class="kpis">';
    [['cumplimiento', 'compliance', 'Cumplimiento de plan'], ['scrap', 'scrapRate', 'Tasa de scrap'], ['fpy', 'fpy', 'FPY']].forEach(([kind, k, lb]) => {
      const v = ag ? ag[k] : null, st = status(kind, v);
      h += '<div class="kpi"><div class="lbl">' + lb + (d === 0 ? ' · hasta las 10:40' : '') + ' ' + info(kind) + '</div><div class="val num">' + pct(v) + '</div><div class="dev">' + badge(st) + '<span>' + (v != null ? devPP(kind, v) : '') + ' · ' + targetTxt(kind) + '</span></div></div>';
    });
    h += '</div><div class="grid split" style="grid-template-columns: 1fr 1fr">';
    h += '<section class="panel"><h2>Cumplimiento por línea y turno ' + info('cumplimiento') + '<span class="sub">Pulse una celda para analizarla</span></h2><table class="matrix"><thead><tr><th></th>' + D.SHIFTS.map((s) => '<th>' + s.name + ' ' + D.clockLabel(s.start) + '–' + D.clockLabel(s.start + 480) + '</th>').join('') + '</tr></thead><tbody>';
    lines.forEach((l) => {
      h += '<tr><th>' + D.lineById[l].name + '</th>';
      D.SHIFTS.forEach((s, si) => {
        const r = D.shift(d, si, l);
        if (!r) { h += '<td><div class="mc na"><span class="v">—</span><span style="font-size:12px">Pendiente</span></div></td>'; return; }
        if (ref && r.ref !== ref) { h += '<td><div class="mc na"><span style="font-size:13px">' + r.ref + '</span><span style="font-size:12px">Otra referencia</span></div></td>'; return; }
        const v = r.live ? r.projection : r.compliance;
        const st = status('cumplimiento', v);
        h += '<td><button class="mc ' + (st === 'ok' ? '' : 'cell-' + st) + '" data-go="#/p3' + q({ l, d, s: si }) + '" aria-label="' + D.lineById[l].name + ', ' + s.name + ': ' + (r.live ? 'proyección ' : '') + pct(v) + ', ' + ST_LABEL[st] + '"><span style="display:flex;gap:6px;align-items:center">' + icon(st) + '<span class="v num">' + pct(v) + '</span></span><span style="font-size:12px;color:var(--ink-2)">' + (r.live ? 'Proyección · en curso' : 'Scrap ' + pct(r.scrapRate)) + '</span></button></td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table></section>';
    const rows = lines.map((l) => {
      const rs = recsFor(d, [l], ref);
      const a = D.aggregate(rs);
      if (!a) return null;
      const worst = rs.slice().sort((x, y) => ((y.live ? y.planToDate : y.plan) - y.good) - ((x.live ? x.planToDate : x.plan) - x.good))[0];
      return { name: D.lineById[l].name, ...a.losses, href: '#/p3' + q({ l, d, s: worst.s }) };
    }).filter(Boolean);
    h += '<section class="panel"><h2>Brecha plan–real por tipo de pérdida ' + info('brecha') + '<span class="sub">unidades · pulse una línea</span></h2><div class="legend"><span><i style="background:var(--series-1)"></i>Parada</span><span><i style="background:var(--series-2)"></i>Ritmo inferior</span><span><i style="background:var(--series-3)"></i>Scrap</span></div>' + CH.decomposition({ rows }) + '</section></div>';
    h += '<div class="grid split" style="grid-template-columns: 1fr 1fr">';
    const dayAlerts = D.ALERTS.filter((a) => (a.d === d || (d === 0 && isOpen(a.id))) && lines.includes(a.l)).sort((a, b) => absMin(b.d, b.s, b.t) - absMin(a.d, a.s, a.t));
    h += '<section class="panel"><h2>Alertas del día<span class="sub">y abiertas de días anteriores</span></h2><ul class="list">';
    if (!dayAlerts.length) h += '<li class="muted" style="padding:10px 2px">Sin alertas.</li>';
    dayAlerts.forEach((a) => {
      const stale = isOpen(a.id) && ageMin(a) > 1440;
      h += '<li><button class="row" data-go="#/p5?a=' + a.id + '&from=p2">' + icon(prio(a)) + '<div class="grow"><div class="t1">' + a.l + ' · ' + esc(alertTitle(a)) + '</div><div class="t2">' + a.id + ' · ' + when(a) + ' · ' + alertValue(a) + (stale ? ' · <b style="color:var(--crit)">sin cerrar desde hace ' + durTxt(ageMin(a)) + '</b>' : '') + '</div></div>' + pill(a.id) + '<span class="chev" aria-hidden="true">›</span></button></li>';
    });
    h += '</ul></section>';
    const od = D.OVERDUE.filter((o) => lines.includes(o.l));
    h += '<section class="panel"><h2>Preventivo vencido en equipos críticos ' + info('preventivo') + '</h2><ul class="list">';
    if (!od.length) h += '<li class="muted" style="padding:10px 2px">Ninguno en las líneas seleccionadas.</li>';
    od.forEach((o) => {
      h += '<li><div class="row" style="cursor:default">' + icon('crit') + '<div class="grow"><div class="t1">' + o.equip + ' · ' + D.lineById[o.l].name + '</div><div class="t2">' + o.ot + ' · ' + esc(o.task) + '</div></div><div style="text-align:right"><div class="st st-crit">Vencido hace ' + o.since + ' días</div><div class="t2 muted" style="font-size:12px">desde ' + D.dayLabel(o.since, true) + '</div></div></div></li>';
    });
    h += '</ul><p class="muted" style="font-size:12px;margin:8px 0 0">La orden se gestiona en el GMAO. El MVP no escribe en él.</p></section></div>';
    return h + '</div></div>';
  }

  /* P3 */
  function renderP3(p) {
    const l = p.get('l') || 'L2', d = +(p.get('d') || 0), s = +(p.get('s') ?? 1);
    const sh = D.shift(d, s, l);
    const L = D.lineById[l];
    const vId = p.get('v') || L.vars[0].id;
    const v = L.vars.find((x) => x.id === vId) || L.vars[0];
    const lot = sh && sh.lots.find((x) => x.id === p.get('lot'));
    const par = p.get('par') || 'turno';
    const base = { l, d, s, v: vId, lot: lot ? lot.id : null, par };
    const link = (over) => '#/p3' + q({ ...base, ...over });
    const days = D.prodDays(5);
    let h = '<div class="scr"><div class="scr-head"><div><h1>Planta: análisis de desviación</h1><nav class="crumbs" aria-label="Migas de pan"><a href="#/p2' + q({ d: d || null }) + '">Planta piloto</a><span>›</span><a href="#/p2' + q({ d: d || null, l }) + '">' + L.name + '</a><span>›</span><span>' + D.dayLabel(d) + ' · ' + D.SHIFTS[s].name + '</span>' + (lot ? '<span>›</span><span>' + lot.order + '</span><span>›</span><span>Lote ' + lot.id + '</span>' : '') + '</nav></div><div class="spacer"></div>' +
      '<div class="filters"><label>Línea<select data-filter3="l">' + D.LINES.map((x) => '<option value="' + x.id + '"' + (x.id === l ? ' selected' : '') + '>' + x.name + '</option>').join('') + '</select></label>' +
      '<label>Día<select data-filter3="d">' + days.map((x) => '<option value="' + x + '"' + (x === d ? ' selected' : '') + '>' + D.dayLabel(x) + '</option>').join('') + '</select></label>' +
      '<label>Turno<select data-filter3="s">' + D.SHIFTS.map((x, i) => '<option value="' + i + '"' + (i === s ? ' selected' : '') + (D.shift(d, i, l) ? '' : ' disabled') + '>' + x.name + '</option>').join('') + '</select></label>' +
      '<label>Variable<select data-filter3="v">' + L.vars.map((x) => '<option value="' + x.id + '"' + (x.id === v.id ? ' selected' : '') + '>' + x.name + '</option>').join('') + '</select></label></div></div>';
    if (!sh) return h + '<div class="scr-body"><p>No hay producción en este turno.</p></div></div>';
    const plan = sh.live ? sh.planToDate : sh.plan;
    const gap = plan - sh.good;
    const k = sh.live ? sh.projection : sh.compliance;
    const stK = status('cumplimiento', k);
    h += '<div class="scr-body grid" style="grid-template-columns: 1.65fr 1fr; align-items:start"><div class="grid">';
    h += '<section class="panel"><h2>Plan frente a real ' + info(sh.live ? 'proyeccion' : 'cumplimiento') + '<span class="sub">unidades buenas acumuladas</span></h2>' +
      '<div style="display:flex;gap:18px;flex-wrap:wrap;align-items:center;margin-bottom:6px;font-size:14px"><span>' + (sh.live ? 'Proyección al cierre' : 'Cumplimiento') + ' <b class="num">' + pct(k) + '</b></span>' + badge(stK) +
      '<span class="muted">Brecha ' + (sh.live ? 'a esta hora ' : '') + '<b class="num" style="color:var(--ink)">' + nf(Math.max(0, gap)) + ' u</b>: parada ' + nf(sh.losses.parada) + ' · ritmo ' + nf(sh.losses.ritmo) + ' · scrap ' + nf(sh.losses.scrap) + ' ' + info('brecha') + '</span></div>' +
      '<div class="legend"><span><i class="ln" style="background:var(--plan)"></i>Plan</span><span><i class="ln" style="background:var(--series-1)"></i>Real</span>' + (sh.live ? '<span><i class="dash" style="border-color:var(--series-1)"></i>Proyección</span>' : '') + (lot ? '<span><i style="background:#e7f0fb;border:1px solid #b7d3f6"></i>Lote seleccionado</span>' : '') + '</div>' +
      CH.cumulative({ sh, selLot: lot }) + '</section>';
    const S = sh.samples[v.id];
    h += '<section class="panel"><h2>Gráfico de control · ' + esc(v.name) + ' ' + info('spc') + '<span class="sub">' + S.episodes.length + (S.episodes.length === 1 ? ' señal' : ' señales') + ' en el turno · banda gris ±2σ</span></h2>' + CH.control({ sh, v, selLot: lot, alerts: D.ALERTS.filter((a) => a.d === d && a.s === s && a.l === l) }) + '</section>';
    const od = D.OVERDUE.find((o) => o.l === l && o.since >= d);
    h += '<section class="panel"><h2>Paradas y mantenimiento ' + info('paradas') + '<span class="sub">' + sh.stopMin + ' min de parada no planificada</span></h2>' + CH.timeline({ sh, overdue: od }) + '</section></div><div class="grid">';
    h += '<section class="panel"><h2>Orden y lotes<span class="sub">pulse un lote</span></h2><table class="tbl"><thead><tr><th>Lote</th><th>Tramo</th><th class="r">Proc.</th><th class="r">Scrap</th><th class="r">FPY</th><th class="r">SPC</th></tr></thead><tbody>';
    h += '<tr><td colspan="6" style="background:var(--surface-2);font-weight:600">' + sh.lots[0].order + ' · ' + sh.ref + ' · ' + sh.lots.length + ' lotes</td></tr>';
    sh.lots.forEach((x) => {
      const sr = x.processed ? x.scrap / x.processed : null;
      const st = status('scrap', sr);
      h += '<tr class="click' + (lot && lot.id === x.id ? ' sel' : '') + '" data-go="' + link({ lot: lot && lot.id === x.id ? null : x.id }) + '" tabindex="0"><td>' + x.id + '</td><td class="num">' + D.shiftTime(s, x.start) + '–' + (x.live ? 'ahora' : D.shiftTime(s, x.end)) + '</td><td class="r num">' + x.processed + '</td><td class="r num">' + (st === 'ok' ? '' : icon(st) + ' ') + x.scrap + ' · ' + pct(sr) + '</td><td class="r num">' + pct(x.fpy) + '</td><td class="r num">' + (x.signals ? '<b style="color:var(--crit)">' + x.signals + '</b>' : '0') + '</td></tr>';
    });
    h += '</tbody></table></section>';
    const lastDays = D.prodDays(5);
    const causes = par === 'turno' ? sh.causes : D.aggregate(lastDays.flatMap((x) => D.shiftsOfDay(x, l))).causes;
    const items = Object.entries(causes).sort((a, b) => b[1] - a[1]);
    h += '<section class="panel"><h2>Scrap por causa ' + info('pareto') + '</h2><div class="seg" role="group" aria-label="Periodo del Pareto" style="margin-bottom:10px"><button data-go="' + link({ par: 'turno' }) + '" aria-pressed="' + (par === 'turno') + '">Este turno</button><button data-go="' + link({ par: '5d' }) + '" aria-pressed="' + (par === '5d') + '">Últimos 5 días</button></div>' + (items.length ? CH.pareto({ items }) : '<p class="muted">Sin scrap registrado.</p>') + '</section>';
    h += '<p class="muted" style="font-size:12px;margin:0">Las coincidencias temporales entre paneles son hipótesis de causa, no causalidad demostrada. La acción de mejora se abre con calidad por su canal habitual.</p>';
    return h + '</div></div></div>';
  }

  /* P4 */
  function renderP4() {
    const { d, s } = D.CLOCK;
    const shs = D.LINES.map((L) => D.shift(d, s, L.id));
    const rem = 480 - D.CLOCK.min;
    let h = '<div class="scr p4"><div class="scr-head"><div><h1>Mi turno</h1><div class="ctx">Planta piloto · Mañana 06:00–14:00 · Ahora 10:40 · Quedan ' + durTxt(rem) + '</div></div><div class="spacer"></div><div class="ctx">Jefe de turno · Mañana</div></div><div class="scr-body grid">';
    h += '<div><h2 style="margin:0 0 8px;display:flex;gap:6px;align-items:center">Proyección de cumplimiento al cierre del turno ' + info('proyeccion') + '</h2><div class="cards">';
    shs.forEach((sh) => {
      const st = status('proyeccion', sh.projection);
      h += '<div class="lc ' + (st === 'ok' ? '' : 'cell-' + st) + '"><div class="nm"><span>' + sh.line.name + '</span><span class="muted" style="font-size:13px;font-weight:500">' + sh.ref + '</span></div><div class="big num">' + pct(sh.projection, 0) + '</div>' + badge(st) + '<div class="sm num">Real ' + nf(sh.good) + ' de ' + nf(sh.planToDate) + ' previstas a esta hora · plan del turno ' + nf(sh.plan) + '</div></div>';
    });
    h += '</div></div>';
    const act = D.ALERTS.filter((a) => a.d === d && a.s === s && isOpen(a.id)).sort((a, b) => (prio(a) === prio(b) ? b.t - a.t : prio(a) === 'crit' ? -1 : 1));
    const closed = D.ALERTS.filter((a) => a.d === d && a.s === s && !isOpen(a.id));
    h += '<div class="grid split" style="grid-template-columns: 1.4fr 1fr; align-items:start"><section><h2 style="margin:0 0 8px">Alertas activas del turno · ' + act.length + '</h2>';
    if (!act.length) h += '<div class="panel muted">' + ICON.ok + ' Sin alertas activas.</div>';
    act.forEach((a) => {
      const pr = prio(a);
      h += '<button class="alert-row ' + (pr === 'crit' ? 'prio' : '') + '" data-go="#/p5?a=' + a.id + '&from=p4">' + badge(pr, PRIO_LABEL[pr]) + '<div style="flex:1;min-width:0"><div class="t1">' + a.l + ' · ' + esc(alertTitle(a)) + '</div><div class="t2">' + D.shiftTime(a.s, a.t) + ' · ' + alertValue(a) + ' · ' + esc(alertRef(a)) + '</div></div>' + pill(a.id) + '<span class="chev" aria-hidden="true">›</span></button>';
    });
    if (closed.length) h += '<p class="muted" style="margin:4px 0 0;font-size:14px">' + closed.length + (closed.length > 1 ? ' alertas cerradas' : ' alerta cerrada') + ' en este turno: ' + closed.map((a) => '<a href="#/p5?a=' + a.id + '&from=p4">' + a.id + '</a>').join(', ') + '</p>';
    h += '</section><div class="grid">';
    const ongoing = shs.filter((sh) => sh.ongoingStop);
    h += '<section class="panel"><h2>Paradas no planificadas en curso ' + info('paradas') + '</h2>';
    if (!ongoing.length) h += '<p class="muted" style="margin:0">Ninguna.</p>';
    ongoing.forEach((sh) => {
      const st = sh.ongoingStop;
      h += '<div style="display:flex;gap:10px;align-items:center;font-size:16px">' + icon('crit') + '<div><b>' + sh.line.name + '</b> · ' + esc(st.cause) + '<div class="muted" style="font-size:14px">Desde las ' + D.shiftTime(sh.s, st.start) + ' · ' + st.dur + ' min</div></div></div>';
    });
    h += '<div class="muted" style="font-size:13px;margin-top:8px">Acumulado del turno: ' + shs.map((sh) => sh.line.id + ' ' + sh.stopMin + ' min').join(' · ') + '</div></section>';
    h += '<section class="panel"><h2>Scrap acumulado del turno ' + info('scrap') + '</h2><table class="tbl" style="font-size:15px"><tbody>';
    shs.forEach((sh) => {
      const st = status('scrap', sh.scrapRate);
      h += '<tr><td><b>' + sh.line.name + '</b></td><td class="r num">' + sh.scrap + ' u</td><td class="r num">' + pct(sh.scrapRate) + '</td><td class="r">' + badge(st) + '</td></tr>';
    });
    h += '</tbody></table></section></div></div>';
    return h + '</div></div>';
  }

  /* P5 */
  function renderP5(p) {
    const a = alertById(p.get('a') || 'ALR-103') || alertById('ALR-103');
    const from = p.get('from') || 'p4';
    const sh = D.shift(a.d, a.s, a.l);
    const back = { p4: ['#/p4', 'Mi turno'], p3: ['#/p3' + q({ l: a.l, d: a.d, s: a.s, v: a.var }), 'Análisis de desviación'], p2: ['#/p2' + q({ d: a.d || null }), 'Resumen del día'] }[from] || ['#/p4', 'Mi turno'];
    const pr = prio(a);
    let h = '<div class="scr"><div class="scr-head"><a class="btn sm" href="' + back[0] + '">‹ ' + back[1] + '</a><div><h1>Detalle de alerta · ' + a.id + '</h1><div class="ctx">' + D.lineById[a.l].name + ' · ' + D.dayLabel(a.d) + ' · turno de ' + D.SHIFTS[a.s].name.toLowerCase() + '</div></div><div class="spacer"></div>' + pill(a.id) + '</div>';
    h += '<div class="scr-body grid split" style="grid-template-columns: 1.7fr 1fr; align-items:start"><div class="grid">';
    h += '<section class="panel"><div style="display:flex;gap:10px;align-items:center;margin-bottom:6px">' + badge(pr, PRIO_LABEL[pr]) + '<span class="muted" style="font-size:13px">Emitida ' + when(a) + ' por Activator</span></div><div style="font-size:20px;font-weight:700;margin-bottom:6px">' + esc(alertTitle(a)) + ' ' + info(a.type === 'spc' ? 'spc' : 'proyeccion') + '</div>' +
      '<div style="font-size:15px;margin-bottom:10px">' + esc(alertCond(a)) + '</div><div style="display:flex;gap:28px;flex-wrap:wrap"><div><div class="muted" style="font-size:13px">Valor</div><div style="font-size:28px;font-weight:700;color:var(--crit)" class="num">' + alertValue(a) + '</div></div><div><div class="muted" style="font-size:13px">Referencia</div><div style="font-size:16px;font-weight:600;margin-top:8px">' + esc(alertRef(a)) + '</div></div></div></section>';
    if (a.type === 'spc') {
      const v = varOf(a);
      h += '<section class="panel"><h2>Evolución de ' + esc(v.name) + '<span class="sub">últimas 3 horas · rombos: señales SPC</span></h2>' + CH.control({ sh, v, selLot: a.lot, onlyFrom: Math.max(0, a.t - 180), alerts: [] }) + '</section>';
    } else {
      h += '<section class="panel"><h2>Evolución de la proyección de cumplimiento<span class="sub">una evaluación por intervalo de carga</span></h2>' + CH.projectionMini({ sh, upto: a.t + 2, threshold: a.threshold }) + '</section>';
    }
    h += '<section class="panel"><h2>Afectados</h2><table class="tbl"><tbody><tr><td class="muted">Línea</td><td><b>' + D.lineById[a.l].name + '</b></td><td class="muted">Referencia</td><td><b>' + sh.ref + '</b></td></tr><tr><td class="muted">Orden</td><td><b>' + a.lot.order + '</b></td><td class="muted">Lote</td><td><b>' + a.lot.id + '</b></td></tr></tbody></table>' +
      '<p style="margin:10px 0 0"><a href="#/p3' + q({ l: a.l, d: a.d, s: a.s, v: a.var, lot: a.lot.id }) + '">Analizar el turno en la vista de planta ›</a></p></section></div>';
    h += '<div class="grid"><section class="panel"><h2>Historial de estados</h2><ul class="hist">';
    const hs = hist(a.id);
    hs.forEach((x) => {
      h += '<li><b>' + STATE_LABEL[x.state] + '</b><div class="when">' + when(x) + ' · ' + esc(x.who) + '</div>' + (x.cause ? '<div>' + esc(x.cause) + (x.note ? '. ' + esc(x.note) : '') + '</div>' : '') + '</li>';
    });
    ['emitida', 'reconocida', 'causa', 'cerrada'].slice(hs.length).forEach((st) => { h += '<li class="pending">' + STATE_LABEL[st] + '<div class="when">pendiente</div></li>'; });
    h += '</ul></section><section class="panel"><h2>Acciones</h2><p style="margin:0 0 10px;font-size:14px">Reconocer, registrar la causa y cerrar se hacen en la tarjeta de Teams. El estado se refleja aquí y en P1 a P4.</p>' +
      '<a class="btn primary" style="width:100%" href="#/teams?a=' + a.id + '">Abrir tarjeta en Teams</a><p class="muted" style="font-size:12px;margin:10px 0 0">La acción correctiva se gestiona en el MES o el GMAO. El MVP no escribe en ellos.</p></section></div>';
    return h + '</div></div>';
  }

  /* Teams */
  function renderTeams(p) {
    const focus = p.get('a') || 'ALR-103';
    const list = D.ALERTS.filter((a) => a.d === 0 || a.id === focus).sort((a, b) => absMin(a.d, a.s, a.t) - absMin(b.d, b.s, b.t));
    let h = '<div class="teams"><aside class="side" aria-label="Canales"><div style="font-weight:700;margin:4px 10px 10px">Equipos</div><div class="ch">Planta piloto · General</div><div class="ch on">Planta piloto · Alertas de turno</div><div class="ch">Calidad</div><div class="ch">Mantenimiento</div></aside><div class="main"><div class="tbar"><b>Alertas de turno</b><span class="muted" style="font-size:13px">Planta piloto</span><span class="sim">Simulación de Teams</span></div><div class="feed">';
    list.forEach((a) => {
      const st = stateOf(a.id);
      const c = causeOf(a.id);
      h += '<div class="msg"><div class="av" aria-hidden="true">A</div><div style="min-width:0;flex:1"><div class="who"><b>Activator · Planta piloto</b> · ' + when(a) + '</div>';
      h += '<div class="acard' + (a.id === focus ? ' focus' : '') + (st === 'cerrada' ? ' closed' : '') + '" id="card-' + a.id + '"><div class="bar"></div><div class="bd"><div class="hd">' + (st === 'cerrada' ? '' : '⚠ ') + esc(alertTitle(a)) + '</div><dl>' +
        '<dt>Línea</dt><dd>' + D.lineById[a.l].name + '</dd><dt>Condición</dt><dd>' + esc(alertCond(a)) + '</dd><dt>Valor</dt><dd>' + alertValue(a) + ' · ' + esc(alertRef(a)) + '</dd><dt>Orden / lote</dt><dd>' + a.lot.order + ' · ' + a.lot.id + '</dd><dt>Estado</dt><dd>' + pill(a.id) + '</dd></dl>';
      if (st === 'emitida') {
        h += '<div class="acts"><button class="tbtn pri" data-act="ack" data-id="' + a.id + '">Reconocer</button><a class="tbtn" style="display:inline-flex;align-items:center;text-decoration:none;color:inherit" href="#/p5?a=' + a.id + '&from=p4">Ver detalle en Power BI</a></div>';
      } else if (st === 'reconocida') {
        h += '<label style="font-size:13px;color:#616161;display:block;margin-bottom:4px" for="cause-' + a.id + '">Causa (catálogo)</label><div class="acts" style="margin-bottom:8px"><select id="cause-' + a.id + '"><option value="">Seleccione una causa…</option>' + D.ALERT_CAUSES.map((x) => '<option>' + esc(x) + '</option>').join('') + '</select></div>' +
          '<label style="font-size:13px;color:#616161;display:block;margin-bottom:4px" for="note-' + a.id + '">Comentario (opcional)</label><textarea id="note-' + a.id + '" placeholder="Qué se ha hecho en la línea"></textarea>' +
          '<div class="acts"><button class="tbtn pri" data-act="cause" data-id="' + a.id + '">Registrar causa</button><a class="tbtn" style="display:inline-flex;align-items:center;text-decoration:none;color:inherit" href="#/p5?a=' + a.id + '&from=p4">Ver detalle en Power BI</a></div>';
      } else if (st === 'causa') {
        h += '<div class="done" style="margin-bottom:10px">Causa: <b>' + esc(c.cause) + '</b>' + (c.note ? '. ' + esc(c.note) : '') + '</div><div class="acts"><button class="tbtn pri" data-act="close" data-id="' + a.id + '">Cerrar alerta</button><a class="tbtn" style="display:inline-flex;align-items:center;text-decoration:none;color:inherit" href="#/p5?a=' + a.id + '&from=p4">Ver detalle en Power BI</a></div>';
      } else {
        const cl = hist(a.id)[hist(a.id).length - 1];
        h += '<div class="done">Cerrada ' + when(cl) + ' por ' + esc(cl.who) + '. Causa: <b>' + esc(c.cause || '—') + '</b>' + (c.note ? '. ' + esc(c.note) : '') + '</div>';
      }
      h += '</div></div></div></div>';
    });
    h += '</div></div></div>';
    return h;
  }

  /* Popover */
  function showPop(el) {
    let title, body;
    if (el.dataset.def) { title = TNAME[el.dataset.def]; body = D.DEFS[el.dataset.def]; }
    else { title = el.dataset.tip; body = el.dataset.tipbody; }
    pop.innerHTML = '<b>' + esc(title) + '</b>' + esc(body || '');
    pop.hidden = false;
    const r = el.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let x = Math.min(window.innerWidth - pw - 8, Math.max(8, r.left + r.width / 2 - pw / 2));
    let y = r.top - ph - 8;
    if (y < 8) y = r.bottom + 8;
    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
  }
  function hidePop() { pop.hidden = true; }

  /* Events */
  const go = (href) => { location.hash = withBare(href).slice(1); };
  document.addEventListener('click', (e) => {
    const inf = e.target.closest('.info');
    if (inf) { e.preventDefault(); e.stopPropagation(); pop.hidden ? showPop(inf) : hidePop(); return; }
    hidePop();
    const a = e.target.closest('[data-act]');
    if (a) {
      const id = a.dataset.id;
      const k = a.dataset.act;
      if (k === 'reset') { S = initial(); save(); render(); }
      else if (k === 'tour-start') { store.sset('odd-tour', '0'); go(TOUR[0].href); render(); }
      else if (k === 'tour-next') { const i = tourIdx(); if (i >= TOUR.length - 1) { store.sset('odd-tour', null); go('#/'); render(); } else { store.sset('odd-tour', String(i + 1)); go(TOUR[i + 1].href); render(); } }
      else if (k === 'tour-prev') { const i = Math.max(0, tourIdx() - 1); store.sset('odd-tour', String(i)); go(TOUR[i].href); render(); }
      else if (k === 'tour-exit') { store.sset('odd-tour', null); render(); }
      else if (k === 'ack') { act(id, 'reconocida'); render(); }
      else if (k === 'cause') {
        const sel = document.getElementById('cause-' + id);
        if (!sel.value) { sel.focus(); sel.style.outline = '3px solid var(--crit)'; return; }
        act(id, 'causa', { cause: sel.value, note: document.getElementById('note-' + id).value.trim() });
        render();
      } else if (k === 'close') { act(id, 'cerrada'); render(); }
      return;
    }
    if (e.target.closest('[data-stop]') && !e.target.closest('a,[data-go]:not(.sheet-bg)')) return;
    const g = e.target.closest('[data-go]');
    if (g) { e.preventDefault(); go(g.dataset.go); return; }
    const l = e.target.closest('a[href^="#/"]');
    if (l && !l.target && isBare()) { e.preventDefault(); go(l.getAttribute('href')); }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-go][tabindex], g[data-go]')) { e.preventDefault(); go(e.target.dataset.go); }
    if (e.key === 'Escape') hidePop();
  });
  document.addEventListener('change', (e) => {
    const f = e.target.dataset.filter, f3 = e.target.dataset.filter3;
    if (f) {
      const { p } = parse();
      p.set(f, e.target.value); p.delete('bare');
      [...p.keys()].forEach((k) => { if (!p.get(k)) p.delete(k); });
      go('#/p2' + (p.toString() ? '?' + p : ''));
    }
    if (f3) {
      const { p } = parse();
      p.set(f3, e.target.value); p.delete('bare'); p.delete('lot');
      if (f3 === 'l') p.delete('v');
      if (f3 !== 's') { const l = p.get('l') || 'L2', d = +(p.get('d') || 0); let s = +(p.get('s') ?? 1); if (!D.shift(d, s, l)) s = [1, 0, 2].find((i) => D.shift(d, i, l)) ?? 0; p.set('s', s); }
      go('#/p3?' + p);
    }
  });
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest('[data-tip],.info');
    if (t) showPop(t);
  });
  document.addEventListener('mouseout', (e) => { if (e.target.closest('[data-tip],.info') && !e.relatedTarget?.closest?.('[data-tip],.info')) hidePop(); });
  document.addEventListener('focusin', (e) => { if (e.target.matches('.info')) showPop(e.target); });
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  window.addEventListener('resize', fit);
  window.addEventListener('scroll', hidePop, true);
  render();
})();
