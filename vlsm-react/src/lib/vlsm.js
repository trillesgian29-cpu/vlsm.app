// lib/vlsm.js — All IP math and VLSM/FLSM calculations (pure JS, no deps)

export function ipToInt(ip) {
  return ip.trim().split('.').reduce((acc, o) => ((acc << 8) + parseInt(o, 10)) >>> 0, 0) >>> 0;
}

export function intToIp(n) {
  n = n >>> 0;
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

export function prefixToMask(prefix) {
  if (prefix === 0) return 0;
  const shift = 32 - prefix;
  return shift >= 32 ? 0 : (0xffffffff << shift) >>> 0;
}

export function maskToPrefix(maskInt) {
  let n = maskInt, count = 0;
  while (n & 0x80000000) { count++; n = (n << 1) >>> 0; }
  return count;
}

export function wildcardMask(maskInt) {
  return (~maskInt) >>> 0;
}

export function intToWildcard(maskInt) {
  return intToIp(wildcardMask(maskInt));
}

export function parseMaskInput(val) {
  val = val.trim();
  if (val.startsWith('/')) val = val.slice(1);
  if (/^\d+$/.test(val)) {
    const p = parseInt(val, 10);
    if (p < 0 || p > 32) throw new Error('Prefix must be 0–32');
    return p;
  }
  if (val.includes('.')) {
    const parts = val.split('.');
    if (parts.length !== 4) throw new Error('Invalid subnet mask');
    return maskToPrefix(ipToInt(val));
  }
  throw new Error('Invalid mask or prefix');
}

function getOctetLabel(prefix) {
  if (prefix >= 25) return '4th';
  if (prefix >= 17) return '3rd';
  if (prefix >= 9)  return '2nd';
  return '1st';
}

function getOctetIncrement(prefix) {
  if (prefix >= 25) return Math.pow(2, 32 - prefix);
  if (prefix >= 17) return Math.pow(2, 24 - prefix);
  if (prefix >= 9)  return Math.pow(2, 16 - prefix);
  return Math.pow(2, 8 - prefix);
}

export function buildSubnetRow(no, networkInt, prefix, inputHosts = null) {
  const maskInt   = prefixToMask(prefix);
  const blockSize = prefix === 32 ? 1 : Math.pow(2, 32 - prefix);
  const calcHosts = prefix >= 31 ? (prefix === 31 ? 2 : 1) : blockSize - 2;
  const wc        = wildcardMask(maskInt);
  const bcastInt  = (networkInt | wc) >>> 0;
  const firstInt  = prefix >= 31 ? networkInt : networkInt + 1;
  const lastInt   = prefix >= 31 ? bcastInt   : bcastInt - 1;

  return {
    no,
    hosts:       inputHosts ?? Math.max(0, calcHosts),
    cidr:        `/${prefix}`,
    octet:       getOctetLabel(prefix),
    increment:   getOctetIncrement(prefix),
    blockSize,
    networkId:   intToIp(networkInt),
    mask:        intToIp(maskInt),
    wildcard:    intToIp(wc),
    first:       intToIp(firstInt),
    last:        intToIp(lastInt),
    broadcast:   intToIp(bcastInt),
    networkInt,
    maskInt,
    prefix,
  };
}

// VLSM: sort descending, allocate smallest-sufficient subnet
export function calcVLSM(baseNet, requirements) {
  const indexed = requirements.map((h, i) => ({ h, orig: i }));
  indexed.sort((a, b) => b.h - a.h);

  let cursor = ipToInt(baseNet);
  const results = new Array(requirements.length);

  for (const { h, orig } of indexed) {
    let prefix = 30;
    while (prefix >= 1) {
      if (Math.pow(2, 32 - prefix) - 2 >= h) break;
      prefix--;
    }
    if (prefix < 1) throw new Error(`Cannot fit ${h} hosts in any subnet`);
    results[orig] = buildSubnetRow(orig + 1, cursor, prefix, h);
    cursor = (cursor + Math.pow(2, 32 - prefix)) >>> 0;
  }
  return results;
}

// FLSM: fixed prefix, subdivide evenly
export function calcFLSM(baseNet, maskInput, count) {
  const baseInt  = ipToInt(baseNet);
  const prefix   = parseMaskInput(String(maskInput));
  let   bits     = 0;
  while ((1 << bits) < count) bits++;
  const newPrefix = prefix + bits;
  if (newPrefix > 30) throw new Error(`Not enough space for ${count} subnets`);
  const inc = Math.pow(2, 32 - newPrefix);
  return Array.from({ length: count }, (_, i) =>
    buildSubnetRow(i + 1, (baseInt + i * inc) >>> 0, newPrefix)
  );
}

// Get classful major network for RIP
export function getMajorNetwork(ip) {
  const parts = ip.split('.').map(Number);
  const a = parts[0], b = parts[1], c = parts[2];
  if (a >= 1   && a <= 126) return `${a}.0.0.0`;
  if (a >= 128 && a <= 191) return `${a}.${b}.0.0`;
  if (a >= 192 && a <= 223) return `${a}.${b}.${c}.0`;
  return null;
}

// ── Routing CLI Generators ──────────────────────────────────

function buildAdjGraph(routers, serialLinks) {
  const graph = routers.map(() => []);
  serialLinks.forEach((link, li) => {
    if (link.r1 >= 0 && link.r2 >= 0) {
      graph[link.r1].push({ neighbor: link.r2, linkIdx: li });
      graph[link.r2].push({ neighbor: link.r1, linkIdx: li });
    }
  });
  return graph;
}

function firstHopLink(graph, src, dst, routerCount) {
  if (src === dst) return null;
  const visited = new Array(routerCount).fill(false);
  const queue   = [[src, null]];
  visited[src]  = true;
  while (queue.length) {
    const [cur, fhl] = queue.shift();
    for (const { neighbor, linkIdx } of graph[cur]) {
      if (visited[neighbor]) continue;
      visited[neighbor] = true;
      const resolved = fhl !== null ? fhl : linkIdx;
      if (neighbor === dst) return resolved;
      queue.push([neighbor, resolved]);
    }
  }
  return null;
}

export function generateInterfaces(ri, routers, subnets, serialLinks) {
  const router = routers[ri];
  let c = '';
  c += `enable\nconfigure terminal\nhostname ${router.name}\n!\n`;

  (router.lans || []).forEach((si, idx) => {
    if (idx > 1) return;
    const s = subnets[si];
    c += `interface FastEthernet0/${idx}\n`;
    c += ` ip address ${s.first} ${s.mask}\n`;
    c += ` no shutdown\n!\n`;
  });

  let portIdx = 0;
  serialLinks.forEach(link => {
    if (link.r1 !== ri && link.r2 !== ri) return;
    if (link.netIndex < 0) return;
    const s     = subnets[link.netIndex];
    const iface = `Serial0/1/${portIdx++}`;
    const isDCE = link.r1 === ri;
    const myIp  = isDCE ? s.first : s.last;
    c += `interface ${iface}\n`;
    c += ` ip address ${myIp} ${s.mask}\n`;
    if (isDCE) c += ` clock rate 64000\n`;
    c += ` no shutdown\n!\n`;
  });

  c += `end\n`;
  return c;
}

export function generateStatic(ri, routers, subnets, serialLinks) {
  const router  = routers[ri];
  const graph   = buildAdjGraph(routers, serialLinks);

  const myNets = new Set([
    ...(router.lans || []),
    ...serialLinks
      .filter(l => (l.r1 === ri || l.r2 === ri) && l.netIndex >= 0)
      .map(l => l.netIndex),
  ]);

  let c = `enable\nconfigure terminal\n!\n! Static routing for ${router.name}\n!\n`;

  subnets.forEach((s, si) => {
    if (myNets.has(si)) return;

    let owner = -1;
    for (let r = 0; r < routers.length; r++) {
      if (r === ri) continue;
      if ((routers[r].lans || []).includes(si)) { owner = r; break; }
      if (serialLinks.some(l => (l.r1 === r || l.r2 === r) && l.netIndex === si)) { owner = r; break; }
    }
    if (owner < 0) return;

    const li = firstHopLink(graph, ri, owner, routers.length);
    if (li === null) return;

    const link = serialLinks[li];
    const net  = subnets[link.netIndex];
    if (!net) return;
    const gateway = link.r1 === ri ? net.last : net.first;
    c += `ip route ${s.networkId} ${s.mask} ${gateway}\n`;
  });

  c += `end\n`;
  return c;
}

export function generateRIP(ri, routers, subnets, serialLinks) {
  const router   = routers[ri];
  const netIdxs  = new Set([
    ...(router.lans || []),
    ...serialLinks
      .filter(l => (l.r1 === ri || l.r2 === ri) && l.netIndex >= 0)
      .map(l => l.netIndex),
  ]);

  const majorNets = new Set();
  for (const si of netIdxs) {
    const mn = getMajorNetwork(subnets[si].networkId);
    if (mn) majorNets.add(mn);
  }

  let c = `enable\nconfigure terminal\n!\nrouter rip\n version 2\n no auto-summary\n`;
  for (const mn of [...majorNets].sort()) c += ` network ${mn}\n`;
  c += `!\nend\n`;
  return c;
}

export function generateEIGRP(ri, routers, subnets, serialLinks, asNum = 100) {
  const router  = routers[ri];
  const seen    = new Set();
  const netObjs = [];

  (router.lans || []).forEach(si => {
    if (!seen.has(si)) { seen.add(si); netObjs.push(subnets[si]); }
  });
  serialLinks.forEach(l => {
    if (l.r1 !== ri && l.r2 !== ri) return;
    if (l.netIndex >= 0 && !seen.has(l.netIndex)) {
      seen.add(l.netIndex);
      netObjs.push(subnets[l.netIndex]);
    }
  });

  let c = `enable\nconfigure terminal\n!\n! EIGRP AS ${asNum} — must match on ALL routers\nrouter eigrp ${asNum}\nno auto-summary\n`;
  netObjs.forEach(s => { c += `network ${s.networkId} ${s.wildcard}\n`; });
  c += `!\nend\n`;
  return c;
}

export function generateOSPF(ri, routers, subnets, serialLinks, pid = 1) {
  const router  = routers[ri];
  const seen    = new Set();
  const netObjs = [];

  (router.lans || []).forEach(si => {
    if (!seen.has(si)) { seen.add(si); netObjs.push(subnets[si]); }
  });
  serialLinks.forEach(l => {
    if (l.r1 !== ri && l.r2 !== ri) return;
    if (l.netIndex >= 0 && !seen.has(l.netIndex)) {
      seen.add(l.netIndex);
      netObjs.push(subnets[l.netIndex]);
    }
  });

  let c = `enable\nconfigure terminal\n!\n! OSPF Process ID ${pid} — locally significant\nrouter ospf ${pid}\n`;
  netObjs.forEach(s => { c += `network ${s.networkId} ${s.wildcard} area 0\n`; });
  c += `!\nend\n`;
  return c;
}
