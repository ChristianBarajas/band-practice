import { useMemo, useState } from "react";

const SCREENS = {
  LANDING: "LANDING",
  LOGIN: "LOGIN",
  SIGNUP: "SIGNUP",
  BAND_SETUP: "BAND_SETUP",
  HOME: "HOME",
  AVAILABILITY: "AVAILABILITY",
  DECLARE: "DECLARE",
  NOTIFS: "NOTIFS",
  HISTORY: "HISTORY",
  PROFILE: "PROFILE",
};

const days = ["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"];

function App() {
  const [screen, setScreen] = useState(SCREENS.LANDING);
  const [history, setHistory] = useState([]);

  const [user, setUser] = useState(null);
  const [band, setBand] = useState(null);
  const [availability, setAvailability] = useState(() =>
    Object.fromEntries(days.map((d) => [d, { status: "gray" }]))
  );

  const submittedCount = useMemo(() => {
    return Object.values(availability).filter((v) => v.status !== "gray").length;
  }, [availability]);

  const goTo = (to) => {
    setHistory((prev) => [...prev, screen]);
    setScreen(to);
  };

  const replaceTo = (to) => {
    setScreen(to);
  };

  const goBack = (fallback = SCREENS.LANDING) => {
    setHistory((prev) => {
      if (prev.length === 0) {
        setScreen(fallback);
        return prev;
      }
      const next = [...prev];
      const last = next.pop();
      setScreen(last ?? fallback);
      return next;
    });
  };

  const resetAndGo = (to) => {
    setHistory([]);
    setScreen(to);
  };

  const shell = (content, title) => (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={styles.logo}>🎸</div>
          <div>
            <div style={styles.hTitle}>{title}</div>
            <div style={styles.subtle}>{band?.name ? band.name : "Band Practice"}</div>
          </div>
        </div>

        {user ? (
          <button style={styles.ghostBtn} onClick={() => goTo(SCREENS.PROFILE)}>
            {user.symbol}
          </button>
        ) : (
          <div style={{ width: 40, height: 40 }} />
        )}
      </header>

      <main style={styles.main}>{content}</main>

      {user && band ? (
        <nav style={styles.bottomNav}>
          <NavBtn label="Home" onClick={() => replaceTo(SCREENS.HOME)} active={screen === SCREENS.HOME} />
          <NavBtn label="Week" onClick={() => replaceTo(SCREENS.AVAILABILITY)} active={screen === SCREENS.AVAILABILITY} />
          <NavBtn label="Notifs" onClick={() => replaceTo(SCREENS.NOTIFS)} active={screen === SCREENS.NOTIFS} />
          <NavBtn label="History" onClick={() => replaceTo(SCREENS.HISTORY)} active={screen === SCREENS.HISTORY} />
        </nav>
      ) : null}
    </div>
  );

  if (screen === SCREENS.LANDING) {
    return shell(
      <section style={styles.heroWrap}>
        <div style={styles.heroCard}>
          <h1 style={styles.heroTitle}>Band Practice</h1>
          <p style={styles.heroText}>
            Set weekly availability, find overlaps, declare practice, and keep your band on the same page.
          </p>

          <div style={styles.heroActions}>
            <button style={styles.primaryBtn} onClick={() => goTo(SCREENS.SIGNUP)}>
              Sign Up
            </button>
            <button style={styles.secondaryBtn} onClick={() => goTo(SCREENS.LOGIN)}>
              Log In
            </button>
          </div>

          <div style={styles.miniNote}>UI prototype mode (no Firebase yet).</div>
        </div>
      </section>,
      "Welcome"
    );
  }

  if (screen === SCREENS.SIGNUP) {
    return shell(
      <SignupScreen
        onBack={() => goBack(SCREENS.LANDING)}
        onDone={(newUser) => {
          setUser(newUser);
          goTo(SCREENS.BAND_SETUP);
        }}
      />,
      "Sign Up"
    );
  }

  if (screen === SCREENS.LOGIN) {
    return shell(
      <LoginScreen
        onBack={() => goBack(SCREENS.LANDING)}
        onDone={() => {
          setUser({
            name: "Christian",
            instrument: "Guitar",
            symbol: "C",
            isLeader: true,
          });
          goTo(SCREENS.BAND_SETUP);
        }}
      />,
      "Log In"
    );
  }

  if (screen === SCREENS.BAND_SETUP) {
    return shell(
      <BandSetupScreen
        onBack={() => goBack(SCREENS.LANDING)}
        onDoneCreate={(name) => {
          setBand({ name });
          resetAndGo(SCREENS.HOME);
        }}
        onDoneJoin={(name) => {
          setBand({ name });
          resetAndGo(SCREENS.HOME);
        }}
      />,
      "Band Setup"
    );
  }

  if (screen === SCREENS.HOME) {
    return shell(
      <HomeScreen
        user={user}
        band={band}
        submittedCount={submittedCount}
        availability={availability}
        onUpdateWeek={() => goTo(SCREENS.AVAILABILITY)}
        onDeclare={() => goTo(SCREENS.DECLARE)}
      />,
      "Home"
    );
  }

  if (screen === SCREENS.AVAILABILITY) {
    return shell(
      <AvailabilityScreen availability={availability} setAvailability={setAvailability} />,
      "This Week"
    );
  }

  if (screen === SCREENS.DECLARE) {
    return shell(
      <DeclarePracticeScreen
        onBack={() => goBack(SCREENS.HOME)}
        onConfirm={() => replaceTo(SCREENS.NOTIFS)}
      />,
      "Declare Practice"
    );
  }

  if (screen === SCREENS.NOTIFS) {
    return shell(<NotifsScreen />, "Notifications");
  }

  if (screen === SCREENS.HISTORY) {
    return shell(<HistoryScreen />, "History");
  }

  if (screen === SCREENS.PROFILE) {
    return shell(
      <ProfileScreen
        user={user}
        onBack={() => goBack(SCREENS.HOME)}
        onLogout={() => {
          setUser(null);
          setBand(null);
          setAvailability(Object.fromEntries(days.map((d) => [d, { status: "gray" }])));
          resetAndGo(SCREENS.LANDING);
        }}
      />,
      "Profile"
    );
  }

  return null;
}

function NavBtn({ label, onClick, active }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.navBtn,
        opacity: active ? 1 : 0.75,
        borderColor: active ? "#555" : "transparent",
        background: active ? "#222" : "#171717",
      }}
    >
      {label}
    </button>
  );
}

function SignupScreen({ onBack, onDone }) {
  const [name, setName] = useState("");
  const [instrument, setInstrument] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [symbol, setSymbol] = useState("");

  const autoSymbol = (val) => (val?.trim()?.[0] || "").toUpperCase();

  return (
    <div style={styles.centerStage}>
      <div style={styles.cardWide}>
        <h2 style={styles.h2}>Create your account</h2>
        <p style={styles.p}>This is still prototype mode, but the flow works like a real app.</p>

        <Field label="Name" value={name} onChange={(v) => {
          setName(v);
          if (!symbol) setSymbol(autoSymbol(v));
        }} placeholder="Christian" />
        <Field label="Instrument" value={instrument} onChange={setInstrument} placeholder="Guitar" />
        <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" />
        <Field label="Phone" value={phone} onChange={setPhone} placeholder="(555) 555-5555" />
        <Field label="Symbol" value={symbol} onChange={(v) => setSymbol(v.slice(0, 1).toUpperCase())} placeholder="C" />

        <div style={styles.actionRow}>
          <button
            style={styles.primaryBtn}
            onClick={() =>
              onDone({
                name: name || "Christian",
                instrument: instrument || "Guitar",
                email,
                phone,
                symbol: symbol || autoSymbol(name) || "C",
                isLeader: true,
              })
            }
          >
            Continue
          </button>
          <button style={styles.secondaryBtn} onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ onBack, onDone }) {
  return (
    <div style={styles.centerStage}>
      <div style={styles.cardWide}>
        <h2 style={styles.h2}>Welcome back</h2>
        <p style={styles.p}>UI prototype: press Log In to continue.</p>

        <div style={styles.actionRow}>
          <button style={styles.primaryBtn} onClick={onDone}>
            Log In
          </button>
          <button style={styles.secondaryBtn} onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

function BandSetupScreen({ onBack, onDoneCreate, onDoneJoin }) {
  const [bandName, setBandName] = useState("");

  return (
    <div style={styles.centerStage}>
      <div style={styles.cardWide}>
        <h2 style={styles.h2}>Band Setup</h2>
        <p style={styles.p}>Create a new band or join one by name.</p>

        <Field label="Band Name" value={bandName} onChange={setBandName} placeholder="Lamassü" />

        <div style={styles.actionGrid}>
          <button style={styles.primaryBtn} onClick={() => onDoneCreate(bandName || "Lamassü")}>
            Create Band
          </button>
          <button style={styles.secondaryBtn} onClick={() => onDoneJoin(bandName || "Lamassü")}>
            Join Band
          </button>
          <button style={styles.secondaryBtn} onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

function HomeScreen({ user, band, submittedCount, availability, onUpdateWeek, onDeclare }) {
  return (
    <div style={styles.stack}>
      <div style={styles.grid2}>
        <div style={styles.card}>
          <h2 style={styles.h2}>Welcome{user?.name ? `, ${user.name}` : ""}</h2>
          <p style={styles.p}>{band?.name || "Your band"} is ready. Track availability and lock in practice.</p>
          <div style={styles.actionGrid}>
            <button style={styles.primaryBtn} onClick={onUpdateWeek}>Update Week</button>
            <button style={styles.secondaryBtn} onClick={onDeclare}>Declare Practice</button>
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.h2}>This Week</h2>
          <div style={{ ...styles.row, marginTop: 12 }}>
            <span>Submitted days</span>
            <strong>{submittedCount} / 7</strong>
          </div>
          <div style={{ ...styles.row, marginTop: 8 }}>
            <span>Leader</span>
            <strong>{user?.isLeader ? "Yes" : "No"}</strong>
          </div>
          <div style={{ ...styles.row, marginTop: 8 }}>
            <span>Band</span>
            <strong>{band?.name || "—"}</strong>
          </div>
        </div>
      </div>

      <MiniWeekPreview availability={availability} />
      <Legend />
    </div>
  );
}

function AvailabilityScreen({ availability, setAvailability }) {
  const setDay = (day, next) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: next,
    }));
  };

  return (
    <div style={styles.stack}>
      <div style={styles.card}>
        <h2 style={styles.h2}>Weekly Availability</h2>
        <p style={styles.p}>Mark each day as available, partially available, unavailable, or not submitted.</p>
      </div>

      <div style={styles.daysGrid}>
        {days.map((day) => (
          <DayCard key={day} day={day} data={availability[day]} onChange={(next) => setDay(day, next)} />
        ))}
      </div>
    </div>
  );
}

function DayCard({ day, data, onChange }) {
  const status = data?.status || "gray";

  const bg =
    status === "green"
      ? "rgba(52, 199, 89, 0.12)"
      : status === "yellow"
      ? "rgba(255, 204, 0, 0.12)"
      : status === "red"
      ? "rgba(255, 59, 48, 0.12)"
      : "#1a1a1a";

  let label = "Not submitted yet";
  if (status === "green") label = "Available all day";
  if (status === "yellow") label = `${data?.start || "8am"} – ${data?.end || "3pm"}`;
  if (status === "red") label = "Not available";

  return (
    <div style={{ ...styles.day, background: bg }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <strong>{day}</strong>
        <span style={styles.tag}>{status.toUpperCase()}</span>
      </div>

      <div style={{ marginTop: 10, fontSize: 14, opacity: 0.9 }}>{label}</div>

      <div style={styles.emojiRow}>
        <button style={styles.smallBtn} onClick={() => onChange({ status: "green" })}>🟩</button>
        <button style={styles.smallBtn} onClick={() => onChange({ status: "yellow", start: "8am", end: "3pm" })}>🟨</button>
        <button style={styles.smallBtn} onClick={() => onChange({ status: "red" })}>🟥</button>
        <button style={styles.smallBtn} onClick={() => onChange({ status: "gray" })}>⬜</button>
      </div>
    </div>
  );
}

function DeclarePracticeScreen({ onBack, onConfirm }) {
  return (
    <div style={styles.centerStage}>
      <div style={styles.cardWide}>
        <h2 style={styles.h2}>Declare Practice</h2>
        <p style={styles.p}>Later this will only allow times that match actual member overlap.</p>

        <div style={styles.actionRow}>
          <button style={styles.primaryBtn} onClick={onConfirm}>Confirm Practice</button>
          <button style={styles.secondaryBtn} onClick={onBack}>Back</button>
        </div>
      </div>
    </div>
  );
}

function NotifsScreen() {
  return (
    <div style={styles.stack}>
      <div style={styles.card}>
        <h2 style={styles.h2}>Notifications</h2>
        <div style={styles.notif}>🔔 You haven't submitted availability for every day yet.</div>
        <div style={styles.notif}>🤝 3 members overlap Thu 7–10pm (prototype).</div>
        <div style={styles.notif}>📣 Official practice: Sun 2–5pm (prototype).</div>
        <div style={styles.notif}>👀 Can you make this practice, bro?</div>
      </div>
    </div>
  );
}

function HistoryScreen() {
  return (
    <div style={styles.stack}>
      <div style={styles.card}>
        <h2 style={styles.h2}>Practice History</h2>
        <p style={styles.p}>Later: list of past practices and attendance.</p>
        <div style={styles.notif}>✅ Jan 10 — 6–9pm — 4 attended</div>
        <div style={styles.notif}>✅ Jan 03 — 7–10pm — 3 attended</div>
      </div>
    </div>
  );
}

function ProfileScreen({ user, onBack, onLogout }) {
  return (
    <div style={styles.centerStage}>
      <div style={styles.cardWide}>
        <h2 style={styles.h2}>Profile</h2>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <div style={styles.row}>
            <span>Name</span>
            <strong>{user?.name || "—"}</strong>
          </div>
          <div style={styles.row}>
            <span>Instrument</span>
            <strong>{user?.instrument || "—"}</strong>
          </div>
          <div style={styles.row}>
            <span>Symbol</span>
            <strong>{user?.symbol || "—"}</strong>
          </div>
        </div>

        <div style={styles.actionRow}>
          <button style={styles.secondaryBtn} onClick={onBack}>Back</button>
          <button style={styles.primaryBtn} onClick={onLogout}>Log Out</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label style={{ display: "grid", gap: 6, marginTop: 12 }}>
      <span style={styles.label}>{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={styles.input}
      />
    </label>
  );
}

function Legend() {
  return (
    <div style={styles.card}>
      <h2 style={styles.h2}>Legend</h2>
      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        <div>🟩 Available all day</div>
        <div>🟨 Partially available</div>
        <div>🟥 Not available</div>
        <div>⬜ Not submitted yet</div>
      </div>
    </div>
  );
}

function MiniWeekPreview({ availability }) {
  return (
    <div style={styles.card}>
      <h2 style={styles.h2}>Week Preview</h2>
      <div style={styles.pillsWrap}>
        {days.map((d) => (
          <span key={d} style={styles.pill}>
            {d}: {availability[d]?.status || "gray"}
          </span>
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    background: "#121212",
    color: "#eee",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },
  header: {
    minHeight: 70,
    padding: "14px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #222",
    position: "sticky",
    top: 0,
    background: "#121212",
    zIndex: 10,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    background: "#1c1c1c",
  },
  hTitle: { fontSize: 16, fontWeight: 700 },
  subtle: { fontSize: 12, opacity: 0.7 },

  main: {
    width: "100%",
    minHeight: "calc(100vh - 70px)",
    padding: "18px 18px 96px",
    boxSizing: "border-box",
  },

  heroWrap: {
    minHeight: "calc(100vh - 184px)",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    width: "100%",
    maxWidth: 1100,
    minHeight: 420,
    background: "#1a1a1a",
    border: "1px solid #252525",
    borderRadius: 24,
    padding: 28,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    boxSizing: "border-box",
  },
  heroTitle: {
    margin: 0,
    fontSize: "clamp(2.5rem, 6vw, 5rem)",
    lineHeight: 1,
    letterSpacing: -1.5,
  },
  heroText: {
    marginTop: 16,
    fontSize: 18,
    lineHeight: 1.5,
    opacity: 0.86,
    maxWidth: 760,
  },
  heroActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    width: "100%",
    marginTop: 24,
  },

  centerStage: {
    width: "100%",
    minHeight: "calc(100vh - 184px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  stack: {
    display: "grid",
    gap: 16,
    width: "100%",
  },

  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 16,
    width: "100%",
  },

  daysGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
    width: "100%",
  },

  bottomNav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8,
    padding: 10,
    borderTop: "1px solid #222",
    background: "#121212",
  },
  navBtn: {
    padding: "12px 10px",
    borderRadius: 12,
    border: "1px solid transparent",
    background: "#1a1a1a",
    color: "#eee",
    fontWeight: 700,
    cursor: "pointer",
  },

  card: {
    background: "#1a1a1a",
    border: "1px solid #252525",
    borderRadius: 18,
    padding: 18,
    width: "100%",
    boxSizing: "border-box",
  },
  cardWide: {
    background: "#1a1a1a",
    border: "1px solid #252525",
    borderRadius: 18,
    padding: 20,
    width: "100%",
    maxWidth: 760,
    boxSizing: "border-box",
  },

  h2: { margin: 0, fontSize: 22 },
  p: { marginTop: 10, opacity: 0.85, lineHeight: 1.5 },

  label: { fontSize: 12, opacity: 0.8 },
  input: {
    padding: 14,
    borderRadius: 12,
    border: "1px solid #333",
    background: "#121212",
    color: "#eee",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },

  primaryBtn: {
    padding: 14,
    borderRadius: 12,
    border: "1px solid #3a3a3a",
    background: "#2b2b2b",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
  },
  secondaryBtn: {
    padding: 14,
    borderRadius: 12,
    border: "1px solid #333",
    background: "#171717",
    color: "#eee",
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
  },
  ghostBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "1px solid #333",
    background: "#171717",
    color: "#eee",
    fontWeight: 800,
    cursor: "pointer",
  },

  actionRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginTop: 18,
  },
  actionGrid: {
    display: "grid",
    gap: 10,
    marginTop: 16,
  },

  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "center",
  },

  miniNote: {
    marginTop: 14,
    fontSize: 12,
    opacity: 0.65,
  },

  pillsWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 12,
  },
  pill: {
    padding: "8px 10px",
    borderRadius: 999,
    background: "#151515",
    border: "1px solid #2a2a2a",
    fontSize: 13,
  },

  day: {
    border: "1px solid #2b2b2b",
    borderRadius: 16,
    padding: 16,
    boxSizing: "border-box",
  },
  tag: {
    fontSize: 11,
    letterSpacing: 0.4,
    opacity: 0.8,
    border: "1px solid #333",
    borderRadius: 999,
    padding: "5px 8px",
    background: "#111",
  },
  emojiRow: {
    display: "flex",
    gap: 8,
    marginTop: 14,
    flexWrap: "wrap",
  },
  smallBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #333",
    background: "#171717",
    color: "#fff",
    cursor: "pointer",
  },

  notif: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    background: "#151515",
    border: "1px solid #262626",
  },
};

export default App;