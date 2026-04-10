/* ============================================================
   NetCalc Pro — app.js
   Calculator + CLI Generator Frontend Logic
   ============================================================ */

'use strict';

// ── State ──────────────────────────────────────────────────
let mode        = 'vlsm';
let topo        = 'ring';
let proto       = 'static';
let subnets     = [];
let routers     = [];
let serialLinks = [];
let routerCount = 0;
let vlsmCount   = 0;

// ── Mode ───────────────────────────────────────────────────
function setMode(m) {
  mode = m;
  document.querySelectorAll('.mode-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === m)
  );
  document.getElementById('vlsmInputs').classList.toggle('hidden', m !== 'vlsm');
  document.getElementById('flsmInputs').classList.toggle('hidden', m !== 'flsm');
  document.getElementById('calcError').textContent = '';
  if (m === 'vlsm' && document.getElementById('vlsmList').children.length === 0) {
    addVlsmEntry(); addVlsmEntry();
  }
}

// ── VLSM Entries ───────────────────────────────────────────
function addVlsmEntry() {
  vlsmCount++;
  const id  = 've_' + vlsmCount;
  const div = document.createElement('div');
  div.className = 'vlsm-entry';
  div.id = id;
  div.innerHTML = `
    <span class="vlsm-label">Subnet ${vlsmCount}</span>
    <input type="number" placeholder="Required Hosts" min="1" />
    <button class="btn-icon-danger" onclick="removeVlsmEntry('${id}')">✕</button>
  `;
  document.getElementById('vlsmList').appendChild(div);
}

function removeVlsmEntry(id) {
  document.getElementById(id)?.remove();
  renumberVlsm();
}

function renumberVlsm() {
  document.querySelectorAll('.vlsm-entry .vlsm-label').forEach((el, i) => {
    el.textContent = 'Subnet ' + (i + 1);
  });
}

// ── Calculate ──────────────────────────────────────────────
async function calculate() {
  const errEl = document.getElementById('calcError');
  errEl.textContent = '';

  let payload;
  if (mode === 'vlsm') {
    const net = document.getElementById('vlsmNet').value.trim();
    if (!net) { errEl.textContent = '⚠ Enter a base network address.'; return; }
    const entries = document.querySelectorAll('#vlsmList .vlsm-entry');
    if (!entries.length) { errEl.textContent = '⚠ Add at least one subnet.'; return; }
    const hosts = [];
    let valid = true;
    entries.forEach((e, i) => {
      const h = parseInt(e.querySelector('input').value);
      if (isNaN(h) || h < 1) { errEl.textContent = `⚠ Subnet ${i+1}: enter a valid host count.`; valid = false; }
      else hosts.push(h);
    });
    if (!valid) return;
    payload = { mode: 'vlsm', base_net: net, hosts };
  } else {
    const net   = document.getElementById('flsmNet').value.trim();
    const mask  = document.getElementById('flsmMask').value.trim();
    const count = parseInt(document.getElementById('flsmCount').value);
    if (!net || !mask || isNaN(count)) { errEl.textContent = '⚠ Fill all FLSM fields.'; return; }
    payload = { mode: 'flsm', base_net: net, mask, count };
  }

  try {
    const res  = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.error) { errEl.textContent = '⚠ ' + data.error; return; }

    subnets = data.subnets;
    renderTable(data.title, data.next_available);
    document.getElementById('resultCard').classList.remove('hidden');
    document.getElementById('cliCard').classList.remove('hidden');
    refreshRouterGrid();
    refreshSerialSection();
  } catch (e) {
    errEl.textContent = '⚠ Network error: ' + e.message;
  }
}

// ── Render Table ───────────────────────────────────────────
function renderTable(title, nextAvail) {
  document.getElementById('tableTitle').textContent  = title;
  document.getElementById('nextAvail').textContent   = nextAvail;

  const tbody = document.getElementById('subnetTbody');
  tbody.innerHTML = '';
  subnets.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-no">${s.no}</td>
      <td>${Number(s.hosts).toLocaleString()}</td>
      <td class="col-cidr">${s.cidr}</td>
      <td style="color:var(--text3)">${s.octet}</td>
      <td style="color:var(--orange);font-family:var(--mono)">${s.increment}</td>
      <td class="col-net">${s.network_id}</td>
      <td style="font-family:var(--mono)">${s.mask}</td>
      <td style="font-family:var(--mono)">${s.first}</td>
      <td style="font-family:var(--mono)">${s.last}</td>
      <td style="font-family:var(--mono);color:var(--text3)">${s.broadcast}</td>`;
    tbody.appendChild(tr);
  });
}

// ── Reset ──────────────────────────────────────────────────
function resetCalc() {
  subnets = [];
  document.getElementById('calcError').textContent = '';
  ['vlsmNet','flsmNet','flsmMask','flsmCount'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('vlsmList').innerHTML = '';
  vlsmCount = 0;
  document.getElementById('resultCard').classList.add('hidden');
  document.getElementById('cliCard').classList.add('hidden');
  document.getElementById('cliOutput').classList.add('hidden');
}

// ── Topo & Proto ───────────────────────────────────────────
function setTopo(t) {
  topo = t;
  document.getElementById('topoRing').classList.toggle('active', t === 'ring');
  document.getElementById('topoBus').classList.toggle('active',  t === 'bus');
  refreshSerialSection();
}

function setProto(p) {
  proto = p;
  document.querySelectorAll('[data-proto]').forEach(b =>
    b.classList.toggle('active', b.dataset.proto === p)
  );
  document.getElementById('eigrpAsField').classList.toggle('hidden', p !== 'eigrp');
  document.getElementById('ospfPidField').classList.toggle('hidden', p !== 'ospf');
}

// ── Routers ────────────────────────────────────────────────
function addRouter() {
  routerCount++;
  routers.push({ id: routerCount, name: 'R' + routerCount, lans: [] });
  refreshRouterGrid();
  refreshSerialSection();
  updateRouterBadge();
}

function removeLastRouter() {
  if (!routers.length) return;
  routers.pop();
  refreshRouterGrid();
  refreshSerialSection();
  updateRouterBadge();
}

function updateRouterBadge() {
  const b = document.getElementById('routerBadge');
  if (b) b.textContent = routers.length + ' Router' + (routers.length !== 1 ? 's' : '');
}

function refreshRouterGrid() {
  const grid = document.getElementById('routerGrid');
  if (!grid) return;
  grid.innerHTML = '';
  routers.forEach((r, ri) => {
    const div = document.createElement('div');
    div.className = 'router-card';
    const checks = subnets.map((s, si) =>
      `<label class="net-check">
        <input type="checkbox" ${r.lans.includes(si) ? 'checked' : ''}
               onchange="toggleLan(${ri},${si},this.checked)">
        <span>
          <span class="net-id">${s.network_id}${s.cidr}</span>
          <span class="net-hosts"> · ${Number(s.hosts).toLocaleString()} hosts</span>
        </span>
      </label>`
    ).join('');
    div.innerHTML = `
      <div class="router-card-title"><span>⬡</span> ${r.name}</div>
      <div class="net-check-list">${checks || '<span style="font-size:11px;color:var(--text3)">No subnets</span>'}</div>`;
    grid.appendChild(div);
  });
}

function toggleLan(ri, si, checked) {
  if (checked) { if (!routers[ri].lans.includes(si)) routers[ri].lans.push(si); }
  else routers[ri].lans = routers[ri].lans.filter(x => x !== si);
}

// ── Serial Links ────────────────────────────────────────────
function refreshSerialSection() {
  const hint = document.getElementById('serialHint');
  const list = document.getElementById('serialList');
  if (!hint || !list) return;
  list.innerHTML = '';

  if (routers.length < 2) {
    hint.textContent = (topo === 'ring' ? 'Ring' : 'Bus') + ' topology: add at least 2 routers.';
    serialLinks = [];
    return;
  }

  const prev = {};
  serialLinks.forEach(l => { prev[l.r1 + '_' + l.r2] = l.net_index; });
  serialLinks = [];

  const n = routers.length;
  const pairs = topo === 'ring'
    ? Array.from({length: n}, (_, i) => [i, (i + 1) % n])
    : Array.from({length: n - 1}, (_, i) => [i, i + 1]);

  hint.textContent = `${topo === 'ring' ? 'Ring' : 'Bus'}: ${n} routers → ${pairs.length} serial links`;

  pairs.forEach(([r1, r2], li) => {
    serialLinks.push({ r1, r2, net_index: prev[r1 + '_' + r2] ?? -1 });
    const opts = subnets.map((s, si) =>
      `<option value="${si}" ${prev[r1+'_'+r2] === si ? 'selected':''}>
        Net ${s.no}: ${s.network_id}${s.cidr}
      </option>`
    ).join('');
    const div = document.createElement('div');
    div.className = 'serial-entry';
    div.innerHTML = `
      <span class="serial-label">${routers[r1].name} ↔ ${routers[r2].name}</span>
      <span class="serial-arrow">→</span>
      <select onchange="setSerialNet(${li}, this.value)">
        <option value="-1">-- Select Network --</option>
        ${opts}
      </select>`;
    list.appendChild(div);
  });
}

function setSerialNet(li, val) {
  serialLinks[li].net_index = parseInt(val);
}

// ── Generate CLI ────────────────────────────────────────────
async function generateCLI() {
  const errEl = document.getElementById('cliError');
  errEl.textContent = '';

  if (!routers.length) { errEl.textContent = '⚠ Add at least one router.'; return; }
  for (const l of serialLinks) {
    if (l.net_index < 0) { errEl.textContent = '⚠ Assign a network to every serial link.'; return; }
  }

  const payload = {
    subnets,
    routers,
    serial_links: serialLinks,
    protocol:  proto,
    topo,
    eigrp_as:  parseInt(document.getElementById('eigrpAs')?.value) || 100,
    ospf_pid:  parseInt(document.getElementById('ospfPid')?.value) || 1,
  };

  try {
    const res  = await fetch('/api/generate_cli', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.error) { errEl.textContent = '⚠ ' + data.error; return; }

    renderCLI(data.routers);
    document.getElementById('cliOutput').classList.remove('hidden');
    document.getElementById('cliOutput').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    errEl.textContent = '⚠ ' + e.message;
  }
}

// ── Render CLI Output ───────────────────────────────────────
function renderCLI(routerOutputs) {
  const body = document.getElementById('cliOutputBody');
  body.innerHTML = '';

  routerOutputs.forEach((r, ri) => {
    const block = document.createElement('div');
    block.className = 'router-output';
    block.innerHTML = `
      <div class="router-output-header">
        <span>⬡</span> ${escHtml(r.name)} Configuration
      </div>
      <div class="tab-bar">
        <button class="tab-btn active" onclick="switchTab(this,'tab-iface-${ri}')">Stage 1: Interfaces</button>
        <button class="tab-btn" onclick="switchTab(this,'tab-route-${ri}')">Stage 2: Routing</button>
      </div>
      <div id="tab-iface-${ri}" class="tab-content active">
        <div class="code-block" id="code-iface-${ri}">
          <button class="copy-btn" onclick="copyCode('code-iface-${ri}',this)">COPY</button>${escHtml(r.interfaces)}
        </div>
      </div>
      <div id="tab-route-${ri}" class="tab-content">
        <div class="code-block" id="code-route-${ri}">
          <button class="copy-btn" onclick="copyCode('code-route-${ri}',this)">COPY</button>${escHtml(r.routing)}
        </div>
      </div>`;
    body.appendChild(block);
  });
}

// ── Reset CLI ───────────────────────────────────────────────
function resetCLI() {
  routers = []; serialLinks = []; routerCount = 0;
  proto = 'static'; topo = 'ring';
  document.querySelectorAll('[data-proto]').forEach(b =>
    b.classList.toggle('active', b.dataset.proto === 'static')
  );
  document.getElementById('topoRing').classList.add('active');
  document.getElementById('topoBus').classList.remove('active');
  ['eigrpAsField','ospfPidField'].forEach(id =>
    document.getElementById(id)?.classList.add('hidden')
  );
  document.getElementById('cliOutput').classList.add('hidden');
  updateRouterBadge();
  refreshRouterGrid();
  refreshSerialSection();
}

// ── Utilities ───────────────────────────────────────────────
function switchTab(btn, tabId) {
  const parent = btn.closest('.router-output');
  parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(tabId)?.classList.add('active');
}

function copyCode(id, btn) {
  const el   = document.getElementById(id);
  const text = el.innerText.replace(/^COPY\n?|^COPIED!\n?/, '');
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'COPIED!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'COPY'; btn.classList.remove('copied'); }, 2000);
  });
}

function copyAllCLI() {
  const all = Array.from(document.querySelectorAll('.code-block'))
    .map(b => b.innerText.replace(/^COPY\n?|^COPIED!\n?/, ''))
    .join('\n' + '-'.repeat(60) + '\n');
  navigator.clipboard.writeText(all).then(() => alert('All CLI copied!'));
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Load from history (dashboard) ───────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  setMode('vlsm');
  setProto('static');

  const saved = localStorage.getItem('vlsm_load');
  if (saved) {
    localStorage.removeItem('vlsm_load');
    try {
      const data = JSON.parse(saved);
      subnets = data.subnets || [];
      if (subnets.length) {
        renderTable(data.title || 'Loaded', '—');
        document.getElementById('resultCard').classList.remove('hidden');
        document.getElementById('cliCard').classList.remove('hidden');
        refreshRouterGrid();
        refreshSerialSection();
      }
    } catch(e) {}
  }
});
