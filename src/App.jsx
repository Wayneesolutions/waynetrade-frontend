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

// Deliberately a SEPARATE localStorage key and a separate connection shape
// (memberId + viewToken, never apiKey) from the admin connection above —
// keeps the two credential types from ever being read by the wrong screen.
function loadInvestorConnection() {
  try {
    const raw = localStorage.getItem("waynetrade_investor_connection");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveInvestorConnection(conn) {
  localStorage.setItem("waynetrade_investor_connection", JSON.stringify(conn));
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

// Separate from apiFetch on purpose, not just a parameterized version of
// it — an investor's view token must never be sent as X-Api-Key (that
// header is the shared admin secret; mixing the two up would be exactly
// the kind of bug that defeats the whole point of having two auth
// systems). Almost every investor route is read-only GET; the one
// exception (self-service token rotation) still authenticates with
// X-View-Token, never X-Api-Key, so this still isn't apiFetch with a
// parameter swapped in.
async function investorApiFetch(baseUrl, viewToken, path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "X-View-Token": viewToken, ...(options.headers || {}) },
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
  const [brokerWhatsappNumber, setBrokerWhatsappNumber] = useState("");
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
        body: JSON.stringify({
          name: groupName,
          adminUserId,
          brokerWhatsappNumber: brokerWhatsappNumber || undefined,
        }),
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
          <label className={styles.label}>
            Broker's WhatsApp number (optional)
            <input
              className={styles.input}
              value={brokerWhatsappNumber}
              onChange={(e) => setBrokerWhatsappNumber(e.target.value)}
              placeholder="+91XXXXXXXXXX — where the research digest is sent"
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
        <p className={styles.subtleSmall} style={{ marginTop: 6 }}>
          Are you an investor, not a broker/admin?{" "}
          <a className={styles.buttonLink} href="#investor">
            View your own trades
          </a>
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
  const [prompt, setPrompt] = useState(null); // "pause" | "resume" | "remove" | null
  const [busy, setBusy] = useState(false);

  async function act(action, reason) {
    setBusy(true);
    try {
      if (action === "remove") {
        // Soft delete — status: REMOVED, no "un-remove" route exists on
        // purpose (matches the backend's "more permanent than pause"
        // design). Confirmed once via ReasonPrompt below; no second
        // confirmation dialog on top of it.
        await apiFetch(conn.baseUrl, conn.apiKey, `/onboarding/member/${member.id}`, {
          method: "DELETE",
          body: JSON.stringify({ triggeredBy: "dashboard", reason }),
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

  const removed = member.status === "REMOVED";

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
        {/* Once removed, no further action is possible — matches the
            backend having no "un-remove" route at all. */}
        {!removed && (
          <>
            {member.status === "PAUSED" ? (
              <button className={styles.buttonSmall} disabled={busy} onClick={() => setPrompt("resume")}>
                Resume
              </button>
            ) : (
              <button className={styles.buttonSmallDanger} disabled={busy} onClick={() => setPrompt("pause")}>
                Pause
              </button>
            )}
            <button className={styles.buttonLink} disabled={busy} onClick={() => setPrompt("remove")}>
              Remove
            </button>
          </>
        )}
      </div>
      {prompt && (
        <ReasonPrompt
          title={
            prompt === "pause"
              ? `Pause ${member.userId}?`
              : prompt === "resume"
                ? `Resume ${member.userId}?`
                : `Remove ${member.userId}? This cannot be undone.`
          }
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
  const [riskRewardRatio, setRiskRewardRatio] = useState("2.0");
  const [whatsappNumber, setWhatsappNumber] = useState("");
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
      if (whatsappNumber) body.whatsappNumber = whatsappNumber;
      if (fixedLots) {
        body.riskProfile = { fixedLots: Number(fixedLots) };
        // Blank = let the backend's schema default (2.0) apply; a typed
        // value overrides it. There's no way to explicitly send "disable
        // profit-booking" (null) from this form yet — use the risk-profile
        // update endpoint directly for that.
        if (riskRewardRatio) body.riskProfile.riskRewardRatio = Number(riskRewardRatio);
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
              <option value="KITE_CONNECT">Kite Connect (Indian equities)</option>
            </select>
          </label>
          <label className={styles.label}>
            Broker account reference
            <input
              className={styles.input}
              value={brokerAccountRef}
              onChange={(e) => setBrokerAccountRef(e.target.value)}
              placeholder={
                brokerType === "KITE_CONNECT"
                  ? "Kite access token (not login/password)"
                  : "MetaApi accountId (not login/password)"
              }
            />
          </label>
          {brokerType === "KITE_CONNECT" && (
            <p className={styles.subtleSmall}>
              Kite access tokens expire daily — this needs refreshing each
              trading day. Every equities order also needs the strategy's
              Algo-ID set (see the Strategies section) or it will be rejected.
            </p>
          )}
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
          <label className={styles.label}>
            Risk:reward ratio (auto profit-booking)
            <input
              className={styles.input}
              type="number"
              step="0.1"
              min="0"
              value={riskRewardRatio}
              onChange={(e) => setRiskRewardRatio(e.target.value)}
              placeholder="e.g. 2.0 = book profit at 2x the risked amount"
            />
          </label>
          <label className={styles.label}>
            WhatsApp number (optional)
            <input
              className={styles.input}
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="+91XXXXXXXXXX — for real-time trade alerts"
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

function AlgoIdModal({ conn, strategy, onClose, onSaved }) {
  const [algoId, setAlgoId] = useState(strategy.algoId || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!algoId.trim()) {
      setError("Algo-ID is required.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(conn.baseUrl, conn.apiKey, `/onboarding/strategy/${strategy.id}/algo-id`, {
        method: "PUT",
        body: JSON.stringify({ algoId: algoId.trim() }),
      });
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
        <h3 className={styles.h3}>Set Algo-ID for "{strategy.name}"</h3>
        <p className={styles.subtle}>
          SEBI requires every algorithmic equities order to carry the
          exchange-assigned Algo-ID. Get this from your broker once they've
          registered this strategy — there's no API to generate it yourself.
          Kite Connect (equities) members can't trade this strategy until
          it's set; MetaTrader/forex members don't need one.
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            Algo-ID
            <input
              className={styles.input + " mono"}
              value={algoId}
              onChange={(e) => setAlgoId(e.target.value)}
              placeholder="from your broker, after exchange registration"
            />
          </label>
          {error && <p className={styles.errorText}>{error}</p>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.buttonGhost} onClick={onClose}>
              Cancel
            </button>
            <button className={styles.buttonPrimary} type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save Algo-ID"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const NOTIFICATION_AUDIENCE_COLOR = {
  INVESTOR: "var(--navy)",
  BROKER: "var(--gold)",
};

const WHATSAPP_STATUS_COLOR = {
  SENT: "var(--green)",
  FAILED: "var(--red)",
  PENDING: "var(--grey)",
  SKIPPED_NOT_CONFIGURED: "var(--grey)",
};

/**
 * Layer 3's transparency feed — every trade explanation sent to an
 * investor, and every research digest sent to the broker, in one list.
 * This is the dashboard-permanent copy: the whatsappStatus pill shows
 * whether the WhatsApp push also went out, but the row exists here either
 * way (see notificationService.js — persistence always happens first).
 */
function NotificationsSection({ conn }) {
  const [notifications, setNotifications] = useState(null);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    apiFetch(conn.baseUrl, conn.apiKey, `/dashboard/group/${conn.groupId}/notifications`)
      .then(setNotifications)
      .catch((err) => setError(err.message));
  }, [conn]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeaderRow}>
        <div>
          <h2 className={styles.h2}>Transparency feed</h2>
          <p className={styles.subtleSmall}>
            Every trade explanation sent to an investor, and every research
            digest sent to you — win, loss, or rejected, shown the same way.
          </p>
        </div>
        <button className={styles.buttonGhost} onClick={refresh}>
          Refresh
        </button>
      </div>
      {error && <p className={styles.errorText}>{error}</p>}
      {!notifications && !error && <p className={styles.subtle}>Loading…</p>}
      {notifications && notifications.length === 0 && (
        <p className={styles.subtleSmall}>No notifications yet.</p>
      )}
      <div className={styles.feedList}>
        {notifications?.map((n) => (
          <div key={n.id} className={styles.feedRow}>
            <div className={styles.feedRowTop}>
              <span
                className={styles.pillSmall}
                style={{
                  borderColor: NOTIFICATION_AUDIENCE_COLOR[n.audience],
                  color: NOTIFICATION_AUDIENCE_COLOR[n.audience],
                }}
              >
                {n.audience === "INVESTOR" ? n.member?.userId || "Investor" : "Broker digest"}
              </span>
              <span
                className={styles.pillSmall}
                style={{
                  borderColor: WHATSAPP_STATUS_COLOR[n.whatsappStatus],
                  color: WHATSAPP_STATUS_COLOR[n.whatsappStatus],
                }}
              >
                WhatsApp: {n.whatsappStatus}
              </span>
              <span className={styles.subtleSmall}>{timeAgo(n.createdAt)}</span>
            </div>
            <p className={styles.feedMessage}>{n.message}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const CONFIDENCE_TAG_COLOR = {
  HIGH: "var(--green)",
  MEDIUM: "var(--amber)",
  LOW: "var(--grey)",
};

/**
 * Layer 2's research feed — the AI research assistant's news analysis,
 * cross-checked against the Saaf Signal forecast engine when a specific
 * ticker was identifiable. The two readings (confidenceTag from the news
 * analysis, technicalConfidence from history) are shown as two separate
 * lines on purpose — never merged into one number, see researchAssistant.js.
 */
function ResearchSection({ conn }) {
  const [signals, setSignals] = useState(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);

  const refresh = useCallback(() => {
    apiFetch(conn.baseUrl, conn.apiKey, `/research/feed?groupId=${conn.groupId}`)
      .then(setSignals)
      .catch((err) => setError(err.message));
  }, [conn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function runScan() {
    setScanning(true);
    setError("");
    try {
      await apiFetch(conn.baseUrl, conn.apiKey, "/research/scan", {
        method: "POST",
        body: JSON.stringify({ groupId: conn.groupId }),
      });
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeaderRow}>
        <div>
          <h2 className={styles.h2}>Research assistant</h2>
          <p className={styles.subtleSmall}>
            No automatic schedule is configured yet — an external cron needs
            to hit this periodically. Use "Run scan now" to trigger one
            manually.
          </p>
        </div>
        <button className={styles.buttonGhost} disabled={scanning} onClick={runScan}>
          {scanning ? "Scanning…" : "Run scan now"}
        </button>
      </div>
      {error && <p className={styles.errorText}>{error}</p>}
      {!signals && !error && <p className={styles.subtle}>Loading…</p>}
      {signals && signals.length === 0 && (
        <p className={styles.subtleSmall}>No research signals yet — run a scan.</p>
      )}
      <div className={styles.feedList}>
        {signals?.map((s) => (
          <div key={s.id} className={styles.feedRow}>
            <div className={styles.feedRowTop}>
              <span
                className={styles.pillSmall}
                style={{
                  borderColor: CONFIDENCE_TAG_COLOR[s.confidenceTag],
                  color: CONFIDENCE_TAG_COLOR[s.confidenceTag],
                }}
              >
                {s.confidenceTag}
              </span>
              <span className={styles.subtleSmall}>
                {s.sector || "General"}
                {s.ticker ? ` · ${s.ticker}` : ""}
              </span>
              <span className={styles.subtleSmall}>{timeAgo(s.createdAt)}</span>
            </div>
            <p className={styles.feedMessage}>
              {s.sourceUrl ? (
                <a href={s.sourceUrl} target="_blank" rel="noreferrer">
                  {s.headline}
                </a>
              ) : (
                s.headline
              )}
            </p>
            <p className={styles.subtleSmall}>{s.riskNote}</p>
            {s.technicalConfidence != null && (
              <p className={styles.subtleSmall}>
                Historical read: {s.technicalDirection} @ {s.technicalConfidence}%
                confidence ({s.technicalSampleSize} samples, {s.technicalReliabilityTier})
              </p>
            )}
          </div>
        ))}
      </div>
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
  const [algoIdStrategy, setAlgoIdStrategy] = useState(null);

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
              <div key={s.id} className={styles.memberRow} style={{ gridTemplateColumns: "1fr auto auto" }}>
                <div className={styles.memberInfo}>
                  <div className={styles.memberName}>{s.name}</div>
                  <div className={styles.memberMeta}>
                    {s.sourceType} · <span className="mono">/webhook/{s.id}</span>
                  </div>
                </div>
                {s.algoId ? (
                  <span
                    className={styles.pillSmall}
                    style={{ borderColor: "var(--green)", color: "var(--green)" }}
                  >
                    Algo-ID: <span className="mono">{s.algoId}</span>
                  </span>
                ) : (
                  <span
                    className={styles.pillSmall}
                    style={{ borderColor: "var(--amber)", color: "var(--amber)" }}
                  >
                    No Algo-ID — equities orders blocked
                  </span>
                )}
                <button className={styles.buttonLink} onClick={() => setAlgoIdStrategy(s)}>
                  {s.algoId ? "Update Algo-ID" : "Set Algo-ID"}
                </button>
              </div>
            ))}
          </div>
        )}
        {group.strategies.length > 0 && (
          <p className={styles.subtleSmall} style={{ marginTop: 8 }}>
            Lost a webhook secret? Create a new strategy — secrets can't be re-shown.
          </p>
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

      <NotificationsSection conn={conn} />
      <ResearchSection conn={conn} />

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
      {algoIdStrategy && (
        <AlgoIdModal
          conn={conn}
          strategy={algoIdStrategy}
          onClose={() => setAlgoIdStrategy(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function InvestorConnectScreen({ onConnect }) {
  const [baseUrl, setBaseUrl] = useState("https://waynetrade.wayneesolutions.com");
  const [memberId, setMemberId] = useState("");
  const [viewToken, setViewToken] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!baseUrl || !memberId || !viewToken) {
      setError("All three fields are needed.");
      return;
    }
    setChecking(true);
    try {
      const cleanBaseUrl = baseUrl.replace(/\/$/, "");
      await investorApiFetch(cleanBaseUrl, viewToken, `/investor/${memberId}/overview`);
      const conn = { baseUrl: cleanBaseUrl, memberId, viewToken };
      saveInvestorConnection(conn);
      onConnect(conn);
    } catch (err) {
      setError(err.message || "Could not verify that member ID and view token.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className={styles.centerScreen}>
      <div className={styles.card} style={{ maxWidth: 440 }}>
        <p className={styles.eyebrow}>WayneTrade — Investor</p>
        <h1 className={styles.h1}>View your own trades</h1>
        <p className={styles.subtle}>
          This is separate from the broker/admin dashboard — you'll only see
          your own trades, notifications, and audit trail here, nothing
          about anyone else. Your broker/admin gives you the member ID and
          view token below when they add you (or afterwards, on request).
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
            Your member ID
            <input
              className={styles.input}
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              placeholder="uuid, from your broker/admin"
            />
          </label>
          <label className={styles.label}>
            Your view token
            <input
              className={styles.input}
              type="password"
              value={viewToken}
              onChange={(e) => setViewToken(e.target.value)}
              placeholder="from your broker/admin — never your admin API key"
            />
          </label>
          {error && <p className={styles.errorText}>{error}</p>}
          <button className={styles.buttonPrimary} type="submit" disabled={checking}>
            {checking ? "Checking…" : "View my trades"}
          </button>
        </form>
        <p className={styles.subtleSmall} style={{ marginTop: 14 }}>
          Are you the broker/admin? <a className={styles.buttonLink} href="#">Go to the admin dashboard</a>
        </p>
      </div>
    </div>
  );
}

/**
 * Investor's own read-only view — deliberately narrower than
 * GroupDashboard: no kill-switch, no onboarding, no other members. Every
 * request is scoped by the view token itself (see investor.js on the
 * backend), not by anything this component chooses to show or hide, but
 * this component also never renders a control that could act on anyone
 * else's behalf, as a second layer of "an investor can't even try."
 */
function InvestorDashboard({ conn, onDisconnect, onTokenRotated }) {
  const [overview, setOverview] = useState(null);
  const [decisions, setDecisions] = useState(null);
  const [notifications, setNotifications] = useState(null);
  const [error, setError] = useState("");
  const [saafSignalUrl, setSaafSignalUrl] = useState(
    () => localStorage.getItem("waynetrade_saaf_signal_url") || ""
  );
  const [rotating, setRotating] = useState(false);
  const [newToken, setNewToken] = useState(null);

  async function rotateToken() {
    if (!confirm("Get a new view token? Your current token stops working the moment this succeeds.")) return;
    setRotating(true);
    try {
      const result = await investorApiFetch(
        conn.baseUrl,
        conn.viewToken,
        `/investor/${conn.memberId}/view-token/regenerate`,
        { method: "POST" }
      );
      // Update the stored connection immediately so this session keeps
      // working without needing to log out and back in — the old token in
      // conn.viewToken is now dead the instant the request above succeeded.
      onTokenRotated(result.viewTokenPlaintext);
      setNewToken(result.viewTokenPlaintext);
    } catch (err) {
      alert(err.message);
    } finally {
      setRotating(false);
    }
  }

  const refresh = useCallback(() => {
    investorApiFetch(conn.baseUrl, conn.viewToken, `/investor/${conn.memberId}/overview`)
      .then(setOverview)
      .catch((err) => setError(err.message));
    investorApiFetch(conn.baseUrl, conn.viewToken, `/investor/${conn.memberId}/audit`)
      .then(setDecisions)
      .catch(() => {});
    investorApiFetch(conn.baseUrl, conn.viewToken, `/investor/${conn.memberId}/notifications`)
      .then(setNotifications)
      .catch(() => {});
  }, [conn]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  function saveSaafSignalUrl(url) {
    setSaafSignalUrl(url);
    localStorage.setItem("waynetrade_saaf_signal_url", url);
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

  if (!overview) {
    return <div className={styles.centerScreen}>Loading…</div>;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>WayneTrade — Investor</p>
          <h1 className={styles.h1}>{overview.userId}</h1>
          <p className={styles.subtle}>
            {overview.groupName} · {overview.brokerType} · <StatusPill status={overview.status} />
          </p>
        </div>
        <div className={styles.headerActions}>
          {saafSignalUrl ? (
            <a className={styles.buttonGhost} href={saafSignalUrl} target="_blank" rel="noreferrer">
              Market forecasts &amp; track record
            </a>
          ) : (
            <button
              className={styles.buttonGhost}
              onClick={() => {
                const url = prompt("Saaf Signal site URL (e.g. https://saaf-signal-frontend.vercel.app):");
                if (url) saveSaafSignalUrl(url);
              }}
            >
              Link Saaf Signal site
            </button>
          )}
          <button className={styles.buttonGhost} disabled={rotating} onClick={rotateToken}>
            {rotating ? "Rotating…" : "Get a new view token"}
          </button>
          <button className={styles.buttonGhost} onClick={onDisconnect}>
            Disconnect
          </button>
        </div>
      </header>

      {newToken && (
        <div className={styles.modalOverlay} onClick={() => setNewToken(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.h3}>Your new view token</h3>
            <p className={styles.subtle}>
              Save this now — it will not be shown again, and your previous
              token no longer works. This session is already updated to use
              it; you'll need this if you connect from another device/browser.
            </p>
            <label className={styles.label}>
              New view token
              <input className={styles.input + " mono"} readOnly value={newToken} />
            </label>
            <div className={styles.modalActions}>
              <button className={styles.buttonPrimary} onClick={() => setNewToken(null)}>
                Done, I've saved it
              </button>
            </div>
          </div>
        </div>
      )}

      <section className={styles.section}>
        <h2 className={styles.h2}>Your risk settings</h2>
        <p className={styles.subtleSmall}>
          Fixed lot size: {overview.riskProfile?.fixedLots ?? "not set"} · Risk:reward
          ratio: {overview.riskProfile?.riskRewardRatio ?? "not set"}
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Your recent orders</h2>
        {overview.recentOrders.length === 0 ? (
          <p className={styles.subtleSmall}>No orders yet.</p>
        ) : (
          <div className={styles.memberList}>
            {overview.recentOrders.map((o) => (
              <div key={o.id} className={styles.memberRow} style={{ gridTemplateColumns: "1fr auto" }}>
                <div className={styles.memberInfo}>
                  <div className={styles.memberMeta}>{new Date(o.createdAt).toLocaleString()}</div>
                </div>
                <OrderStatusPill status={o.status} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Your transparency feed</h2>
        <p className={styles.subtleSmall}>
          Every trade explanation sent to you — win, loss, or rejected, shown the same way.
        </p>
        <div className={styles.feedList}>
          {notifications?.length === 0 && (
            <p className={styles.subtleSmall}>No notifications yet.</p>
          )}
          {notifications?.map((n) => (
            <div key={n.id} className={styles.feedRow}>
              <div className={styles.feedRowTop}>
                <span className={styles.subtleSmall}>{timeAgo(n.createdAt)}</span>
              </div>
              <p className={styles.feedMessage}>{n.message}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Your full audit trail</h2>
        <p className={styles.subtleSmall}>
          Every risk decision made for your account — why it was approved,
          rejected, or resized, and what order (if any) resulted.
        </p>
        <div className={styles.auditList}>
          {decisions?.length === 0 && (
            <p className={styles.subtle}>No decisions logged yet.</p>
          )}
          {decisions?.map((d) => (
            <div key={d.id} className={styles.auditRow}>
              <div className={styles.auditTop}>
                <span
                  className={styles.pillSmall}
                  style={{
                    borderColor: d.action === "APPROVE" ? "var(--green)" : "var(--red)",
                    color: d.action === "APPROVE" ? "var(--green)" : "var(--red)",
                  }}
                >
                  {d.action}
                </span>
                <span className={styles.subtleSmall}>{new Date(d.createdAt).toLocaleString()}</span>
              </div>
              <p className={styles.auditReason}>{d.reason}</p>
              {d.order && (
                <p className={styles.subtleSmall}>
                  Order status: <OrderStatusPill status={d.order.status} />
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function InvestorApp() {
  const [conn, setConn] = useState(() => loadInvestorConnection());

  function disconnect() {
    localStorage.removeItem("waynetrade_investor_connection");
    setConn(null);
  }

  function tokenRotated(newViewToken) {
    const updated = { ...conn, viewToken: newViewToken };
    saveInvestorConnection(updated);
    setConn(updated);
  }

  if (!conn) {
    return <InvestorConnectScreen onConnect={setConn} />;
  }

  return <InvestorDashboard conn={conn} onDisconnect={disconnect} onTokenRotated={tokenRotated} />;
}

/**
 * Hash-based routing — no router library, matching this project's minimal-
 * dependency approach. #investor is the whole investor app (its own
 * connect screen + dashboard, its own localStorage key, its own auth);
 * everything else is the existing broker/admin app. A hash route (not a
 * path route) needs no server-side rewrite rule to work on a static host.
 */
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  return hash;
}

function AdminApp() {
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

export default function App() {
  const hash = useHashRoute();
  return hash === "#investor" ? <InvestorApp /> : <AdminApp />;
}
