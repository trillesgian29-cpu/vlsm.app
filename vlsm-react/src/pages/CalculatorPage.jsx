// pages/CalculatorPage.jsx
import { useState, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { vlsmSchema, flsmSchema } from '../lib/schemas';
import { calcVLSM, calcFLSM } from '../lib/vlsm';
import SubnetTable from '../components/SubnetTable';
import CLISection  from '../components/CLISection';
import { FieldError, CardHeader } from '../components/ui';

export default function CalculatorPage() {
  const [calcMode, setCalcMode] = useState('vlsm');
  const [subnets,  setSubnets]  = useState([]);
  const [result,   setResult]   = useState(null);

  // VLSM form
  const vlsmForm = useForm({
    resolver: zodResolver(vlsmSchema),
    defaultValues: {
      baseNet: '192.168.10.0',
      hosts: [{ value: '100' }, { value: '50' }, { value: '10' }, { value: '2' }],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: vlsmForm.control,
    name: 'hosts',
  });

  // FLSM form
  const flsmForm = useForm({
    resolver: zodResolver(flsmSchema),
    defaultValues: { baseNet: '192.168.1.0', mask: '24', count: '4' },
  });

  const onVLSM = vlsmForm.handleSubmit((data) => {
    try {
      const hostNums = data.hosts.map(h => parseInt(h.value, 10));
      const rows     = calcVLSM(data.baseNet, hostNums);
      const last     = rows[rows.length - 1];
      const nextInt  = (last.networkInt + last.blockSize) >>> 0;
      const nextIp   = [nextInt >>> 24, (nextInt >>> 16) & 255, (nextInt >>> 8) & 255, nextInt & 255].join('.');
      setSubnets(rows);
      setResult({ title: `${data.baseNet} — VLSM (${rows.length} subnets)`, next: nextIp });
    } catch (e) {
      vlsmForm.setError('root', { message: e.message });
    }
  });

  const onFLSM = flsmForm.handleSubmit((data) => {
    try {
      const rows    = calcFLSM(data.baseNet, data.mask, parseInt(data.count, 10));
      const last    = rows[rows.length - 1];
      const nextInt = (last.networkInt + last.blockSize) >>> 0;
      const nextIp  = [nextInt >>> 24, (nextInt >>> 16) & 255, (nextInt >>> 8) & 255, nextInt & 255].join('.');
      setSubnets(rows);
      setResult({ title: `${data.baseNet} — FLSM (${rows.length} subnets)`, next: nextIp });
    } catch (e) {
      flsmForm.setError('root', { message: e.message });
    }
  });

  const reset = () => {
    setSubnets([]); setResult(null);
    vlsmForm.reset({ baseNet: '', hosts: [{ value: '' }] });
    flsmForm.reset({ baseNet: '', mask: '', count: '' });
  };

  return (
    <div className="main">

      {/* ── Input Card ───────────────────────────────── */}
      <div className="card">
        <CardHeader
          icon="⚙"
          iconVariant="blue"
          title="Subnet Calculator"
          subtitle="VLSM — Variable Length | FLSM — Fixed Length"
        />
        <div className="card-body">

          {/* Mode tabs */}
          <div className="mode-tabs">
            {['vlsm', 'flsm'].map(m => (
              <button
                key={m}
                className={`mode-tab ${calcMode === m ? 'active' : ''}`}
                onClick={() => setCalcMode(m)}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          {/* ── VLSM Form ── */}
          {calcMode === 'vlsm' && (
            <form onSubmit={onVLSM} noValidate>
              <div className="field">
                <label className="field-label">Base Network Address</label>
                <input
                  className={`input ${vlsmForm.formState.errors.baseNet ? 'input-error' : ''}`}
                  type="text"
                  placeholder="e.g. 192.168.10.0"
                  {...vlsmForm.register('baseNet')}
                />
                <FieldError error={vlsmForm.formState.errors.baseNet} />
              </div>

              <div className="section-label">Host Requirements</div>

              <div className="hosts-list">
                {fields.map((field, i) => (
                  <div key={field.id} className="host-entry">
                    <span className="host-label">Subnet {i + 1}</span>
                    <input
                      className={`input ${vlsmForm.formState.errors.hosts?.[i]?.value ? 'input-error' : ''}`}
                      type="number"
                      placeholder="Required hosts"
                      min="1"
                      {...vlsmForm.register(`hosts.${i}.value`)}
                    />
                    <FieldError error={vlsmForm.formState.errors.hosts?.[i]?.value} />
                    {fields.length > 1 && (
                      <button type="button" className="btn-icon-rm" onClick={() => remove(i)}>✕</button>
                    )}
                  </div>
                ))}
              </div>

              {vlsmForm.formState.errors.hosts?.root && (
                <p className="field-error">⚠ {vlsmForm.formState.errors.hosts.root.message}</p>
              )}
              {vlsmForm.formState.errors.root && (
                <p className="field-error">⚠ {vlsmForm.formState.errors.root.message}</p>
              )}

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 8 }}
                onClick={() => append({ value: '' })}
              >
                + Add Subnet
              </button>

              <div className="btn-row">
                <button type="submit" className="btn btn-primary" disabled={vlsmForm.formState.isSubmitting}>
                  ▶ Calculate VLSM
                </button>
                <button type="button" className="btn btn-ghost" onClick={reset}>↺ Reset</button>
              </div>
            </form>
          )}

          {/* ── FLSM Form ── */}
          {calcMode === 'flsm' && (
            <form onSubmit={onFLSM} noValidate>
              <div className="form-row">
                <div className="field">
                  <label className="field-label">Network Address</label>
                  <input
                    className={`input ${flsmForm.formState.errors.baseNet ? 'input-error' : ''}`}
                    type="text"
                    placeholder="e.g. 192.168.1.0"
                    {...flsmForm.register('baseNet')}
                  />
                  <FieldError error={flsmForm.formState.errors.baseNet} />
                </div>
                <div className="field">
                  <label className="field-label">Mask / Prefix</label>
                  <input
                    className={`input ${flsmForm.formState.errors.mask ? 'input-error' : ''}`}
                    type="text"
                    placeholder="e.g. 24"
                    style={{ width: 120 }}
                    {...flsmForm.register('mask')}
                  />
                  <FieldError error={flsmForm.formState.errors.mask} />
                </div>
                <div className="field">
                  <label className="field-label">Subnet Count</label>
                  <input
                    className={`input ${flsmForm.formState.errors.count ? 'input-error' : ''}`}
                    type="number"
                    placeholder="e.g. 4"
                    min="2"
                    style={{ width: 110 }}
                    {...flsmForm.register('count')}
                  />
                  <FieldError error={flsmForm.formState.errors.count} />
                </div>
              </div>

              {flsmForm.formState.errors.root && (
                <p className="field-error">⚠ {flsmForm.formState.errors.root.message}</p>
              )}

              <div className="btn-row">
                <button type="submit" className="btn btn-primary">▶ Calculate FLSM</button>
                <button type="button" className="btn btn-ghost" onClick={reset}>↺ Reset</button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ── Result Table ── */}
      {subnets.length > 0 && result && (
        <SubnetTable subnets={subnets} title={result.title} nextAvail={result.next} />
      )}

      {/* ── CLI Generator ── */}
      {subnets.length > 0 && (
        <CLISection subnets={subnets} />
      )}

    </div>
  );
}
