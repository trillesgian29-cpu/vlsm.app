// components/CLISection.jsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cliConfigSchema } from '../lib/schemas';
import {
  generateInterfaces, generateStatic,
  generateRIP, generateEIGRP, generateOSPF
} from '../lib/vlsm';
import { FieldError, CardHeader } from './ui';

const PROTOCOLS = [
  { key: 'static', label: 'Static', icon: '🔗', color: 'blue' },
  { key: 'rip',    label: 'RIP v2', icon: '📡', color: 'green' },
  { key: 'eigrp',  label: 'EIGRP',  icon: '⚡', color: 'orange' },
  { key: 'ospf',   label: 'OSPF',   icon: '🔷', color: 'purple' },
];

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={`copy-btn ${copied ? 'copied' : ''}`}
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? 'COPIED!' : 'COPY'}
    </button>
  );
}

function RouterBlock({ router, stage1, stage2, protocol }) {
  const [tab, setTab] = useState('iface');
  const content = tab === 'iface' ? stage1 : stage2;
  return (
    <div className="router-output">
      <div className="router-output-header">
        <span>⬡</span> {router.name} Configuration
      </div>
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'iface' ? 'active' : ''}`} onClick={() => setTab('iface')}>
          Stage 1: Interfaces
        </button>
        <button className={`tab-btn ${tab === 'route' ? 'active' : ''}`} onClick={() => setTab('route')}>
          Stage 2: {protocol === 'static' ? 'Static Routes' : protocol === 'rip' ? 'RIP v2' : protocol.toUpperCase()}
        </button>
      </div>
      <div className="code-block">
        <CopyBtn text={content} />
        {content}
      </div>
    </div>
  );
}

export default function CLISection({ subnets }) {
  const [topo,          setTopo]          = useState('ring');
  const [protocol,      setProtocol]      = useState('static');
  const [routers,       setRouters]       = useState([]);
  const [serialLinks,   setSerialLinks]   = useState([]);
  const [routerCount,   setRouterCount]   = useState(0);
  const [outputs,       setOutputs]       = useState([]);

  const { register, handleSubmit, watch, formState: { errors } } =
    useForm({
      resolver: zodResolver(cliConfigSchema),
      defaultValues: { topo: 'ring', protocol: 'static', eigrpAs: '100', ospfPid: '1' },
    });

  // Topology helpers
  function buildLinks(rList, t) {
    const n = rList.length;
    if (n < 2) return [];
    const pairs = t === 'ring'
      ? Array.from({ length: n }, (_, i) => [i, (i + 1) % n])
      : Array.from({ length: n - 1 }, (_, i) => [i, i + 1]);
    return pairs.map(([r1, r2]) => {
      const existing = serialLinks.find(l => l.r1 === r1 && l.r2 === r2);
      return { r1, r2, netIndex: existing?.netIndex ?? -1 };
    });
  }

  function addRouter() {
    const n   = routerCount + 1;
    const newR = { id: n, name: `R${n}`, lans: [] };
    const newRouters = [...routers, newR];
    setRouters(newRouters);
    setRouterCount(n);
    setSerialLinks(buildLinks(newRouters, topo));
  }

  function removeRouter() {
    if (!routers.length) return;
    const newRouters = routers.slice(0, -1);
    setRouters(newRouters);
    setSerialLinks(buildLinks(newRouters, topo));
  }

  function changeTopo(t) {
    setTopo(t);
    setSerialLinks(buildLinks(routers, t));
  }

  function toggleLan(ri, si, checked) {
    setRouters(prev => prev.map((r, i) => {
      if (i !== ri) return r;
      const lans = checked
        ? [...new Set([...r.lans, si])]
        : r.lans.filter(x => x !== si);
      return { ...r, lans };
    }));
  }

  function setSerialNet(li, val) {
    setSerialLinks(prev => prev.map((l, i) =>
      i === li ? { ...l, netIndex: parseInt(val, 10) } : l
    ));
  }

  const onGenerate = handleSubmit((formData) => {
    if (!routers.length) return;
    const unassigned = serialLinks.some(l => l.netIndex < 0);
    if (unassigned) return;

    const eigrpAs = parseInt(formData.eigrpAs, 10) || 100;
    const ospfPid = parseInt(formData.ospfPid, 10) || 1;

    const results = routers.map((_, ri) => {
      const s1 = generateInterfaces(ri, routers, subnets, serialLinks);
      let   s2 = '';
      switch (protocol) {
        case 'static': s2 = generateStatic(ri, routers, subnets, serialLinks); break;
        case 'rip':    s2 = generateRIP(ri, routers, subnets, serialLinks); break;
        case 'eigrp':  s2 = generateEIGRP(ri, routers, subnets, serialLinks, eigrpAs); break;
        case 'ospf':   s2 = generateOSPF(ri, routers, subnets, serialLinks, ospfPid); break;
      }
      return { router: routers[ri], stage1: s1, stage2: s2 };
    });
    setOutputs(results);
    setTimeout(() => {
      document.getElementById('cli-output')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  });

  const hasUnassigned = serialLinks.some(l => l.netIndex < 0);

  return (
    <>
      {/* ── Config Card ── */}
      <div className="card">
        <CardHeader icon="🖥" iconVariant="purple" title="Routing Configuration Generator" subtitle="Generates Cisco IOS CLI — paste directly into Packet Tracer" />
        <div className="card-body">

          {/* Topology */}
          <div className="section-label">Topology</div>
          <div className="topo-row">
            {['ring', 'bus'].map(t => (
              <button
                key={t}
                className={`topo-btn ${topo === t ? 'active' : ''}`}
                onClick={() => changeTopo(t)}
              >
                {t === 'ring' ? '🔄 Ring' : '➡ Bus'}&nbsp;
                <span className="topo-hint">{t === 'ring' ? '(N links)' : '(N−1 links)'}</span>
              </button>
            ))}
          </div>

          {/* Protocol */}
          <div className="section-label">Routing Protocol</div>
          <div className="proto-row">
            {PROTOCOLS.map(p => (
              <button
                key={p.key}
                className={`proto-btn pb-${p.color} ${protocol === p.key ? 'active' : ''}`}
                onClick={() => setProtocol(p.key)}
              >
                <span className="proto-icon">{p.icon}</span>
                <span className="proto-label">{p.label}</span>
              </button>
            ))}
          </div>

          {protocol === 'eigrp' && (
            <div className="proto-extra">
              <label className="field-label" style={{ marginRight: 8 }}>EIGRP AS</label>
              <input
                type="number" min="1" max="65535"
                className={`input ${errors.eigrpAs ? 'input-error' : ''}`}
                style={{ width: 100 }}
                {...register('eigrpAs')}
              />
              <FieldError error={errors.eigrpAs} />
            </div>
          )}

          {protocol === 'ospf' && (
            <div className="proto-extra">
              <label className="field-label" style={{ marginRight: 8 }}>OSPF PID</label>
              <input
                type="number" min="1"
                className={`input ${errors.ospfPid ? 'input-error' : ''}`}
                style={{ width: 100 }}
                {...register('ospfPid')}
              />
              <FieldError error={errors.ospfPid} />
            </div>
          )}

          {/* Routers */}
          <div className="section-label" style={{ marginTop: 16 }}>Routers</div>
          <div className="router-controls">
            <button className="btn btn-primary btn-sm" onClick={addRouter}>+ Add Router</button>
            <button className="btn btn-danger-outline btn-sm" onClick={removeRouter} disabled={!routers.length}>
              − Remove
            </button>
            <span className="router-badge">
              {routers.length} Router{routers.length !== 1 ? 's' : ''}
            </span>
          </div>

          {routers.length > 0 && (
            <div className="router-grid">
              {routers.map((r, ri) => (
                <div className="router-card" key={r.id}>
                  <div className="router-card-title"><span>⬡</span> {r.name}</div>
                  <div className="net-check-list">
                    {subnets.map((s, si) => (
                      <label key={si} className="net-check">
                        <input
                          type="checkbox"
                          checked={r.lans.includes(si)}
                          onChange={e => toggleLan(ri, si, e.target.checked)}
                        />
                        <span>
                          <span className="net-id">{s.networkId}{s.cidr}</span>
                          <span className="net-hosts"> · {s.hosts.toLocaleString()} hosts</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Serial Links */}
          <div className="section-label">Serial Links (WAN /30)</div>
          {routers.length < 2
            ? <div className="serial-hint">Add at least 2 routers to generate serial links.</div>
            : (
              <div className="serial-hint">
                {topo === 'ring' ? 'Ring' : 'Bus'}: {routers.length} routers → {serialLinks.length} serial links
              </div>
            )
          }

          {serialLinks.map((link, li) => (
            <div className="serial-entry" key={li}>
              <span className="serial-label">
                {routers[link.r1]?.name} ↔ {routers[link.r2]?.name}
              </span>
              <span className="serial-arrow">→</span>
              <select
                className={`input ${link.netIndex < 0 ? 'input-error' : ''}`}
                value={link.netIndex}
                onChange={e => setSerialNet(li, e.target.value)}
              >
                <option value="-1">-- Select Network --</option>
                {subnets.map((s, si) => (
                  <option key={si} value={si}>
                    Net {s.no}: {s.networkId}{s.cidr}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {/* Generate Button */}
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button
              className="btn btn-primary"
              onClick={onGenerate}
              disabled={!routers.length || hasUnassigned}
            >
              ▶ Generate CLI
            </button>
            <button className="btn btn-ghost" onClick={() => { setRouters([]); setSerialLinks([]); setOutputs([]); setRouterCount(0); }}>
              ↺ Reset
            </button>
          </div>

          {!routers.length && (
            <p className="field-error" style={{ marginTop: 8 }}>⚠ Add at least one router.</p>
          )}
          {routers.length > 0 && hasUnassigned && (
            <p className="field-error" style={{ marginTop: 8 }}>⚠ Assign a network to every serial link.</p>
          )}
        </div>
      </div>

      {/* ── CLI Output ── */}
      {outputs.length > 0 && (
        <div className="card" id="cli-output">
          <CardHeader
            icon="📟"
            iconVariant="green"
            title="CLI Output"
            subtitle="Stage 1: Interfaces · Stage 2: Routing"
            right={
              <button className="btn btn-ghost btn-sm" onClick={() => {
                const all = outputs.map(o => `${'!'+'-'.repeat(60)}\n! ${o.router.name}\n${'!'+'-'.repeat(60)}\n${o.stage1}\n${o.stage2}`).join('\n');
                navigator.clipboard.writeText(all).then(() => alert('All CLI copied!'));
              }}>
                ⎘ Copy All
              </button>
            }
          />
          <div className="card-body">
            {outputs.map((o, i) => (
              <RouterBlock key={i} router={o.router} stage1={o.stage1} stage2={o.stage2} protocol={protocol} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
