import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'

export default function Auditor() {
  const [decisions, setDecisions] = useState([])
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterRunId, setFilterRunId] = useState('')
  const [filterFacilityId, setFilterFacilityId] = useState('')
  const [expandedIds, setExpandedIds] = useState(new Set())

  useEffect(() => {
    async function load() {
      try {
        const [decSnap, propSnap] = await Promise.all([
          getDocs(collection(db, 'agent_decisions')),
          getDocs(collection(db, 'proposals')),
        ])

        const decList = decSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        decList.sort((a, b) => {
          const ta = a.timestamp?.toDate?.() || new Date(0)
          const tb = b.timestamp?.toDate?.() || new Date(0)
          return tb - ta
        })
        setDecisions(decList)

        setProposals(propSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error('Auditor data load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = decisions.filter((d) => {
    if (
      filterRunId &&
      !(d.run_id || '').toLowerCase().includes(filterRunId.toLowerCase())
    )
      return false
    if (
      filterFacilityId &&
      !(d.facility_id || '').toLowerCase().includes(filterFacilityId.toLowerCase())
    )
      return false
    return true
  })

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const kpis = {
    totalProposals: proposals.length,
    pendingReview: proposals.filter((p) => p.status === 'pending_review').length,
    approved: proposals.filter((p) => p.status === 'approved').length,
    rejected: proposals.filter((p) => p.status === 'rejected').length,
    revisionRequested: proposals.filter(
      (p) => p.status === 'revision_requested',
    ).length,
    totalDecisions: decisions.length,
  }

  if (loading) return <div className="loading">Loading audit data...</div>

  return (
    <div className="page">
      <h1>Auditor Dashboard</h1>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KpiCard label="Total Proposals" value={kpis.totalProposals} />
        <KpiCard
          label="Pending Review"
          value={kpis.pendingReview}
          color="#e65100"
        />
        <KpiCard label="Approved" value={kpis.approved} color="#2e7d32" />
        <KpiCard label="Rejected" value={kpis.rejected} color="#c62828" />
        <KpiCard
          label="Revision Requested"
          value={kpis.revisionRequested}
          color="#f9a825"
        />
        <KpiCard label="Agent Decisions" value={kpis.totalDecisions} />
      </div>

      {/* Filters */}
      <div className="card">
        <h2>Audit Trail</h2>
        <div className="filter-bar">
          <input
            type="text"
            className="input"
            placeholder="Filter by Run ID..."
            value={filterRunId}
            onChange={(e) => setFilterRunId(e.target.value)}
          />
          <input
            type="text"
            className="input"
            placeholder="Filter by Facility ID..."
            value={filterFacilityId}
            onChange={(e) => setFilterFacilityId(e.target.value)}
          />
          <span style={{ fontSize: 13, color: '#888', alignSelf: 'center' }}>
            Showing {filtered.length} of {decisions.length} entries
          </span>
        </div>
      </div>

      {/* Decision Log */}
      {filtered.length === 0 ? (
        <div className="empty-state">No agent decisions found.</div>
      ) : (
        <div className="audit-log">
          {filtered.map((d) => (
            <div key={d.id} className="audit-entry card">
              <div className="audit-header">
                <span className="badge badge-agent">
                  {d.agent_name || 'Unknown Agent'}
                </span>
                <span className="audit-ts">{fmtTs(d.timestamp)}</span>
              </div>

              <div className="audit-meta">
                <span>
                  <strong>Facility:</strong> {d.facility_id || 'N/A'}
                </span>
                <span>
                  <strong>Run ID:</strong> {d.run_id || 'N/A'}
                </span>
                <span>
                  <strong>Confidence:</strong> {d.confidence || 'N/A'}
                </span>
              </div>

              {d.input_summary && (
                <div className="audit-field">
                  <strong>Input:</strong> {d.input_summary}
                </div>
              )}

              {d.rationale && (
                <div className="audit-field">
                  <strong>Rationale:</strong> {d.rationale}
                </div>
              )}

              {d.output_json && (
                <div className="audit-json">
                  <button
                    className="btn btn-sm"
                    onClick={() => toggleExpand(d.id)}
                  >
                    {expandedIds.has(d.id) ? 'Hide' : 'Show'} Output JSON
                  </button>
                  {expandedIds.has(d.id) && (
                    <pre className="json-block">
                      {JSON.stringify(d.output_json, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, color }) {
  return (
    <div className="kpi-card">
      <div className="kpi-value" style={color ? { color } : {}}>
        {value}
      </div>
      <div className="kpi-label">{label}</div>
    </div>
  )
}

function fmtTs(ts) {
  if (!ts) return 'N/A'
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}
