// components/SubnetTable.jsx
import { CardHeader } from './ui';

export default function SubnetTable({ subnets, title, nextAvail }) {
  const exportCSV = () => {
    const headers = ['#','Hosts','CIDR','Octet','Increment','Network ID','Mask','1st Usable','Last Usable','Broadcast'];
    const rows    = subnets.map(s =>
      [s.no, s.hosts, s.cidr, s.octet, s.increment, s.networkId, s.mask, s.first, s.last, s.broadcast]
    );
    const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'vlsm_table.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card">
      <div className="table-info-row">
        <span className="table-title">{title}</span>
        <span className="next-label">Next Available:</span>
        <span className="next-addr">{nextAvail}</span>
      </div>

      <div className="table-wrap">
        <table className="subnet-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Hosts Req.</th>
              <th>CIDR</th>
              <th>Octet</th>
              <th>Increment</th>
              <th>Network ID</th>
              <th>Subnet Mask</th>
              <th>1st Usable</th>
              <th>Last Usable</th>
              <th>Broadcast</th>
            </tr>
          </thead>
          <tbody>
            {subnets.map(s => (
              <tr key={s.no}>
                <td className="col-no">{s.no}</td>
                <td>{s.hosts.toLocaleString()}</td>
                <td className="col-cidr">{s.cidr}</td>
                <td className="col-muted">{s.octet}</td>
                <td className="col-orange mono">{s.increment}</td>
                <td className="col-net mono">{s.networkId}</td>
                <td className="mono">{s.mask}</td>
                <td className="mono">{s.first}</td>
                <td className="mono">{s.last}</td>
                <td className="mono col-muted">{s.broadcast}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-actions">
        <button className="btn btn-ghost btn-sm" onClick={exportCSV}>⬇ Export CSV</button>
      </div>
    </div>
  );
}
