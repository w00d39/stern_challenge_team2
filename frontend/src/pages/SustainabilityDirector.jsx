import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { submitDecision } from '../lib/api'

export default function SustainabilityDirector({ user }) {
  const [allProposals, setAllProposals] = useState([])
  const [selectedFacility, setSelectedFacility] = useState(null)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    const q = query(
      collection(db, 'proposals'),
      where('status', '==', 'pending_review'),
    )

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setAllProposals(list)
        setLoading(false)
      },
      (err) => {
        console.error('Proposals snapshot error:', err)
        setLoading(false)
      },
    )

    return unsub
  }, [])

  // One card per facility — only the latest pending proposal matters
  const latestByFacility = {}
  for (const p of allProposals) {
    const fid = p.facility_id || 'unknown'
    const existing = latestByFacility[fid]
    if (!existing) {
      latestByFacility[fid] = { latest: p, totalPending: 1 }
    } else {
      latestByFacility[fid].totalPending += 1
      const pTime = p.created_at?.toDate?.() || new Date(0)
      const eTime = existing.latest.created_at?.toDate?.() || new Date(0)
      if (pTime > eTime) latestByFacility[fid].latest = p
    }
  }

  const queue = Object.values(latestByFacility)
    .sort((a, b) => (b.latest.urgency_score || 0) - (a.latest.urgency_score || 0))

  const selected = queue.find((q) => q.latest.facility_id === selectedFacility)?.latest || null

  const handleDecision = async (status) => {
    if (!selected) return

    if (status === 'revision_requested' && !feedback.trim()) {
      setMessage({
        type: 'warning',
        text: 'Please provide feedback when requesting a revision.',
      })
      return
    }

    setSubmitting(true)
    setMessage(null)

    try {
      const token = await user.getIdToken()
      await submitDecision({
        runId: selected.run_id || selected.id,
        status,
        feedbackText: feedback.trim() || null,
        token,
      })
      setMessage({
        type: 'success',
        text: `Proposal ${status.replace(/_/g, ' ')} successfully.`,
      })
      setFeedback('')
      setSelectedFacility(null)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="loading">Loading proposals...</div>

  return (
    <div className="page">
      <h1>Sustainability Director Dashboard</h1>

      {message && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}

      <div className="split-layout">
        {/* Queue Panel */}
        <div className="panel queue-panel">
          <h2>Pending Review ({queue.length} facilities)</h2>
          {queue.length === 0 ? (
            <div className="empty-state">No proposals pending review.</div>
          ) : (
            <div className="proposal-list">
              {queue.map((item) => {
                const p = item.latest
                const fid = p.facility_id || 'unknown'
                return (
                  <div
                    key={fid}
                    className={`proposal-card ${selectedFacility === fid ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedFacility(fid)
                      setMessage(null)
                      setFeedback('')
                    }}
                  >
                    <div className="proposal-card-header">
                      <strong>{fid}</strong>
                      {p.urgency_score != null && (
                        <span className="badge badge-urgency">
                          Urgency: {Math.round(p.urgency_score).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="proposal-card-meta">
                      <span>Latest run</span>
                      {p.created_at && <span>{fmtTs(p.created_at)}</span>}
                    </div>
                    {item.totalPending > 1 && (
                      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                        {item.totalPending - 1} older run{item.totalPending - 1 > 1 ? 's' : ''} superseded
                      </div>
                    )}
                    {p.proposal_json?.priority_tier && (
                      <span className={`badge badge-tier-${p.proposal_json.priority_tier.toLowerCase()}`}>
                        {p.proposal_json.priority_tier}
                      </span>
                    )}
                    {p.proposal_json?.ira_credit_flag && (
                      <span className="badge badge-ira" style={{ marginLeft: 6 }}>
                        IRA Eligible
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="panel detail-panel">
          {!selected ? (
            <div className="empty-state">Select a facility to review.</div>
          ) : (
            <ProposalDetail
              proposal={selected}
              feedback={feedback}
              setFeedback={setFeedback}
              onDecision={handleDecision}
              submitting={submitting}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ProposalDetail({ proposal, feedback, setFeedback, onDecision, submitting }) {
  const [showRawJson, setShowRawJson] = useState(false)

  const pj = proposal.proposal_json || {}
  const profile = pj.facility_profile || {}
  const energy = pj.energy_load_output || {}
  const battery = pj.battery_sizing_output || {}

  return (
    <div className="proposal-detail">
      <h2>Proposal Review</h2>
      <p className="detail-subtitle">
        Run ID: <span className="truncate" title={proposal.run_id || proposal.id}>{proposal.run_id || proposal.id}</span> &middot; Facility: {proposal.facility_id}
      </p>

      <Section title="Facility Context">
        <Row label="Facility Name" value={profile.name} />
        <Row label="Facility Type" value={profile.facility_type} />
        <Row label="Climate Zone" value={profile.climate_zone} />
        <Row label="IRA Eligible" value={profile.ira_eligible != null ? (profile.ira_eligible ? 'Yes' : 'No') : null} />
        <Row label="ESG Mandate" value={profile.esg_mandate} />
        <Row label="Grid Outages/Month" value={profile.monthly_grid_outage_count} />
        <Row label="Power Load" value={profile.facility_power_load_kw != null ? `${profile.facility_power_load_kw} kW` : null} />
        <Row label="Annual Diesel Runtime" value={profile.annual_diesel_runtime_hours != null ? `${profile.annual_diesel_runtime_hours} hrs` : null} />
        <Row label="Monthly Demand Charge" value={profile.monthly_demand_charge_usd != null ? `$${Number(profile.monthly_demand_charge_usd).toLocaleString()}` : null} />
      </Section>

      <Section title="Energy Load Analysis">
        <Row label="Recommended Product" value={energy.recommended_product} />
        <Row label="Module Count" value={energy.recommended_module_count} />
        <Row label="Total kWh" value={energy.recommended_kwh_total != null ? `${energy.recommended_kwh_total} kWh` : null} />
        <Row label="Diesel Runtime Reduction" value={energy.diesel_runtime_reduction_hrs != null ? `${energy.diesel_runtime_reduction_hrs} hrs/yr` : null} />
        <Row label="Peak Events Addressable" value={energy.peak_events_addressable_pct != null ? `${(energy.peak_events_addressable_pct * 100).toFixed(0)}%` : null} />
        <Row label="Climate Risk" value={energy.climate_risk_flag != null ? (energy.climate_risk_flag ? 'Yes' : 'No') : null} />
        <Row label="Confidence" value={energy.confidence} />
        {energy.rationale && <p className="rationale">{energy.rationale}</p>}
      </Section>

      <Section title="Battery Sizing & Financial Analysis">
        <h4>3-Scenario Cost Comparison</h4>
        <div className="scenario-grid">
          <ScenarioCard title="Continue As-Is" cost={battery.scenario_continue_as_is_annual_cost_usd} />
          <ScenarioCard title="Upgrade Diesel" cost={battery.scenario_upgrade_diesel_annual_cost_usd} />
          <ScenarioCard title="Add Battery (BESS)" cost={battery.scenario_add_battery_annual_cost_usd} highlight />
        </div>
        <Row label="Gross CapEx" value={usd(battery.gross_capex_usd)} />
        <Row label="IRA Credit" value={usd(battery.ira_credit_amount_usd)} />
        <Row label="IRA-Adjusted CapEx" value={usd(battery.ira_adjusted_capex_usd)} />
        <Row label="Payback Years" value={battery.payback_years != null ? `${battery.payback_years} years` : null} />
        <Row label="5-Year NPV" value={usd(battery.npv_5yr_usd)} />
        <Row label="Estimated CO2 Avoided" value={battery.co2_avoided_metric_tons_per_year != null ? `${battery.co2_avoided_metric_tons_per_year} metric tons/yr` : null} />
        <Row label="Demand Charge Savings" value={battery.annual_demand_charge_savings_usd != null ? `$${Number(battery.annual_demand_charge_savings_usd).toLocaleString()}/yr` : null} />
        <Row label="Diesel Cost Eliminated" value={battery.annual_diesel_cost_eliminated_usd != null ? `$${Number(battery.annual_diesel_cost_eliminated_usd).toLocaleString()}/yr` : null} />
        <Row label="Confidence" value={battery.confidence} />
        {battery.rationale && <p className="rationale">{battery.rationale}</p>}
      </Section>

      <Section title="Flags & Confidence">
        <Row label="Priority Tier" value={pj.priority_tier} />
        <Row label="IRA Credit Flag" value={pj.ira_credit_flag != null ? (pj.ira_credit_flag ? 'Yes' : 'No') : null} />
        <Row label="NMC Recommended" value={pj.nmc_recommended_flag != null ? (pj.nmc_recommended_flag ? 'Yes' : 'No') : null} />
        <Row label="Recommendation Status" value={pj.recommendation_status} />
      </Section>

      <div className="json-toggle-section">
        <button className="btn btn-sm" onClick={() => setShowRawJson(!showRawJson)}>
          {showRawJson ? 'Hide' : 'Show'} Full Raw JSON
        </button>
        {showRawJson && (
          <pre className="json-block">{JSON.stringify(pj, null, 2)}</pre>
        )}
      </div>

      <Section title="Review Decision">
        <div className="form-group">
          <label>Feedback / Notes</label>
          <textarea
            className="textarea"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Enter feedback for the facility engineer..."
            rows={3}
          />
        </div>
        <div className="action-buttons">
          <button className="btn btn-success" onClick={() => onDecision('approved')} disabled={submitting}>
            Approve
          </button>
          <button className="btn btn-warning" onClick={() => onDecision('revision_requested')} disabled={submitting}>
            Request Revision
          </button>
          <button className="btn btn-danger" onClick={() => onDecision('rejected')} disabled={submitting}>
            Reject
          </button>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="section">
      <h3>{title}</h3>
      {children}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value ?? 'Not available'}</span>
    </div>
  )
}

function ScenarioCard({ title, cost, highlight }) {
  return (
    <div className={`scenario-card ${highlight ? 'highlight' : ''}`}>
      <div className="scenario-title">{title}</div>
      <div className="scenario-cost">
        {cost != null ? `$${Number(cost).toLocaleString()}/yr` : 'N/A'}
      </div>
    </div>
  )
}

function usd(val) {
  if (val == null) return null
  return `$${Number(val).toLocaleString()}`
}

function fmtTs(ts) {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}
