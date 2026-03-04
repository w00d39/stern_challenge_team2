import { useState, useEffect } from 'react'
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { streamRun } from '../lib/api'

const STATUS_STYLES = {
  pending_review: { background: '#fff3e0', color: '#e65100', label: 'Pending Review' },
  approved: { background: '#e8f5e9', color: '#2e7d32', label: 'Approved' },
  rejected: { background: '#fce4ec', color: '#c62828', label: 'Rejected' },
  revision_requested: { background: '#fff8e1', color: '#f57c00', label: 'Revision Requested' },
  running: { background: '#e3f2fd', color: '#1565c0', label: 'Running' },
  created: { background: '#f5f5f5', color: '#666', label: 'Created' },
  disqualified: { background: '#fce4ec', color: '#c62828', label: 'Disqualified' },
}

export default function FacilityEngineer({ user }) {
  const [facilities, setFacilities] = useState([])
  const [proposals, setProposals] = useState([])
  const [revisions, setRevisions] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loadingFacilities, setLoadingFacilities] = useState(true)
  const [running, setRunning] = useState(false)
  const [events, setEvents] = useState([])
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // Load facility profiles
  useEffect(() => {
    async function loadFacilities() {
      try {
        const snap = await getDocs(collection(db, 'facility_profiles'))
        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        list.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))
        setFacilities(list)
      } catch (err) {
        console.error('Failed to load facilities:', err)
        setError('Failed to load facility profiles from Firestore.')
      } finally {
        setLoadingFacilities(false)
      }
    }
    loadFacilities()
  }, [])

  // Load all proposals (for status indicators)
  useEffect(() => {
    async function loadProposals() {
      try {
        const snap = await getDocs(collection(db, 'proposals'))
        setProposals(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error('Failed to load proposals:', err)
      }
    }
    loadProposals()
  }, [result])

  // Real-time listener for revision requests
  useEffect(() => {
    const q = query(
      collection(db, 'proposals'),
      where('status', '==', 'revision_requested'),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => {
          const ta = a.updated_at?.toDate?.() || new Date(0)
          const tb = b.updated_at?.toDate?.() || new Date(0)
          return tb - ta
        })
        setRevisions(list)
      },
      (err) => console.error('Revisions snapshot error:', err),
    )
    return unsub
  }, [])

  const selected = facilities.find((f) => f.id === selectedId)

  // Build a map: facility_id -> latest proposal status
  const facilityStatus = {}
  for (const p of proposals) {
    const fid = p.facility_id
    if (!fid) continue
    const existing = facilityStatus[fid]
    if (!existing) {
      facilityStatus[fid] = p
    } else {
      const pTime = p.updated_at?.toDate?.() || new Date(0)
      const eTime = existing.updated_at?.toDate?.() || new Date(0)
      if (pTime > eTime) facilityStatus[fid] = p
    }
  }

  const handleRunAnalysis = async (facilityId) => {
    const targetId = facilityId || selectedId
    if (!targetId) return

    if (facilityId && facilityId !== selectedId) {
      setSelectedId(facilityId)
    }

    setRunning(true)
    setEvents([])
    setResult(null)
    setError(null)

    const token = await user.getIdToken()

    await streamRun({
      facilityId: targetId,
      token,
      onEvent: (evt) => {
        setEvents((prev) => [...prev, evt])
        if (evt.stage === 'finished') setResult(evt)
        if (evt.stage === 'error') setError(evt.error || 'Run failed')
      },
      onError: (msg) => {
        setError(msg)
        setRunning(false)
      },
      onDone: () => setRunning(false),
    })
  }

  if (loadingFacilities)
    return <div className="loading">Loading facilities...</div>

  return (
    <div className="page">
      <h1>Facility Engineer Dashboard</h1>

      {/* Revision Requests */}
      {revisions.length > 0 && (
        <div className="card revision-section">
          <h2>Revision Requests ({revisions.length})</h2>
          <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
            The Sustainability Director has requested revisions on these
            proposals. Review the feedback and re-run analysis.
          </p>
          {revisions.map((r) => (
            <div key={r.id} className="revision-card">
              <div className="revision-header">
                <strong>{r.facility_id}</strong>
                <span className="badge" style={{ background: '#fff8e1', color: '#f57c00' }}>
                  Revision #{r.revision_count || 1}
                </span>
              </div>
              {r.feedback_text && (
                <div className="revision-feedback">
                  <strong>Director feedback:</strong> {r.feedback_text}
                </div>
              )}
              <div style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>
                {r.updated_at?.toDate
                  ? r.updated_at.toDate().toLocaleString()
                  : ''}
              </div>
              <button
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: 13 }}
                onClick={() => handleRunAnalysis(r.facility_id)}
                disabled={running}
              >
                Re-run Analysis for {r.facility_id}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Facility Selector */}
      <div className="card">
        <h2>Select Facility</h2>
        <select
          className="select"
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value)
            setEvents([])
            setResult(null)
            setError(null)
          }}
        >
          <option value="">— Choose a facility —</option>
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name || f.id} ({f.id})
            </option>
          ))}
        </select>
      </div>

      {/* Facility Details */}
      {selected && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>{selected.name || selected.id}</h2>
            {facilityStatus[selected.id] && (
              <StatusBadge status={facilityStatus[selected.id].status} />
            )}
          </div>

          {/* Show existing proposal info if any */}
          {facilityStatus[selected.id] && (
            <div className="facility-proposal-status">
              <span>
                Latest proposal: <strong>{facilityStatus[selected.id].status?.replace(/_/g, ' ')}</strong>
              </span>
              {facilityStatus[selected.id].run_id && (
                <span> · Run ID: {facilityStatus[selected.id].run_id}</span>
              )}
              {facilityStatus[selected.id].feedback_text && (
                <div style={{ marginTop: 6 }}>
                  <strong>Feedback:</strong> {facilityStatus[selected.id].feedback_text}
                </div>
              )}
            </div>
          )}

          <div className="detail-grid">
            <Detail label="Facility ID" value={selected.facility_id || selected.id} />
            <Detail label="Type" value={selected.facility_type} />
            <Detail label="Climate Zone" value={selected.climate_zone} />
            <Detail
              label="Power Load"
              value={
                selected.facility_power_load_kw != null
                  ? `${selected.facility_power_load_kw} kW`
                  : null
              }
            />
            <Detail
              label="Annual Diesel Runtime"
              value={
                selected.annual_diesel_runtime_hours != null
                  ? `${selected.annual_diesel_runtime_hours} hrs`
                  : null
              }
            />
            <Detail
              label="Monthly Demand Charge"
              value={
                selected.monthly_demand_charge_usd != null
                  ? `$${Number(selected.monthly_demand_charge_usd).toLocaleString()}`
                  : null
              }
            />
            <Detail
              label="Annual Diesel Fuel Cost"
              value={
                selected.annual_diesel_fuel_cost != null
                  ? `$${Number(selected.annual_diesel_fuel_cost).toLocaleString()}`
                  : null
              }
            />
            <Detail
              label="Grid Rate"
              value={
                selected.grid_electricity_rate_kwh != null
                  ? `$${selected.grid_electricity_rate_kwh}/kWh`
                  : null
              }
            />
            <Detail
              label="IRA Eligible"
              value={
                selected.ira_eligible != null
                  ? selected.ira_eligible
                    ? 'Yes'
                    : 'No'
                  : null
              }
            />
            <Detail label="ESG Mandate" value={selected.esg_mandate} />
            <Detail
              label="Grid Outages/Month"
              value={selected.monthly_grid_outage_count}
            />
            <Detail
              label="Existing Solar"
              value={
                selected.existing_solar_kw != null
                  ? `${selected.existing_solar_kw} kW`
                  : null
              }
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={() => handleRunAnalysis()}
            disabled={running}
            style={{ marginTop: 20 }}
          >
            {running ? 'Running Analysis...' : 'Run Analysis'}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card error-card">
          <strong>Error: </strong>
          {error}
        </div>
      )}

      {/* SSE Trace Panel */}
      {events.length > 0 && (
        <div className="card">
          <h2>Analysis Trace</h2>
          <div className="trace-panel">
            {events.map((evt, i) => (
              <div key={i} className={`trace-event trace-${evt.stage}`}>
                <span className="trace-stage">{evt.stage}</span>
                {evt.facility_id && (
                  <span className="trace-detail">
                    Facility: {evt.facility_id}
                  </span>
                )}
                {evt.status && (
                  <span className="trace-detail">Status: {evt.status}</span>
                )}
                {evt.disqualified != null && (
                  <span className="trace-detail">
                    Disqualified: {evt.disqualified ? 'Yes' : 'No'}
                  </span>
                )}
                {evt.run_id && (
                  <span className="trace-detail">Run ID: {evt.run_id}</span>
                )}
                {evt.error && (
                  <span className="trace-detail error-text">{evt.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success — proposal created */}
      {result && result.stage === 'finished' && !result.disqualified && (
        <div className="card success-card">
          <h2>Analysis Complete</h2>
          <p>
            <strong>Run ID:</strong> {result.run_id}
          </p>
          <p>
            <strong>Status:</strong> {result.status}
          </p>
          <p style={{ marginTop: 8 }}>
            A proposal has been created and is now pending review by the
            Sustainability Director.
          </p>
        </div>
      )}

      {/* Disqualified */}
      {result && result.stage === 'finished' && result.disqualified && (
        <div className="card warning-card">
          <h2>Facility Disqualified</h2>
          <p>
            <strong>Run ID:</strong> {result.run_id}
          </p>
          <p>
            <strong>Status:</strong> {result.status}
          </p>
          <p style={{ marginTop: 8 }}>
            This facility did not meet the minimum thresholds for BESS
            deployment analysis.
          </p>
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }) {
  return (
    <div className="detail-item">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value ?? 'N/A'}</span>
    </div>
  )
}

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || { background: '#f5f5f5', color: '#666', label: status }
  return (
    <span
      className="badge"
      style={{ background: style.background, color: style.color }}
    >
      {style.label}
    </span>
  )
}
