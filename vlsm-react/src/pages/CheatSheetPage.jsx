// pages/CheatSheetPage.jsx
import { CardHeader } from '../components/ui';

const ROWS = [
  { bits: '2²',  hosts: 2,        inc: 4,   cidr: '/30', mask: '255.255.255.252' },
  { bits: '2³',  hosts: 6,        inc: 8,   cidr: '/29', mask: '255.255.255.248' },
  { bits: '2⁴',  hosts: 14,       inc: 16,  cidr: '/28', mask: '255.255.255.240' },
  { bits: '2⁵',  hosts: 30,       inc: 32,  cidr: '/27', mask: '255.255.255.224' },
  { bits: '2⁶',  hosts: 62,       inc: 64,  cidr: '/26', mask: '255.255.255.192' },
  { bits: '2⁷',  hosts: 126,      inc: 128, cidr: '/25', mask: '255.255.255.128' },
  { bits: '2⁸',  hosts: 254,      inc: 1,   cidr: '/24', mask: '255.255.255.0'   },
  { bits: '2⁹',  hosts: 510,      inc: 2,   cidr: '/23', mask: '255.255.254.0'   },
  { bits: '2¹⁰', hosts: 1022,     inc: 4,   cidr: '/22', mask: '255.255.252.0'   },
  { bits: '2¹¹', hosts: 2046,     inc: 8,   cidr: '/21', mask: '255.255.248.0'   },
  { bits: '2¹²', hosts: 4094,     inc: 16,  cidr: '/20', mask: '255.255.240.0'   },
  { bits: '2¹³', hosts: 8190,     inc: 32,  cidr: '/19', mask: '255.255.224.0'   },
  { bits: '2¹⁴', hosts: 16382,    inc: 64,  cidr: '/18', mask: '255.255.192.0'   },
  { bits: '2¹⁵', hosts: 32766,    inc: 128, cidr: '/17', mask: '255.255.128.0'   },
  { bits: '2¹⁶', hosts: 65534,    inc: 1,   cidr: '/16', mask: '255.255.0.0'     },
  { bits: '2¹⁷', hosts: 131070,   inc: 2,   cidr: '/15', mask: '255.254.0.0'     },
  { bits: '2¹⁸', hosts: 262142,   inc: 4,   cidr: '/14', mask: '255.252.0.0'     },
  { bits: '2¹⁹', hosts: 524286,   inc: 8,   cidr: '/13', mask: '255.248.0.0'     },
  { bits: '2²⁰', hosts: 1048574,  inc: 16,  cidr: '/12', mask: '255.240.0.0'     },
  { bits: '2²¹', hosts: 2097150,  inc: 32,  cidr: '/11', mask: '255.224.0.0'     },
  { bits: '2²²', hosts: 4194302,  inc: 64,  cidr: '/10', mask: '255.192.0.0'     },
  { bits: '2²³', hosts: 8388606,  inc: 128, cidr: '/9',  mask: '255.128.0.0'     },
  { bits: '2²⁴', hosts: 16777214, inc: 1,   cidr: '/8',  mask: '255.0.0.0'       },
];

const AD_TABLE = [
  { source: 'Connected',      ad: 0,   color: 'var(--green-h)' },
  { source: 'Static',         ad: 1,   color: 'var(--blue-h)'  },
  { source: 'EIGRP',          ad: 90,  color: 'var(--orange)'  },
  { source: 'OSPF',           ad: 110, color: '#a78bfa'         },
  { source: 'RIP v2',         ad: 120, color: 'var(--green-h)' },
  { source: 'EIGRP External', ad: 170, color: 'var(--orange)'  },
  { source: 'Unknown',        ad: 255, color: 'var(--text3)'   },
];

export default function CheatSheetPage() {
  return (
    <div className="main">

      {/* Subnetting table */}
      <div className="card">
        <CardHeader
          icon="📋"
          iconVariant="orange"
          title="Subnetting Reference"
          subtitle="2ⁿ − 2 usable hosts · CIDR · Mask · Increment"
        />
        <div className="table-wrap">
          <table className="cheat-table">
            <thead>
              <tr>
                <th>Formula</th>
                <th>Usable Hosts</th>
                <th>Increment</th>
                <th>CIDR</th>
                <th>Subnet Mask</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(r => (
                <tr key={r.cidr}>
                  <td style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 11 }}>{r.bits}</td>
                  <td style={{ fontFamily: 'var(--mono)' }}>{r.hosts.toLocaleString()}</td>
                  <td style={{ fontFamily: 'var(--mono)', color: 'var(--orange)', fontWeight: 700 }}>{r.inc}</td>
                  <td style={{ fontFamily: 'var(--mono)', color: 'var(--green-h)', fontWeight: 700 }}>{r.cidr}</td>
                  <td style={{ fontFamily: 'var(--mono)' }}>{r.mask}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AD table */}
      <div className="card">
        <CardHeader
          icon="📡"
          iconVariant="purple"
          title="Administrative Distance"
          subtitle="Lower AD = more trusted = preferred route"
        />
        <div className="table-wrap">
          <table className="cheat-table">
            <thead>
              <tr><th>Route Source</th><th>Admin Distance</th></tr>
            </thead>
            <tbody>
              {AD_TABLE.map(r => (
                <tr key={r.source}>
                  <td style={{ fontWeight: 600, color: r.color }}>{r.source}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: r.color }}>{r.ad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Port rules */}
      <div className="card">
        <CardHeader icon="🔌" iconVariant="blue" title="Serial Port Rules" subtitle="Cisco IOS point-to-point serial convention" />
        <div className="card-body">
          <table className="cheat-table">
            <thead>
              <tr><th>Side</th><th>Role</th><th>Interface</th><th>IP from /30</th><th>Clock Rate</th></tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ color: 'var(--blue-h)', fontWeight: 700 }}>OUT (DCE)</td>
                <td>Link initiator</td>
                <td style={{ fontFamily: 'var(--mono)', color: 'var(--green-h)' }}>Serial0/1/0</td>
                <td style={{ fontFamily: 'var(--mono)' }}>First usable</td>
                <td style={{ fontFamily: 'var(--mono)', color: 'var(--orange)' }}>clock rate 64000</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--purple)', fontWeight: 700 }}>IN (DTE)</td>
                <td>Link receiver</td>
                <td style={{ fontFamily: 'var(--mono)', color: 'var(--green-h)' }}>Serial0/1/1</td>
                <td style={{ fontFamily: 'var(--mono)' }}>Last usable</td>
                <td style={{ color: 'var(--text3)' }}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
