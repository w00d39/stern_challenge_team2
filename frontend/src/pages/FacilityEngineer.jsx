import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { streamRun } from '../lib/api'

export default function FacilityEngineer({ user }) {
  const [facilities, setFacilities] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loadingFacilities, setLoadingFacilities] = useState(true)
  const [running, setRunning] = useState(false)
  const [events, setEvents] = useState([])
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadFacilities() {
      try {
        const snap = await getDocs(collection(db, 'facility_profiles'))
        const list = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        list.sort((a, b) =>
          (a.name || a.id).localeCompare(b.name || b.id)
        )
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

  const selected = facilities.find((f) => f.id === selectedId)

  const handleRunAnalysis = async () => {
    if (!selectedId) return
    setRunning(true)
    setEvents([])
    setResult(null)
    setError(null)

    const token = await user.getIdToken()

    await streamRun({
      facilityId: selectedId,
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

  if (loadingFacilities) return <div className="loading">Loading facilities...</div>

  return (
    <div className="page">
      <h1>Facility Engineer Dashboard</h1>

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
          <h2>{selected.name || selected.id}</h2>
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
            <Detail label="Grid Outages/Month" value={selected.monthly_grid_outage_count} />
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
            onClick={handleRunAnalysis}
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
                  <span className="trace-detail">Facility: {evt.facility_id}</span>
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
