import { useEffect, useState, useCallback } from "react";
import styles from "./App.module.css";

// HONEST STATUS (see README): this is a first-pass internal dashboard.
// It reads/writes the waynetrade-backend API directly and does NOT poll
// live MetaApi equity/position data — P&L shown is only what's in our own
// DB (orders + risk decisions), not live account balances.

function loadConnection() {
  try {
    const raw = localStorage.getItem("waynetrade_connection");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveConnection(conn) {
  localStorage.setItem("waynetrade_connection", JSON.stringify(conn));
}

async function apiFetch(baseUrl, apiKey, path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
      ...(options.headers || {}),
    },
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // no body
  }
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

function StatusPill({ status }) {
  const map = {
    ACTIVE: { label: "Active", color: "var(--green)" },
    PAUSED: { label: "Paused", color: "var(--amber)" },
    REMOVED: { label: "Removed", color: "var(--red)" },
  };
  const s = map[status] || { label: status, color: "var(--grey)" };
  return (
    <span className={styles.pill} style={{ borderColor: s.color, color: s.color }}>
      {s.label}
    </span>
  );
}

function OrderStatusPill({ status }) {
  const map = {
    PENDING: "var(--grey)",
    SENT: "var(--green)",
    FILLED: "var(--green)",
    REJECTED: "var(--red)",
    CANCELLED: "var(--grey)",
    ERROR: "var(--red)",
  };
  const color = map[status] || "var(--grey)";
  return (
    <span className={styles.pillSmall} style={{ borderColor: color, color }}>
      {status}
    </span>
  );
}

function CreateGroupScreen({ onCreated, onBack }) {
  const [baseUrl, setBaseUrl] = useState("http://localhost:4000");
  const [apiKey, setApiKey] = useState("");
  const [groupName, setGroupName] = useState("");
  const [adminUserId, setAdminUserId] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!baseUrl || !apiKey || !groupName || !adminUserId) {
      setError("All fields are needed.");
      return;
    }
    setCreating(true);
    try {
      const cleanBaseUrl = baseUrl.replace(/\/$/, "");
      const group = await apiFetch(cleanBaseUrl, apiKey, "/onboarding/group", {
        method: "POST",
        body: JSON.stringify({ name: groupName, adminUserId }),
      });
      const conn = { baseUrl: cleanBaseUrl, apiKey, groupId: group.id };
      saveConnection(conn);
      onCreated(conn);
    } catch (err) {
      setError(err.message || "Could not create the group.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={styles.centerScreen}>
      <div className={styles.card} style={{ maxWidth: 440 }}>
        <p className={styles.eyebrow}>WayneTrade</p>
        <h1 className={styles.h1}>Create a new group</h1>
        <p className={styles.subtle}>
          This creates the group's row in the database via your backend's
          onboarding route — no direct database access needed.
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            Backend URL
            <input
              className={styles.input}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://waynetrade-backend.up.railway.app"
            />
          </label>
          <label className={styles.label}>
            Admin API key
            <input
              className={styles.input}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="ADMIN_API_KEY from the backend .env"
            />
          </label>
          <label className={styles.label}>
            Group name
            <input
              className={styles.input}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Ludhiana Forex Circle"
            />
          </label>
          <label className={styles.label}>
            Your user ID (admin of this group)
            <input
              className={styles.input}
              value={adminUserId}
              onChange={(e) => setAdminUserId(e.target.value)}
              placeholder="any identifier you'll recognize, e.g. your name/email"
            />
          </label>
          {error && <p className={styles.errorText}>{error}</p>}
          <button className={styles.buttonPrimary} type="submit" disabled={creating}>
            {creating ? "Creating…" : "Create group"}
          </button>
          <button type="button" className={styles.buttonGhost} onClick={onBack}>
            Back
          </button>
        </form>
      </div>
    </div>
  );
}

function ConnectScreen({ onConnect }) {
  const [mode, setMode] = useState("connect"); // "connect" | "create"
  const [baseUrl, setBaseUrl] = useState("http://localhost:4000");
  const [apiKey, setApiKey] = useState("");
  const [groupId, setGroupId] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!baseUrl || !apiKey || !groupId) {
      setError("All three fields are needed.");
      return;
    }
    setChecking(true);
    try {
      await apiFetch(baseUrl.replace(/\/$/, ""), apiKey, `/dashboard/group/${groupId}`);
      const conn = { baseUrl: baseUrl.replace(/\/$/, ""), apiKey, groupId };
      saveConnection(conn);
      onConnect(conn);
    } catch (err) {
      setError(err.message || "Could not reach that group with those credentials.");
    } finally {
      setChecking(false);
    }
  }

  if (mode === "create") {
    return <CreateGroupScreen onCreated={onConnect} onBack={() => setMode("connect")} />;
  }

  return (
    <div className={styles.centerScreen}>
      <div className={styles.card} style={{ maxWidth: 440 }}>
        <p className={styles.eyebrow}>WayneTrade</p>
        <h1 className={styles.h1}>Connect to your group</h1>
        <p className={styles.subtle}>
          This dashboard talks directly to your waynetrade-backend deployment.
          Nothing is stored except this connection info, in your browser only.
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            Backend URL
            <input
              className={styles.input}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://waynetrade-backend.up.railway.app"
            />
          </label>
          <label className={styles.label}>
            Admin API key
            <input
              className={styles.input}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="ADMIN_API_KEY from the backend .env"
            />
          </label>
          <label className={styles.label}>
            Group ID
            <input
              className={styles.input}
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              placeholder="uuid from the groups table"
            />
          </label>
          {error && <p className={styles.errorText}>{error}</p>}
          <button className={styles.buttonPrimary} type="submit" disabled={checking}>
            {checking ? "Checking…" : "Connect"}
          </button>
        </form>
        <p className={styles.subtleSmall} style={{ marginTop: 14 }}>
          Don't have a group yet?{" "}
          <button type="button" className={styles.buttonLink} onClick={() => setMode("create")}>
            Create one
          </button>
        </p>
      </div>
    </div>
  );
}

function ReasonPrompt({ title, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalCard}>
        <h3 className={styles.h3}>{title}</h3>
        <p className={styles.subtle}>
          A reason is required — every pause/resume is written to the audit trail,
          no silent kill-switches.
        </p>
        <textarea
          className={styles.textarea}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Strategy misbehaving on EURUSD, pausing to investigate"
          rows={3}
        />
        <div className={styles.modalActions}>
          <button className={styles.buttonGhost} onClick={onCancel}>
            Cancel
          </button>
          <button
            className={styles.buttonDanger}
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberRow({ member, conn, onChanged, onViewAudit, onEdit, onViewEquity }) {
  const [prompt, setPrompt] = useState(null); // "pause" | "resume" | "remove" | null
  const [busy, setBusy] = useState(false);

  async function act(action, reason) {
    setBusy(true);
    try {
      if (action === "remove") {
        await apiFetch(conn.baseUrl, conn.apiKey, `/onboarding/member/${member.id}`, {
          method: "DELETE",
          body: JSON.stringify({ reason }),
        });
      } else {
        const path =
          action === "pause"
            ? `/kill-switch/member/${member.id}`
            : `/kill-switch/member/${member.id}/resume`;
        await apiFetch(conn.baseUrl, conn.apiKey, path, {
          method: "POST",
          body: JSON.stringify({ triggeredBy: "dashboard", reason }),
        });
      }
      setPrompt(null);
      onChanged();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  const promptTitles = {
    pause: `Pause ${member.userId}?`,
    resume: `Resume ${member.userId}?`,
    remove: `Remove ${member.userId}? They stop receiving signals; their audit history is kept.`,
  };

  return (
    <div className={styles.memberRow}>
      <div className={styles.memberInfo}>
        <div className={styles.memberName}>{member.userId}</div>
        <div className={styles.memberMeta}>
          {member.brokerType} · <span className="mono">{member.brokerAccountRef}</span>
          {member.riskProfile ? ` · ${Number(member.riskProfile.fixedLots)} lots` : " · no risk profile"}
        </div>
      </div>
      <StatusPill status={member.status} />
      <div className={styles.memberOrders}>
        {member.orders?.length ? (
          member.orders.map((o) => (
            <OrderStatusPill key={o.id} status={o.status} />
          ))
        ) : (
          <span className={styles.subtleSmall}>No orders yet</span>
        )}
      </div>
      <div className={styles.memberActions}>
        <div className={styles.linkRow}>
          <button className={styles.buttonLink} onClick={() => onViewAudit(member.id)}>
            Audit trail
          </button>
          <button className={styles.buttonLink} onClick={() => onViewEquity(member)}>
            Equity chart
          </button>
          <button className={styles.buttonLink} onClick={() => onEdit(member)}>
            Edit
          </button>
          {member.status !== "REMOVED" && (
            <button className={styles.buttonLink} style={{ color: "var(--red)" }} onClick={() => setPrompt("remove")}>
              Remove
            </button>
          )}
        </div>
        {member.status === "PAUSED" ? (
          <button className={styles.buttonSmall} disabled={busy} onClick={() => setPrompt("resume")}>
            Resume
          </button>
        ) : member.status !== "REMOVED" ? (
          <button className={styles.buttonSmallDanger} disabled={busy} onClick={() => setPrompt("pause")}>
            Pause
          </button>
        ) : null}
      </div>
      {prompt && (
        <ReasonPrompt
          title={promptTitles[prompt]}
          onCancel={() => setPrompt(null)}
          onConfirm={(reason) => act(prompt, reason)}
        />
      )}
    </div>
  );
}

function AuditTrail({ conn, memberId, onClose }) {
  const [decisions, setDecisions] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(conn.baseUrl, conn.apiKey, `/dashboard/member/${memberId}/audit`)
      .then(setDecisions)
      .catch((err) => setError(err.message));
  }, [conn, memberId]);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCardWide} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.h3}>Audit trail</h3>
          <button className={styles.buttonGhost} onClick={onClose}>
            Close
          </button>
        </div>
        <p className={styles.subtle}>
          Every risk decision for this member — why the engine approved, rejected,
          or resized each signal, and what order (if any) resulted.
        </p>
        {error && <p className={styles.errorText}>{error}</p>}
        {!decisions && !error && <p className={styles.subtle}>Loading…</p>}
        {decisions && decisions.length === 0 && (
          <p className={styles.subtle}>No decisions logged yet for this member.</p>
        )}
        <div className={styles.auditList}>
          {decisions?.map((d) => (
            <div key={d.id} className={styles.auditRow}>
              <div className={styles.auditTop}>
                <span
                  className={styles.pillSmall}
                  style={{
                    borderColor:
                      d.action === "APPROVE" ? "var(--green)" : "var(--red)",
                    color: d.action === "APPROVE" ? "var(--green)" : "var(--red)",
                  }}
                >
                  {d.action}
                </span>
                <span className={styles.subtleSmall}>
                  {new Date(d.createdAt).toLocaleString()}
                </span>
              </div>
              <p className={styles.auditReason}>{d.reason}</p>
              {d.positionSize && (
                <p className={styles.subtleSmall}>Position size: {d.positionSize}</p>
              )}
              {d.order && (
                <p className={styles.subtleSmall}>
                  Order status: <OrderStatusPill status={d.order.status} />{" "}
                  {d.order.brokerOrderRef && (
                    <span className="mono">#{d.order.brokerOrderRef}</span>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AddMemberModal({ conn, onClose, onAdded }) {
  const [userId, setUserId] = useState("");
  const [brokerType, setBrokerType] = useState("METATRADER");
  const [brokerAccountRef, setBrokerAccountRef] = useState("");
  const [fixedLots, setFixedLots] = useState("0.01");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!userId || !brokerAccountRef) {
      setError("User ID and broker account reference are required.");
      return;
    }
    setBusy(true);
    try {
      const body = {
        userId,
        brokerType,
        brokerAccountRef,
      };
      if (fixedLots) {
        body.riskProfile = { fixedLots: Number(fixedLots) };
      }
      await apiFetch(conn.baseUrl, conn.apiKey, `/onboarding/group/${conn.groupId}/member`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      onAdded();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.h3}>Add a member</h3>
        <p className={styles.subtle}>
          A member with no risk profile is rejected by the risk engine rather
          than silently guessing a position size — set one here, or leave it
          and configure it later from the member's row.
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            User ID
            <input
              className={styles.input}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="name or identifier you'll recognize"
            />
          </label>
          <label className={styles.label}>
            Broker type
            <select
              className={styles.input}
              value={brokerType}
              onChange={(e) => setBrokerType(e.target.value)}
            >
              <option value="METATRADER">MetaTrader (via MetaApi)</option>
              <option value="KITE_CONNECT">Kite Connect (equities — Phase 3, not wired up)</option>
            </select>
          </label>
          <label className={styles.label}>
            Broker account reference
            <input
              className={styles.input}
              value={brokerAccountRef}
              onChange={(e) => setBrokerAccountRef(e.target.value)}
              placeholder="MetaApi accountId (not login/password)"
            />
          </label>
          <label className={styles.label}>
            Fixed lot size (risk profile)
            <input
              className={styles.input}
              type="number"
              step="0.01"
              min="0"
              value={fixedLots}
              onChange={(e) => setFixedLots(e.target.value)}
            />
          </label>
          {error && <p className={styles.errorText}>{error}</p>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.buttonGhost} onClick={onClose}>
              Cancel
            </button>
            <button className={styles.buttonPrimary} type="submit" disabled={busy}>
              {busy ? "Adding…" : "Add member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddStrategyModal({ conn, onClose, onAdded }) {
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState("PINE_SCRIPT");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!name) {
      setError("Strategy name is required.");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch(conn.baseUrl, conn.apiKey, `/onboarding/group/${conn.groupId}/strategy`, {
        method: "POST",
        body: JSON.stringify({ name, sourceType }),
      });
      setResult(res);
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
          <h3 className={styles.h3}>Strategy created</h3>
          <p className={styles.subtle}>
            Save this secret now — it will never be shown again. Paste it into
            TradingView's alert webhook config so signals are signed correctly.
          </p>
          <label className={styles.label}>
            Webhook secret (plaintext, shown once)
            <input className={styles.input + " mono"} readOnly value={result.webhookSecretPlaintext} />
          </label>
          <label className={styles.label}>
            Webhook URL path
            <input className={styles.input + " mono"} readOnly value={result.webhookUrlPath} />
          </label>
          <div className={styles.modalActions}>
            <button className={styles.buttonPrimary} onClick={onClose}>
              Done, I've saved it
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.h3}>Add a strategy</h3>
        <p className={styles.subtle}>
          This creates the strategy and generates its webhook secret on the
          backend — the secret is encrypted at rest and shown to you exactly
          once, right after creation.
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            Strategy name
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. EURUSD Breakout v1"
            />
          </label>
          <label className={styles.label}>
            Source
            <select
              className={styles.input}
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
            >
              <option value="PINE_SCRIPT">TradingView Pine Script</option>
              <option value="CUSTOM">Custom Python/Node model</option>
            </select>
          </label>
          {error && <p className={styles.errorText}>{error}</p>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.buttonGhost} onClick={onClose}>
              Cancel
            </button>
            <button className={styles.buttonPrimary} type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create strategy"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditMemberModal({ conn, member, onClose, onSaved }) {
  const [userId, setUserId] = useState(member.userId);
  const [brokerAccountRef, setBrokerAccountRef] = useState(member.brokerAccountRef);
  const [fixedLots, setFixedLots] = useState(
    member.riskProfile ? String(member.riskProfile.fixedLots) : ""
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!userId || !brokerAccountRef) {
      setError("User ID and broker account reference are required.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(conn.baseUrl, conn.apiKey, `/onboarding/member/${member.id}`, {
        method: "PUT",
        body: JSON.stringify({ userId, brokerAccountRef }),
      });
      if (fixedLots !== "" && Number(fixedLots) > 0) {
        await apiFetch(conn.baseUrl, conn.apiKey, `/onboarding/member/${member.id}/risk-profile`, {
          method: "PUT",
          body: JSON.stringify({ fixedLots: Number(fixedLots) }),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.h3}>Edit {member.userId}</h3>
        <p className={styles.subtle}>
          Pausing/resuming for trading reasons still goes through the
          Pause/Resume buttons so it's audit-logged — this form is only for
          fixing details.
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            User ID
            <input className={styles.input} value={userId} onChange={(e) => setUserId(e.target.value)} />
          </label>
          <label className={styles.label}>
            Broker account reference
            <input
              className={styles.input}
              value={brokerAccountRef}
              onChange={(e) => setBrokerAccountRef(e.target.value)}
            />
          </label>
          <label className={styles.label}>
            Fixed lot size (risk profile)
            <input
              className={styles.input}
              type="number"
              step="0.01"
              min="0"
              value={fixedLots}
              onChange={(e) => setFixedLots(e.target.value)}
              placeholder="unset — member is rejected until set"
            />
          </label>
          {error && <p className={styles.errorText}>{error}</p>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.buttonGhost} onClick={onClose}>
              Cancel
            </button>
            <button className={styles.buttonPrimary} type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EquityChartModal({ conn, member, onClose }) {
  const [snapshots, setSnapshots] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(conn.baseUrl, conn.apiKey, `/dashboard/member/${member.id}/equity-history`)
      .then(setSnapshots)
      .catch((err) => setError(err.message));
  }, [conn, member.id]);

  let chart = null;
  if (snapshots && snapshots.length >= 2) {
    const values = snapshots.map((s) => Number(s.equity));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const W = 560;
    const H = 180;
    const PAD = 10;
    const points = values
      .map((v, i) => {
        const x = PAD + (i / (values.length - 1)) * (W - 2 * PAD);
        const y = H - PAD - ((v - min) / range) * (H - 2 * PAD);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    const first = values[0];
    const last = values[values.length - 1];
    const change = last - first;
    const currency = snapshots[snapshots.length - 1].currency;
    chart = (
      <>
        <p className={styles.subtle}>
          {snapshots.length} snapshots · latest equity{" "}
          <b>
            {last.toFixed(2)} {currency}
          </b>{" "}
          · change over this history:{" "}
          <b style={{ color: change >= 0 ? "var(--green)" : "var(--red)" }}>
            {change >= 0 ? "+" : ""}
            {change.toFixed(2)} {currency}
          </b>
        </p>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.chartSvg} role="img" aria-label="Equity over time">
          <polyline
            points={points}
            fill="none"
            stroke={change >= 0 ? "var(--green)" : "var(--red)"}
            strokeWidth="2"
          />
        </svg>
        <p className={styles.subtleSmall}>
          {new Date(snapshots[0].capturedAt).toLocaleString()} —{" "}
          {new Date(snapshots[snapshots.length - 1].capturedAt).toLocaleString()}
        </p>
      </>
    );
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCardWide} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.h3}>Equity over time — {member.userId}</h3>
          <button className={styles.buttonGhost} onClick={onClose}>
            Close
          </button>
        </div>
        {error && <p className={styles.errorText}>{error}</p>}
        {!snapshots && !error && <p className={styles.subtle}>Loading…</p>}
        {snapshots && snapshots.length < 2 && (
          <p className={styles.subtle}>
            Not enough history yet. Snapshots are captured each time live data
            is refreshed (button in the Live accounts section) — history builds
            up while the dashboard is being used.
          </p>
        )}
        {chart}
      </div>
    </div>
  );
}

function LiveOverview({ conn, members }) {
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    setLoading(true);
    setError("");
    apiFetch(conn.baseUrl, conn.apiKey, `/dashboard/group/${conn.groupId}/live`)
      .then(setLive)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [conn]);

  const byMember = {};
  (live || []).forEach((r) => {
    byMember[r.memberId] = r;
  });

  return (
    <section className={styles.section}>
      <div className={styles.modalHeader}>
        <h2 className={styles.h2}>Live accounts (MetaApi)</h2>
        <button className={styles.buttonGhost} onClick={refresh} disabled={loading}>
          {loading ? "Fetching…" : "Refresh live data"}
        </button>
      </div>
      <p className={styles.subtleSmall}>
        Balance/equity/floating P&amp;L straight from each member's own broker
        account via MetaApi — this IS live data, unlike the order history
        below. Each refresh also saves an equity snapshot for the charts.
      </p>
      {error && <p className={styles.errorText}>{error}</p>}
      {!live && !error && (
        <p className={styles.subtleSmall} style={{ marginTop: 8 }}>
          Not fetched yet — click "Refresh live data".
        </p>
      )}
      {live && (
        <div className={styles.liveGrid}>
          {members
            .filter((m) => m.status !== "REMOVED")
            .map((m) => {
              const r = byMember[m.id];
              if (!r) return null;
              if (!r.ok) {
                return (
                  <div key={m.id} className={styles.liveCard}>
                    <div className={styles.memberName}>{m.userId}</div>
                    <p className={styles.subtleSmall}>{r.error}</p>
                  </div>
                );
              }
              const info = r.accountInformation;
              const floating = Number(info.equity) - Number(info.balance);
              return (
                <div key={m.id} className={styles.liveCard}>
                  <div className={styles.memberName}>{m.userId}</div>
                  <div className={styles.liveNumbers}>
                    <span>
                      Balance: <b>{Number(info.balance).toFixed(2)}</b> {info.currency}
                    </span>
                    <span>
                      Equity: <b>{Number(info.equity).toFixed(2)}</b> {info.currency}
                    </span>
                    <span style={{ color: floating >= 0 ? "var(--green)" : "var(--red)" }}>
                      Floating P&amp;L: <b>{floating >= 0 ? "+" : ""}{floating.toFixed(2)}</b> {info.currency}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </section>
  );
}

function GroupDashboard({ conn, onDisconnect }) {
  const [group, setGroup] = useState(null);
  const [error, setError] = useState("");
  const [groupPausePrompt, setGroupPausePrompt] = useState(false);
  const [auditMemberId, setAuditMemberId] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddStrategy, setShowAddStrategy] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [equityMember, setEquityMember] = useState(null);

  async function archiveStrategy(strategy) {
    if (
      !window.confirm(
        `Archive "${strategy.name}"? Its webhook stops accepting signals immediately; its audit history is kept. This cannot be undone — recreate the strategy (new secret) to trade it again.`
      )
    ) {
      return;
    }
    try {
      await apiFetch(conn.baseUrl, conn.apiKey, `/onboarding/strategy/${strategy.id}`, {
        method: "DELETE",
      });
      refresh();
    } catch (err) {
      alert(err.message);
    }
  }

  async function renameStrategy(strategy) {
    const name = window.prompt("New name for this strategy:", strategy.name);
    if (!name || name === strategy.name) return;
    try {
      await apiFetch(conn.baseUrl, conn.apiKey, `/onboarding/strategy/${strategy.id}`, {
        method: "PUT",
        body: JSON.stringify({ name }),
      });
      refresh();
    } catch (err) {
      alert(err.message);
    }
  }

  const refresh = useCallback(() => {
    apiFetch(conn.baseUrl, conn.apiKey, `/dashboard/group/${conn.groupId}`)
      .then(setGroup)
      .catch((err) => setError(err.message));
  }, [conn]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function pauseGroup(reason) {
    try {
      await apiFetch(conn.baseUrl, conn.apiKey, `/kill-switch/group/${conn.groupId}`, {
        method: "POST",
        body: JSON.stringify({ triggeredBy: "dashboard", reason }),
      });
      setGroupPausePrompt(false);
      refresh();
    } catch (err) {
      alert(err.message);
    }
  }

  if (error) {
    return (
      <div className={styles.centerScreen}>
        <div className={styles.card}>
          <p className={styles.errorText}>{error}</p>
          <button className={styles.buttonGhost} onClick={onDisconnect}>
            Reconnect
          </button>
        </div>
      </div>
    );
  }

  if (!group) {
    return <div className={styles.centerScreen}>Loading…</div>;
  }

  const activeCount = group.members.filter((m) => m.status === "ACTIVE").length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>WayneTrade</p>
          <h1 className={styles.h1}>{group.name}</h1>
          <p className={styles.subtle}>
            {activeCount} of {group.members.length} members active ·{" "}
            {group.strategies.length} {group.strategies.length === 1 ? "strategy" : "strategies"}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.buttonGhost} onClick={() => setShowAddMember(true)}>
            Add member
          </button>
          <button className={styles.buttonGhost} onClick={() => setShowAddStrategy(true)}>
            Add strategy
          </button>
          <button className={styles.buttonDanger} onClick={() => setGroupPausePrompt(true)}>
            Pause entire group
          </button>
          <button className={styles.buttonGhost} onClick={onDisconnect}>
            Disconnect
          </button>
        </div>
      </header>

      <section className={styles.section}>
        <h2 className={styles.h2}>Strategies</h2>
        {group.strategies.length === 0 ? (
          <p className={styles.subtleSmall}>
            No strategy yet — add one to get a webhook URL for TradingView.
          </p>
        ) : (
          <div className={styles.memberList}>
            {group.strategies.map((s) => (
              <div key={s.id} className={styles.memberRow} style={{ gridTemplateColumns: "1fr auto" }}>
                <div className={styles.memberInfo}>
                  <div className={styles.memberName}>{s.name}</div>
                  <div className={styles.memberMeta}>
                    {s.sourceType} · <span className="mono">/webhook/{s.id}</span>
                  </div>
                </div>
                <div className={styles.linkRow}>
                  <button className={styles.buttonLink} onClick={() => renameStrategy(s)}>
                    Rename
                  </button>
                  <button
                    className={styles.buttonLink}
                    style={{ color: "var(--red)" }}
                    onClick={() => archiveStrategy(s)}
                  >
                    Archive
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className={styles.subtleSmall} style={{ marginTop: 8 }}>
          Lost a secret? Secrets can't be re-shown — archive the strategy and create a new one.
        </p>
      </section>

      <LiveOverview conn={conn} members={group.members} />

      <section className={styles.section}>
        <h2 className={styles.h2}>Members</h2>
        <p className={styles.subtleSmall}>
          P&amp;L shown here is not live — it reflects only orders and risk
          decisions logged in our own database, not live broker equity.
        </p>
        <div className={styles.memberList}>
          {group.members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              conn={conn}
              onChanged={refresh}
              onViewAudit={setAuditMemberId}
              onEdit={setEditMember}
              onViewEquity={setEquityMember}
            />
          ))}
        </div>
      </section>

      {groupPausePrompt && (
        <ReasonPrompt
          title={`Pause all of "${group.name}"?`}
          onCancel={() => setGroupPausePrompt(false)}
          onConfirm={pauseGroup}
        />
      )}
      {auditMemberId && (
        <AuditTrail conn={conn} memberId={auditMemberId} onClose={() => setAuditMemberId(null)} />
      )}
      {showAddMember && (
        <AddMemberModal conn={conn} onClose={() => setShowAddMember(false)} onAdded={refresh} />
      )}
      {showAddStrategy && (
        <AddStrategyModal conn={conn} onClose={() => setShowAddStrategy(false)} onAdded={refresh} />
      )}
      {editMember && (
        <EditMemberModal
          conn={conn}
          member={editMember}
          onClose={() => setEditMember(null)}
          onSaved={refresh}
        />
      )}
      {equityMember && (
        <EquityChartModal conn={conn} member={equityMember} onClose={() => setEquityMember(null)} />
      )}
    </div>
  );
}

export default function App() {
  const [conn, setConn] = useState(() => loadConnection());

  function disconnect() {
    localStorage.removeItem("waynetrade_connection");
    setConn(null);
  }

  if (!conn) {
    return <ConnectScreen onConnect={setConn} />;
  }

  return <GroupDashboard conn={conn} onDisconnect={disconnect} />;
}
