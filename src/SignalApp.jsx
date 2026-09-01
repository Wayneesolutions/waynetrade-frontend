import { useState, useEffect, useCallback } from "react";
import styles from "./App.module.css";

/**
 * Saaf Signal's forecast engine, brought into this dashboard as one product
 * surface — this used to be a separate static site (saaf-signal-frontend)
 * calling a separate backend (saaf-signal-backend); both are now absorbed
 * into waynetrade-backend/-frontend (see docs/HANDOVER.md). The three
 * views below (Checker, Truth Board, Watchlist) are a direct port of that
 * site's functionality onto the same React shell as the rest of this app.
 *
 * Deliberately mounted in the BROKER dashboard only, not the investor
 * view — see docs/RA_RIA_DECISION_SUPPORT.md: surfacing a forward-looking
 * buy/sell-shaped call directly to a retail investor is the RA-registration
 * trigger this codebase otherwise avoids. Keep it that way unless that
 * document's guidance changes.
 *
 * HONEST GAP: the standalone chat.html page's free-form conversational UI
 * was not ported — the Checker view below already surfaces the same
 * plain-English explain() output chat.html used, just not as a back-and-
 * forth chat thread.
 */

async function signalFetch(baseUrl, path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

function TruthBoard({ conn }) {
  const [trackRecord, setTrackRecord] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    Promise.all([
      signalFetch(conn.baseUrl, "/track-record"),
      signalFetch(conn.baseUrl, "/predictions?limit=20"),
    ])
      .then(([tr, preds]) => {
        setTrackRecord(tr);
        setPredictions(preds);
      })
      .catch((err) => setError(err.message));
  }, [conn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div>
      <p className={styles.subtleSmall}>
        Every call — hit or miss — stays on this board permanently. We don't
        delete the losers; that's what makes the confidence score honest.
      </p>
      {error && <p className={styles.errorText}>{error}</p>}
      {trackRecord && (
        <div className={styles.sectionHeaderRow}>
          <div>
            <strong className="mono" style={{ fontSize: "1.3rem" }}>
              {trackRecord.accuracyPct != null ? `${trackRecord.accuracyPct}%` : "—"}
            </strong>{" "}
            <span className={styles.subtleSmall}>
              {trackRecord.totalChecked
                ? `accuracy across ${trackRecord.totalChecked} checked calls (${trackRecord.correct} hit, ${trackRecord.incorrect} miss)`
                : "no calls resolved yet"}
            </span>
          </div>
          <button className={styles.buttonGhost} onClick={refresh}>
            Refresh
          </button>
        </div>
      )}
      <div className={styles.memberList} style={{ marginTop: 12 }}>
        {predictions?.length === 0 && (
          <p className={styles.subtleSmall}>No calls logged yet — check a ticker below to make the first one.</p>
        )}
        {predictions?.map((p) => {
          const tag = !p.outcomeChecked ? "PENDING" : p.directionCorrect ? "HIT" : "MISS";
          const tagColor = !p.outcomeChecked ? "var(--amber)" : p.directionCorrect ? "var(--green)" : "var(--red)";
          return (
            <div key={p.id} className={styles.memberRow} style={{ gridTemplateColumns: "1fr auto auto auto" }}>
              <div className={styles.memberInfo}>
                <div className={styles.memberName}>{p.ticker}</div>
                <div className={styles.memberMeta}>{p.technicalDirection} · {new Date(p.createdAt).toLocaleDateString()}</div>
              </div>
              <span className={styles.pillSmall} style={{ borderColor: tagColor, color: tagColor }}>
                {tag}
              </span>
              <span className="mono">{p.outcomeChecked ? `${p.priceErrorPct >= 0 ? "+" : ""}${p.priceErrorPct}%` : "—"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Checker({ conn, onLogged }) {
  const [ticker, setTicker] = useState("RELIANCE.NS");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plain, setPlain] = useState(null);
  const [tech, setTech] = useState(null);

  async function runChecker() {
    if (!ticker.trim()) return;
    setLoading(true);
    setError("");
    setPlain(null);
    setTech(null);
    try {
      const [plainRes, techRes] = await Promise.all([
        signalFetch(conn.baseUrl, `/predict/${encodeURIComponent(ticker.trim())}/explain`, { method: "POST" }),
        signalFetch(conn.baseUrl, `/predict/${encodeURIComponent(ticker.trim())}`, { method: "POST" }),
      ]);
      setPlain(plainRes);
      setTech(techRes);
      onLogged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className={styles.subtleSmall}>
        Same underlying historical-backtest signal, shown two ways. Try RELIANCE.NS, TCS.NS, or AAPL.
        Each check logs a permanent, trackable call on the Truth Board — this isn't a free preview.
      </p>
      <div className={styles.form} style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        <input
          className={styles.input}
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="e.g. RELIANCE.NS"
        />
        <button className={styles.buttonPrimary} onClick={runChecker} disabled={loading}>
          {loading ? "Checking…" : "Check signal"}
        </button>
      </div>
      {error && <p className={styles.errorText}>{error}</p>}
      {plain && tech && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className={styles.card}>
            <div className={styles.eyebrow}>Plain-language view</div>
            <p>{plain.answer}</p>
          </div>
          <div className={styles.card}>
            <div className={styles.eyebrow}>
              Technical view · {tech.horizonDays}D horizon · {tech.reliabilityTier}
            </div>
            <p>
              <strong>{tech.technicalDirection.toUpperCase()}</strong> · ₹{tech.priceAtPrediction}
            </p>
            <p className={styles.subtleSmall}>
              {tech.nSamples ?? "?"} historical setup matches · {tech.technicalConfidence}% confidence · range ₹
              {tech.predictedLow}–₹{tech.predictedHigh}
            </p>
            <p className={styles.subtleSmall}>{tech.technicalBasis}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Watchlist({ conn }) {
  const [items, setItems] = useState(null);
  const [newTicker, setNewTicker] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    signalFetch(conn.baseUrl, "/watchlist").then(setItems).catch((err) => setError(err.message));
  }, [conn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function add() {
    if (!newTicker.trim()) return;
    try {
      await signalFetch(conn.baseUrl, `/watchlist/${encodeURIComponent(newTicker.trim())}`, { method: "POST" });
      setNewTicker("");
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(ticker) {
    try {
      await signalFetch(conn.baseUrl, `/watchlist/${encodeURIComponent(ticker)}`, { method: "DELETE" });
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <p className={styles.subtleSmall}>Tickers the broker is watching for a nightly scan.</p>
      <div className={styles.form} style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        <input
          className={styles.input}
          value={newTicker}
          onChange={(e) => setNewTicker(e.target.value)}
          placeholder="Add a ticker, e.g. TCS.NS"
        />
        <button className={styles.buttonPrimary} onClick={add}>
          Add
        </button>
      </div>
      {error && <p className={styles.errorText}>{error}</p>}
      <div className={styles.memberList}>
        {items?.length === 0 && <p className={styles.subtleSmall}>Nothing tracked yet.</p>}
        {items?.map((w) => (
          <div key={w.ticker} className={styles.memberRow} style={{ gridTemplateColumns: "1fr auto" }}>
            <div className="mono">{w.ticker}{w.displayName ? ` — ${w.displayName}` : ""}</div>
            <button className={styles.buttonSmallDanger} onClick={() => remove(w.ticker)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SignalSection({ conn }) {
  const [tab, setTab] = useState("checker");

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeaderRow}>
        <div>
          <h2 className={styles.h2}>Saaf Signal — forecast engine</h2>
          <p className={styles.subtleSmall}>
            An honest, verifiable stock forecast — confidence comes from a
            checkable historical hit rate, never invented.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["checker", "truth-board", "watchlist"].map((t) => (
            <button
              key={t}
              className={tab === t ? styles.buttonPrimary : styles.buttonGhost}
              onClick={() => setTab(t)}
            >
              {t === "checker" ? "Check a ticker" : t === "truth-board" ? "Truth board" : "Watchlist"}
            </button>
          ))}
        </div>
      </div>
      {tab === "checker" && <Checker conn={conn} />}
      {tab === "truth-board" && <TruthBoard conn={conn} />}
      {tab === "watchlist" && <Watchlist conn={conn} />}
    </section>
  );
}
