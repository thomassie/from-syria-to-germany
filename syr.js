/* Europe's Divides: "From Syria to Germany" (D3 v7), drawn into one element:

     <div id="syria-germany" data-base="https://<data host>/"></div>

   data-base        where data/*.json live (default: next to the page)
   data-header      "false" leaves out the built-in title (when the host page has its own)
   data-layout      "standalone" adds the page's own width and side gutters
   data-sticky-top  height in px of a fixed header on the host page, so the held graphic sits below it (default 0)

   A story told in steps: the text scrolls, one graphic is held in view and changes with the step whose text has
   passed a line on the screen. Syrians are followed as a group, never as individual fates. Reads data/*.json,
   written by pipeline/run.py from mart.syr_* (MotherDuck); no database access here. Every number in the text is
   computed here from the same files as the graphics.
   One meaning per colour: ink = totals of people and the EU total; blue = Germany; red = events (dated by an
   official record); grey = deaths (never red) and everything else.
   Words: applicants are counted per country, so they are not the same as people who came; citizenship is not origin
   (UNHCR counts by country of origin); events mark dates, never causes. */
(function () {
  'use strict';

  const root = document.getElementById('syria-germany');
  if (!root || typeof d3 === 'undefined') return;
  const BASE = root.dataset.base ? root.dataset.base.replace(/\/?$/, '/') : '';
  root.classList.add('syr');
  if (root.dataset.layout === 'standalone') root.classList.add('syr--standalone');
  const stickyTop = Math.max(0, parseFloat(root.dataset.stickyTop || '0') || 0);
  root.style.setProperty('--sticky-top', stickyTop + 'px');

  const DOT = '<svg class="title-dot" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><circle cx="5" cy="5" r="5"/></svg>';
  root.innerHTML = `
<div class="masthead wrap"${root.dataset.header === 'false' ? ' hidden' : ''}>
  <div class="masthead__text">
    <p class="eyebrow">Europe&rsquo;s Divides</p>
    <h1>From Syria to Germany${DOT}</h1>
    <p class="lede">Syrians as a group, from the uprising in March 2011 to today: the war, where they found protection, the route to Europe, asylum in Germany, work, and moves back. From official statistics.</p>
  </div>
</div>
<div class="wrap">
  <div class="story">
    <div class="story__graphic">
      <div class="story__figure">
        <div class="story__head">
          <div class="story__top">
            <p class="eyebrow" id="syr-kicker"></p>
            <div class="seg syr-sex" id="syr-sex" role="group" aria-label="Show"></div>
          </div>
          <p class="story__title" id="syr-title"></p>
        </div>
        <div class="legend story__key" id="syr-key"></div>
        <div class="chart story__chart" id="syr-chart" aria-hidden="true"></div>
        <p class="note" id="syr-note"></p>
      </div>
    </div>
    <div class="story__steps" id="syr-steps"></div>
  </div>
  <section class="foot" aria-labelledby="syr-h-method">
    <div><h2 id="syr-h-method">Method and sources</h2></div>
    <div>
      <ul id="syr-method"></ul>
      <p class="credit" id="syr-credit"></p>
    </div>
  </section>
</div>`;

  // ---------- helpers ----------
  const $ = (sel) => root.querySelector(sel.replace(/#([\w-]+)/g, '#syr-$1'));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => (v == null || Number.isNaN(v) ? '–' : d3.format(',')(Math.round(v)));
  const pct = (a, b) => (b ? Math.round((100 * a) / b) + '%' : '–');
  const approx = (v) => d3.format(',')(Math.round(v / 100) * 100);
  // compact counts for labels over columns: 985, 6.2k, 18k, 291k
  const compact = (v) => (v < 1000 ? String(Math.round(v)) : v < 10000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v / 1000)}k`);
  const DL = '<a href="https://www.govdata.de/dl-de/by-2-0">dl-de/by-2-0</a>';
  const QB = 'https://www.destatis.de/DE/Methoden/Qualitaet/Qualitaetsberichte/Bevoelkerung/auslaenderstatistik.pdf?__blob=publicationFile';
  const UNHCR_TERMS = 'https://www.unhcr.org/terms-use-datasets';
  const parseM = d3.timeParse('%Y-%m');
  const parseD = d3.timeParse('%Y-%m-%d');
  const mName = (m) => d3.timeFormat('%B %Y')(parseM(m));
  const dayName = (d) => d3.timeFormat('%-d %B %Y')(parseD(d));
  const andList = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DUR = REDUCED ? 0 : 650;
  const NAMES = { TUR: 'Türkiye', LBN: 'Lebanon', JOR: 'Jordan', IRQ: 'Iraq', EGY: 'Egypt', DEU: 'Germany', SWE: 'Sweden',
    AUT: 'Austria', NLD: 'Netherlands', GBR: 'United Kingdom', FRA: 'France', USA: 'United States', CAN: 'Canada' };

  async function getJSON(path) {
    const r = await fetch(BASE + path + '?m=' + Math.floor(Date.now() / 60000), { cache: 'no-cache' });
    if (!r.ok) throw new Error('Could not load ' + BASE + path + ' (' + r.status + ').');
    return r.json();
  }

  const FILES = ['war', 'abroad', 'applications', 'applications_years', 'decisions', 'events', 'meta',
    'de_register', 'de_status', 'de_stay', 'de_naturalisations', 'de_migration', 'de_moves_syria', 'de_counties', 'counties.topo',
    'routes', 'applications_sex', 'decisions_sex', 'region.topo', 'departures', 'reviews', 'work', 'work_rates', 'work_levels'];
  Promise.all(FILES.map((n) => getJSON('data/' + n + '.json')))
    .then((xs) => { const D = {}; FILES.forEach((n, i) => { D[n] = xs[i]; });
      start({ ...D, apps: D.applications, appsYears: D.applications_years, topo: D['counties.topo'], region: D['region.topo'] }); })
    .catch((err) => {
      $('#steps').innerHTML = '<p class="error">' + esc(err.message) + '</p>';
    });

  function start(D) {
    // ---------- data ----------
    const SEXES = [['T', 'All'], ['M', 'Male'], ['F', 'Female']];
    let SEX = 'T';
    const ofSex = (rows, sx) => rows.filter((r) => (r.sx || 'T') === sx);
    const W = D.war.map((r) => ({ m: r.m, t: parseM(r.m), v: +r.d, p: !!r.p }));
    const warYear = d3.rollup(W, (v) => d3.sum(v, (r) => r.v), (r) => r.t.getFullYear());
    const wy = (y) => warYear.get(y);
    const lastWar = W[W.length - 1];
    const firstPrelim = W.find((r) => r.p);
    const peak = W.reduce((a, r) => (r.v > a.v ? r : a), W[0]);
    const fullWarYears = [...warYear.keys()].filter((y) => W.filter((r) => r.t.getFullYear() === y).length === 12);

    const AB = D.abroad.map((r) => ({ y: +r.y, h: r.h, n: NAMES[r.h] || r.n, nb: !!r.nb, v: +r.v || 0, a: +r.a || 0 }));
    const abYears = [...new Set(AB.map((r) => r.y))].sort((a, b) => a - b);
    const ab = (y, h, k = 'v') => (AB.find((r) => r.y === y && r.h === h) || {})[k] || 0;
    const abTot = (y) => d3.sum(AB.filter((r) => r.y === y), (r) => r.v);
    const abNb = (y) => d3.sum(AB.filter((r) => r.y === y && r.nb), (r) => r.v);
    const turPeak = abYears.reduce((a, y) => (ab(y, 'TUR') > ab(a, 'TUR') ? y : a), abYears[0]);
    // the first year-end at which Germany is the largest host that does not border Syria
    const deTopYear = abYears.find((y) => (AB.filter((r) => r.y === y && !r.nb).sort((a, b) => b.v - a.v)[0] || {}).h === 'DEU') || abYears[0];

    const A = D.apps.map((r) => ({ m: r.m, t: parseM(r.m), g: r.g, v: +r.v, d: r.d }));
    const deM = A.filter((r) => r.g === 'DE');
    const euM = A.filter((r) => r.g === 'EU27_2020');
    const lastDE = deM[deM.length - 1];
    const AY = D.appsYears.map((r) => ({ y: +r.y, g: r.g, n: r.n, r: r.r, v: +r.v, p: !!r.p }));
    const ay = (g, y) => (AY.find((r) => r.g === g && r.y === y) || {}).v;
    const others2015 = AY.filter((r) => r.y === 2015 && r.r === 'europe31' && r.g !== 'DE').sort((a, b) => b.v - a.v).slice(0, 3);

    const decRow = (r) => ({ y: +r.y, t: +r.t, rs: +r.rs || 0, sp: +r.sp || 0, hs: +r.hs || 0, neg: +r.neg || 0, p: !!r.p });
    const DEC = D.decisions.map(decRow).map((r) => ({ ...r, s: r.rs + r.sp + r.hs + r.neg }));
    const decFor = (sx) => (sx === 'T' ? DEC : ofSex(D.decisions_sex, sx).map(decRow).map((r) => ({ ...r, s: r.rs + r.sp + r.hs + r.neg })));
    // applications by sex (Eurostat, Syria alone); T is the series above
    const appsFor = (sx, g) => (sx === 'T' ? (g === 'DE' ? deM : euM)
      : D.applications_sex.filter((r) => r.sx === sx && r.g === g).map((r) => ({ m: r.m, t: parseM(r.m), v: +r.v })));
    const dec = (y) => DEC.find((r) => r.y === y) || { t: 0, rs: 0, sp: 0, hs: 0, neg: 0, s: 0 };
    const lastDec = DEC[DEC.length - 1];

    // Frontex: detections at the EU's external borders per month, route and border type (not people)
    const RT = D.routes.map((r) => ({ m: r.m, r: r.r, b: r.b, s: +r.s || 0, u: +r.u || 0, a: +r.a || 0 }));
    const rtLast = d3.max(RT, (r) => r.m);
    const rtMonths = d3.timeMonths(parseM('2009-01'), d3.timeMonth.offset(parseM(rtLast), 1)).map(d3.timeFormat('%Y-%m'));
    const rtGroup = (code) => (['EM', 'WB', 'CM'].includes(code) ? code : 'OT');
    const rtIdx = d3.rollup(RT, (v) => d3.sum(v, (r) => r.s), (r) => rtGroup(r.r), (r) => r.m);
    const rtSeries = (g) => rtMonths.map((m) => ({ m, t: parseM(m), v: (rtIdx.get(g) || new Map()).get(m) || 0 }));
    const rtY = (g, y, k = 's', b) => d3.sum(RT.filter((r) => (g === 'ALL' || r.r === g) && r.m.startsWith(String(y)) && (!b || r.b === b)), (r) => r[k]);
    const rtM = (g, m) => d3.sum(RT.filter((r) => r.r === g && r.m === m), (r) => r.s);
    const emPeak = rtSeries('EM').reduce((a, r) => (r.v > a.v ? r : a), { v: -1 });
    const rtLastYear = +rtLast.slice(0, 4);
    // where Frontex counts: one point per route and border type (lon, lat), placed on the border section the route
    // names (Frontex' definitions); the circle is the year's detections of Syrian citizens there
    const SECTIONS = [
      { r: 'EM', b: 'Sea', at: [26.4, 38.7], lab: 'Eastern Med., sea', short: 'E. Med. sea' },
      { r: 'EM', b: 'Land', at: [26.5, 41.6], lab: 'Eastern Med., land', short: 'E. Med. land' },
      { r: 'WB', b: 'Land', at: [19.6, 46.0], lab: 'Western Balkans', short: 'W. Balkans' },
      { r: 'CM', b: 'Sea', at: [12.6, 35.6], lab: 'Central Med.', short: 'C. Med.' },
      { r: 'WM', b: 'Sea', at: [-4.2, 36.2], lab: 'Western Med.', short: 'W. Med.' },
      { r: 'EB', b: 'Land', at: [23.9, 53.2], lab: 'Eastern borders', short: 'E. borders' },
    ];
    // schematic lines (lon, lat): they join the border sections in the order the routes run; not a recorded path
    const PATHS = [
      [[37.2, 36.2], [37.4, 37.1], [27.1, 38.4], [26.4, 38.9], [23.7, 38.0], [22.5, 41.1], [21.4, 42.0], [20.5, 44.8],
        [19.9, 46.2], [19.0, 47.5], [16.4, 48.2], [11.6, 48.1]],
      [[37.4, 37.1], [29.0, 41.0], [26.5, 41.6], [22.9, 40.6], [22.5, 41.1]],
      [[20.5, 44.8], [19.1, 45.2], [15.9, 45.8], [15.6, 46.7], [16.4, 48.2]],
      [[35.9, 34.9], [33.5, 33.2], [31.0, 31.8], [25.0, 31.9], [20.0, 32.1], [13.2, 32.9], [12.6, 35.5], [14.0, 37.5], [12.5, 41.9], [11.4, 47.0], [11.6, 48.1]],
    ];
    const secY = (sec, y) => rtY(sec.r, y, 's', sec.b);
    const apY = (y) => AY.filter((r) => r.y === y && r.r === 'europe31' && r.v > 0);
    const EV = D.events;
    const ev = (d) => EV.find((e) => e.d === d);
    const evLink = (d, text) => { const e = ev(d); return e ? `<a href="${esc(e.u)}">${esc(text || e.src)}</a>` : ''; };
    const meta = (src, item) => D.meta.find((r) => r.src === src && (!item || r.i.startsWith(item)));

    // Destatis (GENESIS-Online): Syrian citizens in Germany. Every table by sex (sx: T both, M male, F female); the
    // text always uses T, the graphics follow the switch.
    const REG_ALL = D.de_register.map((r) => ({ sx: r.sx || 'T', y: +r.y, s1: +r.s1, fe: +r.fe, le: +r.le, en: +r.en, b: +r.b, ma: +r.ma, da: +r.da, del: +r.del }));
    const REG = ofSex(REG_ALL, 'T');
    const reg = (y) => REG.find((r) => r.y === y) || {};
    const lastReg = REG[REG.length - 1];
    // years whose end-of-year count is below the year before, and whether every year from a to b grew
    const regFalls = REG.filter((r, i) => i > 0 && r.s1 < REG[i - 1].s1).map((r) => r.y);
    const regGrows = (a, b) => REG.filter((r) => r.y >= a && r.y <= b).every((r) => !regFalls.includes(r.y));
    const NAT_ALL = D.de_naturalisations.map((r) => ({ sx: r.sx || 'T', y: +r.y, v: +r.v, a: +r.a })).filter((r) => r.y >= 2011);
    const NAT = ofSex(NAT_ALL, 'T');
    const nat = (y) => NAT.find((r) => r.y === y) || {};
    const lastNat = NAT[NAT.length - 1];
    const natSince2016 = d3.sum(NAT.filter((r) => r.y >= 2016), (r) => r.v);
    const STS_ALL = D.de_status.map((r) => ({ sx: r.sx || 'T', y: +r.y, t: +r.t, o: +r.o, rl: +r.rl, rp: +r.rp, x: +r.x }));
    const STS = ofSex(STS_ALL, 'T');
    const sts = (y) => STS.find((r) => r.y === y) || {};
    const lastSts = STS[STS.length - 1];
    const stayYear = d3.max(D.de_stay, (r) => +r.y);
    // Destatis' bands of length of stay at 31 December, read as years of first entry; 15 years and more together
    const stayFor = (sx) => {
      const rows = D.de_stay.filter((r) => +r.y === stayYear && (r.sx || 'T') === sx).map((r) => ({ f: +r.f, v: +r.v, k: r.k }));
      const bands = [[0, 1], [1, 4], [4, 6], [6, 8], [8, 10], [10, 15], [15, 99]];
      return bands.map(([a, b]) => {
        const v = d3.sum(rows.filter((r) => r.f >= a && r.f < b), (r) => r.v);
        const from = stayYear - b + 1, to = stayYear - a;
        return { key: `${a}`, a, b, v, years: b >= 99 ? `until ${stayYear - 15}` : from === to ? `${to}` : `${from}–${to}`,
          name: b >= 99 ? '15+ years' : a === 0 ? 'under 1 year' : `${a}–${b} years` };
      });
    };
    const STAY = stayFor('T');
    const stay = (a) => STAY.find((r) => r.a === a) || {};
    // the group that first came in 2015 or 2016: in the years where one of Destatis' bands of length of stay covers
    // exactly those two years of first entry (2020: 4 to 6 years, 2022: 6 to 8, 2024: 8 to 10)
    const bandFrom = [...new Set(D.de_stay.map((r) => +r.f))].sort((a, b) => a - b);
    const groupFor = (sx) => [...new Set(D.de_stay.map((r) => +r.y))].sort((a, b) => a - b).filter((y) => {
      const i = bandFrom.indexOf(y - 2016);
      return i >= 0 && bandFrom[i + 1] === y - 2014;
    }).map((y) => ({ y, v: d3.sum(D.de_stay.filter((r) => +r.y === y && +r.f === y - 2016 && (r.sx || 'T') === sx), (r) => +r.v) }));
    const GROUP = groupFor('T');
    const group = (y) => (GROUP.find((r) => r.y === y) || {}).v;
    const g0 = GROUP[0] || {}, g1 = GROUP[GROUP.length - 1] || {};
    const MIG = D.de_migration.map((r) => ({ y: +r.y, i: +r.i, o: +r.o, n: +r.n })).filter((r) => r.y >= 2011);
    const lastMig = MIG[MIG.length - 1];
    const migMoreBefore = MIG.filter((r) => r.y < lastMig.y && r.o > lastMig.o).map((r) => r.y).pop();
    // moves between Germany and Syria by country of destination (12711-0008): citizenship only German or foreign
    const TS = D.de_moves_syria.map((r) => ({ y: +r.y, o: +r.o, of: +r.of, og: +r.og, i: +r.i })).filter((r) => r.y >= 2011 && r.o > 0);
    const lastTS = TS[TS.length - 1];
    const ts = (y) => TS.find((r) => r.y === y) || {};
    const tsMoreBefore = lastTS && TS.filter((r) => r.y < lastTS.y && r.o > lastTS.o).map((r) => r.y).pop();
    const pctFloor = (a, b) => (b ? Math.floor((100 * a) / b) + '%' : '–');   // for "at least"

    // Federal Employment Agency (Migrationsmonitor): Syrian citizens per month; T from 2010, male and female from 2020
    const nOrNull = (v) => (v == null ? null : +v);
    const WK = D.work.map((r) => ({ m: r.m, t: parseM(r.m), sx: r.sx, e: nOrNull(r.e), en: nOrNull(r.en), u: nOrNull(r.u), b: nOrNull(r.b), ee: !!r.ee, be: !!r.be }));
    const wkOf = (sx) => WK.filter((r) => r.sx === sx);
    const WKT = wkOf('T');
    const hasWork = WKT.some((r) => r.e != null);
    const lastOf = (rows, k, est) => rows.filter((r) => r[k] != null && (!est || !r[est])).pop() || {};
    const empFirst = WKT.find((r) => r.e != null) || {};
    const empFinal = lastOf(WKT, 'e', 'ee'), empLast = lastOf(WKT, 'e');
    const empF = lastOf(wkOf('F'), 'e', 'ee'), empM = WK.find((r) => r.sx === 'M' && r.m === empF.m) || {};
    const empTF = WKT.find((r) => r.m === empF.m) || {};
    const sgbPeak = WKT.filter((r) => r.b != null).reduce((a, r) => (r.b > (a.b || 0) ? r : a), {});
    const sgbLast = lastOf(WKT, 'b'), sgbFinal = lastOf(WKT, 'b', 'be'), unLast = lastOf(WKT, 'u');
    const WR = D.work_rates.map((r) => ({ m: r.m, t: parseM(r.m), g: r.g, er: nOrNull(r.er), sv: nOrNull(r.sv), ur: nOrNull(r.ur), sr: nOrNull(r.sr), p: !!r.p }))
      .filter((r) => r.m >= '2010-01');   // as the counts, from January 2010
    const wrOf = (g) => WR.filter((r) => r.g === g && r.er != null);
    // the agency calls the latest rates provisional: the text names the last final month, and the latest apart
    const erFirst = wrOf('SY')[0] || {}, erLast = wrOf('SY').filter((r) => !r.p).pop() || {}, erProv = wrOf('SY').filter((r) => r.p).pop();
    const erLow = wrOf('SY').filter((r) => r.m >= '2015-01').reduce((a, r) => (r.er < (a.er ?? 101) ? r : a), {});
    const erAt = (g, m) => (WR.find((r) => r.g === g && r.m === m) || {}).er;
    const WL = D.work_levels.map((r) => ({ m: r.m, he: +r.he || 0, sk: +r.sk || 0, sp: +r.sp || 0, ex: +r.ex || 0, t: +r.t || 0, e: !!r.e }));
    const WLY = WL.filter((r, i) => r.m.endsWith('-12') || i === WL.length - 1)
      .map((r) => ({ ...r, y: r.m, lab: r.m.endsWith('-12') ? r.m.slice(0, 4) : mName(r.m), labShort: r.m.endsWith('-12') ? `’${r.m.slice(2, 4)}` : `${d3.timeFormat('%b')(parseM(r.m))} ’${r.m.slice(2, 4)}` }));
    const wlLast = WL.filter((r) => !r.e).pop() || {};   // the last month without the agency's estimates
    const pct1 = (a, b) => (b ? `${Math.round((1000 * a) / b) / 10}%` : '–');
    // the federal government's answers to the Bundestag: voluntary departures per month (months it gave), reviews of
    // protection per year (2026: first half), deportations
    const MON = d3.timeFormat('%b');
    const DEP = (() => {
      const have = new Map(D.departures.map((r) => [r.m, r]));
      const first = d3.min(D.departures, (r) => r.m), last = d3.max(D.departures, (r) => r.m);
      return d3.timeMonths(parseM(first), d3.timeMonth.offset(parseM(last), 1)).map((t) => {
        const m = d3.timeFormat('%Y-%m')(t), r = have.get(m);
        return { y: m, w: r ? +r.w : 0, o: r ? +r.o : 0, gap: !r, lab: `${MON(t)} ’${m.slice(2, 4)}`, labShort: m.endsWith('-01') ? `’${m.slice(2, 4)}` : MON(t).slice(0, 1) };
      });
    })();
    const depSum = (from, to, k) => d3.sum(DEP.filter((r) => r.y >= from && r.y <= to), (r) => (k ? r[k] : r.w + r.o));
    const depGap = DEP.filter((r) => r.gap).map((r) => r.y);
    const depSrc = (m) => { const r = D.departures.find((x) => x.m === m); return r ? `<a href="${esc(r.u)}">${esc(r.src.split(',')[0])}</a>` : ''; };
    const REV = D.reviews.map((r) => ({ p: r.p, y: r.p, s: +r.s || 0, d: +r.d || 0, kept: +r.n || 0, dsy: +r.dsy || 0, del: +r.del || 0,
      rev: (+r.ra || 0) + (+r.rr || 0) + (+r.rs || 0) + (+r.rb || 0), src: r.src, u: r.u,
      lab: r.p.includes('-H1') ? `Jan–Jun ${r.p.slice(0, 4)}` : r.p, labShort: r.p.includes('-H1') ? `H1 ’${r.p.slice(2, 4)}` : `’${r.p.slice(2, 4)}` }))
      .filter((r) => r.d > 0 || r.s > 0);
    const rev = (p) => REV.find((r) => r.p === p) || {};
    const revLast = REV[REV.length - 1] || {};
    const revPeak = REV.reduce((a, r) => (r.s > a.s ? r : a), REV[0] || {});
    const revSrc = REV.length ? `<a href="${esc(REV[0].u)}">${esc((REV[0].src || '').split(',')[0])}</a>` : '';
    const DEPO = D.reviews.filter((r) => r.del != null || r.dsy != null);
    const deportedToSyria = d3.sum(DEPO, (r) => +r.dsy || 0), deportedElsewhere = d3.sum(DEPO, (r) => +r.del || 0);
    const depoLast = DEPO.length ? DEPO[DEPO.length - 1].p : '';
    const depoTo = depoLast.includes('-H1') ? `June ${depoLast.slice(0, 4)}` : depoLast ? `December ${depoLast}` : '';
    const destatis = (code) => { const r = meta('Destatis', code); return r ? `<a href="${esc(r.url)}">${code}</a>` : code; };
    // Destatis' terms: the source, the table, the licence (linked) and that the data were changed
    const dsrc = (what, code, tail = '') => `Source: Statistisches Bundesamt (Destatis), ${what} (GENESIS-Online ${destatis(code)})${tail}; data licence ${DL}; own calculation.`;
    // the Employment Agency's terms: the source, the issue, and that shares and sums are own calculations
    const basrc = () => { const r = meta('BA');
      return `Source: Statistik der Bundesagentur für Arbeit (Federal Employment Agency), ${r && r.url ? `<a href="${esc(r.url)}">${esc(r.i)}</a>` : 'Migrationsmonitor'}${r && r.thru ? `, report month ${mName(r.thru)}` : ''}; own calculation.`; };
    // BKG's source note in full, with its links
    const bkgNote = () => {
      const c = (D.topo.meta && D.topo.meta.credit) || '';
      const mm = c.match(/^© BKG \((\d{4})\) dl-de\/by-2-0, Datenquellen: (\S+?);?\s*(?:changed: (.*))?$/);
      return mm ? `© <a href="https://www.bkg.bund.de">BKG</a> (${mm[1]}) ${DL}, Datenquellen: <a href="${esc(mm[2])}">${esc(mm[2])}</a>${mm[3] ? `; changed: ${esc(mm[3])}` : ''}` : esc(c);
    };
    // protection seekers by county at 31 December of the latest year. Destatis counts them where the immigration
    // office that keeps their record sits; where one office serves several counties, the map draws them as one unit.
    const UNIT_NAMES = { 10044: 'Saarland', '06611': 'Kassel, city and district', 12052: 'Cottbus and Spree-Neiße' };
    const UNIT_NOTE = { 10044: 'all of Saarland', '06611': 'the city and the district of Kassel', 12052: 'Cottbus and the district of Spree-Neiße' };
    const shortName = (n) => n.replace(/,\s*(kreisfreie Stadt|Landkreis|Stadt|Kreis)$/, '');
    const CTY_ALL = D.de_counties.map((r) => ({ sx: r.sx || 'T', k: r.k, n: UNIT_NAMES[r.k] || shortName(r.n), v: +r.v || 0, unit: !!UNIT_NAMES[r.k] }));
    const CTY = ofSex(CTY_ALL, 'T');
    const ctyRank = [...CTY].sort((a, b) => b.v - a.v);
    const ctyTot = d3.sum(CTY, (r) => r.v);
    const ctyYear = ((meta('Destatis', '12531-0043') || {}).thru || '').slice(0, 4);
    // rankings and shares by county leave out the merged units (Saarland is a federal state of six counties)
    const CTYC = CTY.filter((r) => !r.unit), ctyRankC = [...CTYC].sort((a, b) => b.v - a.v);
    const ctyUnderC = (n) => CTYC.filter((r) => r.v < n).length;
    const saar = CTY.find((r) => r.k === '10044') || {};

    // ---------- the steps ----------
    // scene: which graphic; range: months in focus (war, asylum) or years (decisions); year: the year shown (abroad);
    // events: dated marks with a short label; alt: what the graphic shows at this step, for screen readers.
    const warMin = d3.min(fullWarYears.filter((y) => y >= 2021), wy), warMax = d3.max(fullWarYears.filter((y) => y >= 2021), wy);
    const lastAb = abYears[abYears.length - 1];
    const CH = [
      { n: 1, id: 'war', title: 'The war', steps: [
        { scene: 'war', range: ['2011-01', '2011-12'], events: [['2011-03-22', 'Deraa']],
          text: `<p>On 22 and 23 March 2011, protesters are killed in Deraa, in the south of Syria. Media reports say security forces fired on them, UN News notes; the UN Secretary-General calls for an investigation into the killings (${evLink('2011-03-22', 'UN News')}).</p>
                 <p>For 2011, the Uppsala Conflict Data Program (UCDP) records ${num(wy(2011))} deaths from organised violence in Syria.</p>`,
          alt: `UCDP deaths from organised violence in Syria per month since January 2010; 2011 marked, ${num(wy(2011))} deaths.` },
        { scene: 'war', range: ['2012-01', '2014-12'], events: [['2013-08-21', 'Ghouta']],
          text: `<p>The count rises to ${num(wy(2012))} in 2012, ${num(wy(2013))} in 2013 and ${num(wy(2014))} in 2014. In this page&rsquo;s monthly allocation of UCDP&rsquo;s events, the highest month is ${mName(peak.m)}, with about ${approx(peak.v)}.</p>
                 <p>On 21 August 2013, rockets carrying sarin hit the Ghouta area near Damascus, UN investigators find (${evLink('2013-08-21', 'UN News')}).</p>
                 <p class="note">UCDP counts deaths it can attribute to organised violence. The UN human rights office estimates that 306,887 civilians were killed from March 2011 to March 2021 (<a href="https://news.un.org/en/story/2022/06/1121532">UN News</a>).</p>`,
          alt: `Deaths per month; 2012 to 2014 marked: ${num(wy(2012))}, ${num(wy(2013))} and ${num(wy(2014))} deaths.` },
        { scene: 'war', range: ['2015-01', '2019-12'], events: [['2015-09-30', 'Russian air strikes'], ['2019-12-11', 'Idlib']],
          text: `<p>From 2015, the yearly count falls: ${num(wy(2015))} in 2015, ${num(wy(2017))} in 2017, ${num(wy(2019))} in 2019.</p>
                 <p>Russia begins air strikes in Syria on 30 September 2015 (${evLink('2015-09-30', 'UN document S/2015/792')}). In December 2019, fighting in the north-west (Idlib) displaces more than 130,000 people within two weeks (${evLink('2019-12-11', 'UN News')}).</p>`,
          alt: `Deaths per month; 2015 to 2019 marked, falling from ${num(wy(2015))} to ${num(wy(2019))} a year.` },
        { scene: 'war', range: ['2020-01', lastWar.m], events: [['2023-02-06', 'Earthquakes'], ['2024-12-08', 'Assad government falls']],
          text: `<p>Since 2021, UCDP records between ${num(warMin)} and ${num(warMax)} deaths a year. On 6 February 2023, earthquakes strike southern Türkiye and northern Syria (${evLink('2023-02-06', 'UN News')}). On 8 December 2024, the Assad government falls (${evLink('2024-12-08', 'UN News')}).</p>
                 ${firstPrelim ? `<p class="note">Months from ${mName(firstPrelim.m)} to ${mName(lastWar.m)} are preliminary.</p>` : ''}`,
          alt: `Deaths per month; 2020 to ${mName(lastWar.m)} marked, ${num(warMin)} to ${num(warMax)} a year since 2021.` },
      ] },
      { n: 2, id: 'abroad', title: 'Leaving, mostly for the neighbours', steps: [
        { scene: 'abroad', year: 2015,
          text: `<p>At the end of 2015, UNHCR counts ${num(abTot(2015))} people from Syria as refugees living abroad. ${pct(abNb(2015), abTot(2015))} of them live in a country that borders Syria: ${num(ab(2015, 'TUR'))} in Türkiye, ${num(ab(2015, 'LBN'))} in Lebanon, ${num(ab(2015, 'JOR'))} in Jordan.</p>
                 <p class="note">UNHCR counts people by their country of origin, not their citizenship. In Lebanon, the registration of Syrian nationals has been suspended since 5 May 2015 (<a href="https://help.unhcr.org/lebanon/en/registration">UNHCR Lebanon</a>).</p>`,
          alt: `People from Syria counted by UNHCR as refugees abroad at the end of 2015, by country: ${num(abTot(2015))} in all, ${pct(abNb(2015), abTot(2015))} in neighbouring countries.` },
        { scene: 'abroad', year: deTopYear,
          text: `<p>Germany is the largest host that does not border Syria from the end of ${deTopYear}: ${num(ab(deTopYear, 'DEU'))}, and ${num(ab(deTopYear + 1, 'DEU'))} a year later, against ${num(ab(deTopYear - 1, 'DEU'))} at the end of ${deTopYear - 1}.</p>
                 <p class="note">Asylum-seekers whose application is still pending are counted apart: ${num(ab(deTopYear, 'DEU', 'a'))} from Syria in Germany at the end of ${deTopYear}.</p>`,
          alt: `People from Syria counted as refugees abroad at the end of ${deTopYear}, by country; Germany ${num(ab(deTopYear, 'DEU'))}.` },
        { scene: 'abroad', year: turPeak,
          text: `<p>Türkiye&rsquo;s count is highest at the end of ${turPeak}: ${num(ab(turPeak, 'TUR'))}. In all, UNHCR counts ${num(abTot(turPeak))} people from Syria as refugees abroad, ${pct(abNb(turPeak), abTot(turPeak))} in a neighbouring country.</p>`,
          alt: `People from Syria counted as refugees abroad at the end of ${turPeak}, by country; Türkiye ${num(ab(turPeak, 'TUR'))}.` },
        { scene: 'abroad', year: lastAb,
          text: `<p>At the end of ${lastAb}: ${num(abTot(lastAb))}, ${num(abTot(lastAb - 1) - abTot(lastAb))} fewer than a year before. Türkiye ${num(ab(lastAb, 'TUR'))}, Lebanon ${num(ab(lastAb, 'LBN'))}, Jordan ${num(ab(lastAb, 'JOR'))}, Germany ${num(ab(lastAb, 'DEU'))}.</p>
                 ${sts(lastAb).t && Math.abs(ab(lastAb, 'DEU') - sts(lastAb).t) <= 10 ? `<p class="note">UNHCR&rsquo;s figure for Germany at the end of ${lastAb} is the same as Destatis&rsquo; count of all Syrian protection seekers that day (chapter 5), open cases and rejected protection status included. For the end of ${lastAb - 1} the two differ (${num(ab(lastAb - 1, 'DEU'))} and ${num(sts(lastAb - 1).t)}), so the two years may not be counted on the same basis.</p>` : ''}
                 <p class="note">Returns since December 2024 follow in chapter 7.</p>`,
          alt: `People from Syria counted as refugees abroad at the end of ${lastAb}, by country: ${num(abTot(lastAb))} in all.` },
      ] },
      { n: 3, id: 'route', title: 'The route', steps: [
        { scene: 'routemap', year: 2015,
          text: `<p>Frontex, the EU&rsquo;s border agency, counts detections of people crossing the external borders of the EU and of the Schengen associated countries (here, the EU&rsquo;s external borders for short) outside official crossing points, by route and nationality. In 2015, ${num(rtY('EM', 2015))} detections of Syrian citizens on the eastern Mediterranean route${rtY('EM', 2015, 's', 'Sea') > rtY('EM', 2015) / 2 ? ', most of them at the sea borders of Greece and Cyprus' : ''}.</p>
                 <p>The rings show first-time asylum applicants with Syrian citizenship that year, by country: ${andList(apY(2015).sort((a, b) => b.v - a.v).slice(0, 3).map((r) => `${esc(r.n)} (${num(r.v)})`))}.</p>
                 <p class="note">The lines are schematic: they join the border sections in the order the routes run. No official source records anyone&rsquo;s path. Discs and rings have scales of their own, so their sizes cannot be compared. On the Western Balkan route in 2015, most detections have no known nationality, so its disc is far too small.</p>`,
          alt: `Map from Syria to Germany: detections of Syrian citizens by border section in 2015 and first-time asylum applicants with Syrian citizenship by country, each on its own scale; routes drawn schematically.` },
        { scene: 'routes', range: ['2011-01', '2014-12'], events: [],
          text: `<p>Month by month: detections of Syrian citizens on all routes, ${num(rtY('ALL', 2011))} in 2011, ${num(rtY('ALL', 2013))} in 2013 and ${num(rtY('ALL', 2014))} in 2014, then most often on the central Mediterranean, at the sea borders of Italy and Malta (${num(rtY('CM', 2014))}), and on the eastern Mediterranean, at the borders of Greece, Bulgaria and Cyprus (${num(rtY('EM', 2014))}).</p>
                 <p class="note">Detections, not people: &ldquo;the same person may cross the external border several times&rdquo;, Frontex notes.</p>`,
          alt: 'Frontex detections of Syrian citizens per month since 2009 by route; 2011 to 2014 marked.' },
        { scene: 'routes', range: ['2015-01', '2015-12'], events: [],
          text: `<p>In 2015, ${num(rtY('EM', 2015))} detections of Syrian citizens on the eastern Mediterranean route, ${num(rtY('EM', 2015, 's', 'Sea'))} of them at sea. The highest month is ${mName(emPeak.m)}, with ${num(emPeak.v)}. Syrian citizens make up ${pct(rtY('EM', 2015), rtY('EM', 2015, 'a'))} of all detections on the route that year.</p>`,
          alt: `Detections of Syrian citizens per month by route; 2015 marked, ${num(rtY('EM', 2015))} on the eastern Mediterranean route.` },
        { scene: 'routes', range: ['2015-01', '2015-12'], events: [],
          text: `<p>The Western Balkan route counts crossings into Hungary, Croatia, Bulgaria and Romania from the Western Balkans. Frontex notes that the same person may cross the external border several times: someone who entered the EU in Greece and travelled on over land left the EU and crossed its external border again there. In 2015, Frontex records ${num(rtY('WB', 2015, 'a'))} detections on this route, ${num(rtY('WB', 2015, 'u'))} of them without a known nationality, so the Syrian count there (${num(rtY('WB', 2015))}) is far from complete.</p>`,
          alt: 'Detections of Syrian citizens per month by route; the Western Balkan route in 2015, nationality mostly unknown.' },
        { scene: 'routes', range: ['2016-01', '2017-12'], events: [['2016-03-18', 'EU–Türkiye statement']],
          text: `<p>On the eastern Mediterranean route, detections of Syrian citizens: ${num(rtM('EM', '2016-01'))} in January 2016, ${num(rtM('EM', '2016-02'))} in February, ${num(rtM('EM', '2016-03'))} in March and ${num(rtM('EM', '2016-04'))} in April. On 18 March 2016, the EU and Türkiye agree on the return to Türkiye of people crossing irregularly to the Greek islands from 20 March (${evLink('2016-03-18', 'Council of the EU')}). In 2017: ${num(rtY('EM', 2017))}.</p>`,
          alt: 'Detections of Syrian citizens per month by route; 2016 and 2017 marked.' },
        { scene: 'routes', range: ['2021-01', '2023-12'], events: [], zoom: true,
          text: `<p>A second rise, on the Western Balkan route: ${num(rtY('WB', 2022))} detections of Syrian citizens in 2022 and ${num(rtY('WB', 2023))} in 2023, ${pct(rtY('WB', 2022), rtY('WB', 2022, 'a'))} and ${pct(rtY('WB', 2023), rtY('WB', 2023, 'a'))} of all detections on that route.</p>
                 <p class="note">From this step on, the graphic shows the months since 2019 on a larger scale.</p>`,
          alt: 'Detections of Syrian citizens per month by route from 2021, scale enlarged; 2021 to 2023 marked.' },
        { scene: 'routemap', year: 2023,
          text: `<p>The same map for 2023: ${num(rtY('WB', 2023))} detections of Syrian citizens on the Western Balkan route, ${num(rtY('EM', 2023))} on the eastern Mediterranean and ${num(rtY('CM', 2023))} on the central Mediterranean. First-time applicants: ${andList(apY(2023).sort((a, b) => b.v - a.v).slice(0, 3).map((r) => `${esc(r.n)} (${num(r.v)})`))}.</p>`,
          alt: 'Map from Syria to Germany: detections of Syrian citizens by border section in 2023 and first-time asylum applicants with Syrian citizenship by country, each on its own scale.' },
        { scene: 'routes', range: ['2024-01', rtLast], events: [['2024-12-08', 'Assad government falls']], zoom: true,
          text: `<p>Detections of Syrian citizens on all routes: ${num(rtY('ALL', 2024))} in 2024 and ${num(rtY('ALL', 2025))} in 2025.${rtLastYear > 2025 ? ` From January to ${d3.timeFormat('%B')(parseM(rtLast))} ${rtLastYear}: ${num(rtY('ALL', rtLastYear))}.` : ''}</p>`,
          alt: `Detections of Syrian citizens per month by route, scale enlarged; 2024 to ${mName(rtLast)} marked.` },
      ] },
      { n: 4, id: 'asylum', title: 'Asking for protection in Germany', steps: [
        { scene: 'asylum', range: ['2011-01', '2014-12'], events: [],
          text: `<p>From 2011 to 2014, the number of first-time asylum applicants with Syrian citizenship in Germany ${ay('DE', 2014) > ay('DE', 2011) ? 'grows' : 'goes'} from ${num(ay('DE', 2011))} to ${num(ay('DE', 2014))}; ${num(ay('DE', 2013))} in 2013.</p>
                 <p class="note">Eurostat counts applicants: each person once per country and month. Someone who applies in two countries is counted in both, so applicants are not the same as people who came. &ldquo;First time&rdquo; means the first application in that country.</p>`,
          alt: `First-time asylum applicants with Syrian citizenship per month, Germany since 2011 and the EU total since 2014; 2011 to 2014 marked.` },
        { scene: 'asylum', range: ['2015-01', '2016-12'], events: [],
          text: `<p>Then ${num(ay('DE', 2015))} in 2015 and ${num(ay('DE', 2016))} in 2016. In 2016, Germany counts ${pct(ay('DE', 2016), ay('EU27_2020', 2016))} of all first-time applicants with Syrian citizenship in the EU.</p>
                 <p>In 2015, Syrian citizens also apply for the first time in ${andList(others2015.map((r) => `${esc(r.n)} (${num(r.v)})`))}. Each country counts its own applicants, so a person who applies in two countries is counted in both.</p>`,
          alt: `First-time applicants per month; 2015 and 2016 marked: ${num(ay('DE', 2015))} and ${num(ay('DE', 2016))} in Germany.` },
        { scene: 'asylum', range: ['2016-03', '2020-12'], events: [['2016-03-18', 'EU–Türkiye statement']],
          text: `<p>On 18 March 2016, the EU and Türkiye agree that people crossing irregularly to the Greek islands from 20 March are returned to Türkiye (${evLink('2016-03-18', 'Council of the EU')}).</p>
                 <p>First-time applicants with Syrian citizenship in Germany: ${num(ay('DE', 2017))} in 2017, ${num(ay('DE', 2018))} in 2018, ${num(ay('DE', 2020))} in 2020.</p>`,
          alt: `First-time applicants per month; 2016 to 2020 marked.` },
        { scene: 'asylum', range: ['2021-01', '2024-11'], events: [],
          text: `<p>${[2021, 2022, 2023].every((y) => ay('DE', y) > ay('DE', y - 1)) ? 'The number rises again: ' : 'First-time applicants: '}${num(ay('DE', 2021))} in 2021, ${num(ay('DE', 2022))} in 2022 and ${num(ay('DE', 2023))} in 2023; ${num(ay('DE', 2024))} in 2024.</p>`,
          alt: `First-time applicants per month; 2021 to 2024 marked.` },
        { scene: 'asylum', range: ['2024-12', lastDE.m], events: [['2024-12-08', 'Assad government falls']],
          text: `<p>The Assad government falls on 8 December 2024. First-time applicants with Syrian citizenship in Germany: ${num(ay('DE', 2024))} in 2024, ${num(ay('DE', 2025))} in 2025. ${mName(lastDE.m)}: ${num(lastDE.v)}.</p>
                 ${lastDE.m >= '2026-07' ? '<p class="note">From July 2026, Eurostat counts registered instead of lodged applications; the dashed line marks the change.</p>' : ''}`,
          alt: `First-time applicants per month; December 2024 to ${mName(lastDE.m)} marked.` },
        { sub: 'What the decisions granted', scene: 'decisions', range: [2014, 2015],
          text: `<p>Decisions concern applications made earlier; Eurostat counts the persons they cover. In 2015, ${pct(dec(2015).rs, dec(2015).t)} of ${num(dec(2015).t)} first-instance decisions on Syrian citizens in Germany grant refugee status.</p>
                 <p class="note">Shares of the four outcomes per year, with the number of decisions above each column; Eurostat rounds each quarter to the nearest 5.</p>`,
          alt: `First-instance decisions on Syrian citizens in Germany by outcome, ${DEC[0].y} to ${lastDec.y}; 2014 and 2015 marked.` },
        { scene: 'decisions', range: [2016, 2017],
          text: `<p>In 2016: refugee status ${pct(dec(2016).rs, dec(2016).t)}, subsidiary protection ${pct(dec(2016).sp, dec(2016).t)}. From 17 March 2016, Germany suspends family reunification for people with subsidiary protection for two years (${evLink('2016-03-17', 'German Bundestag')}). In 2017, ${pct(dec(2017).sp, dec(2017).t)} of decisions grant subsidiary protection.</p>`,
          alt: `Decisions by outcome; 2016 and 2017 marked.` },
        { scene: 'decisions', range: [2022, 2024],
          text: `<p>By 2024, subsidiary protection makes up ${pct(dec(2024).sp, dec(2024).t)} of decisions, refugee status ${pct(dec(2024).rs, dec(2024).t)}.</p>`,
          alt: `Decisions by outcome; 2022 to 2024 marked.` },
        { scene: 'decisions', range: [lastDec.y, lastDec.y],
          text: `<p>In ${lastDec.y}: ${num(lastDec.t)} decisions, ${pct(lastDec.neg, lastDec.t)} of them rejected, in Eurostat&rsquo;s classification.</p>
                 <p class="note">Eurostat does not count decisions to transfer a person to another European country under the Dublin rules as rejections, even where a formal negative decision was issued (<a href="https://ec.europa.eu/eurostat/cache/metadata/Annexes/migr_asydec_esms_an_2021_guidelines.pdf">Eurostat, technical guidelines</a>, p. 19).</p>`,
          alt: `Decisions by outcome; ${lastDec.y} marked, ${pct(lastDec.neg, lastDec.t)} rejected.` },
      ] },
      { n: 5, id: 'stayed', title: 'Who stayed', steps: [
        { scene: 'stock', range: [2013, 2016],
          text: `<p>At the end of 2013, the foreigners&rsquo; register counts ${num(reg(2013).s1)} Syrian citizens in Germany. At the end of 2016: ${num(reg(2016).s1)}.</p>
                 <p>Of the ${num(reg(2016).en)} entries the register records in 2016, ${reg(2016).le > reg(2016).en / 2 ? 'more than half' : pct(reg(2016).le, reg(2016).en)} (${num(reg(2016).le)}) were recorded late. Of all late entries that year, Destatis notes that they were mostly protection seekers who had entered in 2015, so the count for the end of 2015 is too low (<a href="${QB}">Destatis, quality report</a>).</p>
                 <p class="note">The register counts people by citizenship, from the day they are registered. Destatis rounds these counts to multiples of 5.</p>`,
          alt: `Syrian citizens in the foreigners' register at the end of each year since 2013; 2013 to 2016 marked.` },
        { scene: 'stock', range: [2017, lastReg.y - 1],
          text: `<p>${regGrows(2017, lastReg.y - 1) ? `The number grows every year, to ${num(reg(lastReg.y - 1).s1)}` : `The number reaches ${num(reg(lastReg.y - 1).s1)}`} at the end of ${lastReg.y - 1}.</p>`,
          alt: `Syrian citizens in the register; 2017 to ${lastReg.y - 1} marked.` },
        { scene: 'stock', range: [lastReg.y, lastReg.y],
          text: `<p>At the end of ${lastReg.y}: ${num(lastReg.s1)}, ${reg(lastReg.y - 1).s1 >= lastReg.s1 ? `${num(reg(lastReg.y - 1).s1 - lastReg.s1)} fewer` : `${num(lastReg.s1 - reg(lastReg.y - 1).s1)} more`} than a year before${regFalls.length === 1 && regFalls[0] === lastReg.y ? `, the first fall in the years shown here (from ${REG[0].y})` : ''}.</p>
                 <p>In ${lastReg.y} the register records ${num(lastReg.fe)} first entries from abroad and ${num(lastReg.b)} births; ${num(lastReg.ma)} moves abroad, ${num(lastReg.da)} people taken off the register by the authorities as gone abroad or to an unknown address, and ${num(lastReg.del)} deleted records. Deletions follow mostly from naturalisations (<a href="https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/DEHeft_derivate_00060217/2010200207004_akt12042021.pdf">Destatis</a>).</p>`,
          alt: `Syrian citizens in the register; ${lastReg.y} marked: ${num(lastReg.s1)}.` },
        { scene: 'nat', range: [2021, lastNat.y],
          text: `<p>Naturalisations of Syrian citizens: ${num(nat(2016).v)} in 2016, ${num(nat(2021).v)} in 2021, ${num(nat(2024).v)} in 2024 and ${num(lastNat.v)} in ${lastNat.y}, ${pct(lastNat.v, lastNat.a)} of all naturalisations that year. From 2016 to ${lastNat.y}, Destatis counts ${num(natSince2016)} naturalisations of Syrian citizens.</p>
                 <p class="note">Once naturalised, people are no longer counted as Syrian citizens anywhere on this page.</p>`,
          alt: `Naturalisations of Syrian citizens per year since 2011; 2021 to ${lastNat.y} marked.` },
        { scene: 'status', range: [2015, 2017],
          text: `<p>At the end of 2015, the applications of ${num(sts(2015).o)} Syrian citizens are still open. By the end of 2017, ${num(sts(2017).rl)} hold protection for a limited time.</p>`,
          alt: `Syrian protection seekers by protection status at the end of each year since 2013; 2015 to 2017 marked.` },
        { scene: 'status', range: [lastSts.y, lastSts.y],
          text: `<p>At the end of ${lastSts.y}, ${num(lastSts.t)} Syrian citizens are registered as protection seekers: ${num(lastSts.rl)} with protection for a limited time, ${num(lastSts.rp)} with permanent protection, ${num(lastSts.o)} whose case is open and ${num(lastSts.x)} with a rejected protection status.</p>`,
          alt: `Protection status; ${lastSts.y} marked.` },
        { scene: 'stay',
          text: `<p>How long they have lived in Germany, at the end of ${stayYear}: ${num(stay(10).v)} for 10 to 15 years, so first came in ${stay(10).years}; ${num(stay(8).v)} for 8 to 10 years (${stay(8).years}); ${num(stay(1).v)} for 1 to 4 years (${stay(1).years}).</p>
                 <p class="note">Destatis gives length of stay in bands, so years of first entry come in groups.</p>`,
          alt: `Syrian protection seekers by length of stay at the end of ${stayYear}.` },
        { scene: 'group', range: [g0.y, g1.y],
          text: `<p>The group that first came in 2015 or 2016 can be followed every two years: in ${andList(GROUP.map((r) => r.y))}, one of Destatis&rsquo; bands of length of stay covers exactly those two years of first entry. Syrian protection seekers in that group: ${andList(GROUP.map((r) => `${num(r.v)} at the end of ${r.y}`))}, ${pct(g0.v - g1.v, g0.v)} fewer in ${g1.y - g0.y} years.</p>
                 <p class="note">Length of stay counts from first entry into Germany. A person leaves this count on naturalisation, on receiving a residence permit for another purpose (for example by marriage) or on leaving Germany (<a href="https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/DEHeft_derivate_00051055/2010240187004.pdf">Destatis</a>), and on death; the table does not say which.</p>`,
          alt: `Syrian protection seekers who first came in 2015 or 2016, at the end of ${andList(GROUP.map((r) => r.y))}: ${GROUP.map((r) => num(r.v)).join(', ')}.` },
        { scene: 'where', top: 4,
          text: `<p>Where they are registered at the end of ${ctyYear}: ${CTY.every((r) => r.v > 0) ? `in every one of the ${CTYC.length} counties and ${CTY.length - CTYC.length} merged units Destatis reports` : `in ${CTY.filter((r) => r.v > 0).length} of the ${CTYC.length} counties and ${CTY.length - CTYC.length} merged units Destatis reports`}. The counties with the most: ${andList(ctyRankC.slice(0, 3).map((r) => `${esc(r.n)} (${num(r.v)})`))}. Saarland, for which Destatis gives no figures by county, counts ${num(saar.v)} in all. The ten counties with the most hold ${pct(d3.sum(ctyRankC.slice(0, 10), (r) => r.v), ctyTot)} of all; ${ctyUnderC(500)} of ${CTYC.length} counties count fewer than 500.</p>
                 <p class="note">Destatis assigns protection seekers to the county for which the immigration office keeping their record is responsible. From the end of 2025, people registered with a reception facility or a central immigration authority serving several counties are assigned to the county of their address, where there is one; counties can be compared with earlier years only to a limited extent (<a href="${QB}">Destatis, quality report</a>). Destatis gives ${UNIT_NOTE['06611']} together, and ${UNIT_NOTE[12052]}; each is drawn as one unit, as is Saarland.</p>`,
          alt: `Map of Germany's counties with one circle per county or merged unit, its area by the number of Syrian protection seekers at the end of ${ctyYear}; largest ${ctyRank.slice(0, 3).map((r) => `${r.n} ${num(r.v)}`).join(', ')}.` },
      ] },
      { n: 6, id: 'work', title: 'What they do', prep: !hasWork, steps: hasWork ? [
        { scene: 'employed', range: [empFirst.m, empLast.m],
          text: `<p>In ${mName(empFirst.m)}, ${num(empFirst.e)} Syrian citizens hold a job subject to social security in Germany, according to the Federal Employment Agency. In ${mName(empFinal.m)}: ${num(empFinal.e)}${empLast.m !== empFinal.m ? `; the agency estimates ${num(empLast.e)} for ${mName(empLast.m)}` : ''}.</p>
                 ${empF.m ? `<p>Leaving apprentices aside, ${pct(empF.e, empTF.en)} of them are women: ${num(empF.e)} women and ${num(empM.e)} men in ${mName(empF.m)}.</p>` : ''}
                 <p class="note">Employment subject to social security, apprentices included, counted where people work; marginal jobs alone are not included. The agency gives men and women apart from January 2020, without apprentices. It estimates the latest months, which it has not counted yet.</p>`,
          alt: `Syrian citizens in employment subject to social security per month since ${mName(empFirst.m)}.` },
        { scene: 'rates', range: [erFirst.m, erLast.m],
          text: `<p>The employment rate, the share of Syrian citizens aged 15 to 64 in Germany who hold a job: ${pct1(erFirst.er, 100)} in ${mName(erFirst.m)}, ${pct1(erLow.er, 100)} at its lowest, in ${mName(erLow.m)}, and ${pct1(erLast.er, 100)} in ${mName(erLast.m)}${erProv ? `; the agency gives ${pct1(erProv.er, 100)} for ${mName(erProv.m)}, provisional` : ''}. For all foreign citizens in ${mName(erLast.m)}: ${pct1(erAt('FOREIGN', erLast.m), 100)}; for German citizens: ${pct1(erAt('GERMAN', erLast.m), 100)}.</p>
                 <p class="note">Jobs subject to social security and marginal jobs, per 100 residents aged 15 to 64 of the same citizenship. For foreign citizens, Syrian citizens among them, the agency takes the residents from the foreigners&rsquo; register, for German citizens from the population figures; it notes that rates based on the register come out lower. The rates of the latest months are provisional.</p>`,
          alt: 'Employment rates per month: Syrian citizens, all foreign citizens and German citizens.' },
        { scene: 'levels', range: [WLY[0] && WLY[0].y, WLY.length ? WLY[WLY.length - 1].y : ''],
          text: `<p>What the jobs require, in ${mName(wlLast.m)}: ${pct(wlLast.he, wlLast.t)} of Syrian citizens with a job subject to social security (apprentices not included) work as helpers, without a vocational qualification needed, ${pct(wlLast.sk, wlLast.t)} as skilled workers and ${pct(wlLast.sp + wlLast.ex, wlLast.t)} as specialists or experts.</p>
                 <p class="note">The skill level of the job (Anforderungsniveau), not the person&rsquo;s own qualification. Apprentices not included.</p>`,
          alt: 'Syrian citizens in employment subject to social security, apprentices not included, by the skill level of the job, December of each year since 2020.' },
        { scene: 'support', range: [WKT.find((r) => r.b != null).m, sgbLast.m],
          text: `<p>Syrian citizens receiving basic income support and able to work: ${num(sgbPeak.b)} at the most, in ${mName(sgbPeak.m)}; ${num(sgbFinal.b)} in ${mName(sgbFinal.m)}${sgbLast.m !== sgbFinal.m ? `; the agency estimates ${num(sgbLast.b)} for ${mName(sgbLast.m)}` : ''}. Registered as unemployed in ${mName(unLast.m)}: ${num(unLast.u)}.</p>
                 <p class="note">Basic income support (SGB II) also goes to people whose pay from work is too low to live on.</p>`,
          alt: 'Syrian citizens receiving basic income support and able to work, and registered unemployed, per month.' },
      ] : [
        { scene: 'prep', lines: ['Jobs, employment rates, skill levels', 'Basic income support', 'Men and women apart'],
          text: `<p class="prep">In preparation</p><p>Jobs, employment rates, the skill level of the jobs and basic income support of Syrian citizens, from the Federal Employment Agency&rsquo;s monthly Migrationsmonitor.</p>`,
          alt: 'Chapter in preparation.' },
      ] },
      { n: 7, id: 'since', title: 'Since December 2024', steps: [
        { scene: 'moves', range: [lastMig.y, lastMig.y],
          text: `<p>In ${lastMig.y}, Destatis counts ${num(lastMig.o)} moves of Syrian citizens from Germany to another country, the most since ${migMoreBefore || MIG[0].y}, and ${num(lastMig.i)} moves to Germany.${lastReg.y === lastMig.y ? ` The foreigners&rsquo; register (chapter 5) records fewer for ${lastMig.y}: ${num(lastReg.ma)} moves abroad and ${num(lastReg.da)} people taken off the register by the authorities; the two statistics count differently (<a href="${QB}">Destatis, quality report</a>).` : ''}</p>
                 <p>From the neighbouring countries, UNHCR estimates that 1.67 million Syrians had returned by 31 May 2026, and about 1.92 million people displaced inside Syria had returned home (<a href="https://www.unhcr.org/sites/default/files/docs/default/2026-07/unhcr-returns-to-syria-regional-update-April-May-2026_0.pdf">UNHCR</a>).</p>
                 <p class="note">Moves, not people: one person can move more than once. This table counts moves by citizenship, so a move abroad is not necessarily a return to Syria${lastTS ? '; the next graphic counts moves by country of destination' : ''}.</p>`,
          alt: `Moves of Syrian citizens to and from Germany per year since 2011; ${lastMig.y} marked.` },
        ...(lastTS ? [{ scene: 'tosyria', range: [lastTS.y, lastTS.y],
          text: `<p>By country of destination, Destatis counts ${num(lastTS.o)} moves from Germany to Syria in ${lastTS.y}, ${tsMoreBefore ? `the most since ${tsMoreBefore}` : `the most in the years shown (from ${TS[0].y})`}: ${num(lastTS.of)} by foreign citizens and ${num(lastTS.og)} by German citizens. In ${lastTS.y - 1}: ${num(ts(lastTS.y - 1).o)}.</p>
                 ${lastMig.y === lastTS.y && lastMig.o > lastTS.o ? `<p>This table gives citizenship only as German or foreign. So at most ${num(lastTS.o)} of the ${num(lastMig.o)} moves of Syrian citizens from Germany in ${lastTS.y} are recorded with Syria as their destination: the number of all moves to Syria. For many moves abroad Destatis records no destination, and it notes that moves abroad are the less reliable side of its count, as people often leave without deregistering and are taken off the register later (<a href="https://www.destatis.de/DE/Themen/Gesellschaft-Umwelt/Bevoelkerung/Wanderungen/_inhalt.html">Destatis, migration statistics</a>).</p>` : ''}
                 <p class="note">Moves, not people. Destatis alters small counts slightly to protect confidentiality, so the parts may not add up to the total. In the other direction, Destatis counts ${num(lastTS.i)} moves from Syria to Germany in ${lastTS.y}.</p>`,
          alt: `Moves from Germany to Syria per year since ${TS[0].y}, by foreign and German citizens; ${lastTS.y} marked: ${num(lastTS.o)}.` }] : []),
        { scene: 'departures', range: [DEP[0].y, DEP[DEP.length - 1].y],
          text: `<p>Voluntary departures of Syrian citizens recorded in the foreigners&rsquo; register: ${num(depSum('2025-01', '2025-12'))} from January to ${mName(DEP.filter((r) => r.y < '2026' && !r.gap).pop().y).split(' ')[0]} 2025, ${num(depSum('2025-01', '2025-12', 'w'))} of them with return support (${depSrc('2025-01')}); ${num(depSum('2026-01', '2026-12'))} from January to ${mName(DEP.filter((r) => !r.gap).pop().y)}, ${num(depSum('2026-01', '2026-12', 'w'))} with support (${depSrc('2026-01')}).</p>
                 <p class="note">The federal government notes that the true number is higher, as the authorities do not always learn of a departure. ${depGap.length ? `The two answers do not cover ${andList(depGap.map((m) => mName(m)))}; the graphic leaves these months as dashed slots.` : ''}</p>`,
          alt: 'Voluntary departures of Syrian citizens per month, with and without return support, from the federal government’s answers to the Bundestag.' },
        { scene: 'reviews', range: [REV[0].y, REV[REV.length - 1].y],
          text: `<p>The Federal Office for Migration and Refugees reviews whether protection it granted still applies. For Syrian citizens it started ${num(revPeak.s)} reviews in ${revPeak.p}; of ${num(rev('2020').d)} decisions in 2020, ${num(rev('2020').rev)} revoked or withdrew protection. In ${revLast.lab}: ${num(revLast.d)} decisions, ${num(revLast.rev)} revocations or withdrawals (${pct(revLast.rev, revLast.d)}) (${revSrc}).</p>
                 <p>Deportations: from 2015 to ${depoTo}, the government counts ${num(deportedToSyria)} deportations of Syrian citizens to Syria, ${andList(DEPO.filter((r) => +r.dsy > 0).map((r) => `${+r.dsy} in ${r.p.includes('-H1') ? `the first half of ${r.p.slice(0, 4)}` : r.p}`))}. It also counts ${num(deportedElsewhere)} deportations of Syrian citizens from Germany in the same years, not counting those to Syria.</p>`,
          alt: 'Reviews of protection granted to Syrian citizens per year: decisions that revoked or withdrew protection and decisions that kept it.' },
      ] },
    ];

    const STEPS = [];
    $('#steps').innerHTML = CH.map((c) => `
      <section class="chapter${c.prep ? ' chapter--prep' : ''}" id="syr-ch-${c.id}" aria-labelledby="syr-h-${c.id}">
        <div class="chapter__head"><p class="chapter__num">Chapter ${c.n}</p><h2 id="syr-h-${c.id}">${esc(c.title)}${DOT}</h2></div>
        ${c.steps.map((s) => { const i = STEPS.push({ ...s, ch: c }) - 1;
          return `${s.sub ? `<h3>${esc(s.sub)}</h3>` : ''}<div class="step${c.prep ? ' step--prep' : ''}" data-i="${i}"><div class="step__text">${s.text}<p class="syr-sr">Graphic: ${esc(s.alt)}</p></div></div>`; }).join('')}
      </section>`).join('');

    // ---------- the graphic ----------
    const chart = $('#chart');
    let scene = null, update = null, active = -1, mapKey = [], routeOut = [];
    const sizeKey = (list, cls) => list.map(([v, rr]) => `<span><svg class="syr-size" width="${Math.ceil(2 * rr + 2)}" height="${Math.ceil(2 * rr + 2)}" aria-hidden="true"><circle class="${cls}" cx="${rr + 1}" cy="${rr + 1}" r="${rr}"></circle></svg>${num(v)}</span>`).join('');

    const SCENES = {
      war: { title: () => 'Deaths from organised violence in Syria, per month',
        key: () => '<span><i class="syr-sw syr-sw--dead"></i>Deaths (UCDP best estimate)</span><span><i class="syr-sw syr-sw--ev"></i>Event</span>',
        note: () => { const g = meta('UCDP', 'ged'), c = meta('UCDP', 'candidate');
          return `Source: Uppsala Conflict Data Program${g ? `, ${esc(g.i.replace('ged', 'GED'))}` : ''}${c ? `; Candidate data to ${mName(c.thru)}, preliminary` : ''} (citations under Method and sources). Deaths are counted where the violence happened; an event UCDP dates to a span of days is spread evenly over it.`; },
        draw: drawWar },
      abroad: { title: (s) => `People from Syria counted by UNHCR as refugees, end of ${s.year}, by country of asylum`,
        key: () => '<span><i class="syr-sw syr-sw--nb"></i>Borders Syria</span><span><i class="syr-sw syr-sw--de"></i>Germany</span><span><i class="syr-sw syr-sw--other"></i>Other countries</span>',
        note: () => `Source: UNHCR Refugee Population Statistics Database, used under UNHCR&rsquo;s <a href="${UNHCR_TERMS}">Terms of Use for Datasets</a>. By country of origin, not citizenship; asylum-seekers apart.`,
        draw: drawAbroad },
      routemap: { title: (s) => `Detections at the EU’s external borders and first-time asylum applicants, Syrian citizens, ${s.year}`,
        key: () => '<span><i class="syr-sw syr-sw--det"></i>Detections at the border (Frontex)</span><span><i class="syr-sw syr-sw--ring"></i>First-time asylum applicants</span><span><i class="syr-sw syr-sw--ringde"></i>in Germany</span><span><i class="syr-ln syr-ln--path"></i>Route, schematic</span>',
        note: () => { const r = meta('Frontex'); return `Sources: Frontex${r ? ` (${esc(r.i)})` : ''}, detections, not people; Eurostat (migr_asyappctza), applicants per country. Discs and rings each have their own scale: their sizes cannot be compared.${routeOut.length ? ` Not on the map: ${andList(routeOut)}.` : ''} Map: ${esc(D.region.meta.source || '')}.`; },
        draw: drawRouteMap },
      routes: { title: () => 'Detections of Syrian citizens at the EU’s external borders, per month',
        key: () => '<span><i class="syr-sw syr-sw--em"></i>Eastern Mediterranean</span><span><i class="syr-ln syr-ln--wb"></i>Western Balkans</span><span><i class="syr-ln syr-ln--cm"></i>Central Mediterranean</span><span><i class="syr-sw syr-sw--ev"></i>Event</span>',
        note: (s) => { const r = meta('Frontex'); return `Source: Frontex${r ? `, ${esc(r.i)}` : ''}. Detections, not people. The three largest routes shown.${s.zoom ? ' Months since 2019, on an enlarged scale.' : ''}`; },
        draw: drawRoutes },
      asylum: { sex: 'eurostat', title: () => 'First-time asylum applicants with Syrian citizenship, per month',
        key: () => `<span><i class="syr-ln syr-ln--de"></i>Germany</span><span><i class="syr-ln"></i>EU total (from 2014)</span><span><i class="syr-sw syr-sw--ev"></i>Event</span>${lastDE.m >= '2026-07' ? '<span><i class="syr-ln syr-ln--break"></i>Change of definition (July 2026)</span>' : ''}`,
        note: () => 'Source: Eurostat, migr_asyappctzm. Applicants per country and month; a person can be counted in more than one country.',
        draw: drawAsylum },
      decisions: { sex: 'eurostat', title: () => 'First-instance decisions on Syrian citizens in Germany, by outcome',
        key: () => '<span><i class="syr-sw syr-o1"></i>Refugee status</span><span><i class="syr-sw syr-o2"></i>Subsidiary protection</span><span><i class="syr-sw syr-o3"></i>Humanitarian status</span><span><i class="syr-sw syr-o4"></i>Rejected</span>',
        note: () => 'Source: Eurostat, migr_asydcfstq. Full years only: the sum of four quarters; persons covered by decisions, which concern applications made earlier. Above each column: the number of decisions.',
        draw: drawDecisions },
      stock: { sex: 'destatis', title: () => 'Syrian citizens in the foreigners’ register, end of each year',
        key: () => '<span><i class="syr-sw syr-sw--tot"></i>Syrian citizens</span>',
        note: () => `${dsrc('foreigners’ register', '12521-0009')} Rounded to 5. The count for the end of 2015 is too low: many people who came in 2015 were entered only in 2016.`,
        draw: (svg, w, h) => drawCols(svg, w, h, ofSex(REG_ALL, SEX).map((r) => ({ y: r.y, v: r.s1 })), [['v', 'syr-tot', 'In the register, end of year']], false, d3.max(REG, (r) => r.s1), null, 'Syrian citizens') },
      nat: { sex: 'destatis', title: () => 'Naturalisations of Syrian citizens, per year',
        key: () => '<span><i class="syr-sw syr-sw--tot"></i>Naturalisations</span>',
        note: () => dsrc('naturalisation statistics', '12511-0002'),
        draw: (svg, w, h) => drawCols(svg, w, h, ofSex(NAT_ALL, SEX), [['v', 'syr-tot', 'Naturalisations']], false, d3.max(NAT, (r) => r.v), null, 'Syrian citizens') },
      status: { sex: 'destatis', title: () => 'Syrian protection seekers by protection status, end of each year',
        key: () => '<span><i class="syr-sw syr-o1"></i>Permanent protection</span><span><i class="syr-sw syr-o2"></i>Protection for a limited time</span><span><i class="syr-sw syr-o3"></i>Open</span><span><i class="syr-sw syr-o4"></i>Rejected protection status</span>',
        note: () => dsrc('protection seekers', '12531-0008', ', 31 December'),
        draw: (svg, w, h) => drawCols(svg, w, h, ofSex(STS_ALL, SEX), [['rp', 'syr-o1', 'Permanent protection'], ['rl', 'syr-o2', 'Protection for a limited time'],
          ['o', 'syr-o3', 'Open'], ['x', 'syr-o4', 'Rejected protection status']], true, d3.max(STS, (r) => r.rp + r.rl + r.o + r.x), null, 'Syrian protection seekers, end of year') },
      stay: { sex: 'destatis', title: () => `Syrian protection seekers by length of stay, end of ${stayYear}`,
        key: () => '<span><i class="syr-sw syr-sw--tot"></i>Protection seekers</span><span>Grey: years of first entry</span>',
        note: () => `${dsrc('protection seekers', '12531-0006')} Years of first entry read from the length of stay.`,
        draw: drawStay },
      group: { sex: 'destatis', title: () => 'Syrian protection seekers who first came in 2015 or 2016, end of year',
        key: () => '<span><i class="syr-sw syr-sw--tot"></i>Protection seekers, first entry 2015–2016</span>',
        note: () => `${dsrc('protection seekers by length of stay', '12531-0006', ', 31 December')} Years of first entry read from the length of stay.`,
        draw: (svg, w, h) => drawCols(svg, w, h, groupFor(SEX), [['v', 'syr-tot', 'First entry 2015–2016']], false, d3.max(GROUP, (r) => r.v), null, 'Syrian protection seekers, end of year') },
      where: { sex: 'destatis', title: () => `Syrian protection seekers by county, end of ${ctyYear}`,
        key: () => `<span>Protection seekers, circle area:</span>${sizeKey(mapKey, 'syr-dot')}`,
        note: () => `${dsrc('protection seekers', '12531-0043', ', 31 December')} Map: VG250, ${bkgNote()}.`,
        draw: drawMap },
      employed: { sex: 'ba', title: () => 'Syrian citizens in employment subject to social security, per month',
        key: () => '<span><i class="syr-sw syr-sw--tot"></i>In a job subject to social security</span><span><i class="syr-sw syr-sw--est"></i>Estimate of the agency</span>',
        note: () => `${basrc()}`,
        draw: (svg, w, h) => drawMonthly(svg, w, h, 'e', null) },
      rates: { title: () => 'Employment rate by citizenship, per month',
        key: () => '<span><i class="syr-ln"></i>Syrian citizens</span><span><i class="syr-ln syr-ln--cm"></i>All foreign citizens</span><span><i class="syr-ln syr-ln--wb"></i>German citizens</span>',
        note: () => { return `${basrc()} Percent of residents aged 15 to 64; the latest months provisional. Foreign citizens counted from the foreigners’ register, German citizens from the population figures.`; },
        draw: drawRates },
      levels: { title: () => 'Syrian citizens in a job subject to social security (apprentices not included), by what the job requires',
        key: () => '<span><i class="syr-sw syr-o1"></i>Expert</span><span><i class="syr-sw syr-o2"></i>Specialist</span><span><i class="syr-sw syr-o3"></i>Skilled</span><span><i class="syr-sw syr-o4"></i>Helper</span>',
        note: () => { return `${basrc()} Apprentices not included; the total above a column includes jobs whose level is not known. December of each year; the last column the latest month the agency has counted.`; },
        draw: (svg, w, h) => drawCols(svg, w, h, WLY, [['ex', 'syr-o1', 'Expert'], ['sp', 'syr-o2', 'Specialist'], ['sk', 'syr-o3', 'Skilled'], ['he', 'syr-o4', 'Helper']], true, null, (r) => r.t,
          'Syrian citizens in a job subject to social security', 'All, with level not known') },
      support: { sex: 'ba', title: () => 'Syrian citizens receiving basic income support, and unemployed, per month',
        key: () => '<span><i class="syr-sw syr-sw--sup"></i>Receiving basic income support, able to work</span><span><i class="syr-ln"></i>Registered unemployed</span>',
        note: () => `${basrc()} Basic income support (SGB II), published after a waiting period of three months.`,
        draw: (svg, w, h) => drawMonthly(svg, w, h, 'b', 'u') },
      departures: { title: () => 'Voluntary departures of Syrian citizens, per month',
        key: () => `<span><i class="syr-sw syr-o1"></i>With return support</span><span><i class="syr-sw syr-o3"></i>Without</span>${depGap.length ? '<span><i class="syr-sw syr-sw--gap"></i>No figures</span>' : ''}`,
        note: () => 'Source: federal government, answers to the Bundestag (foreigners’ register): 2025 as recorded on 31 October 2025, 2026 provisional. Recorded departures; the true number is higher.',
        draw: (svg, w, h) => drawCols(svg, w, h, DEP, [['w', 'syr-o1', 'With return support'], ['o', 'syr-o3', 'Without']], true, null, null, 'Voluntary departures, Syrian citizens') },
      reviews: { title: () => 'Reviews of protection granted to Syrian citizens: decisions per year',
        key: () => '<span><i class="syr-sw syr-o1"></i>Protection revoked or withdrawn</span><span><i class="syr-sw syr-o4"></i>Protection kept</span>',
        note: () => 'Source: federal government, answer to the Bundestag (Federal Office for Migration and Refugees). Decisions in a year concern reviews started earlier.',
        draw: (svg, w, h) => drawCols(svg, w, h, REV, [['rev', 'syr-o1', 'Protection revoked or withdrawn'], ['kept', 'syr-o4', 'Protection kept']], true, null, null, 'Decisions on reviews', 'All decisions') },
      moves: { title: () => 'Moves of Syrian citizens across Germany’s border, per year',
        key: () => '<span><i class="syr-sw syr-o1"></i>From Germany to another country</span><span><i class="syr-sw syr-o4"></i>To Germany</span>',
        note: () => `${dsrc('migration statistics', '12711-0007')} Moves, not people; by citizenship, not destination.`,
        draw: (svg, w, h) => drawCols(svg, w, h, MIG, [['o', 'syr-o1', 'From Germany to another country'], ['i', 'syr-o4', 'To Germany']], false, null, null, 'Moves of Syrian citizens') },
      tosyria: { title: () => 'Moves from Germany to Syria, per year, by citizenship',
        key: () => '<span><i class="syr-sw syr-o1"></i>Foreign citizens</span><span><i class="syr-sw syr-o3"></i>German citizens</span>',
        note: () => `${dsrc('migration statistics by country of origin and destination', '12711-0008')} Moves, not people; citizenship only German or foreign. A scale of its own, smaller than the previous graphic’s.`,
        draw: (svg, w, h) => drawCols(svg, w, h, TS, [['of', 'syr-o1', 'Foreign citizens'], ['og', 'syr-o3', 'German citizens']], true, null, (r) => r.o,
          'Moves from Germany to Syria', 'All moves to Syria') },
      prep: { title: () => 'In preparation', key: () => '', note: () => '', draw: drawPrep },
    };

    function show(i, animate) {
      const s = STEPS[i], S = SCENES[s.scene];
      tip.hide();
      if (s.scene !== scene || !update) {
        scene = s.scene;
        chart.innerHTML = '';
        const w = chart.clientWidth, h = chart.clientHeight;
        if (!w || !h) return;
        const svg = d3.select(chart).append('svg').attr('width', w).attr('height', h).attr('viewBox', `0 0 ${w} ${h}`).attr('aria-hidden', 'true');
        chart.appendChild(tip.el);   // re-attached after each redraw empties the chart
        update = S.draw(svg, w, h);
        animate = false;
      }
      update(s, animate ? DUR : 0);   // first, so the note can name what the graphic left out
      const sexOn = !!S.sex, part = sexOn && SEX !== 'T' ? (SEX === 'M' ? 'male' : 'female') : '';
      $('#kicker').textContent = `Chapter ${s.ch.n} · ${s.ch.title}`;
      $('#title').textContent = S.title(s) + (part ? ` (${part})` : '');
      $('#key').innerHTML = S.key(s);
      $('#note').innerHTML = S.note(s) + (part ? (S.sex === 'eurostat' ? ' Each figure rounded to 5; all includes sex unknown; the scale is that of all.'
        : S.sex === 'ba' ? (s.scene === 'employed' ? ' Male and female from January 2020, without apprentices; the scale is that of all.' : ' Male and female from January 2020; the scale is that of all.')
        : s.scene === 'nat' ? ' Destatis&rsquo; total and the two parts can differ by a few; the scale is that of all.' : ' Male and female each rounded to 5; the scale is that of all.')
        + ' Figures in the text are for all.' : '');
      // hidden where the graphic has no data by sex (its place kept, so the graphic does not move)
      sexEl.classList.toggle('is-off', !sexOn);
      sexEl.inert = !sexOn;
      sexEl.setAttribute('aria-hidden', String(!sexOn));
      sexEl.querySelectorAll('button').forEach((b) => { b.disabled = !sexOn; });
    }

    // the switch: All / Male / Female, for the graphics whose data has sex; hidden on the others
    const sexEl = $('#sex');
    sexEl.innerHTML = SEXES.map(([k, l]) => `<button type="button" data-sx="${k}" aria-pressed="${k === SEX}">${l}</button>`).join('');
    sexEl.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.dataset.sx === SEX || sexEl.classList.contains('is-off')) return;
      SEX = b.dataset.sx;
      sexEl.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.sx === SEX)));
      scene = null; update = null;
      if (active >= 0) show(active, false);
    });

    // ---------- tooltips ----------
    // what the graphic shows under the pointer: hover with a mouse or pen, tap on a touch screen (a tap outside the
    // graphic closes it). The pages' shared tooltip: meta line (when), title (where), rows of figures, a note.
    function tooltip(container) {
      const el = document.createElement('div');
      el.className = 'tooltip';
      el.hidden = true;
      el.setAttribute('aria-hidden', 'true');   // as the graphic: the steps carry its description
      container.appendChild(el);
      let clear = null;
      return {
        el,
        show(html, x, y, mark) {
          el.innerHTML = html;
          el.hidden = false;
          const cw = container.clientWidth, ch = container.clientHeight, tw = el.offsetWidth, th = el.offsetHeight;
          let left = x + 14;
          if (left + tw > cw) left = x - tw - 14;
          if (left < 0) left = Math.max(0, Math.min(cw - tw, x - tw / 2));
          let top = y - th - 14;
          if (top < 0) top = Math.min(y + 18, Math.max(0, ch - th));
          el.style.left = `${left}px`;
          el.style.top = `${top}px`;
          if (clear && clear !== mark) clear(null);
          clear = mark || null;
        },
        hide() { el.hidden = true; if (clear) { clear(null); clear = null; } },
      };
    }
    const tip = tooltip(chart);
    document.addEventListener('click', (e) => { if (!chart.contains(e.target)) tip.hide(); });
    chart.addEventListener('click', () => tip.hide());   // a tap on the graphic away from its marks (a mark's own tap stops here)
    const ym = d3.timeFormat('%Y-%m');
    const sexWord = () => (SEX === 'T' ? '' : SEX === 'M' ? ' · male' : ' · female');
    const ttRow = (sw, label, value) => `<div><dt>${sw ? `<i class="${sw}"></i>` : ''}${label}</dt><dd>${value}</dd></div>`;
    const ttHtml = (meta, title, rows, note) => `<div class="tt__meta">${meta}</div>${title ? `<div class="tt__title">${title}</div>` : ''}`
      + `<dl class="tt__rows">${rows.join('')}</dl>${note ? `<p class="tt__note">${note}</p>` : ''}`;
    // a target on the graphic: pick(event, datum) returns [html, what to mark] or null; mark(what) draws the hover
    // mark and mark(null) removes it
    function tipOn(target, pick, mark) {
      target.on('pointermove click', (e, d) => {
        const hit = pick(e, d);
        if (!hit) { tip.hide(); return; }
        if (mark) mark(hit[1]);
        const [px, py] = d3.pointer(e, chart);
        tip.show(hit[0], px, py, mark);
        if (e.type === 'click') e.stopPropagation();
      }).on('pointerleave', (e) => { if (e.pointerType !== 'touch') tip.hide(); });
    }
    // over time: the month under the pointer, a hairline at it and a dot on each series. at(t) returns
    // { html, ys: [[y, class]] } or null; mid: the month drawn as a step (its middle) or as a point (its start)
    function tipTime(svg, x, m, w, h, at, mid = true) {
      const hair = svg.append('line').attr('class', 'syr-hair').attr('y1', m.t).attr('y2', h - m.b).style('display', 'none');
      const dots = svg.append('g');
      const over = svg.append('rect').attr('class', 'overlay').attr('x', m.l).attr('y', m.t)
        .attr('width', Math.max(0, w - m.r - m.l)).attr('height', Math.max(0, h - m.b - m.t));
      const cx = (t) => (mid ? (x(t) + x(d3.timeMonth.offset(t, 1))) / 2 : x(t));
      tipOn(over, (e) => {
        const [px] = d3.pointer(e, svg.node());
        const t = mid ? d3.timeMonth.floor(x.invert(px)) : d3.timeMonth.round(x.invert(px));
        const hit = at(t);
        return hit ? [hit.html, { t, ys: hit.ys || [] }] : null;
      }, (d) => {
        dots.selectAll('*').remove();
        hair.style('display', d ? null : 'none');
        if (!d) return;
        hair.attr('x1', cx(d.t)).attr('x2', cx(d.t));
        d.ys.forEach(([yy, cls]) => dots.append('circle').attr('class', `syr-hdot${cls ? ` ${cls}` : ''}`).attr('cx', cx(d.t)).attr('cy', yy).attr('r', 3.5));
      });
    }

    // shared drawing parts
    function gridY(svg, y, m, w, fmt, ticks = 4) {
      const g = svg.append('g').attr('class', 'grid');
      y.ticks(ticks).forEach((v) => {
        g.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', Math.round(y(v)) + 0.5).attr('y2', Math.round(y(v)) + 0.5);
        svg.append('text').attr('x', m.l - 6).attr('y', y(v) + 4).attr('text-anchor', 'end').text(fmt(v));
      });
    }
    function axisYears(svg, x, m, h, w) {
      const step = w < 420 ? 4 : w < 640 ? 2 : 1;
      const [a, b] = x.domain();
      const g = svg.append('g').attr('class', 'axis');
      g.append('line').attr('x1', m.l).attr('x2', x(b)).attr('y1', h - m.b + 0.5).attr('y2', h - m.b + 0.5).attr('stroke', 'currentColor');
      for (let y = a.getFullYear(); y <= b.getFullYear(); y++) {
        const t = new Date(y, 0, 1);
        if (t < a || t > b) continue;
        g.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', h - m.b).attr('y2', h - m.b + 4);
        if ((y - a.getFullYear()) % step === 0 && x(t) + 32 <= w) svg.append('text').attr('x', x(t) + 2).attr('y', h - m.b + 16).text(y);
      }
    }
    function band(svg, m, h) {
      return svg.append('rect').attr('class', 'syr-band').attr('y', m.t).attr('height', h - m.b - m.t).attr('x', m.l).attr('width', 0);
    }
    function setBand(rect, x, a, b, dur) {
      const x0 = x(parseM(a)), x1 = x(d3.timeMonth.offset(parseM(b), 1));
      rect.transition().duration(dur).attr('x', x0).attr('width', Math.max(0, x1 - x0));
    }
    // events: a red line down to the baseline, a red disc above the plot, the label beside it (staggered when they
    // meet a label or another event's line; to the left of its line when the right side is taken or too narrow)
    function drawEvents(g, list, x, m, h, w, dur) {
      g.selectAll('*').remove();
      const placed = [];
      const xs = list.filter(([d]) => ev(d)).map(([d]) => x(parseD(d))).filter((xx) => xx >= m.l && xx <= w - m.r + 0.5);
      list.forEach(([d, label], k) => {
        const e = ev(d);
        if (!e) return;
        const xx = x(parseD(d));
        if (xx < m.l || xx > w - m.r + 0.5) return;
        const est = label.length * 6.6 + 10;
        const crosses = (b) => xs.some((o) => o !== xx && o > b[0] - 2 && o < b[1] + 2);
        const fitsR = xx + est < w, fitsL = xx - est > 0;
        const right = fitsR && (!crosses([xx, xx + est]) || !fitsL || crosses([xx - est, xx]));
        const box = right ? [xx, xx + est] : [xx - est, xx];
        let row = 0;
        // a label that crosses another event's line goes up a row, above that event's disc
        const over = crosses(box) ? 1 : 0;
        while (placed.some((p) => p.row === row && p.box[0] < box[1] && p.box[1] > box[0]) || row < over) row++;
        placed.push({ row, box });
        const yy = m.t - 14 - row * 15;
        const one = g.append('g').attr('opacity', 0);
        one.append('line').attr('class', 'syr-mk').attr('x1', xx).attr('x2', xx).attr('y1', yy).attr('y2', h - m.b);
        one.append('circle').attr('class', 'syr-badge').attr('cx', xx).attr('cy', yy).attr('r', 4.5);
        one.append('text').attr('class', 'syr-label').attr('x', right ? xx + 8 : xx - 8).attr('y', yy + 4)
          .attr('text-anchor', right ? 'start' : 'end').text(label);
        one.transition().delay(dur ? 150 + 80 * k : 0).duration(dur ? 300 : 0).attr('opacity', 1);
      });
    }

    function drawWar(svg, w, h) {
      const m = { t: 52, r: 12, b: firstPrelim ? 44 : 26, l: 46 };   // room under the years for the preliminary bracket
      const x = d3.scaleTime([parseM('2010-01'), d3.timeMonth.offset(lastWar.t, 1)], [m.l, w - m.r]);
      const y = d3.scaleLinear([0, peak.v], [h - m.b, m.t]).nice(4);
      const rect = band(svg, m, h);
      gridY(svg, y, m, w, (v) => num(v));
      svg.append('g').selectAll('rect').data(W).join('rect')
        .attr('class', (r) => (r.p ? 'syr-dead syr-dead--prelim' : 'syr-dead'))
        .attr('x', (r) => x(r.t)).attr('width', (r) => Math.max(0.6, x(d3.timeMonth.offset(r.t, 1)) - x(r.t) - (w > 700 ? 0.5 : 0)))
        .attr('y', (r) => y(r.v)).attr('height', (r) => y(0) - y(r.v));
      axisYears(svg, x, m, h, w);
      if (firstPrelim) {   // the preliminary months, named directly: a bracket under the years
        const x0 = x(firstPrelim.t), x1 = x(d3.timeMonth.offset(lastWar.t, 1)), yb = h - m.b + 24;
        svg.append('path').attr('class', 'syr-bracket').attr('d', `M${x0},${yb - 4}V${yb}H${x1}V${yb - 4}`);
        svg.append('text').attr('class', 'syr-label').attr('x', x1).attr('y', yb + 13).attr('text-anchor', 'end').text('Preliminary');
      }
      const evg = svg.append('g');
      const byM = new Map(W.map((r) => [r.m, r]));
      tipTime(svg, x, m, w, h, (t) => { const r = byM.get(ym(t)); return r && {
        html: ttHtml(mName(r.m), 'Syria', [ttRow('syr-sw syr-sw--dead', 'Deaths (UCDP best estimate)', num(r.v))], r.p ? 'Preliminary: UCDP Candidate data.' : ''),
        ys: [[y(r.v)]] }; });
      return (s, dur) => { setBand(rect, x, s.range[0], s.range[1], dur); drawEvents(evg, s.events || [], x, m, h, w, dur); };
    }

    // the years in focus in a column chart: a red bar under the axis (columns of shares and stacks are never dimmed)
    function focusBar(svg, xs, m, h) {
      const bar = svg.append('rect').attr('class', 'syr-focus').attr('y', h - m.b + 1).attr('height', 3).attr('width', 0);
      return (on, rows, key = (r) => r.y) => {
        const f = rows.filter(on);
        if (!f.length) { bar.attr('width', 0); return; }
        const x0 = xs(key(f[0])), x1 = xs(key(f[f.length - 1])) + xs.bandwidth();
        bar.attr('x', x0).attr('width', Math.max(0, x1 - x0));
      };
    }

    function drawAsylum(svg, w, h) {
      const m = { t: 52, r: 12, b: 26, l: 50 };
      const end = d3.max([deM[deM.length - 1].t, euM.length ? euM[euM.length - 1].t : deM[0].t]);
      const x = d3.scaleTime([parseM('2011-01'), d3.timeMonth.offset(end, 1)], [m.l, w - m.r]);
      const y = d3.scaleLinear([0, d3.max([...deM, ...euM], (r) => r.v)], [h - m.b, m.t]).nice(4);   // the scale of All
      const de = appsFor(SEX, 'DE'), eu = appsFor(SEX, 'EU27_2020').filter((r) => r.t >= parseM('2014-01'));
      const rect = band(svg, m, h);
      gridY(svg, y, m, w, (v) => num(v));
      const closed = (rows) => (rows.length ? [...rows, { t: d3.timeMonth.offset(rows[rows.length - 1].t, 1), v: rows[rows.length - 1].v }] : rows);
      svg.append('path').attr('class', 'syr-area--de')
        .attr('d', d3.area().x((r) => x(r.t)).y0(y(0)).y1((r) => y(r.v)).curve(d3.curveStepAfter)(closed(de)));
      if (eu.length) svg.append('path').attr('class', 'syr-line').attr('d', d3.line().x((r) => x(r.t)).y((r) => y(r.v)).curve(d3.curveStepAfter)(closed(eu)));
      svg.append('path').attr('class', 'syr-line syr-line--de').attr('d', d3.line().x((r) => x(r.t)).y((r) => y(r.v)).curve(d3.curveStepAfter)(closed(de)));
      const brk = parseM('2026-07');
      if (brk <= end) svg.append('line').attr('class', 'syr-break').attr('x1', x(brk)).attr('x2', x(brk)).attr('y1', m.t).attr('y2', h - m.b);
      axisYears(svg, x, m, h, w);
      const evg = svg.append('g');
      const deBy = new Map(de.map((r) => [r.m, r])), euBy = new Map(eu.map((r) => [r.m, r]));
      tipTime(svg, x, m, w, h, (t) => {
        const k = ym(t), a = deBy.get(k), b = euBy.get(k);
        if (!a && !b) return null;
        return { html: ttHtml(mName(k) + sexWord(), 'First-time asylum applicants, Syrian citizens',
          [a ? ttRow('syr-ln syr-ln--de', 'Germany', num(a.v)) : '', b ? ttRow('syr-ln', 'EU total', num(b.v)) : ''],
          k >= '2026-07' ? 'After the change of definition in July 2026.' : ''),
          ys: [...(b ? [[y(b.v)]] : []), ...(a ? [[y(a.v), 'syr-hdot--de']] : [])] };
      });
      return (s, dur) => { setBand(rect, x, s.range[0], s.range[1], dur); drawEvents(evg, s.events || [], x, m, h, w, dur); };
    }

    function drawAbroad(svg, w, h) {
      const narrow = w < 480;
      const m = { t: 6, r: narrow ? 74 : 82, b: 6, l: narrow ? 84 : 110 };
      const N = 7;
      const x = d3.scaleLinear([0, d3.max(AB, (r) => r.v)], [m.l, w - m.r]);
      const yb = d3.scaleBand(d3.range(N), [m.t, h - m.b]).padding(0.3);
      const g = svg.append('g');
      let year = null, yearTot = 0;
      const rowsFor = (yr) => {
        const ys = AB.filter((r) => r.y === yr).sort((a, b) => b.v - a.v);
        const keep = ys.slice(0, N - 1);
        if (!keep.some((r) => r.h === 'DEU')) { const de = ys.find((r) => r.h === 'DEU'); if (de) keep.splice(N - 2, 1, de); }
        const rest = d3.sum(ys.filter((r) => !keep.includes(r)), (r) => r.v);
        return [...keep.sort((a, b) => b.v - a.v).map((r) => ({ key: r.h, name: r.n, v: r.v, cls: r.h === 'DEU' ? 'de' : r.nb ? 'nb' : 'other' })),
          { key: 'OTHER', name: 'All others', v: rest, cls: 'other' }];
      };
      tipOn(g, (e) => { const gg = e.target.closest('g.syr-hb'), d = gg && d3.select(gg).datum(); return d && [ttHtml(`End of ${year}`,
        d.key === 'OTHER' ? 'All other countries' : esc(d.name), [ttRow('', 'People from Syria counted as refugees', num(d.v)), ttRow('', 'Share of all countries', pct(d.v, yearTot))]), null]; });
      return (s, dur) => {
        const rows = rowsFor(s.year);
        year = s.year; yearTot = d3.sum(rows, (r) => r.v);
        const sel = g.selectAll('g.syr-hb').data(rows, (d) => d.key);
        const en = sel.enter().append('g').attr('class', 'syr-hb').attr('transform', (d, i) => `translate(0,${yb(i)})`).attr('opacity', 0);
        en.append('rect').attr('class', 'overlay').attr('x', 0).attr('width', w).attr('y', -(yb.step() - yb.bandwidth()) / 2).attr('height', yb.step());   // the whole row
        en.append('rect').attr('x', m.l).attr('height', yb.bandwidth()).attr('width', 0);
        en.append('text').attr('class', 'syr-name').attr('x', m.l - 8).attr('text-anchor', 'end');
        en.append('text').attr('class', 'syr-val');
        sel.exit().transition().duration(dur).attr('opacity', 0).remove();
        const all = en.merge(sel);
        all.transition().duration(dur).attr('opacity', 1).attr('transform', (d, i) => `translate(0,${yb(i)})`);
        all.select('rect:not(.overlay)').attr('class', (d) => `syr-bar syr-bar--${d.cls}`).transition().duration(dur)
          .attr('height', yb.bandwidth()).attr('width', (d) => Math.max(0, x(d.v) - m.l));
        all.select('.syr-name').attr('y', yb.bandwidth() / 2 + 4).text((d) => d.name);
        all.select('.syr-val').attr('y', yb.bandwidth() / 2 + 4).text((d) => num(d.v))
          .transition().duration(dur).attr('x', (d) => x(d.v) + 6);
      };
    }

    function drawDecisions(svg, w, h) {
      const DEC = decFor(SEX);
      const m = { t: 26, r: 6, b: 26, l: 40 };
      const xs = d3.scaleBand(DEC.map((r) => r.y), [m.l, w - m.r]).padding(0.18);
      const y = d3.scaleLinear([0, 1], [h - m.b, m.t]);
      const g0 = svg.append('g').attr('class', 'grid');
      [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
        g0.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', Math.round(y(v)) + 0.5).attr('y2', Math.round(y(v)) + 0.5);
        svg.append('text').attr('x', m.l - 6).attr('y', y(v) + 4).attr('text-anchor', 'end').text(`${Math.round(v * 100)}%`);
      });
      const parts = [['rs', 'syr-o1'], ['sp', 'syr-o2'], ['hs', 'syr-o3'], ['neg', 'syr-o4']];
      const cols = svg.append('g').selectAll('g').data(DEC).join('g').attr('class', 'syr-col');
      cols.each(function (r) {
        let acc = 0;
        const c = d3.select(this);
        parts.forEach(([k, cls]) => {
          const v = r.s ? r[k] / r.s : 0;
          c.append('rect').attr('class', cls).attr('x', xs(r.y)).attr('width', xs.bandwidth())
            .attr('y', y(acc + v)).attr('height', Math.max(0, y(acc) - y(acc + v)));
          acc += v;
        });
      });
      const every = w < 420 ? 3 : w < 640 ? 2 : 1;
      const labels = svg.append('g').selectAll('text').data(DEC).join('text').attr('class', 'syr-axis')
        .attr('x', (r) => xs(r.y) + xs.bandwidth() / 2).attr('y', h - m.b + 16).attr('text-anchor', 'middle');
      // the number of decisions above each column (shares alone would give 985 decisions the weight of 290,000)
      const counts = svg.append('g').selectAll('text').data(DEC).join('text').attr('class', 'syr-count')
        .attr('x', (r) => xs(r.y) + xs.bandwidth() / 2).attr('y', m.t - 6);
      const focus = focusBar(svg, xs, m, h);
      const ring = svg.append('rect').attr('class', 'focus-ring').style('display', 'none');
      const OUT = [['rs', 'syr-o1', 'Refugee status'], ['sp', 'syr-o2', 'Subsidiary protection'], ['hs', 'syr-o3', 'Humanitarian status'], ['neg', 'syr-o4', 'Rejected']];
      tipOn(svg.append('g').selectAll('rect').data(DEC).join('rect').attr('class', 'overlay')
        .attr('x', (r) => xs(r.y) - (xs.step() - xs.bandwidth()) / 2).attr('width', xs.step()).attr('y', m.t - 18).attr('height', h - m.b - m.t + 18),
      (e, r) => [ttHtml(`${r.y}${sexWord()}`, 'First-instance decisions, Germany',
        [...OUT.map(([k, cls, lab]) => ttRow(`syr-sw ${cls}`, lab, `${num(r[k])} · ${pct(r[k], r.s)}`)), ttRow('', 'All decisions', num(r.t))]), r],
      (r) => { ring.style('display', r ? null : 'none'); if (r) ring.attr('x', xs(r.y) - 1.5).attr('width', xs.bandwidth() + 3).attr('y', m.t - 1.5).attr('height', h - m.b - m.t + 3); });
      return (s) => {
        const on = (r) => r.y >= s.range[0] && r.y <= s.range[1];
        focus(on, DEC);
        // narrow: two-digit years (’16); the years in focus always labelled, the rest every second or third
        const short = xs.bandwidth() < 34;
        labels.classed('is-on', on).text((r, i) => (on(r) || i % every === 0 ? (short ? `’${String(r.y).slice(2)}` : r.y) : ''));
        // every count where there is room; where not, the years in focus first, then others that do not touch them
        const shown = [], keep = new Set();   // [centre, half width] of each count placed
        [...DEC.filter(on), ...DEC.filter((r) => !on(r))].forEach((r) => {
          const cx = xs(r.y) + xs.bandwidth() / 2, hw = compact(r.t).length * 3.2 + 2;   // 10.5px tabular figures
          if (shown.some(([c, o]) => Math.abs(c - cx) < hw + o)) return;
          shown.push([cx, hw]); keep.add(r.y);
        });
        counts.classed('is-on', on).text((r) => (keep.has(r.y) ? compact(r.t) : ''));
      };
    }

    // the routes on a map: countries, Syria outlined and Germany blue; schematic lines; a grey circle per border
    // section (Frontex detections of Syrian citizens in the year), a ring per country (first-time applications)
    let clipN = 0;
    function drawRouteMap(svg, w, h) {
      const t = D.region.transform;
      const arcs = D.region.arcs.map((a) => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * t.scale[0] + t.translate[0], y * t.scale[1] + t.translate[1]]; }); });
      const arc = (i) => (i < 0 ? arcs[~i].slice().reverse() : arcs[i]);
      const ring = (ids) => { const pts = []; ids.forEach((i, k) => { const a = arc(i); pts.push(...(k ? a.slice(1) : a)); }); return pts; };
      const feats = D.region.objects.countries.geometries.map((g) => ({ type: 'Feature', id: g.id, properties: g.properties || {},
        geometry: { type: 'MultiPolygon', coordinates: g.arcs.map((p) => p.map(ring)) } }));
      const frame = { type: 'MultiPoint', coordinates: [[-9.5, 36], [-9.5, 43.8], [44, 30], [44, 56], [2, 30], [10.5, 61], [24, 61.5], [23, 29]] };
      const proj = d3.geoAzimuthalEqualArea().rotate([-23, -44]).fitExtent([[4, 4], [w - 4, h - 4]], frame);
      const path = d3.geoPath(proj);
      const id = `syr-clip-${++clipN}`;
      svg.append('clipPath').attr('id', id).append('rect').attr('width', w).attr('height', h);
      const g = svg.append('g').attr('clip-path', `url(#${id})`);
      g.append('g').selectAll('path').data(feats).join('path')
        .attr('class', (f) => (f.id === 'DE' ? 'syr-cty syr-cty--de' : f.id === 'SY' ? 'syr-cty syr-cty--sy' : 'syr-cty')).attr('d', path);
      const curve = d3.line().curve(d3.curveCatmullRom.alpha(0.5));
      g.append('g').selectAll('path').data(PATHS).join('path').attr('class', 'syr-path').attr('d', (p) => curve(p.map((c) => proj(c))));
      const sy = feats.find((f) => f.id === 'SY');
      if (sy) g.append('text').attr('class', 'syr-label').attr('x', path.centroid(sy)[0]).attr('y', path.centroid(sy)[1] + 18).attr('text-anchor', 'middle').text('Syria');
      // two units, two scales: detections (discs) and applicants (rings) are never sized against each other
      const rMax = Math.max(16, Math.min(40, w / 16));
      const detMax = d3.max(SECTIONS, (c) => d3.max([2015, 2016, 2022, 2023], (y) => secY(c, y)));
      const appMax = d3.max(AY.filter((a) => a.r === 'europe31'), (a) => a.v);
      const rDet = d3.scaleSqrt([0, detMax], [0, rMax]), rApp = d3.scaleSqrt([0, appMax], [0, rMax]);
      // where a ring sits: the country's centroid, or a point in its south where the centroid lies beyond the map
      const ANCHOR = { SE: [15.0, 57.8], NO: [10.0, 59.6], FI: [25.0, 60.9], PT: [-8.2, 39.8], ES: [-3.7, 40.2] };
      const centre = new Map(feats.map((f) => [f.id, ANCHOR[f.id] ? proj(ANCHOR[f.id]) : path.centroid(f)]));
      // a ring is drawn only where it fits whole inside the map; the countries left out are named in the note
      const fits = (c, rr) => c && c[0] - rr > 1 && c[0] + rr < w - 1 && c[1] - rr > 1 && c[1] + rr < h - 1;
      const rings = g.append('g'), dots = g.append('g'), lab = g.append('g');
      let year = null;
      const hov = g.append('circle').attr('class', 'focus-ring').style('display', 'none');
      const markC = (c) => { hov.style('display', c ? null : 'none'); if (c) hov.attr('cx', c[0]).attr('cy', c[1]).attr('r', c[2] + 1.5); };
      tipOn(dots, (e) => { const c = d3.select(e.target).datum(); return c && [ttHtml(String(year), esc(c.lab),
        [ttRow('syr-sw syr-sw--det', 'Detections of Syrian citizens', num(c.v))], `Frontex, ${c.b === 'Sea' ? 'sea' : 'land'} border. Detections, not people.`), [c.xy[0], c.xy[1], Math.max(2, rDet(c.v))]]; }, markC);
      tipOn(rings, (e) => { const a = d3.select(e.target).datum(); return a && [ttHtml(String(year), esc(a.n),
        [ttRow(a.g === 'DE' ? 'syr-sw syr-sw--ringde' : 'syr-sw syr-sw--ring', 'First-time asylum applicants', num(a.v))], 'Eurostat. Applicants with Syrian citizenship.'), [...centre.get(a.g), rApp(a.v)]]; }, markC);
      // size keys in the map's lower left corner, one per unit: nested circles, the values beside them
      const keyG = svg.append('g');
      let kx = 8;
      [['Detections', rDet, detMax, 'syr-det'], ['Applicants', rApp, appMax, 'syr-ring']].forEach(([title, sc, max, cls]) => {
        const vals = [100000, 10000].filter((v) => v <= max);
        if (!vals.length) return;
        const R0 = sc(vals[0]), base = h - 10;
        keyG.append('text').attr('class', 'syr-label').attr('x', kx).attr('y', base - 2 * R0 - 8).text(title);
        vals.forEach((v) => {
          const rr = sc(v);
          keyG.append('circle').attr('class', cls).attr('cx', kx + R0).attr('cy', base - rr).attr('r', rr);
          keyG.append('line').attr('class', 'syr-bracket').attr('x1', kx + R0).attr('x2', kx + 2 * R0 + 4).attr('y1', base - 2 * rr).attr('y2', base - 2 * rr);
          keyG.append('text').attr('class', 'syr-label').attr('x', kx + 2 * R0 + 6).attr('y', base - 2 * rr + 4).text(num(v));
        });
        kx += 2 * R0 + 6 + 52 + 14;
      });
      return (s) => {
        const all = apY(s.year).filter((a) => a.v > 0).sort((a, b) => b.v - a.v);
        const apps = all.filter((a) => fits(centre.get(a.g), rApp(a.v)));
        routeOut = all.filter((a) => !apps.includes(a)).map((a) => `${a.n} (${num(a.v)})`);
        rings.selectAll('circle').data(apps, (a) => a.g).join('circle')
          .attr('class', (a) => (a.g === 'DE' ? 'syr-ring syr-ring--de' : 'syr-ring'))
          .attr('cx', (a) => centre.get(a.g)[0]).attr('cy', (a) => centre.get(a.g)[1]).attr('r', (a) => rApp(a.v));
        const secs = SECTIONS.map((c) => ({ ...c, v: secY(c, s.year), xy: proj(c.at) })).filter((c) => c.v > 0).sort((a, b) => b.v - a.v);
        dots.selectAll('circle').data(secs, (c) => c.r + c.b).join('circle').attr('class', 'syr-det')
          .attr('cx', (c) => c.xy[0]).attr('cy', (c) => c.xy[1]).attr('r', (c) => Math.max(2, rDet(c.v)));
        year = s.year;
        // labels: the three countries the text names and the largest sections; never over each other or over a disc
        lab.selectAll('*').remove();
        const placed = [];
        const hit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
        const discs = secs.map((c) => { const rr = Math.max(2, rDet(c.v)); return [c.xy[0] - rr, c.xy[1] - rr, c.xy[0] + rr, c.xy[1] + rr]; });
        // labels keep clear of the rings too (a ring's own label excepted)
        const ringBox = apps.filter((a) => rApp(a.v) >= 4).map((a) => { const [cx, cy] = centre.get(a.g), rr = rApp(a.v); return { g: a.g, box: [cx - rr, cy - rr, cx + rr, cy + rr] }; });
        const put = (cx, cy, rr, text, strong, own, ownRing) => {
          const tw = text.length * 7;   // 11.5px monospaced figures and letters
          const at = (g) => [[cx + rr + g, cy + 4, 'start', [cx + rr + g, cy - 9, cx + rr + g + tw, cy + 5], [cx + rr, cy, cx + rr + g - 2, cy]],
            [cx - rr - g, cy + 4, 'end', [cx - rr - g - tw, cy - 9, cx - rr - g, cy + 5], [cx - rr, cy, cx - rr - g + 2, cy]],
            [cx, cy - rr - g - 2, 'middle', [cx - tw / 2, cy - rr - g - 15, cx + tw / 2, cy - rr - g - 1], [cx, cy - rr, cx, cy - rr - g + 2]],
            [cx, cy + rr + g + 11, 'middle', [cx - tw / 2, cy + rr + g - 2, cx + tw / 2, cy + rr + g + 12], [cx, cy + rr, cx, cy + rr + g - 2]]];
          // beside the mark first, then further out with a leader line
          for (const [x, y, anchor, box, leader] of [...at(4), ...at(22), ...at(40)]) {
            if (box[0] < 2 || box[2] > w - 2 || box[1] < 2 || box[3] > h - 2 || placed.some((p) => hit(p, box))) continue;
            if (discs.some((d, i) => i !== own && hit(d, box)) || ringBox.some((b) => b.g !== ownRing && hit(b.box, box))) continue;
            placed.push(box);
            if (Math.hypot(leader[2] - leader[0], leader[3] - leader[1]) > 4)
              lab.append('line').attr('class', 'syr-bracket').attr('x1', leader[0]).attr('y1', leader[1]).attr('x2', leader[2]).attr('y2', leader[3]);
            lab.append('text').attr('class', `syr-label${strong ? ' syr-label--strong' : ''}`).attr('x', x).attr('y', y).attr('text-anchor', anchor).text(text);
            return;
          }
        };
        const narrow = w < 480;
        apps.slice(0, 3).forEach((a) => put(centre.get(a.g)[0], centre.get(a.g)[1], rApp(a.v), `${a.n} ${num(a.v)}`, a.g === 'DE', -1, a.g));
        secs.slice(0, narrow ? 2 : 3).forEach((c, i) => put(c.xy[0], c.xy[1], Math.max(2, rDet(c.v)), `${narrow ? c.short : c.lab} ${num(c.v)}`, false, i, null));
      };
    }

    // Frontex detections of Syrian citizens per month: the eastern Mediterranean as an area, the Western Balkans and
    // the central Mediterranean as lines; zoom = the scale follows the months in focus and after
    function drawRoutes(svg, w, h) {
      const S = { EM: rtSeries('EM'), WB: rtSeries('WB'), CM: rtSeries('CM') };
      const y = d3.scaleLinear([0, d3.max(S.EM, (r) => r.v)], [0, 1]).nice(4);
      const m = { t: 52, r: 12, b: 26, l: 14 + 6.8 * d3.max(y.ticks(4), (v) => num(v).length) };   // room for the longest axis value
      y.range([h - m.b, m.t]);
      const x = d3.scaleTime([parseM('2009-01'), d3.timeMonth.offset(parseM(rtLast), 1)], [m.l, w - m.r]);
      const ZOOM_FROM = parseM('2019-01');
      const rect = band(svg, m, h);
      const grid = svg.append('g');
      const axis = svg.append('g');
      const closed = (rows) => [...rows, { t: d3.timeMonth.offset(rows[rows.length - 1].t, 1), v: rows[rows.length - 1].v }];
      const area = d3.area().x((r) => x(r.t)).y0(() => y(0)).y1((r) => y(r.v)).curve(d3.curveStepAfter);
      const line = d3.line().x((r) => x(r.t)).y((r) => y(r.v)).curve(d3.curveStepAfter);
      const em = svg.append('path').attr('class', 'syr-route syr-route--em');
      const wb = svg.append('path').attr('class', 'syr-route syr-route--wb');
      const cm = svg.append('path').attr('class', 'syr-route syr-route--cm');
      const evg = svg.append('g');
      const full = y.domain()[1];
      const draw = (dur) => {
        axis.selectAll('*').remove();
        axisYears(axis, x, m, h, w);
        grid.selectAll('*').remove();
        const g = grid.append('g').attr('class', 'grid');
        y.ticks(4).forEach((v) => {
          g.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', Math.round(y(v)) + 0.5).attr('y2', Math.round(y(v)) + 0.5);
          grid.append('text').attr('x', m.l - 6).attr('y', y(v) + 4).attr('text-anchor', 'end').text(num(v));
        });
        const from = x.domain()[0], vis = (rows) => closed(rows.filter((r) => r.t >= from));
        em.attr('d', area(vis(S.EM)));
        wb.attr('d', line(vis(S.WB)));
        cm.attr('d', line(vis(S.CM)));
      };
      tipTime(svg, x, m, w, h, (t) => {
        const k = ym(t), i = rtMonths.indexOf(k);
        if (i < 0 || t < x.domain()[0]) return null;
        const [a, b, c] = [S.EM[i], S.WB[i], S.CM[i]];
        return { html: ttHtml(mName(k), 'Detections of Syrian citizens', [ttRow('syr-sw syr-sw--em', 'Eastern Mediterranean', num(a.v)),
          ttRow('syr-ln syr-ln--wb', 'Western Balkans', num(b.v)), ttRow('syr-ln syr-ln--cm', 'Central Mediterranean', num(c.v))], 'Frontex. Detections, not people.'),
          ys: [[y(a.v)], [y(b.v)], [y(c.v)]] };
      });
      let zoomed = null;
      return (s, dur) => {
        const z = !!s.zoom;
        if (z !== zoomed) {   // enlarged: from 2019 on, the scale of those months
          x.domain([z ? ZOOM_FROM : parseM('2009-01'), x.domain()[1]]);
          y.domain([0, z ? d3.max(['EM', 'WB', 'CM'].flatMap((k) => S[k].filter((r) => r.t >= ZOOM_FROM).map((r) => r.v))) : full]).nice(4);
          draw(0);
          zoomed = z;
        }
        setBand(rect, x, s.range[0], s.range[1], dur);
        drawEvents(evg, s.events || [], x, m, h, w, dur);
      };
    }

    // Employment Agency, per month: key as an area (the agency's estimates lighter), line as a line; the series of the
    // switch (male and female from 2020), on the scale of all
    function drawMonthly(svg, w, h, key, line) {
      const rowsT = WKT.filter((r) => r[key] != null), rows = wkOf(SEX).filter((r) => r[key] != null);
      const span = WKT.filter((r) => r[key] != null || (line && r[line] != null));   // the axis covers both series
      const yMax = d3.max(WKT, (r) => Math.max(r[key] || 0, line ? r[line] || 0 : 0));
      const y = d3.scaleLinear([0, yMax], [0, 1]).nice(4);
      const m = { t: 52, r: 12, b: 26, l: 14 + 6.8 * d3.max(y.ticks(4), (v) => num(v).length) };
      y.range([h - m.b, m.t]);
      const x = d3.scaleTime([span[0].t, d3.timeMonth.offset(span[span.length - 1].t, 1)], [m.l, w - m.r]);
      const rect = band(svg, m, h);
      gridY(svg, y, m, w, (v) => num(v));
      const est = key === 'e' ? 'ee' : 'be';
      const closed = (rs) => (rs.length ? [...rs, { t: d3.timeMonth.offset(rs[rs.length - 1].t, 1), [key]: rs[rs.length - 1][key] }] : rs);
      const area = d3.area().x((r) => x(r.t)).y0(y(0)).y1((r) => y(r[key])).curve(d3.curveStepAfter);
      const fin = rows.filter((r) => !r[est]), tail = rows.filter((r, i) => r[est] || (rows[i + 1] && rows[i + 1][est]));
      svg.append('path').attr('class', key === 'e' ? 'syr-tot' : 'syr-sup').attr('d', area(closed(fin)));
      if (tail.length > 1) svg.append('path').attr('class', 'syr-est').attr('d', area(closed(tail)));
      if (line) {
        const ls = wkOf(SEX).filter((r) => r[line] != null);
        const lc = ls.length ? [...ls, { t: d3.timeMonth.offset(ls[ls.length - 1].t, 1), [line]: ls[ls.length - 1][line] }] : ls;
        const ld = d3.line().x((r) => x(r.t)).y((r) => y(r[line])).curve(d3.curveStepAfter)(lc);
        svg.append('path').attr('class', 'syr-halo').attr('d', ld);
        svg.append('path').attr('class', 'syr-line').attr('d', ld);
      }
      axisYears(svg, x, m, h, w);
      const val = svg.append('text').attr('class', 'syr-label syr-label--strong').attr('text-anchor', 'end');
      const byM = new Map(wkOf(SEX).map((r) => [r.m, r]));
      tipTime(svg, x, m, w, h, (t) => {
        const r = byM.get(ym(t));
        if (!r || (r[key] == null && (!line || r[line] == null))) return null;
        const rows = key === 'e'
          ? [ttRow(r.ee ? 'syr-sw syr-sw--est' : 'syr-sw syr-sw--tot', 'In a job subject to social security', num(r.e))]
          : [r.b != null ? ttRow('syr-sw syr-sw--sup', 'Basic income support, able to work', num(r.b)) : '', r.u != null ? ttRow('syr-ln', 'Registered unemployed', num(r.u)) : ''];
        return { html: ttHtml(mName(r.m) + sexWord(), 'Syrian citizens', rows, r[est] ? 'Estimate of the agency.' : ''),
          ys: [...(r[key] != null ? [[y(r[key])]] : []), ...(line && r[line] != null ? [[y(r[line])]] : [])] };
      });
      return (s, dur) => {
        setBand(rect, x, s.range[0] < d3.timeFormat('%Y-%m')(rowsT[0].t) ? d3.timeFormat('%Y-%m')(rowsT[0].t) : s.range[0], s.range[1], dur);
        const last = rows.filter((r) => r.m <= s.range[1]).pop();
        if (last) val.attr('x', Math.min(w - 4, x(last.t) + 4)).attr('y', y(last[key]) - 8).text(num(last[key]));
      };
    }

    // employment rates per month: Syrian citizens in ink, all foreign citizens and German citizens in grey
    function drawRates(svg, w, h) {
      const m = { t: 40, r: 44, b: 26, l: 40 };
      const all = WR.filter((r) => r.er != null);
      const x = d3.scaleTime([d3.min(all, (r) => r.t), d3.timeMonth.offset(d3.max(all, (r) => r.t), 1)], [m.l, w - m.r]);
      const y = d3.scaleLinear([0, Math.max(80, d3.max(all, (r) => r.er))], [h - m.b, m.t]).nice(4);
      const rect = band(svg, m, h);
      gridY(svg, y, m, w, (v) => `${v}%`);
      const line = d3.line().x((r) => x(r.t)).y((r) => y(r.er));
      [['GERMAN', 'syr-route syr-route--wb'], ['FOREIGN', 'syr-route syr-route--cm'], ['SY', 'syr-line']].forEach(([g, cls]) => {
        const rs = wrOf(g);
        svg.append('path').attr('class', cls).attr('d', line(rs)).style('stroke-width', g === 'SY' ? '2px' : null);
        const l = rs[rs.length - 1];
        if (l) svg.append('text').attr('class', 'syr-label').attr('x', x(l.t) + 4).attr('y', y(l.er) + 4).text(`${Math.round(l.er)}%`);
      });
      axisYears(svg, x, m, h, w);
      const f1 = d3.format('.1f');
      tipTime(svg, x, m, w, h, (t) => {
        const k = ym(t), at = (g) => WR.find((r) => r.g === g && r.m === k && r.er != null);
        const sy = at('SY'), fo = at('FOREIGN'), de = at('GERMAN');
        if (!sy && !fo && !de) return null;
        return { html: ttHtml(mName(k), 'Employment rate', [sy ? ttRow('syr-ln', 'Syrian citizens', `${f1(sy.er)}%`) : '',
          fo ? ttRow('syr-ln syr-ln--cm', 'All foreign citizens', `${f1(fo.er)}%`) : '', de ? ttRow('syr-ln syr-ln--wb', 'German citizens', `${f1(de.er)}%`) : ''],
          (sy || fo || de).p ? 'Provisional.' : ''),
          ys: [sy, fo, de].filter(Boolean).map((r) => [y(r.er)]) };
      }, false);
      return (s, dur) => setBand(rect, x, s.range[0], s.range[1], dur);
    }

    // columns per year: one series, several side by side, or stacked; the years in focus at full strength, the
    // value of the last year in focus above its column
    function drawCols(svg, w, h, rows, series, stacked = false, yMax = null, labelOf = null, what = '', totalName = 'Total') {
      const total = (r) => (stacked ? d3.sum(series, ([k]) => r[k] || 0) : d3.max(series, ([k]) => r[k] || 0));
      const y = d3.scaleLinear([0, yMax || d3.max(rows, total)], [0, 1]).nice(4);
      const m = { t: 22, r: 8, b: 26, l: 14 + 6.8 * d3.max(y.ticks(4), (v) => num(v).length) };   // room for the longest axis value
      y.range([h - m.b, m.t]);
      const xs = d3.scaleBand(rows.map((r) => r.y), [m.l, w - m.r]).padding(0.18);
      gridY(svg, y, m, w, (v) => num(v));
      const inner = series.length > 1 && !stacked ? d3.scaleBand(series.map(([k]) => k), [0, xs.bandwidth()]).padding(0.06) : null;
      const cols = svg.append('g').selectAll('g').data(rows).join('g').attr('class', 'syr-col');
      cols.each(function (r) {
        const c = d3.select(this);
        if (r.gap) {   // a month without figures: an empty dashed slot, not a zero
          c.append('rect').attr('class', 'syr-gap').attr('x', xs(r.y) + 0.5).attr('width', Math.max(0, xs.bandwidth() - 1))
            .attr('y', m.t + 0.5).attr('height', Math.max(0, y(0) - m.t - 1));
          return;
        }
        let acc = 0;
        series.forEach(([k, cls]) => {
          const v = r[k] || 0;
          const rect = c.append('rect').attr('class', cls);
          if (stacked) { rect.attr('x', xs(r.y)).attr('width', xs.bandwidth()).attr('y', y(acc + v)).attr('height', Math.max(0, y(acc) - y(acc + v))); acc += v; }
          else rect.attr('x', xs(r.y) + (inner ? inner(k) : 0)).attr('width', inner ? inner.bandwidth() : xs.bandwidth()).attr('y', y(v)).attr('height', Math.max(0, y(0) - y(v)));
        });
      });
      const every = w < 420 ? 3 : w < 640 ? 2 : 1, short = xs.bandwidth() < 34;
      const labels = svg.append('g').selectAll('text').data(rows).join('text').attr('class', 'syr-axis')
        .attr('x', (r) => xs(r.y) + xs.bandwidth() / 2).attr('y', h - m.b + 16).attr('text-anchor', 'middle');
      const val = svg.append('text').attr('class', 'syr-label syr-label--strong').attr('text-anchor', 'middle');
      // the value shown: the stack's total, or the first series where columns stand side by side
      const shown = (r) => (labelOf ? labelOf(r) : stacked || !inner ? total(r) : r[series[0][0]] || 0);
      const cx = (r) => (stacked || !inner ? xs(r.y) + xs.bandwidth() / 2 : xs(r.y) + inner(series[0][0]) + inner.bandwidth() / 2);
      const crowded = xs.step() < 26;
      const focus = focusBar(svg, xs, m, h);
      // the tooltip: each series of the column and, where the column adds up, its total
      const ring = svg.append('rect').attr('class', 'focus-ring').style('display', 'none');
      tipOn(svg.append('g').selectAll('rect').data(rows).join('rect').attr('class', 'overlay')
        .attr('x', (r) => xs(r.y) - (xs.step() - xs.bandwidth()) / 2).attr('width', xs.step()).attr('y', m.t - 18).attr('height', h - m.b - m.t + 18),
      (e, r) => [ttHtml(`${/^\d{4}-\d{2}$/.test(r.y) ? mName(r.y) : r.lab || r.y}${sexWord()}`, what, r.gap ? [] : [...series.map(([k, cls, name]) => ttRow(`syr-sw ${cls}`, name, num(r[k] || 0))),
        ...(stacked || labelOf ? [ttRow('', totalName, num(shown(r)))] : [])], r.gap ? 'No figures for this month.' : ''), r],
      (r) => { ring.style('display', r ? null : 'none');
        if (r) { const top = r.gap ? m.t : y(total(r)); ring.attr('x', xs(r.y) - 1.5).attr('width', xs.bandwidth() + 3).attr('y', top - 1.5).attr('height', Math.max(0, y(0) - top) + 3); } });
      return (s) => {
        const on = (r) => !s.range || (r.y >= s.range[0] && r.y <= s.range[1]);
        const last = rows.filter((r) => on(r) && !r.gap).pop();
        // one series: dimmed outside the focus; stacked or side by side, never (a dimmed shade reads as another series)
        cols.classed('is-dim', (r) => series.length === 1 && !on(r));
        focus(on, rows);
        const lab = (r) => (r.lab ? (short || r.lab.length * 6.6 > xs.step() * 1.3 ? r.labShort || r.lab : r.lab) : short ? `’${String(r.y).slice(2)}` : r.y);
        labels.classed('is-on', on).text((r, i) => ((on(r) && !crowded) || i % every === 0 || r === last ? lab(r) : ''));
        if (!last) { val.text(''); return; }
        // above every column the label would cross
        const lx = Math.min(w - 30, Math.max(m.l + 30, cx(last))), half = (num(shown(last)).length * 6.4) / 2;   // 12px tabular figures
        let top = 0;
        rows.forEach((r) => series.forEach(([k]) => {     // each column (or side-by-side column) the label's width crosses
          const x0 = stacked || !inner ? xs(r.y) : xs(r.y) + inner(k), x1 = x0 + (stacked || !inner ? xs.bandwidth() : inner.bandwidth());
          if (x1 > lx - half + 2 && x0 < lx + half - 2) top = Math.max(top, stacked || !inner ? total(r) : r[k] || 0);
        }));
        val.attr('x', lx).attr('y', y(top) - 7).text(num(shown(last)));
      };
    }

    // length of stay at the end of the latest year: one bar per band, the years of first entry beside its name
    function drawStay(svg, w, h) {
      const STAY_T = stayFor('T'), STAY = stayFor(SEX);
      const narrow = w < 480;
      const m = { t: 6, r: narrow ? 66 : 76, b: 6, l: narrow ? 100 : 124 };
      const x = d3.scaleLinear([0, d3.max(STAY_T, (r) => r.v)], [m.l, w - m.r]);   // the scale of All
      const yb = d3.scaleBand(STAY.map((r) => r.key), [m.t, h - m.b]).padding(0.3);
      const g = svg.append('g');
      const tot = d3.sum(STAY, (r) => r.v);
      STAY.forEach((r) => {
        const yy = yb(r.key), mid = yy + yb.bandwidth() / 2;
        const gg = g.append('g').datum(r);
        gg.append('rect').attr('class', 'overlay').attr('x', 0).attr('width', w).attr('y', yy - (yb.step() - yb.bandwidth()) / 2).attr('height', yb.step());   // the whole row
        gg.append('rect').attr('class', 'syr-bar syr-tot').attr('x', m.l).attr('y', yy).attr('height', yb.bandwidth()).attr('width', Math.max(0, x(r.v) - m.l));
        gg.append('text').attr('class', 'syr-name').attr('x', m.l - 8).attr('y', mid - 2).attr('text-anchor', 'end').text(r.name);
        gg.append('text').attr('class', 'syr-label').attr('x', m.l - 8).attr('y', mid + 12).attr('text-anchor', 'end').style('fill', 'var(--muted)').text(r.years);
        gg.append('text').attr('class', 'syr-val').attr('x', x(r.v) + 6).attr('y', mid + 4).text(num(r.v));
      });
      tipOn(g.selectAll('g'), (e, r) => [ttHtml(`End of ${stayYear}${sexWord()}`, `In Germany ${r.name}`,
        [ttRow('syr-sw syr-sw--tot', 'Syrian protection seekers', num(r.v)), ttRow('', 'Share of all', pct(r.v, tot))], `First entry ${r.b >= 99 ? r.years : `in ${r.years}`}, read from the length of stay.`), null]);
      return () => {};
    }

    // TopoJSON decoding (polygons and lines only), as on the Germany page, so the page needs no further library
    function topoFeatures(topo) {
      const t = topo.transform;
      const arcs = topo.arcs.map((a) => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * t.scale[0] + t.translate[0], y * t.scale[1] + t.translate[1]]; }); });
      const arc = (i) => (i < 0 ? arcs[~i].slice().reverse() : arcs[i]);
      const ring = (ids) => { const pts = []; ids.forEach((i, k) => { const a = arc(i); pts.push(...(k ? a.slice(1) : a)); }); return pts; };
      const feats = topo.objects.counties.geometries.map((g) => ({ type: 'Feature', id: g.id, properties: {},
        geometry: { type: 'MultiPolygon', coordinates: g.arcs.map((p) => p.map(ring)) } }));
      const lines = (kind) => ({ type: 'MultiLineString', coordinates: arcs.filter((_, i) => topo.kinds[i] === kind) });
      return { feats, lines };
    }

    // one circle per county at its centre, area by the number of protection seekers, the largest first so the small
    // ones stay on top; the counties with the most named
    function drawMap(svg, w, h) {
      const { feats, lines } = topoFeatures(D.topo);
      const all = { type: 'FeatureCollection', features: feats };
      const proj = d3.geoIdentity().reflectY(true).fitExtent([[4, 4], [w - 4, h - 4]], all);
      const path = d3.geoPath(proj);
      svg.append('g').selectAll('path').data(feats).join('path').attr('class', 'syr-land').attr('d', path);
      [['c', 'syr-border--c'], ['s', 'syr-border--s'], ['o', 'syr-border--o']].forEach(([k, cls]) =>
        svg.append('path').attr('class', `syr-border ${cls}`).attr('d', path(lines(k))));
      const [[mx0], [mx1]] = path.bounds(all);
      const byKey = new Map(ofSex(CTY_ALL, SEX).map((r) => [r.k, r]));
      const rMax = Math.max(12, Math.min(30, (mx1 - mx0) / 16));
      const r = d3.scaleSqrt([0, ctyRank[0].v], [0, rMax]);
      const dots = feats.map((f) => ({ ...(byKey.get(f.id) || { k: f.id, n: f.id, v: 0 }), c: path.centroid(f) })).filter((d) => d.v > 0)
        .sort((a, b) => b.v - a.v);
      const circles = svg.append('g').selectAll('circle').data(dots).join('circle').attr('class', 'syr-dot')
        .attr('cx', (d) => d.c[0]).attr('cy', (d) => d.c[1]).attr('r', (d) => r(d.v));
      // the tooltip: the circle under the pointer (the smallest where circles overlap, as drawn), or one within 6px
      const hov = svg.append('circle').attr('class', 'focus-ring').style('display', 'none');
      const ctyTotSx = d3.sum(dots, (d) => d.v);
      tipOn(svg.append('rect').attr('class', 'overlay').attr('width', w).attr('height', h), (e) => {
        const [px, py] = d3.pointer(e, svg.node());
        let best = null, score = Infinity;
        dots.forEach((d) => {
          const dist = Math.hypot(d.c[0] - px, d.c[1] - py), rr = r(d.v);
          const sc = dist <= rr ? rr - 1000 : dist - rr;
          if (sc < score && (dist <= rr || dist - rr <= 6)) { score = sc; best = d; }
        });
        return best && [ttHtml(`End of ${ctyYear}${sexWord()}`, esc(best.n), [ttRow('syr-sw syr-sw--dot', 'Syrian protection seekers', num(best.v)),
          ttRow('', 'Share of Germany', pct1(best.v, ctyTotSx))], best.unit ? `Counted together: ${UNIT_NOTE[best.k]}.` : ''), best];
      }, (d) => { hov.style('display', d ? null : 'none'); if (d) hov.attr('cx', d.c[0]).attr('cy', d.c[1]).attr('r', r(d.v) + 1.5); });
      // the size key in the legend row, drawn with this scale
      mapKey = [1000, 10000, 30000].filter((v) => v <= ctyRank[0].v).map((v) => [v, r(v)]);
      const lab = svg.append('g');
      return (s) => {
        lab.selectAll('*').remove();
        // a label goes beside, above or below its circle, never over another label or another large circle,
        // so it cannot be read as a neighbour's
        const big = dots.slice(0, 15).map((d) => { const rr = r(d.v); return { d, box: [d.c[0] - rr, d.c[1] - rr, d.c[0] + rr, d.c[1] + rr] }; });
        // a label of a county the text names keeps clear of every circle, not only the large ones
        const boxes = (min) => dots.filter((d) => r(d.v) >= min).map((d) => { const rr = r(d.v); return { d, box: [d.c[0] - rr, d.c[1] - rr, d.c[0] + rr, d.c[1] + rr] }; });
        const avoid = [boxes(1.5), boxes(4), big];   // every circle if possible, then the small ones may be crossed
        const done = new Set();
        const hit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
        const placed = [];
        // the counties the text names (and Saarland) first, then the next largest while there is room
        const named = [...ctyRankC.slice(0, 3).map((r) => r.k), saar.k];
        [...dots.filter((d) => named.includes(d.k)), ...dots.filter((d) => !named.includes(d.k))].slice(0, s.top || 0).forEach((d) => {
          const text = `${d.n} ${num(d.v)}`, tw = text.length * 7, rr = r(d.v), [cx, cy] = d.c;
          const at = (g) => [[cx + rr + g, cy + 4, 'start', [cx + rr + g, cy - 9, cx + rr + g + tw, cy + 5], [cx + rr, cy, cx + rr + g - 2, cy]],
            [cx - rr - g, cy + 4, 'end', [cx - rr - g - tw, cy - 9, cx - rr - g, cy + 5], [cx - rr, cy, cx - rr - g + 2, cy]],
            [cx, cy - rr - g - 2, 'middle', [cx - tw / 2, cy - rr - g - 15, cx + tw / 2, cy - rr - g - 1], [cx, cy - rr, cx, cy - rr - g + 2]],
            [cx, cy + rr + g + 11, 'middle', [cx - tw / 2, cy + rr + g - 2, cx + tw / 2, cy + rr + g + 12], [cx, cy + rr, cx, cy + rr + g - 2]]];
          // beside the circle first; for a county the text names, further out with a leader line if need be
          const isNamed = named.includes(d.k);
          const tries = (isNamed ? avoid : [big]).flatMap((av) => [...at(4), ...(isNamed ? [...at(24), ...at(44), ...at(64), ...at(84)] : [])].map((t) => [...t, av]));
          for (const [x, y, anchor, box, leader, av] of tries) {
            if (box[0] < 2 || box[2] > w - 2 || box[1] < 2 || box[3] > h - 2) continue;
            if (placed.some((p) => hit(p, box)) || av.some((b) => b.d !== d && hit(b.box, box))) continue;
            placed.push(box);
            if (Math.hypot(leader[2] - leader[0], leader[3] - leader[1]) > 4)
              lab.append('line').attr('class', 'syr-bracket').attr('x1', leader[0]).attr('y1', leader[1]).attr('x2', leader[2]).attr('y2', leader[3]);
            lab.append('text').attr('class', 'syr-label').attr('x', x).attr('y', y).attr('text-anchor', anchor).text(text);
            done.add(d.k);
            break;
          }
        });
        circles.classed('is-named', (d) => done.has(d.k));   // the labelled circles outlined in ink
      };
    }

    function drawPrep(svg, w, h) {
      svg.append('rect').attr('class', 'syr-prepbox').attr('x', 0.5).attr('y', 0.5).attr('width', w - 1).attr('height', h - 1);
      const g = svg.append('g');
      return (s) => {
        g.selectAll('*').remove();
        const max = Math.max(16, Math.floor((w - 32) / 7.4));
        const wrap = (t) => t.split(' ').reduce((ls, word) => { const l = ls[ls.length - 1]; if (l && (l + ' ' + word).length <= max) ls[ls.length - 1] = l + ' ' + word; else ls.push(word); return ls; }, []);
        const lines = s.lines.flatMap((l, i) => wrap(l).map((t, k) => ({ t, gap: i > 0 && k === 0 })));
        let yy = h / 2 - (lines.length * 18 + 26) / 2;
        g.append('text').attr('class', 'syr-prep').attr('x', w / 2).attr('y', yy).style('font-weight', 600).text('In preparation');
        yy += 26;
        lines.forEach((l) => { yy += l.gap ? 24 : 18; g.append('text').attr('class', 'syr-prep').attr('x', w / 2).attr('y', yy - 18).text(l.t); });
      };
    }

    // ---------- which step is active ----------
    const stepEls = [...root.querySelectorAll('.step')];
    function pick(animate = true) {
      const narrow = root.clientWidth <= 860;
      const line = window.innerHeight * (narrow ? 0.82 : 0.62);
      let k = 0;
      stepEls.forEach((el, i) => { if (el.firstElementChild.getBoundingClientRect().top < line) k = i; });
      if (k === active) return;
      active = k;
      stepEls.forEach((el, i) => el.classList.toggle('is-active', i === k));
      show(k, animate);
    }
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; pick(); });
    }, { passive: true });
    let lastW = 0, lastH = 0;
    const redraw = () => {
      const w = chart.clientWidth, h = chart.clientHeight;
      if (!w || !h || (w === lastW && h === lastH)) return;
      lastW = w; lastH = h;
      scene = null; update = null;
      if (active >= 0) show(active, false);
      pick(false);
    };
    if ('ResizeObserver' in window) new ResizeObserver(() => requestAnimationFrame(redraw)).observe(chart);
    else window.addEventListener('resize', redraw);
    redraw();
    if (active < 0) pick(false);

    // ---------- method and sources ----------
    const src = (r) => `${esc(r.src)} ${esc(r.i)}${r.upd ? `, updated ${esc(r.upd)}` : ''}${r.fetched ? `, read ${esc(r.fetched.slice(0, 10))}` : ''}`;
    $('#method').innerHTML = [
      'Syrians are followed as a group. The counts of Eurostat, Frontex, Destatis and the Federal Employment Agency are of Syrian citizens: people who have become citizens of another country are no longer counted, and people from Syria without Syrian citizenship (for example Palestinians from Syria or stateless people) are not counted as Syrians. UNHCR counts by country of origin, so chapter 2 counts people from Syria.',
      'Frontex counts detections at the external borders of the EU and of the Schengen associated countries outside official crossing points, as the states report them: detections, not people, and the nationality recorded at detection.',
      'Eurostat counts applicants: each person once per country and month, so one person can be counted in more than one country. Decisions count the persons they cover; they concern applications made earlier and are never set against the same year&rsquo;s applicants. UNHCR&rsquo;s figures are people living in a country at the end of a year. Deaths are counted where the violence happened; UCDP&rsquo;s events are spread evenly over the days they span, so monthly figures are this page&rsquo;s allocation. Events mark dates, never causes.',
      `Sources: ${D.meta.map((r) => (r.url ? `<a href="${esc(r.url)}">${src(r)}</a>` : src(r))).join('; ')}. Events from official records, linked where they are mentioned.`,
      'UCDP data are used under CC BY 4.0, citing: Davies, Pettersson and &Ouml;berg (2026), &ldquo;Organized violence 1989&ndash;2025, and violent political protests&rdquo;, <i>Journal of Peace Research</i> 63(4), <a href="https://doi.org/10.1093/jopres/xjag046">doi:10.1093/jopres/xjag046</a>; Sundberg and Melander (2013), &ldquo;Introducing the UCDP Georeferenced Event Dataset&rdquo;, <i>Journal of Peace Research</i> 50(4), <a href="https://doi.org/10.1177/0022343313484347">doi:10.1177/0022343313484347</a>; Hegre, Croicu, Eck and H&ouml;gbladh (2020), &ldquo;Introducing the UCDP Candidate Events Dataset&rdquo;, <i>Research &amp; Politics</i> 7(3), <a href="https://doi.org/10.1177/2053168020935257">doi:10.1177/2053168020935257</a>.',
      `UNHCR Refugee Population Statistics Database, used under UNHCR&rsquo;s <a href="${UNHCR_TERMS}">Terms of Use for Datasets</a> (CC BY 4.0).`,
      `Destatis: Statistisches Bundesamt (Destatis), GENESIS-Online, tables as named in each graphic and read on the dates above; data licence Germany &ndash; attribution &ndash; version 2.0 (${DL}); own calculation (sums, shares, years of first entry). Destatis rounds the counts of the foreigners&rsquo; register and of protection seekers to 5, so a total this page adds from male and female can differ from Destatis&rsquo; own by up to 5; the migration statistics are not rounded but alter small counts slightly to protect confidentiality, and in them and in the naturalisation statistics the parts can differ from the total by a few.`,
      'Voluntary departures, reviews of protection and deportations are figures the federal government gave the Bundestag, typed in from its answers; each is linked where it is used.',
      ...(hasWork ? ['Jobs, unemployment and basic income support are the Federal Employment Agency&rsquo;s monthly Migrationsmonitor (&copy; Statistik der Bundesagentur f&uuml;r Arbeit); the latest months of jobs are its estimates (it counts them in full after six months), and the rates of those months are provisional; basic income support is published after a waiting period of three months, with gaps in job centres&rsquo; data filled by the agency.'] : []),
      `Maps: GISCO, ${esc(D.region.meta.source || '')}; VG250, ${bkgNote()}.`,
    ].map((t) => `<li>${t}</li>`).join('');
    $('#credit').textContent = `Europe’s Divides · Data: Eurostat, UNHCR, UCDP, Frontex, Destatis${hasWork ? ', Federal Employment Agency' : ''}, the federal government’s answers to the Bundestag · Maps: GISCO (© EuroGeographics), © BKG`;
  }
})();
