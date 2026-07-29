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
  const [baseUrl, setBaseUrl] = useState("https://waynetrade.wayneesolutions.com");
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
  const [baseUrl, setBaseUrl] = useState("https://waynetrade.wayneesolutions.com");
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

function MemberRow({ member, conn, onChanged, onViewAudit }) {
  const [prompt, setPrompt] = useState(null); // "pause" | "resume" | null
  const [busy, setBusy] = useState(false);

  async function act(action, reason) {
    setBusy(true);
    try {
      const path =
        action === "pause"
          ? `/kill-switch/member/${member.id}`
          : `/kill-switch/member/${member.id}/resume`;
      await apiFetch(conn.baseUrl, conn.apiKey, path, {
        method: "POST",
        body: JSON.stringify({ triggeredBy: "dashboard", reason }),
      });
      setPrompt(null);
      onChanged();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.memberRow}>
      <div className={styles.memberInfo}>
        <div className={styles.memberName}>{member.userId}</div>
        <div className={styles.memberMeta}>
          {member.brokerType} · <span className="mono">{member.brokerAccountRef}</span>
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
        <button className={styles.buttonLink} onClick={() => onViewAudit(member.id)}>
          Audit trail
        </button>
        {member.status === "PAUSED" ? (
          <button className={styles.buttonSmall} disabled={busy} onClick={() => setPrompt("resume")}>
            Resume
          </button>
        ) : (
          <button className={styles.buttonSmallDanger} disabled={busy} onClick={() => setPrompt("pause")}>
            Pause
          </button>
        )}
      </div>
      {prompt && (
        <ReasonPrompt
          title={prompt === "pause" ? `Pause ${member.userId}?` : `Resume ${member.userId}?`}
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

function GroupDashboard({ conn, onDisconnect }) {
  const [group, setGroup] = useState(null);
  const [error, setError] = useState("");
  const [groupPausePrompt, setGroupPausePrompt] = useState(false);
  const [auditMemberId, setAuditMemberId] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddStrategy, setShowAddStrategy] = useState(false);

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
                <span className={styles.subtleSmall}>
                  Lost the secret? Create a new strategy — secrets can't be re-shown.
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

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
