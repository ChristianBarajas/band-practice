import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from "firebase/auth";

import { doc, setDoc, serverTimestamp } from "firebase/firestore";

async function saveUserProfile(user, extraData = {}) {
  if (!user) return;

  const userRef = doc(db, "users", user.uid);

  const profileData = {
    displayName:
      user.displayName ||
      `${extraData.firstName || ""} ${extraData.lastName || ""}`.trim(),
    email: user.email || "",
    photoURL: user.photoURL || "",
    updatedAt: serverTimestamp(),
  };

  if (extraData.firstName) profileData.firstName = extraData.firstName;
  if (extraData.lastName) profileData.lastName = extraData.lastName;
  if (extraData.isNewUser) profileData.createdAt = serverTimestamp();

  await setDoc(userRef, profileData, { merge: true });
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        await saveUserProfile(currentUser);
      }

      setUser(currentUser);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (loading) return <div style={styles.center}>Loading...</div>;
  if (!user) return <AuthPage />;
  if (!user.emailVerified) return <VerifyPage user={user} />;

  return <HomePage />;
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
        alert("Check your email to verify!");
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
        isNewUser: true,
      });
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={styles.authPage}>
      <div style={styles.videoGrid}>
        <video style={styles.bgVideo} autoPlay loop muted playsInline src="/videos/bg-1.mp4" />
        <video style={styles.bgVideo} autoPlay loop muted playsInline src="/videos/bg-2.mp4" />
        <video style={styles.bgVideo} autoPlay loop muted playsInline src="/videos/bg-3.mp4" />
        <video style={styles.bgVideo} autoPlay loop muted playsInline src="/videos/bg-4.mp4" />
      </div>

      <div style={styles.vhsOverlay}></div>
      <div style={styles.darkOverlay}></div>

      <div style={styles.authContent}>
        <section style={styles.heroText}>
          <p style={styles.kicker}>NO MORE CHAOS. NO MORE GROUP CHAT HELL.</p>
          <h1 style={styles.heroTitle}>Welcome to Band Practice</h1>
          <p style={styles.heroSubtitle}>
            Finally, setting up a practice schedule with your bandmates doesn’t
            have to feel like booking a world tour.
          </p>
          <p style={styles.heroSmall}>
            Create your band, see who’s free, lock in practice, and keep the
            whole crew on the same page.
          </p>
        </section>

        <section style={styles.authCard}>
          <h2 style={styles.formTitle}>{isLogin ? "Sign in" : "Join the crew"}</h2>
          <p style={styles.formSubtitle}>
            {isLogin
              ? "Get back to your bands."
              : "Create your account and start organizing practice."}
          </p>

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
            {isLogin ? "Login" : "Sign Up"}
          </button>

          <button style={styles.googleButton} onClick={handleGoogle}>
            Continue with Google
          </button>

          <p onClick={() => setIsLogin(!isLogin)} style={styles.switchText}>
            {isLogin ? "Need an account? Create one" : "Already have an account? Login"}
          </p>
        </section>
      </div>
    </div>
  );
}

function VerifyPage({ user }) {
  return (
    <div style={styles.center}>
      <div style={styles.card}>
        <h2>Verify your email</h2>
        <p>{user.email}</p>
        <p>Check your inbox before continuing.</p>
        <button onClick={() => signOut(auth)}>Log out</button>
      </div>
    </div>
  );
}

function HomePage() {
  const [bands] = useState([]);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2>Welcome</h2>
        <button onClick={() => signOut(auth)}>Logout</button>
      </div>

      <button style={styles.plus}>+</button>

      {bands.length === 0 ? (
        <div style={styles.roadie}>Currently a roadie 🛠️</div>
      ) : (
        <div style={styles.row}>
          {bands.map((band, index) => (
            <div key={index} style={styles.bandCard}>
              {band.name}
            </div>
          ))}
        </div>
      )}
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
  videoGrid: {
    position: "absolute",
    inset: 0,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gridTemplateRows: "1fr 1fr",
    opacity: 0.42,
    filter: "grayscale(1) contrast(1.8) saturate(0.6)",
  },
  bgVideo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  darkOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at center, rgba(120,0,0,0.25), rgba(0,0,0,0.9)), linear-gradient(90deg, rgba(0,0,0,0.85), rgba(0,0,0,0.35))",
  },
  vhsOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 4px)",
    mixBlendMode: "overlay",
    opacity: 0.5,
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
  heroText: {
    maxWidth: 720,
  },
  kicker: {
    color: "#ff2a2a",
    fontSize: 14,
    fontWeight: 900,
    letterSpacing: 2,
  },
  heroTitle: {
    fontSize: "clamp(48px, 8vw, 110px)",
    lineHeight: 0.9,
    margin: "10px 0",
    textTransform: "uppercase",
    letterSpacing: "-4px",
    textShadow: "4px 4px 0px rgba(255,0,0,0.45)",
  },
  heroSubtitle: {
    fontSize: 24,
    maxWidth: 620,
    lineHeight: 1.3,
    fontWeight: 700,
  },
  heroSmall: {
    maxWidth: 520,
    opacity: 0.8,
    lineHeight: 1.6,
  },
  authCard: {
    background: "rgba(10, 10, 10, 0.82)",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 20px 80px rgba(0,0,0,0.75)",
    backdropFilter: "blur(10px)",
    borderRadius: 18,
    padding: 28,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  formTitle: {
    margin: 0,
    fontSize: 34,
    textTransform: "uppercase",
  },
  formSubtitle: {
    marginTop: -4,
    marginBottom: 10,
    opacity: 0.75,
  },
  input: {
    padding: "14px 15px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontSize: 15,
    outline: "none",
  },
  primaryButton: {
    padding: "14px 15px",
    borderRadius: 10,
    border: "none",
    background: "#e50914",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    textTransform: "uppercase",
  },
  googleButton: {
    padding: "14px 15px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "white",
    color: "#111",
    fontWeight: 800,
    cursor: "pointer",
  },
  switchText: {
    textAlign: "center",
    cursor: "pointer",
    opacity: 0.8,
  },
  page: {
    padding: 20,
    background: "#121212",
    minHeight: "100vh",
    color: "white",
  },
  center: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    background: "#121212",
    color: "white",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 20,
    background: "#1a1a1a",
    borderRadius: 10,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  plus: {
    position: "fixed",
    top: 20,
    left: 20,
    fontSize: 30,
    padding: "5px 12px",
  },
  roadie: {
    marginTop: 100,
    textAlign: "center",
    fontSize: 20,
    opacity: 0.7,
  },
  row: {
    display: "flex",
    gap: 10,
    overflowX: "auto",
    marginTop: 20,
  },
  bandCard: {
    minWidth: 150,
    padding: 20,
    background: "#1a1a1a",
    borderRadius: 10,
  },
};