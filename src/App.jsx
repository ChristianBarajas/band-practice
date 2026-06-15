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
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
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

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getWednesdayWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day - 3 + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateKey(date) {
  return date.toISOString().split("T")[0];
}

function formatDayLabel(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTimeLabel(time) {
  if (!time) return "";

  const [hourString, minute] = time.split(":");
  const hour = Number(hourString);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${ampm}`;
}

function getAvailabilityWeekDays() {
  const start = getWednesdayWeekStart();

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    return {
      date: d,
      key: formatDateKey(d),
      label: formatDayLabel(d),
    };
  });
}

function addHoverLift(e) {
  e.currentTarget.style.transform = "translateY(-8px) scale(1.02)";
  e.currentTarget.style.boxShadow = "0 0 35px rgba(255,0,0,0.28)";
  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.22)";
}

function removeHoverLift(e) {
  e.currentTarget.style.transform = "translateY(0px) scale(1)";
  e.currentTarget.style.boxShadow = "0 20px 60px rgba(0,0,0,0.55)";
  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)";
}

function addButtonHover(e) {
  e.currentTarget.style.transform = "translateY(-4px) scale(1.03)";
  e.currentTarget.style.boxShadow = "0 0 22px rgba(255,0,21,0.28)";
  e.currentTarget.style.border = "1px solid rgba(255,0,21,0.55)";
}

function removeButtonHover(e) {
  e.currentTarget.style.transform = "translateY(0px) scale(1)";
  e.currentTarget.style.boxShadow = "0 14px 35px rgba(0,0,0,0.35)";
  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.16)";
}

function addInputHover(e) {
  e.currentTarget.style.border = "1px solid rgba(255,0,21,0.85)";
  e.currentTarget.style.boxShadow = "0 0 18px rgba(255,0,21,0.32)";
  e.currentTarget.style.transform = "scale(1.02)";
}

function removeInputHover(e) {
  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.16)";
  e.currentTarget.style.boxShadow = "0 0 0 rgba(255,0,0,0)";
  e.currentTarget.style.transform = "scale(1)";
}

function getSharedAvailability(bandAvailability, weekDays) {
  const results = [];

  weekDays.forEach((day) => {
    const slotMap = {};

    bandAvailability.forEach((member) => {
      const dayData = member.days?.[day.key];

      if (!dayData?.available || !dayData?.slots?.length) return;

      dayData.slots.forEach((slot) => {
        const slotKey = `${slot.start}-${slot.end}`;

        if (!slotMap[slotKey]) {
          slotMap[slotKey] = {
            dayKey: day.key,
            dayLabel: day.label,
            start: slot.start,
            end: slot.end,
            members: [],
          };
        }

        slotMap[slotKey].members.push(
          member.displayName || member.email || "Member"
        );
      });
    });

    Object.values(slotMap).forEach((slot) => {
      if (slot.members.length >= 3) {
        results.push(slot);
      }
    });
  });

  return results;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("home");
  const [selectedBand, setSelectedBand] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const goHome = () => {
    setSelectedBand(null);
    setPage("home");
    setRefreshKey((prev) => prev + 1);
  };

  if (loading) return <div style={styles.center}>Loading...</div>;
  if (!user) return <AuthPage />;
  if (!user.emailVerified) return <VerifyPage user={user} />;

  if (page === "createBand") {
    return <CreateBandPage user={user} goHome={goHome} />;
  }

  if (page === "band" && selectedBand) {
    return <BandPage user={user} band={selectedBand} goHome={goHome} />;
  }

  return (
    <HomePage
      user={user}
      refreshKey={refreshKey}
      goCreateBand={() => setPage("createBand")}
      openBand={(band) => {
        setSelectedBand(band);
        setPage("band");
      }}
    />
  );
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

function HomePage({ user, refreshKey, goCreateBand, openBand }) {
  const [bands, setBands] = useState([]);
  const [loadingBands, setLoadingBands] = useState(true);

  const loadBands = async () => {
    try {
      setLoadingBands(true);

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
    } catch (err) {
      console.error("Error loading bands:", err);
      alert(err.message);
    } finally {
      setLoadingBands(false);
    }
  };

  useEffect(() => {
    loadBands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

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
              {user.displayName || user.email}
            </h1>
          </div>

          <button
            style={styles.secondaryButton}
            onClick={() => signOut(auth)}
            onMouseEnter={addButtonHover}
            onMouseLeave={removeButtonHover}
          >
            Logout
          </button>
        </div>

        <div style={styles.homeActions}>
          <button
            style={styles.primaryButton}
            onClick={goCreateBand}
            onMouseEnter={addButtonHover}
            onMouseLeave={removeButtonHover}
          >
            + CREATE BAND
          </button>

          <button
            style={styles.secondaryButton}
            onMouseEnter={addButtonHover}
            onMouseLeave={removeButtonHover}
          >
            JOIN BAND
          </button>
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
                onClick={() => openBand(band)}
                onMouseEnter={addHoverLift}
                onMouseLeave={removeHoverLift}
              >
                <img src={band.logoURL} alt={band.name} style={styles.bandLogo} />

                <div style={styles.bandNameCorner}>
                  <h2 style={styles.bandTitle}>{band.name}</h2>
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

      const inviteCode = generateInviteCode();

      const logoPath = `band-logos/${user.uid}-${Date.now()}-${logoFile.name}`;
      const logoRef = ref(storage, logoPath);

      await uploadBytes(logoRef, logoFile);
      const logoURL = await getDownloadURL(logoRef);

      const bandRef = await addDoc(collection(db, "bands"), {
        name: bandName.trim(),
        logoURL,
        logoPath,
        inviteCode,
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

      alert(`Band created! Invite code: ${inviteCode}`);
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
        <button
          style={styles.backButton}
          onClick={goHome}
          onMouseEnter={addButtonHover}
          onMouseLeave={removeButtonHover}
        >
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

          <label style={styles.fileLabel}>Add Band Logo / Picture</label>

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
            onMouseEnter={addButtonHover}
            onMouseLeave={removeButtonHover}
          >
            {saving ? "CREATING..." : "CREATE BAND"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BandPage({ user, band, goHome }) {
  const [view, setView] = useState("dashboard");
  const [bandName, setBandName] = useState(band.name);
  const [inviteCode, setInviteCode] = useState(band.inviteCode || "");
  const [logoFile, setLogoFile] = useState(null);
  const [currentLogoURL, setCurrentLogoURL] = useState(band.logoURL);
  const [saving, setSaving] = useState(false);

  const weekDays = getAvailabilityWeekDays();
  const weekStart = getWednesdayWeekStart();
  const weekId = formatDateKey(weekStart);

  const [selectedDay, setSelectedDay] = useState(null);
  const [availabilityDraft, setAvailabilityDraft] = useState({});
  const [bandAvailability, setBandAvailability] = useState([]);
  const [loadingBandAvailability, setLoadingBandAvailability] = useState(false);

  const sharedAvailability = getSharedAvailability(bandAvailability, weekDays);

  const loadMyAvailability = async () => {
    try {
      const ref = doc(
        db,
        "bands",
        band.id,
        "availability",
        weekId,
        "members",
        user.uid
      );

      const snap = await getDoc(ref);

      if (snap.exists()) {
        setAvailabilityDraft(snap.data().days || {});
      }
    } catch (err) {
      console.error("Error loading my availability:", err);
    }
  };

  const saveMyAvailability = async () => {
    try {
      setSaving(true);

      await setDoc(
        doc(db, "bands", band.id, "availability", weekId, "members", user.uid),
        {
          uid: user.uid,
          displayName: user.displayName || user.email,
          email: user.email || "",
          bandId: band.id,
          weekId,
          weekStart,
          days: availabilityDraft,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      alert("Availability saved!");
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const loadBandAvailability = async () => {
    try {
      setLoadingBandAvailability(true);

      const snap = await getDocs(
        collection(db, "bands", band.id, "availability", weekId, "members")
      );

      setBandAvailability(
        snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingBandAvailability(false);
    }
  };

  useEffect(() => {
    loadMyAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band.id, user.uid, weekId]);

  const handleSaveSettings = async () => {
    if (!bandName.trim()) return alert("Band name required.");

    try {
      setSaving(true);

      let updatedLogoURL = currentLogoURL;
      let updatedLogoPath = band.logoPath || "";
      let updatedInviteCode = inviteCode;

      if (!updatedInviteCode) {
        updatedInviteCode = generateInviteCode();
      }

      if (logoFile) {
        updatedLogoPath = `band-logos/${band.id}-${Date.now()}-${logoFile.name}`;
        const logoRef = ref(storage, updatedLogoPath);

        await uploadBytes(logoRef, logoFile);
        updatedLogoURL = await getDownloadURL(logoRef);
      }

      await updateDoc(doc(db, "bands", band.id), {
        name: bandName.trim(),
        logoURL: updatedLogoURL,
        logoPath: updatedLogoPath,
        inviteCode: updatedInviteCode,
        updatedAt: serverTimestamp(),
      });

      setCurrentLogoURL(updatedLogoURL);
      setInviteCode(updatedInviteCode);
      setLogoFile(null);
      setView("dashboard");

      alert("Band settings updated!");
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const dashboardSections = [
    {
      title: "Upcoming Shows",
      subtitle: "Track gigs, venues, call times, and set times.",
      value: "No shows yet",
    },
    {
      title: "My Availability",
      subtitle: "Set when you can practice this week.",
      value: Object.keys(availabilityDraft).length ? "Submitted" : "Not submitted",
    },
    {
      title: "Band Goals",
      subtitle: "EP deadlines, live show targets, recording plans.",
      value: "Coming soon",
    },
    {
      title: "Upcoming Practices",
      subtitle: "See confirmed practices and proposed jam times.",
      value: "No practices yet",
    },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.darkOverlay}></div>

      <div style={styles.pageContent}>
        <button
          style={styles.backButton}
          onClick={goHome}
          onMouseEnter={addButtonHover}
          onMouseLeave={removeButtonHover}
        >
          ← BACK TO DASHBOARD
        </button>

        {view === "dashboard" && (
          <>
            <div style={styles.bandDashboardHero}>
              <div>
                <p style={styles.kicker}>BAND DASHBOARD</p>
                <h1 style={styles.bandPageTitle}>{bandName}</h1>
              </div>

              <button
                style={styles.settingsButton}
                onClick={() => setView("settings")}
                title="Band settings"
                onMouseEnter={addButtonHover}
                onMouseLeave={removeButtonHover}
              >
                ⚙
              </button>
            </div>

            <div style={styles.bandDashboardGrid}>
              <div style={styles.logoPanel}>
                <img
                  src={currentLogoURL}
                  alt={bandName}
                  style={styles.bandPageLogo}
                />
              </div>

              <div style={styles.dashboardSectionGrid}>
                {dashboardSections.map((section) => (
                  <div
                    key={section.title}
                    style={{
                      ...styles.dashboardSectionCard,
                      cursor:
                        section.title === "My Availability" ? "pointer" : "default",
                    }}
                    onClick={() => {
                      if (section.title === "My Availability") {
                        setView("availabilityHome");
                      }
                    }}
                    onMouseEnter={addHoverLift}
                    onMouseLeave={removeHoverLift}
                  >
                    <p style={styles.sectionValue}>{section.value}</p>
                    <h2 style={styles.sectionTitle}>{section.title}</h2>
                    <p style={styles.sectionSubtitle}>{section.subtitle}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {view === "availabilityHome" && (
          <div style={styles.availabilityPage}>
            <div style={styles.settingsHeader}>
              <div>
                <p style={styles.kicker}>BAND AVAILABILITY</p>
                <h1 style={styles.bandPageTitle}>Availability</h1>
              </div>

              <button
                style={styles.secondaryButton}
                onClick={() => setView("dashboard")}
                onMouseEnter={addButtonHover}
                onMouseLeave={removeButtonHover}
              >
                BACK TO BAND
              </button>
            </div>

            <div style={styles.availabilityMenuGrid}>
              <div
                style={styles.availabilityMenuCard}
                onClick={() => setView("setAvailability")}
                onMouseEnter={addHoverLift}
                onMouseLeave={removeHoverLift}
              >
                <p style={styles.sectionValue}>THIS WEEK</p>
                <h2 style={styles.sectionTitle}>Set My Availability</h2>
                <p style={styles.sectionSubtitle}>
                  Choose the days and times you can practice this week.
                </p>
              </div>

              <div
                style={styles.availabilityMenuCard}
                onClick={async () => {
                  await loadBandAvailability();
                  setView("viewBandAvailability");
                }}
                onMouseEnter={addHoverLift}
                onMouseLeave={removeHoverLift}
              >
                <p style={styles.sectionValue}>BAND VIEW</p>
                <h2 style={styles.sectionTitle}>View Band Availability</h2>
                <p style={styles.sectionSubtitle}>
                  See when everyone else is free and find 3+ member overlaps.
                </p>
              </div>

              <div
                style={styles.availabilityMenuCard}
                onMouseEnter={addHoverLift}
                onMouseLeave={removeHoverLift}
              >
                <p style={styles.sectionValue}>LEADER TOOL</p>
                <h2 style={styles.sectionTitle}>Schedule Practice</h2>
                <p style={styles.sectionSubtitle}>
                  Coming soon: lock in a hard practice date.
                </p>
              </div>
            </div>
          </div>
        )}

        {view === "setAvailability" && (
          <div style={styles.availabilityPage}>
            <div style={styles.settingsHeader}>
              <div>
                <p style={styles.kicker}>THIS WEEK</p>
                <h1 style={styles.bandPageTitle}>Set Availability</h1>
              </div>

              <button
                style={styles.secondaryButton}
                onClick={() => setView("availabilityHome")}
                onMouseEnter={addButtonHover}
                onMouseLeave={removeButtonHover}
              >
                BACK
              </button>
            </div>

            <div style={styles.weekGrid}>
              {weekDays.map((day) => {
                const saved = availabilityDraft[day.key];

                return (
                  <div
                    key={day.key}
                    style={{
                      ...styles.dayCard,
                      border:
                        saved?.available === true
                          ? "1px solid rgba(0,255,120,0.65)"
                          : saved?.available === false
                          ? "1px solid rgba(255,0,0,0.65)"
                          : "1px solid rgba(255,255,255,0.12)",
                    }}
                    onClick={() => {
                      setSelectedDay(day);
                      setView("editDayAvailability");
                    }}
                    onMouseEnter={addHoverLift}
                    onMouseLeave={removeHoverLift}
                  >
                    <p
                      style={{
                        ...styles.sectionValue,
                        color:
                          saved?.available === true
                            ? "#00ff78"
                            : saved?.available === false
                            ? "#ff2a2a"
                            : "#ff2a2a",
                      }}
                    >
                      {saved?.available === true
                        ? "AVAILABLE"
                        : saved?.available === false
                        ? "NOT AVAILABLE"
                        : "NOT SET"}
                    </p>

                    <h2 style={styles.sectionTitle}>{day.label}</h2>

                    <p style={styles.sectionSubtitle}>
                      {saved?.slots?.length
                        ? saved.slots
                            .map(
                              (slot) =>
                                `${formatTimeLabel(slot.start)} - ${formatTimeLabel(
                                  slot.end
                                )}`
                            )
                            .join(", ")
                        : "Tap to set availability"}
                    </p>
                  </div>
                );
              })}
            </div>

            <button
              style={{ ...styles.primaryButton, marginTop: 30 }}
              onClick={saveMyAvailability}
              disabled={saving}
              onMouseEnter={addButtonHover}
              onMouseLeave={removeButtonHover}
            >
              {saving ? "SAVING..." : "SAVE WEEK"}
            </button>
          </div>
        )}

        {view === "editDayAvailability" && selectedDay && (
          <div style={styles.availabilityPage}>
            <div style={styles.settingsHeader}>
              <div>
                <p style={styles.kicker}>EDIT DAY</p>
                <h1 style={styles.bandPageTitle}>{selectedDay.label}</h1>
              </div>

              <button
                style={styles.secondaryButton}
                onClick={() => setView("setAvailability")}
                onMouseEnter={addButtonHover}
                onMouseLeave={removeButtonHover}
              >
                BACK
              </button>
            </div>

            <div style={styles.settingsPanel}>
              <button
                style={styles.primaryButton}
                onClick={() => {
                  setAvailabilityDraft((prev) => ({
                    ...prev,
                    [selectedDay.key]: {
                      available: true,
                      slots: prev[selectedDay.key]?.slots?.length
                        ? prev[selectedDay.key].slots
                        : [{ start: "10:00", end: "15:00" }],
                    },
                  }));
                }}
                onMouseEnter={addButtonHover}
                onMouseLeave={removeButtonHover}
              >
                YES, I AM AVAILABLE
              </button>

              <button
                style={styles.secondaryButton}
                onClick={() => {
                  setAvailabilityDraft((prev) => ({
                    ...prev,
                    [selectedDay.key]: {
                      available: false,
                      slots: [],
                    },
                  }));
                }}
                onMouseEnter={addButtonHover}
                onMouseLeave={removeButtonHover}
              >
                NO, I AM NOT AVAILABLE
              </button>

              {availabilityDraft[selectedDay.key]?.available && (
                <>
                  <h2 style={styles.sectionTitle}>Time Slots</h2>

                  {availabilityDraft[selectedDay.key].slots.map((slot, index) => (
                    <div key={index} style={styles.timeSlotRow}>
                      <input
                        style={styles.input}
                        type="time"
                        value={slot.start}
                        onMouseEnter={addInputHover}
                        onMouseLeave={removeInputHover}
                        onChange={(e) => {
                          setAvailabilityDraft((prev) => {
                            const slots = [...prev[selectedDay.key].slots];

                            slots[index] = {
                              ...slots[index],
                              start: e.target.value,
                            };

                            return {
                              ...prev,
                              [selectedDay.key]: {
                                ...prev[selectedDay.key],
                                slots,
                              },
                            };
                          });
                        }}
                      />

                      <input
                        style={styles.input}
                        type="time"
                        value={slot.end}
                        onMouseEnter={addInputHover}
                        onMouseLeave={removeInputHover}
                        onChange={(e) => {
                          setAvailabilityDraft((prev) => {
                            const slots = [...prev[selectedDay.key].slots];

                            slots[index] = {
                              ...slots[index],
                              end: e.target.value,
                            };

                            return {
                              ...prev,
                              [selectedDay.key]: {
                                ...prev[selectedDay.key],
                                slots,
                              },
                            };
                          });
                        }}
                      />

                      <button
                        style={styles.dangerButton}
                        onClick={() => {
                          setAvailabilityDraft((prev) => {
                            const slots = prev[selectedDay.key].slots.filter(
                              (_, i) => i !== index
                            );

                            return {
                              ...prev,
                              [selectedDay.key]: {
                                ...prev[selectedDay.key],
                                slots,
                              },
                            };
                          });
                        }}
                        onMouseEnter={addButtonHover}
                        onMouseLeave={removeButtonHover}
                      >
                        REMOVE
                      </button>
                    </div>
                  ))}

                  <button
                    style={styles.secondaryButton}
                    onClick={() => {
                      setAvailabilityDraft((prev) => ({
                        ...prev,
                        [selectedDay.key]: {
                          ...prev[selectedDay.key],
                          slots: [
                            ...prev[selectedDay.key].slots,
                            { start: "17:00", end: "22:00" },
                          ],
                        },
                      }));
                    }}
                    onMouseEnter={addButtonHover}
                    onMouseLeave={removeButtonHover}
                  >
                    + ADD ANOTHER TIME
                  </button>
                </>
              )}

              <button
                style={styles.primaryButton}
                onClick={() => setView("setAvailability")}
                onMouseEnter={addButtonHover}
                onMouseLeave={removeButtonHover}
              >
                DONE
              </button>
            </div>
          </div>
        )}

        {view === "viewBandAvailability" && (
          <div style={styles.availabilityPage}>
            <div style={styles.settingsHeader}>
              <div>
                <p style={styles.kicker}>BAND VIEW</p>
                <h1 style={styles.bandPageTitle}>Band Availability</h1>
              </div>

              <button
                style={styles.secondaryButton}
                onClick={() => setView("availabilityHome")}
                onMouseEnter={addButtonHover}
                onMouseLeave={removeButtonHover}
              >
                BACK
              </button>
            </div>

            {loadingBandAvailability ? (
              <div style={styles.roadie}>Loading availability...</div>
            ) : (
              <>
                <div style={styles.sharedPanel}>
                  <p style={styles.kicker}>BEST PRACTICE WINDOWS</p>

                  {sharedAvailability.length === 0 ? (
                    <p style={styles.sectionSubtitle}>
                      No 3+ member matching time slots yet. Once at least 3 band
                      members submit the exact same time window, it will show here.
                    </p>
                  ) : (
                    <div style={styles.sharedGrid}>
                      {sharedAvailability.map((slot, index) => (
                        <div key={index} style={styles.sharedCard}>
                          <p style={styles.sectionValue}>3+ MEMBERS FREE</p>

                          <h2 style={styles.sectionTitle}>{slot.dayLabel}</h2>

                          <p style={styles.sectionSubtitle}>
                            {formatTimeLabel(slot.start)} -{" "}
                            {formatTimeLabel(slot.end)}
                          </p>

                          <p style={styles.memberList}>
                            {slot.members.join(", ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={styles.memberAvailabilityList}>
                  {bandAvailability.length === 0 ? (
                    <div style={styles.roadie}>No one has submitted yet.</div>
                  ) : (
                    bandAvailability.map((member) => (
                      <div key={member.id} style={styles.memberCard}>
                        <h2 style={styles.sectionTitle}>
                          {member.displayName || member.email}
                        </h2>

                        <div style={styles.memberDaysGrid}>
                          {weekDays.map((day) => {
                            const dayData = member.days?.[day.key];

                            return (
                              <div key={day.key} style={styles.memberDayCard}>
                                <p
                                  style={{
                                    ...styles.sectionValue,
                                    color:
                                      dayData?.available === true
                                        ? "#00ff78"
                                        : dayData?.available === false
                                        ? "#ff2a2a"
                                        : "#777",
                                  }}
                                >
                                  {dayData?.available === true
                                    ? "AVAILABLE"
                                    : dayData?.available === false
                                    ? "NOT AVAILABLE"
                                    : "NOT SET"}
                                </p>

                                <h3 style={styles.memberDayTitle}>
                                  {day.label}
                                </h3>

                                <p style={styles.sectionSubtitle}>
                                  {dayData?.slots?.length
                                    ? dayData.slots
                                        .map(
                                          (slot) =>
                                            `${formatTimeLabel(
                                              slot.start
                                            )} - ${formatTimeLabel(slot.end)}`
                                        )
                                        .join(", ")
                                    : "—"}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {view === "settings" && (
          <div style={styles.settingsPage}>
            <div style={styles.settingsHeader}>
              <div>
                <p style={styles.kicker}>BAND SETTINGS</p>
                <h1 style={styles.bandPageTitle}>Edit Band</h1>
              </div>

              <button
                style={styles.secondaryButton}
                onClick={() => {
                  setView("dashboard");
                  setBandName(band.name);
                  setLogoFile(null);
                }}
                onMouseEnter={addButtonHover}
                onMouseLeave={removeButtonHover}
              >
                BACK TO BAND
              </button>
            </div>

            <div style={styles.settingsPanel}>
              <input
                style={styles.input}
                placeholder="Band name"
                value={bandName}
                onChange={(e) => setBandName(e.target.value)}
              />

              <label style={styles.fileLabel}>Add Band Logo / Picture</label>

              <input
                style={styles.input}
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files[0])}
              />

              <div style={styles.inviteBox}>
                <p style={styles.kicker}>INVITATION CODE</p>

                <div style={styles.inviteCodeBig}>
                  {inviteCode || "Not set yet"}
                </div>

                <p style={styles.inviteHint}>
                  Share this code with band members so they can join later.
                </p>
              </div>

              <div style={styles.settingsActions}>
                <button
                  style={styles.primaryButton}
                  onClick={handleSaveSettings}
                  disabled={saving}
                  onMouseEnter={addButtonHover}
                  onMouseLeave={removeButtonHover}
                >
                  {saving ? "SAVING..." : "SAVE SETTINGS"}
                </button>

                <button
                  style={styles.secondaryButton}
                  onClick={() => setInviteCode(generateInviteCode())}
                  onMouseEnter={addButtonHover}
                  onMouseLeave={removeButtonHover}
                >
                  REGENERATE CODE
                </button>
              </div>
            </div>
          </div>
        )}
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
    textTransform: "uppercase",
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
    width: "100%",
    boxSizing: "border-box",
    transition: "0.25s ease",
    cursor: "pointer",
    boxShadow: "0 0 0 rgba(255,0,0,0)",
  },

  fileLabel: {
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.82)",
  },

  primaryButton: {
    padding: "16px",
    borderRadius: 12,
    border: "1px solid rgba(255,0,21,0.6)",
    background: "#ff0015",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    textTransform: "uppercase",
    letterSpacing: 1,
    transition: "0.25s ease",
    transform: "translateY(0px) scale(1)",
    boxShadow: "0 14px 35px rgba(0,0,0,0.35)",
  },

  secondaryButton: {
    padding: "14px 18px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
    transition: "0.25s ease",
    transform: "translateY(0px) scale(1)",
    boxShadow: "0 14px 35px rgba(0,0,0,0.35)",
  },

  dangerButton: {
    padding: "14px 18px",
    borderRadius: 12,
    border: "1px solid rgba(255,0,0,0.3)",
    background: "rgba(255,0,0,0.14)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    transition: "0.25s ease",
    transform: "translateY(0px) scale(1)",
    boxShadow: "0 14px 35px rgba(0,0,0,0.35)",
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
    position: "relative",
    minWidth: 320,
    height: 360,
    background: "rgba(12,12,12,0.95)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 24,
    overflow: "hidden",
    transition: "0.25s ease",
    transform: "translateY(0px) scale(1)",
    cursor: "pointer",
    boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
  },

  bandLogo: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    padding: 36,
    background: "rgba(255,255,255,0.03)",
    filter: "invert(1) brightness(1.5)",
    boxSizing: "border-box",
  },

  bandNameCorner: {
    position: "absolute",
    right: 18,
    bottom: 16,
    padding: "8px 12px",
    background: "rgba(0,0,0,0.55)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    backdropFilter: "blur(8px)",
  },

  bandTitle: {
    margin: 0,
    fontSize: 28,
    textTransform: "uppercase",
    letterSpacing: "-1px",
  },

  backButton: {
    background: "rgba(255,255,255,0.04)",
    color: "white",
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: 14,
    padding: "12px 16px",
    fontSize: 22,
    fontWeight: 900,
    cursor: "pointer",
    marginBottom: 28,
    transition: "0.25s ease",
    transform: "translateY(0px) scale(1)",
    boxShadow: "0 14px 35px rgba(0,0,0,0.35)",
  },

  bandDashboardHero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    marginBottom: 30,
  },

  bandPageTitle: {
    margin: 0,
    fontSize: "clamp(54px, 8vw, 96px)",
    lineHeight: 0.9,
    textTransform: "uppercase",
    letterSpacing: "-4px",
    textShadow: "4px 4px 0px rgba(255,0,0,0.34)",
  },

  settingsButton: {
    width: 54,
    height: 54,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontSize: 24,
    cursor: "pointer",
    transition: "0.25s ease",
    transform: "translateY(0px) scale(1)",
    boxShadow: "0 14px 35px rgba(0,0,0,0.35)",
  },

  settingsPage: {
    width: "100%",
    maxWidth: 760,
    margin: "0 auto",
  },

  settingsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    marginBottom: 34,
  },

  settingsPanel: {
    maxWidth: 720,
    background: "rgba(10,10,10,0.86)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 25px 80px rgba(0,0,0,0.85)",
    backdropFilter: "blur(10px)",
    borderRadius: 22,
    padding: 28,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  settingsActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },

  inviteBox: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 18,
    padding: 20,
  },

  inviteCodeBig: {
    fontSize: 30,
    fontWeight: 900,
    letterSpacing: 3,
    color: "white",
    textTransform: "uppercase",
  },

  inviteHint: {
    margin: "8px 0 0",
    opacity: 0.68,
    fontWeight: 700,
  },

  bandDashboardGrid: {
    display: "grid",
    gridTemplateColumns: "0.85fr 1.15fr",
    gap: 26,
    alignItems: "stretch",
  },

  logoPanel: {
    background: "rgba(10,10,10,0.78)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 28,
    padding: 28,
    boxShadow: "0 25px 80px rgba(0,0,0,0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  bandPageLogo: {
    width: "100%",
    maxWidth: 420,
    height: 360,
    objectFit: "contain",
    padding: 28,
    background: "rgba(255,255,255,0.03)",
    filter: "invert(1) brightness(1.5)",
    borderRadius: 22,
    boxSizing: "border-box",
  },

  dashboardSectionGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
  },

  dashboardSectionCard: {
    minHeight: 180,
    background: "rgba(10,10,10,0.82)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
    transition: "0.25s ease",
    transform: "translateY(0px) scale(1)",
  },

  sectionValue: {
    color: "#ff2a2a",
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    margin: 0,
  },

  sectionTitle: {
    margin: "18px 0 10px",
    fontSize: 30,
    textTransform: "uppercase",
    letterSpacing: "-1px",
  },

  sectionSubtitle: {
    margin: 0,
    opacity: 0.68,
    lineHeight: 1.5,
    fontWeight: 700,
  },

  availabilityPage: {
    width: "100%",
    maxWidth: 1100,
    margin: "0 auto",
  },

  availabilityMenuGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 22,
    marginTop: 34,
  },

  availabilityMenuCard: {
    minHeight: 220,
    background: "rgba(10,10,10,0.84)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 24,
    padding: 26,
    boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
    cursor: "pointer",
    transition: "0.25s ease",
    transform: "translateY(0px) scale(1)",
  },

  weekGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 14,
    marginTop: 34,
  },

  dayCard: {
    minHeight: 180,
    background: "rgba(10,10,10,0.84)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
    cursor: "pointer",
    transition: "0.25s ease",
    transform: "translateY(0px) scale(1)",
  },

  timeSlotRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr auto",
    gap: 12,
    alignItems: "center",
  },

  sharedPanel: {
    background: "rgba(10,10,10,0.84)",
    border: "1px solid rgba(0,255,120,0.24)",
    borderRadius: 24,
    padding: 26,
    boxShadow: "0 25px 80px rgba(0,0,0,0.65)",
    marginBottom: 28,
  },

  sharedGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 18,
    marginTop: 20,
  },

  sharedCard: {
    background: "rgba(0,255,120,0.08)",
    border: "1px solid rgba(0,255,120,0.32)",
    borderRadius: 20,
    padding: 20,
  },

  memberList: {
    marginTop: 12,
    opacity: 0.82,
    fontWeight: 800,
    lineHeight: 1.5,
  },

  memberAvailabilityList: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },

  memberCard: {
    background: "rgba(10,10,10,0.84)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 24,
    padding: 24,
  },

  memberDaysGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 12,
    marginTop: 16,
  },

  memberDayCard: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 14,
  },

  memberDayTitle: {
    margin: "10px 0 8px",
    fontSize: 18,
    textTransform: "uppercase",
  },
};