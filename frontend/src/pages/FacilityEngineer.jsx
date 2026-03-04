import { useState, useEffect } from 'react'
import { collection, getDocs, onSnapshot } from 'firebase/firestore'
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

function getTime(p) {
  return p.created_at?.toDate?.() || p.updated_at?.toDate?.() || new Date(0)
}

export default function FacilityEngineer({ user }) {
  const [facilities, setFacilities] = useState([])
  const [proposals, setProposals] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loadingFacilities, setLoadingFacilities] = useState(true)
  const [activeTab, setActiveTab] = useState('run')
  const [engineerNotes, setEngineerNotes] = useState('')

  const [running, setRunning] = useState(false)
  const [events, setEvents] = useState([])
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [runContext, setRunContext] = useState(null)

  const [expandedRevId, setExpandedRevId] = useState(null)
  const [revisionNotes, setRevisionNotes] = useState('')

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

  // Single real-time listener for ALL proposals
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'proposals'),
      (snap) => {
        setProposals(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      },
      (err) => console.error('Proposals snapshot error:', err),
    )
    return unsub
  }, [])

  // ── Derived data ──

  // Latest proposal per facility (for status badges on Run Analysis tab)
  const latestByFacility = {}
  for (const p of proposals) {
    const fid = p.facility_id
    if (!fid) continue
    const existing = latestByFacility[fid]
    if (!existing || getTime(p) > getTime(existing)) {
      latestByFacility[fid] = p
    }
  }

  // Facilities in an active revision cycle: had a revision_requested and the
  // latest proposal is NOT approved/rejected (i.e. still in progress).
  // We pair { latest, revisionSource } so the card can show director feedback
  // from the revision even after a re-run creates a new pending_review proposal.
  const revisionCycles = []
  for (const [fid, latest] of Object.entries(latestByFacility)) {
    if (latest.status === 'approved' || latest.status === 'rejected') continue
    const revSource = proposals
      .filter((p) => p.facility_id === fid && p.status === 'revision_requested')
      .sort((a, b) => getTime(b) - getTime(a))[0]
    if (!revSource) continue
    revisionCycles.push({ facilityId: fid, latest, revisionSource: revSource })
  }
  revisionCycles.sort((a, b) => getTime(b.latest) - getTime(a.latest))

  // History: approved + rejected proposals, sorted newest first
  const history = proposals
    .filter((p) => p.status === 'approved' || p.status === 'rejected')
    .sort((a, b) => getTime(b) - getTime(a))

  const selected = facilities.find((f) => f.id === selectedId)

  const doRun = async (facilityId, feedback, context) => {
    setRunning(true)
    setEvents([])
    setResult(null)
    setError(null)
    setRunContext(context)

    const token = await user.getIdToken()

    await streamRun({
      facilityId,
      token,
      humanFeedback: feedback || null,
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

  const handleRunFromTab = () => {
    if (!selectedId) return
    doRun(selectedId, engineerNotes.trim(), 'tab')
  }

  const handleRunFromRevision = (facilityId, revId) => {
    doRun(facilityId, revisionNotes.trim(), revId)
  }

  const toggleRevisionExpand = (rev) => {
    if (expandedRevId === rev.id) {
      setExpandedRevId(null)
      return
    }
    setExpandedRevId(rev.id)
    setRevisionNotes(rev.feedback_text || '')
    if (runContext !== rev.id) {
      setEvents([])
      setResult(null)
      setError(null)
    }
  }

  const showTabTrace = runContext === 'tab' && events.length > 0
  const showTabResult = runContext === 'tab' && result
  const showTabError = runContext === 'tab' && error

  if (loadingFacilities)
    return <div className="loading">Loading facilities...</div>

  return (
    <div className="page">
      <h1>Facility Engineer Dashboard</h1>

      <div className="tabs">
        <button className={`tab ${activeTab === 'run' ? 'active' : ''}`} onClick={() => setActiveTab('run')}>
          Run Analysis
        </button>
        <button className={`tab ${activeTab === 'revisions' ? 'active' : ''}`} onClick={() => setActiveTab('revisions')}>
          Revisions
          {revisionCycles.length > 0 && <span className="tab-badge">{revisionCycles.length}</span>}
        </button>
        <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          History
          {history.length > 0 && <span className="tab-badge" style={{ background: '#1b3a5c' }}>{history.length}</span>}
        </button>
      </div>

      {/* ═══ Run Analysis Tab ═══ */}
      {activeTab === 'run' && (
        <>
          <div className="card">
            <h2>Select Facility</h2>
            <select
              className="select"
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value)
                if (runContext === 'tab') {
                  setEvents([])
                  setResult(null)
                  setError(null)
                }
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

          {selected && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ margin: 0 }}>{selected.name || selected.id}</h2>
                {latestByFacility[selected.id] && (
                  <StatusBadge status={latestByFacility[selected.id].status} />
                )}
              </div>

              {latestByFacility[selected.id] && (
                <div className="facility-proposal-status">
                  <span>
                    Latest proposal: <strong>{latestByFacility[selected.id].status?.replace(/_/g, ' ')}</strong>
                  </span>
                  {latestByFacility[selected.id].feedback_text && (
                    <div style={{ marginTop: 6 }}>
                      <strong>Feedback:</strong> {latestByFacility[selected.id].feedback_text}
                    </div>
                  )}
                </div>
              )}

              <div className="detail-grid">
                <Detail label="Facility ID" value={selected.facility_id || selected.id} />
                <Detail label="Type" value={selected.facility_type} />
                <Detail label="Climate Zone" value={selected.climate_zone} />
                <Detail label="Power Load" value={selected.facility_power_load_kw != null ? `${selected.facility_power_load_kw} kW` : null} />
                <Detail label="Annual Diesel Runtime" value={selected.annual_diesel_runtime_hours != null ? `${selected.annual_diesel_runtime_hours} hrs` : null} />
                <Detail label="Monthly Demand Charge" value={selected.monthly_demand_charge_usd != null ? `$${Number(selected.monthly_demand_charge_usd).toLocaleString()}` : null} />
                <Detail label="Annual Diesel Fuel Cost" value={selected.annual_diesel_fuel_cost != null ? `$${Number(selected.annual_diesel_fuel_cost).toLocaleString()}` : null} />
                <Detail label="Grid Rate" value={selected.grid_electricity_rate_kwh != null ? `$${selected.grid_electricity_rate_kwh}/kWh` : null} />
                <Detail label="IRA Eligible" value={selected.ira_eligible != null ? (selected.ira_eligible ? 'Yes' : 'No') : null} />
                <Detail label="ESG Mandate" value={selected.esg_mandate} />
                <Detail label="Grid Outages/Month" value={selected.monthly_grid_outage_count} />
                <Detail label="Existing Solar" value={selected.existing_solar_kw != null ? `${selected.existing_solar_kw} kW` : null} />
              </div>

              <div className="form-group" style={{ marginTop: 20 }}>
                <label>Engineer Notes <span style={{ fontWeight: 400, color: '#888' }}>(optional — extra context, assumptions, or feedback from others)</span></label>
                <textarea
                  className="textarea"
                  value={engineerNotes}
                  onChange={(e) => setEngineerNotes(e.target.value)}
                  placeholder='e.g. "We confirmed the facility runs diesel 3100 hrs/yr, not 2800. Prioritize peak shaving over demand charge reduction."'
                  rows={3}
                />
              </div>
              <button className="btn btn-primary" onClick={handleRunFromTab} disabled={running}>
                {running && runContext === 'tab' ? 'Running Analysis...' : 'Run Analysis'}
              </button>
            </div>
          )}

          {showTabError && (
            <div className="card error-card"><strong>Error: </strong>{error}</div>
          )}

          {showTabTrace && (
            <div className="card">
              <h2>Analysis Trace</h2>
              <TracePanel events={events} />
            </div>
          )}

          {showTabResult && result.stage === 'finished' && !result.disqualified && (
            <div className="card success-card">
              <h2>Analysis Complete</h2>
              <p><strong>Run ID:</strong> {result.run_id}</p>
              <p><strong>Status:</strong> {result.status}</p>
              <p style={{ marginTop: 8 }}>A proposal has been created and is now pending review by the Sustainability Director.</p>
            </div>
          )}

          {showTabResult && result.stage === 'finished' && result.disqualified && (
            <div className="card warning-card">
              <h2>Facility Disqualified</h2>
              <p><strong>Run ID:</strong> {result.run_id}</p>
              <p><strong>Status:</strong> {result.status}</p>
              <p style={{ marginTop: 8 }}>This facility did not meet the minimum thresholds for BESS deployment analysis.</p>
            </div>
          )}
        </>
      )}

      {/* ═══ Revisions Tab ═══ */}
      {activeTab === 'revisions' && (
        <>
          {revisionCycles.length === 0 ? (
            <div className="empty-state">No revision requests right now. All caught up!</div>
          ) : (
            <div>
              <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
                These facilities have active revision cycles. They'll move to History once the director approves or rejects.
              </p>
              {revisionCycles.map((cycle) => {
                const r = cycle.revisionSource
                const latest = cycle.latest
                const currentStatus = latest.status
                const isPendingReview = currentStatus === 'pending_review'

                const isExpanded = expandedRevId === r.id
                const isThisRunning = running && runContext === r.id
                const showTrace = runContext === r.id && events.length > 0
                const showResult = runContext === r.id && result
                const showError = runContext === r.id && error && !running

                return (
                  <div key={cycle.facilityId} className="revision-card">
                    <div className="revision-header">
                      <strong>{cycle.facilityId}</strong>
                      <StatusBadge status={currentStatus} />
                    </div>

                    {r.feedback_text && (
                      <div className="revision-feedback">
                        <strong>Director feedback:</strong> {r.feedback_text}
                      </div>
                    )}

                    {isPendingReview && (
                      <div style={{ fontSize: 13, color: '#1565c0', margin: '8px 0' }}>
                        Re-run submitted — waiting for director review.
                      </div>
                    )}

                    <div style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>
                      {r.updated_at?.toDate ? r.updated_at.toDate().toLocaleString() : ''}
                    </div>

                    {!isExpanded && !isPendingReview && (
                      <button
                        className="btn btn-primary"
                        style={{ padding: '8px 16px', fontSize: 13 }}
                        onClick={() => toggleRevisionExpand(r)}
                        disabled={running}
                      >
                        Review &amp; Re-run {cycle.facilityId}
                      </button>
                    )}

                    {isExpanded && !isPendingReview && (
                      <div className="revision-run-area">
                        <div className="form-group">
                          <label>
                            Your Notes
                            <span style={{ fontWeight: 400, color: '#888' }}> — edit or add context before re-running</span>
                          </label>
                          <textarea
                            className="textarea"
                            value={revisionNotes}
                            onChange={(e) => setRevisionNotes(e.target.value)}
                            placeholder="Add your own notes, revised assumptions, or context..."
                            rows={3}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '8px 16px', fontSize: 13 }}
                            onClick={() => handleRunFromRevision(cycle.facilityId, r.id)}
                            disabled={running}
                          >
                            {isThisRunning ? 'Running...' : `Run Analysis for ${cycle.facilityId}`}
                          </button>
                          <button
                            className="btn btn-sm"
                            style={{ padding: '8px 16px', fontSize: 13 }}
                            onClick={() => setExpandedRevId(null)}
                            disabled={isThisRunning}
                          >
                            Cancel
                          </button>
                        </div>

                        {showError && (
                          <div className="error-card" style={{ marginTop: 12, padding: 12, borderRadius: 8 }}>
                            <strong>Error: </strong>{error}
                          </div>
                        )}

                        {showTrace && (
                          <div style={{ marginTop: 12 }}>
                            <strong style={{ fontSize: 14 }}>Analysis Trace</strong>
                            <TracePanel events={events} />
                          </div>
                        )}

                        {showResult && result.stage === 'finished' && !result.disqualified && (
                          <div className="success-card" style={{ marginTop: 12, padding: 12, borderRadius: 8 }}>
                            <strong>Analysis Complete</strong> — Run ID: {result.run_id}
                            <p style={{ margin: '6px 0 0' }}>Proposal created and pending director review.</p>
                          </div>
                        )}

                        {showResult && result.stage === 'finished' && result.disqualified && (
                          <div className="warning-card" style={{ marginTop: 12, padding: 12, borderRadius: 8 }}>
                            <strong>Facility Disqualified</strong> — {result.status}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ═══ History Tab ═══ */}
      {activeTab === 'history' && (
        <>
          {history.length === 0 ? (
            <div className="empty-state">No approved or rejected proposals yet.</div>
          ) : (
            <div>
              {history.map((p) => (
                <div key={p.id} className="card" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong>{p.facility_id}</strong>
                    <StatusBadge status={p.status} />
                  </div>
                  <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
                    <div><strong>Run ID:</strong> <span className="truncate" title={p.run_id || p.id}>{p.run_id || p.id}</span></div>
                    {p.reviewed_at && (
                      <div><strong>Reviewed:</strong> {fmtTs(p.reviewed_at)}</div>
                    )}
                    {p.feedback_text && (
                      <div style={{ marginTop: 6 }}>
                        <strong>Director feedback:</strong> {p.feedback_text}
                      </div>
                    )}
                    {p.urgency_score != null && (
                      <div><strong>Urgency:</strong> {Math.round(p.urgency_score)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TracePanel({ events }) {
  return (
    <div className="trace-panel">
      {events.map((evt, i) => (
        <div key={i} className={`trace-event trace-${evt.stage}`}>
          <span className="trace-stage">{evt.stage}</span>
          {evt.facility_id && <span className="trace-detail">Facility: {evt.facility_id}</span>}
          {evt.status && <span className="trace-detail">Status: {evt.status}</span>}
          {evt.disqualified != null && (
            <span className="trace-detail">Disqualified: {evt.disqualified ? 'Yes' : 'No'}</span>
          )}
          {evt.run_id && <span className="trace-detail">Run ID: {evt.run_id}</span>}
          {evt.error && <span className="trace-detail error-text">{evt.error}</span>}
        </div>
      ))}
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
    <span className="badge" style={{ background: style.background, color: style.color }}>
      {style.label}
    </span>
  )
}

function fmtTs(ts) {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}
