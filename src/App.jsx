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

///////////////////////////////////////////////////////////
// 🔥 SAVE USER TO FIRESTORE
///////////////////////////////////////////////////////////

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

  // Only save first/last name if we actually have values.
  // This prevents login/auth refresh from overwriting them with blanks.
  if (extraData.firstName) {
    profileData.firstName = extraData.firstName;
  }

  if (extraData.lastName) {
    profileData.lastName = extraData.lastName;
  }

  // Only set createdAt on first creation attempt.
  if (extraData.isNewUser) {
    profileData.createdAt = serverTimestamp();
  }

  await setDoc(userRef, profileData, { merge: true });
}

///////////////////////////////////////////////////////////
// 🚀 APP ROOT
///////////////////////////////////////////////////////////

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        await saveUserProfile(u);
      }

      setUser(u);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (loading) return <div style={styles.center}>Loading...</div>;

  if (!user) return <AuthPage />;

  if (!user.emailVerified) return <VerifyPage user={user} />;

  return <HomePage user={user} />;
}

///////////////////////////////////////////////////////////
// 🔐 AUTH PAGE
///////////////////////////////////////////////////////////

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
    <div style={styles.center}>
      <div style={styles.card}>
        <h1>Band Practice 🎸</h1>

        {!isLogin && (
          <>
            <input
              placeholder="First Name"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
            />
            <input
              placeholder="Last Name"
              value={last}
              onChange={(e) => setLast(e.target.value)}
            />
          </>
        )}

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button onClick={handleEmailAuth}>
          {isLogin ? "Login" : "Sign Up"}
        </button>

        <button onClick={handleGoogle}>Continue with Google</button>

        <p onClick={() => setIsLogin(!isLogin)} style={{ cursor: "pointer" }}>
          {isLogin ? "Create account" : "Already have an account?"}
        </p>
      </div>
    </div>
  );
}

///////////////////////////////////////////////////////////
// 📧 VERIFY EMAIL
///////////////////////////////////////////////////////////

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

///////////////////////////////////////////////////////////
// 🏠 HOME PAGE
///////////////////////////////////////////////////////////

function HomePage({ user }) {
  const [bands, setBands] = useState([]);

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
          {bands.map((b, i) => (
            <div key={i} style={styles.bandCard}>
              {b.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

///////////////////////////////////////////////////////////
// 🎨 STYLES
///////////////////////////////////////////////////////////

const styles = {
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