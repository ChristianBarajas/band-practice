import { useEffect, useState } from "react";
import { auth, db, storage } from "./firebase";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from "firebase/auth";

import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

async function saveUserProfile(user, extraData = {}) {
  if (!user) return;

  await setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      firstName: extraData.firstName || "",
      lastName: extraData.lastName || "",
      displayName:
        user.displayName ||
        `${extraData.firstName || ""} ${extraData.lastName || ""}`.trim(),
      email: user.email || "",
      photoURL: user.photoURL || "",
      updatedAt: serverTimestamp(),
      ...(extraData.isNewUser ? { createdAt: serverTimestamp() } : {}),
    },
    { merge: true }
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("home");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (loading) return <div style={styles.center}>Loading...</div>;
  if (!user) return <AuthPage />;
  if (!user.emailVerified) return <VerifyPage user={user} />;

  if (page === "createBand") {
    return <CreateBandPage user={user} goHome={() => setPage("home")} />;
  }

  return <HomePage user={user} goCreateBand={() => setPage("createBand")} />;
}

function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");

  const handleEmailAuth = async () => {
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const res = await createUserWithEmailAndPassword(auth, email, password);

        await saveUserProfile(res.user, {
          firstName: first.trim(),
          lastName: last.trim(),
          isNewUser: true,
        });

        await sendEmailVerification(res.user);
        alert("Verify your email first.");
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);

      await saveUserProfile(res.user, {
        firstName: res.user.displayName?.split(" ")[0] || "",
        lastName: res.user.displayName?.split(" ").slice(1).join(" ") || "",
        isNewUser: true,
      });
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={styles.authPage}>
      <div style={styles.darkOverlay}></div>

      <div style={styles.authContent}>
        <section style={styles.heroText}>
          <p style={styles.kicker}>NO MORE CHAOS. NO MORE GROUP CHAT HELL.</p>

          <h1 style={styles.heroTitle}>
            WELCOME
            <br />
            TO BAND
            <br />
            PRACTICE
          </h1>

          <p style={styles.heroSubtitle}>
            Create your band, see who’s free, lock in practice, and keep the
            whole crew on the same page.
          </p>
        </section>

        <section style={styles.authCard}>
          <h2 style={styles.formTitle}>
            {isLogin ? "SIGN IN" : "CREATE ACCOUNT"}
          </h2>

          {!isLogin && (
            <>
              <input
                style={styles.input}
                placeholder="First Name"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
              />

              <input
                style={styles.input}
                placeholder="Last Name"
                value={last}
                onChange={(e) => setLast(e.target.value)}
              />
            </>
          )}

          <input
            style={styles.input}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button style={styles.primaryButton} onClick={handleEmailAuth}>
            {isLogin ? "LOGIN" : "SIGN UP"}
          </button>

          <button style={styles.googleButton} onClick={handleGoogle}>
            Continue with Google
          </button>

          <p onClick={() => setIsLogin(!isLogin)} style={styles.switchText}>
            {isLogin
              ? "Need an account? Create one"
              : "Already have an account? Login"}
          </p>
        </section>
      </div>
    </div>
  );
}

function VerifyPage({ user }) {
  return (
    <div style={styles.center}>
      <div style={styles.authCard}>
        <h2 style={styles.formTitle}>VERIFY EMAIL</h2>
        <p>{user.email}</p>

        <button style={styles.primaryButton} onClick={() => signOut(auth)}>
          LOGOUT
        </button>
      </div>
    </div>
  );
}

function HomePage({ user, goCreateBand }) {
  const [bands, setBands] = useState([]);
  const [loadingBands, setLoadingBands] = useState(true);

  const loadBands = async () => {
    const q = query(
      collection(db, "bands"),
      where("memberIds", "array-contains", user.uid)
    );

    const snap = await getDocs(q);

    setBands(
      snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
    );

    setLoadingBands(false);
  };

  useEffect(() => {
    const run = async () => {
      await loadBands();
    };
  
    run();
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.darkOverlay}></div>

      <div style={styles.pageContent}>
        <div style={styles.header}>
          <div>
            <p style={styles.kicker}>YOUR CREW</p>

            <h1 style={styles.dashboardTitle}>
              Welcome,
              <br />
              {user.displayName}
            </h1>
          </div>

          <button style={styles.secondaryButton} onClick={() => signOut(auth)}>
            Logout
          </button>
        </div>

        <div style={styles.homeActions}>
          <button style={styles.primaryButton} onClick={goCreateBand}>
            + CREATE BAND
          </button>

          <button style={styles.secondaryButton}>JOIN BAND</button>
        </div>

        {loadingBands ? (
          <div style={styles.roadie}>Loading bands...</div>
        ) : bands.length === 0 ? (
          <div style={styles.roadie}>Currently a roadie 🛠️</div>
        ) : (
          <div style={styles.row}>
            {bands.map((band) => (
              <div
                key={band.id}
                style={styles.bandCard}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-8px) scale(1.02)";
                  e.currentTarget.style.boxShadow =
                    "0 0 35px rgba(255,0,0,0.25)";
                  e.currentTarget.style.border =
                    "1px solid rgba(255,255,255,0.18)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0px) scale(1)";
                  e.currentTarget.style.boxShadow =
                    "0 25px 60px rgba(0,0,0,0.75)";
                  e.currentTarget.style.border =
                    "1px solid rgba(255,255,255,0.08)";
                }}
              >
                <img src={band.logoURL} alt={band.name} style={styles.bandLogo} />

                <div style={{ padding: 22 }}>
                  <h2 style={styles.bandTitle}>{band.name}</h2>

                  <p style={styles.bandGoals}>
                    {band.goalsCompleted || 0} goals completed
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateBandPage({ user, goHome }) {
  const [bandName, setBandName] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleCreateBand = async () => {
    if (!bandName.trim()) return alert("Band name required.");
    if (!logoFile) return alert("Band logo required.");

    try {
      setSaving(true);

      const logoPath = `band-logos/${user.uid}-${Date.now()}-${logoFile.name}`;
      const logoRef = ref(storage, logoPath);

      await uploadBytes(logoRef, logoFile);
      const logoURL = await getDownloadURL(logoRef);

      const bandRef = await addDoc(collection(db, "bands"), {
        name: bandName.trim(),
        logoURL,
        logoPath,
        createdBy: user.uid,
        memberIds: [user.uid],
        goalsCompleted: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(doc(db, "users", user.uid, "bands", bandRef.id), {
        bandId: bandRef.id,
        role: "leader",
        joinedAt: serverTimestamp(),
      });

      alert("Band created!");
      goHome();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.darkOverlay}></div>

      <div style={styles.pageContent}>
        <button style={styles.backButton} onClick={goHome}>
          ← BACK
        </button>

        <div style={styles.createCard}>
          <p style={styles.kicker}>START THE MOVEMENT</p>

          <h1 style={styles.formTitle}>CREATE BAND</h1>

          <p style={styles.createSubtitle}>Start your crew. Add a name and logo.</p>

          <input
            style={styles.input}
            placeholder="Band name"
            value={bandName}
            onChange={(e) => setBandName(e.target.value)}
          />

          <input
            style={styles.input}
            type="file"
            accept="image/*"
            onChange={(e) => setLogoFile(e.target.files[0])}
          />

          <button
            style={styles.primaryButton}
            onClick={handleCreateBand}
            disabled={saving}
          >
            {saving ? "CREATING..." : "CREATE BAND"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  authPage: {
    position: "relative",
    minHeight: "100vh",
    overflow: "hidden",
    background: "#050505",
    color: "white",
  },

  darkOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at center, rgba(120,0,0,0.25), rgba(0,0,0,0.95)), linear-gradient(90deg, rgba(0,0,0,0.9), rgba(0,0,0,0.45))",
  },

  authContent: {
    position: "relative",
    zIndex: 2,
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    alignItems: "center",
    gap: 40,
    padding: "60px",
  },

  page: {
    position: "relative",
    minHeight: "100vh",
    overflow: "hidden",
    background: "#050505",
    color: "white",
  },

  pageContent: {
    position: "relative",
    zIndex: 2,
    padding: "50px",
  },

  heroText: {
    maxWidth: 720,
  },

  kicker: {
    color: "#ff2a2a",
    fontSize: 14,
    fontWeight: 900,
    letterSpacing: 2,
    marginBottom: 12,
  },

  heroTitle: {
    fontSize: "clamp(70px, 9vw, 130px)",
    lineHeight: 0.88,
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "-4px",
    textShadow: "4px 4px 0px rgba(255,0,0,0.45)",
  },

  heroSubtitle: {
    marginTop: 30,
    fontSize: 26,
    maxWidth: 620,
    lineHeight: 1.3,
    fontWeight: 700,
  },

  authCard: {
    background: "rgba(10, 10, 10, 0.84)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 25px 80px rgba(0,0,0,0.85)",
    backdropFilter: "blur(10px)",
    borderRadius: 22,
    padding: 30,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  createCard: {
    width: "100%",
    maxWidth: 520,
    margin: "90px auto",
    background: "rgba(10,10,10,0.84)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 25px 80px rgba(0,0,0,0.85)",
    backdropFilter: "blur(10px)",
    borderRadius: 22,
    padding: 34,
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },

  formTitle: {
    margin: 0,
    fontSize: 52,
    textTransform: "uppercase",
    letterSpacing: "-2px",
  },

  createSubtitle: {
    marginTop: -8,
    opacity: 0.72,
    fontWeight: 700,
  },

  input: {
    padding: "16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontSize: 15,
    outline: "none",
  },

  primaryButton: {
    padding: "16px",
    borderRadius: 12,
    border: "none",
    background: "#ff0015",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  secondaryButton: {
    padding: "14px 18px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  },

  googleButton: {
    padding: "16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "white",
    color: "#111",
    fontWeight: 900,
    cursor: "pointer",
  },

  switchText: {
    textAlign: "center",
    cursor: "pointer",
    opacity: 0.8,
    marginTop: 10,
  },

  center: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    background: "#050505",
    color: "white",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 40,
  },

  dashboardTitle: {
    margin: 0,
    fontSize: "clamp(28px, 4vw, 48px)",
    lineHeight: 0.92,
    textTransform: "uppercase",
    letterSpacing: "-3px",
    textShadow: "2px 2px 0px rgba(255,0,0,0.22)",
  },

  homeActions: {
    display: "flex",
    gap: 18,
    marginBottom: 50,
  },

  roadie: {
    marginTop: 120,
    textAlign: "center",
    fontSize: 30,
    fontWeight: 800,
    opacity: 0.7,
  },

  row: {
    display: "flex",
    gap: 24,
    overflowX: "auto",
    paddingBottom: 30,
  },

  bandCard: {
    minWidth: 320,
    background: "rgba(12,12,12,0.95)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 24,
    overflow: "hidden",
    transition: "0.25s ease",
    transform: "translateY(0px) scale(1)",
    cursor: "pointer",
    boxShadow: "0 25px 60px rgba(0,0,0,0.75)",
  },

  bandLogo: {
    width: "100%",
    height: 260,
    objectFit: "contain",
    padding: 28,
    background: "rgba(255,255,255,0.03)",
    filter: "invert(1) brightness(1.5)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },

  bandTitle: {
    margin: 0,
    fontSize: 40,
    textTransform: "uppercase",
    letterSpacing: "-2px",
  },

  bandGoals: {
    marginTop: 14,
    opacity: 0.72,
    fontWeight: 700,
  },

  backButton: {
    background: "transparent",
    color: "white",
    border: "none",
    fontSize: 22,
    fontWeight: 900,
    cursor: "pointer",
  },
};