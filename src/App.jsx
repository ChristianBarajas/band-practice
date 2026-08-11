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
  arrayUnion,
  collection,
  deleteDoc,
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

  const typedFullName = `${extraData.firstName || ""} ${
    extraData.lastName || ""
  }`.trim();

  await setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      firstName: extraData.firstName || "",
      lastName: extraData.lastName || "",
      displayName: user.displayName || typedFullName || user.email || "",
      email: user.email || "",
      photoURL: user.photoURL || "",
      updatedAt: serverTimestamp(),
      ...(extraData.isNewUser ? { createdAt: serverTimestamp() } : {}),
    },
    { merge: true }
  );
}

function buildFullName(profile = {}) {
  return `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
}

function getProfileDisplayName(profile = {}, fallbackEmail = "") {
  return (
    buildFullName(profile) ||
    profile.displayName ||
    fallbackEmail ||
    profile.email ||
    "Member"
  );
}

async function getUserProfile(uid) {
  if (!uid) return null;

  const snap = await getDoc(doc(db, "users", uid));

  if (!snap.exists()) return null;

  return {
    uid,
    ...snap.data(),
  };
}

function getMemberName(member = {}) {
  return getProfileDisplayName(member, member.email);
}

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getMondayWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
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

function formatShowDate(dateString) {
  if (!dateString) return "Date TBD";

  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getNextShow(shows) {
  if (!shows.length) return null;

  const todayKey = formatDateKey(new Date());
  const upcoming = shows.filter((show) => show.date >= todayKey);

  if (upcoming.length) return upcoming[0];

  return shows[shows.length - 1];
}

function getAvailabilityDays() {
  const start = getMondayWeekStart();

  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    return {
      date: d,
      key: formatDateKey(d),
      label: formatDayLabel(d),
      weekNumber: i < 7 ? 1 : 2,
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

        slotMap[slotKey].members.push(getMemberName(member));
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
  const [showJoinBand, setShowJoinBand] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joiningBand, setJoiningBand] = useState(false);
  const [currentUserName, setCurrentUserName] = useState(
    user.displayName || user.email
  );

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

  useEffect(() => {
    const loadCurrentUserName = async () => {
      try {
        const profile = await getUserProfile(user.uid);

        if (profile) {
          setCurrentUserName(getProfileDisplayName(profile, user.email));
        }
      } catch (err) {
        console.error("Error loading user profile:", err);
      }
    };

    loadCurrentUserName();
  }, [user.uid, user.email]);

  const handleJoinBand = async () => {
    const code = joinCode.trim().toUpperCase();

    if (!code) return alert("Invite code required.");

    try {
      setJoiningBand(true);

      const q = query(collection(db, "bands"), where("inviteCode", "==", code));
      const snap = await getDocs(q);

      if (snap.empty) {
        alert("No band found with that invite code.");
        return;
      }

      const bandDoc = snap.docs[0];
      const bandData = bandDoc.data();

      if (bandData.memberIds?.includes(user.uid)) {
        alert(`You're already in ${bandData.name}.`);
        setJoinCode("");
        setShowJoinBand(false);
        await loadBands();
        return;
      }

      await updateDoc(doc(db, "bands", bandDoc.id), {
        memberIds: arrayUnion(user.uid),
        updatedAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, "users", user.uid, "bands", bandDoc.id),
        {
          bandId: bandDoc.id,
          instrument: "Unassigned",
          joinedAt: serverTimestamp(),
        },
        { merge: true }
      );

      alert(`Joined ${bandData.name}!`);
      setJoinCode("");
      setShowJoinBand(false);
      await loadBands();
    } catch (err) {
      console.error("Error joining band:", err);
      alert(err.message);
    } finally {
      setJoiningBand(false);
    }
  };

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
              {currentUserName || user.displayName || user.email}
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
            onClick={() => setShowJoinBand((prev) => !prev)}
            onMouseEnter={addButtonHover}
            onMouseLeave={removeButtonHover}
          >
            JOIN BAND
          </button>
        </div>

        {showJoinBand && (
          <div style={styles.joinBandPanel}>
            <div>
              <p style={styles.kicker}>INVITE CODE</p>
              <h2 style={styles.sectionTitle}>Join a Band</h2>
              <p style={styles.sectionSubtitle}>
                Enter the invite code your bandmate shared. Codes are not case-sensitive.
              </p>
            </div>

            <div style={styles.joinBandRow}>
              <input
                style={styles.input}
                placeholder="Example: ABC123"
                value={joinCode}
                onMouseEnter={addInputHover}
                onMouseLeave={removeInputHover}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleJoinBand();
                }}
              />

              <button
                style={styles.primaryButton}
                onClick={handleJoinBand}
                disabled={joiningBand}
                onMouseEnter={addButtonHover}
                onMouseLeave={removeButtonHover}
              >
                {joiningBand ? "JOINING..." : "JOIN"}
              </button>

              <button
                style={styles.secondaryButton}
                onClick={() => {
                  setJoinCode("");
                  setShowJoinBand(false);
                }}
                disabled={joiningBand}
                onMouseEnter={addButtonHover}
                onMouseLeave={removeButtonHover}
              >
                CANCEL
              </button>
            </div>
          </div>
        )}

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
        instrument: "Unassigned",
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

  const availabilityDays = getAvailabilityDays();
  const currentWeekDays = availabilityDays.slice(0, 7);
  const nextWeekDays = availabilityDays.slice(7, 14);
  const weekStart = getMondayWeekStart();
  const weekId = formatDateKey(weekStart);

  const [selectedDay, setSelectedDay] = useState(null);
  const [availabilityDraft, setAvailabilityDraft] = useState({});
  const [bandAvailability, setBandAvailability] = useState([]);
  const [loadingBandAvailability, setLoadingBandAvailability] = useState(false);
  const [shows, setShows] = useState([]);
  const [loadingShows, setLoadingShows] = useState(false);
  const [showForm, setShowForm] = useState({
    title: "",
    date: "",
    location: "",
    callTime: "",
    songs: "",
    instagramLink: "",
  });
  const [editingShowId, setEditingShowId] = useState(null);

  const [goals, setGoals] = useState([]);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [goalForm, setGoalForm] = useState({
    title: "",
    description: "",
    why: "",
    how: "",
    deadline: "",
  });
  const [editingGoalId, setEditingGoalId] = useState(null);

  const [practices, setPractices] = useState([]);
  const [loadingPractices, setLoadingPractices] = useState(false);
  const [practiceForm, setPracticeForm] = useState({
    title: "",
    date: "",
    location: "",
    goal: "",
  });
  const [editingPracticeId, setEditingPracticeId] = useState(null);

  const [memberProfiles, setMemberProfiles] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);

  const sharedAvailability = getSharedAvailability(bandAvailability, availabilityDays);
  const nextShow = getNextShow(shows);
  const nextGoal = goals[0] || null;
  const nextPractice = practices[0] || null;

  const getCurrentUserName = async () => {
    const profile = currentUserProfile || (await getUserProfile(user.uid));
    const resolvedName = getProfileDisplayName(profile || {}, user.email);

    if (!currentUserProfile && profile) {
      setCurrentUserProfile(profile);
    }

    return resolvedName;
  };

  const loadBandMembers = async () => {
    try {
      setLoadingMembers(true);

      const memberIds = Array.isArray(band.memberIds) ? band.memberIds : [];

      const loadedMembers = await Promise.all(
        memberIds.map(async (uid) => {
          const profile = await getUserProfile(uid);
          const membershipSnap = await getDoc(
            doc(db, "users", uid, "bands", band.id)
          );

          const membership = membershipSnap.exists()
            ? membershipSnap.data()
            : {};

          return {
            uid,
            firstName: profile?.firstName || "",
            lastName: profile?.lastName || "",
            displayName: getProfileDisplayName(profile || {}, profile?.email || ""),
            email: profile?.email || "",
            instrument: membership.instrument || "Unassigned",
          };
        })
      );

      setMemberProfiles(loadedMembers);
    } catch (err) {
      console.error("Error loading band members:", err);
      alert(err.message);
    } finally {
      setLoadingMembers(false);
    }
  };

  const updateMemberInstrument = async (uid, instrument) => {
    try {
      await setDoc(
        doc(db, "users", uid, "bands", band.id),
        {
          bandId: band.id,
          instrument,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setMemberProfiles((prev) =>
        prev.map((member) =>
          member.uid === uid ? { ...member, instrument } : member
        )
      );
    } catch (err) {
      alert(err.message);
    }
  };

  const loadShows = async () => {
    try {
      setLoadingShows(true);

      const snap = await getDocs(collection(db, "bands", band.id, "shows"));

      const loadedShows = snap.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .sort((a, b) => {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return a.date.localeCompare(b.date);
        });

      setShows(loadedShows);
    } catch (err) {
      console.error("Error loading shows:", err);
      alert(err.message);
    } finally {
      setLoadingShows(false);
    }
  };

  const resetShowForm = () => {
    setShowForm({
      title: "",
      date: "",
      location: "",
      callTime: "",
      songs: "",
      instagramLink: "",
    });
    setEditingShowId(null);
  };

  const startEditShow = (show) => {
    setEditingShowId(show.id);
    setShowForm({
      title: show.title || "",
      date: show.date || "",
      location: show.location || "",
      callTime: show.callTime || "",
      songs: Array.isArray(show.songs) ? show.songs.join("\n") : "",
      instagramLink: show.instagramLink || "",
    });
    setView("addShow");
  };

  const deleteShow = async (show) => {
    const confirmed = window.confirm(
      `Delete "${show.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      await deleteDoc(doc(db, "bands", band.id, "shows", show.id));
      await loadShows();
      alert("Show deleted.");
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveShow = async () => {
    if (!showForm.title.trim()) return alert("Show name required.");
    if (!showForm.date) return alert("Show date required.");
    if (!showForm.location.trim()) return alert("Show location required.");

    try {
      setSaving(true);

      const showData = {
        bandId: band.id,
        title: showForm.title.trim(),
        date: showForm.date,
        location: showForm.location.trim(),
        callTime: showForm.callTime,
        songs: showForm.songs
          .split("\n")
          .map((song) => song.trim())
          .filter(Boolean),
        instagramLink: showForm.instagramLink.trim(),
        updatedAt: serverTimestamp(),
      };

      if (editingShowId) {
        await updateDoc(doc(db, "bands", band.id, "shows", editingShowId), showData);
      } else {
        await addDoc(collection(db, "bands", band.id, "shows"), {
          ...showData,
          createdBy: user.uid,
          createdByName: await getCurrentUserName(),
          createdAt: serverTimestamp(),
        });
      }

      const wasEditing = Boolean(editingShowId);

      resetShowForm();
      await loadShows();
      setView("showsHome");
      alert(wasEditing ? "Show updated!" : "Show added!");
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const loadGoals = async () => {
    try {
      setLoadingGoals(true);

      const snap = await getDocs(collection(db, "bands", band.id, "goals"));

      const loadedGoals = snap.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .sort((a, b) => {
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return a.deadline.localeCompare(b.deadline);
        });

      setGoals(loadedGoals);
    } catch (err) {
      console.error("Error loading goals:", err);
      alert(err.message);
    } finally {
      setLoadingGoals(false);
    }
  };

  const resetGoalForm = () => {
    setGoalForm({
      title: "",
      description: "",
      why: "",
      how: "",
      deadline: "",
    });
    setEditingGoalId(null);
  };

  const startEditGoal = (goal) => {
    setEditingGoalId(goal.id);
    setGoalForm({
      title: goal.title || "",
      description: goal.description || "",
      why: goal.why || "",
      how: goal.how || "",
      deadline: goal.deadline || "",
    });
    setView("addGoal");
  };

  const deleteGoal = async (goal) => {
    const confirmed = window.confirm(
      `Delete "${goal.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      await deleteDoc(doc(db, "bands", band.id, "goals", goal.id));
      await loadGoals();
      alert("Goal deleted.");
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveGoal = async () => {
    if (!goalForm.title.trim()) return alert("Goal title required.");
    if (!goalForm.deadline) return alert("Goal deadline required.");

    try {
      setSaving(true);

      const goalData = {
        bandId: band.id,
        title: goalForm.title.trim(),
        description: goalForm.description.trim(),
        why: goalForm.why.trim(),
        how: goalForm.how.trim(),
        deadline: goalForm.deadline,
        completed: false,
        updatedAt: serverTimestamp(),
      };

      if (editingGoalId) {
        await updateDoc(doc(db, "bands", band.id, "goals", editingGoalId), goalData);
      } else {
        await addDoc(collection(db, "bands", band.id, "goals"), {
          ...goalData,
          createdBy: user.uid,
          createdByName: await getCurrentUserName(),
          createdAt: serverTimestamp(),
        });
      }

      const wasEditing = Boolean(editingGoalId);

      resetGoalForm();
      await loadGoals();
      setView("goalsHome");
      alert(wasEditing ? "Goal updated!" : "Goal added!");
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const loadPractices = async () => {
    try {
      setLoadingPractices(true);

      const snap = await getDocs(collection(db, "bands", band.id, "practices"));

      const todayKey = formatDateKey(new Date());
      const loadedPractices = snap.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((practice) => !practice.date || practice.date >= todayKey)
        .sort((a, b) => {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return a.date.localeCompare(b.date);
        });

      setPractices(loadedPractices);
    } catch (err) {
      console.error("Error loading practices:", err);
      alert(err.message);
    } finally {
      setLoadingPractices(false);
    }
  };

  const resetPracticeForm = () => {
    setPracticeForm({
      title: "",
      date: "",
      location: "",
      goal: "",
    });
    setEditingPracticeId(null);
  };

  const startEditPractice = (practice) => {
    setEditingPracticeId(practice.id);
    setPracticeForm({
      title: practice.title || "",
      date: practice.date || "",
      location: practice.location || "",
      goal: practice.goal || "",
    });
    setView("addPractice");
  };

  const deletePractice = async (practice) => {
    const confirmed = window.confirm(
      `Delete "${practice.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      await deleteDoc(doc(db, "bands", band.id, "practices", practice.id));
      await loadPractices();
      alert("Practice deleted.");
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const savePractice = async () => {
    if (!practiceForm.title.trim()) return alert("Practice title required.");
    if (!practiceForm.date) return alert("Practice date required.");
    if (!practiceForm.location.trim()) return alert("Practice location required.");

    try {
      setSaving(true);

      const practiceData = {
        bandId: band.id,
        title: practiceForm.title.trim(),
        date: practiceForm.date,
        location: practiceForm.location.trim(),
        goal: practiceForm.goal.trim(),
        updatedAt: serverTimestamp(),
      };

      if (editingPracticeId) {
        await updateDoc(
          doc(db, "bands", band.id, "practices", editingPracticeId),
          practiceData
        );
      } else {
        await addDoc(collection(db, "bands", band.id, "practices"), {
          ...practiceData,
          createdBy: user.uid,
          createdByName: await getCurrentUserName(),
          createdAt: serverTimestamp(),
        });
      }

      const wasEditing = Boolean(editingPracticeId);

      resetPracticeForm();
      await loadPractices();
      setView("practicesHome");
      alert(wasEditing ? "Practice updated!" : "Practice added!");
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

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

      const profile = currentUserProfile || (await getUserProfile(user.uid));
      const displayName = getProfileDisplayName(profile || {}, user.email);

      if (!currentUserProfile && profile) {
        setCurrentUserProfile(profile);
      }

      await setDoc(
        doc(db, "bands", band.id, "availability", weekId, "members", user.uid),
        {
          uid: user.uid,
          firstName: profile?.firstName || "",
          lastName: profile?.lastName || "",
          displayName,
          email: user.email || profile?.email || "",
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

      const profileMap = Object.fromEntries(
        memberProfiles.map((member) => [member.uid, member])
      );

      setBandAvailability(
        snap.docs.map((doc) => {
          const data = doc.data();
          const profile = profileMap[doc.id] || {};

          return {
            id: doc.id,
            ...data,
            firstName: profile.firstName || data.firstName || "",
            lastName: profile.lastName || data.lastName || "",
            displayName: getProfileDisplayName(
              { ...data, ...profile },
              data.email || profile.email
            ),
            email: data.email || profile.email || "",
            instrument: profile.instrument || "Unassigned",
          };
        })
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

  useEffect(() => {
    const loadCurrentProfile = async () => {
      try {
        const profile = await getUserProfile(user.uid);
        setCurrentUserProfile(profile);
      } catch (err) {
        console.error("Error loading current user profile:", err);
      }
    };

    loadCurrentProfile();
    loadBandMembers();
    loadShows();
    loadGoals();
    loadPractices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band.id]);

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
      subtitle: nextShow
        ? `${formatShowDate(nextShow.date)} • ${nextShow.location} • Call time ${
            nextShow.callTime ? formatTimeLabel(nextShow.callTime) : "TBD"
          }`
        : "Track gigs, venues, call times, and set times.",
      value: nextShow ? "Next show" : "No shows yet",
    },
    {
      title: "My Availability",
      subtitle: "Set when you can practice across the next two weeks.",
      value: Object.keys(availabilityDraft).length ? "Submitted" : "Not submitted",
    },
    {
      title: "Band Goals",
      subtitle: nextGoal
        ? `${nextGoal.title} • Deadline ${formatShowDate(nextGoal.deadline)}`
        : "EP deadlines, live show targets, recording plans.",
      value: nextGoal ? `${goals.length} active goal${goals.length === 1 ? "" : "s"}` : "No goals yet",
    },
    {
      title: "Upcoming Practices",
      subtitle: nextPractice
        ? `${formatShowDate(nextPractice.date)} • ${nextPractice.location}`
        : "See confirmed practices and proposed jam times.",
      value: nextPractice ? "Next practice" : "No practices yet",
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
                        section.title === "My Availability" ||
                        section.title === "Upcoming Shows" ||
                        section.title === "Band Goals" ||
                        section.title === "Upcoming Practices"
                          ? "pointer"
                          : "default",
                    }}
                    onClick={() => {
                      if (section.title === "My Availability") {
                        setView("availabilityHome");
                      }

                      if (section.title === "Upcoming Shows") {
                        setView("showsHome");
                      }

                      if (section.title === "Band Goals") {
                        setView("goalsHome");
                      }

                      if (section.title === "Upcoming Practices") {
                        setView("practicesHome");
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

        {view === "showsHome" && (
          <div style={styles.availabilityPage}>
            <div style={styles.settingsHeader}>
              <div>
                <p style={styles.kicker}>GIG BOARD</p>
                <h1 style={styles.bandPageTitle}>Upcoming Shows</h1>
              </div>



              <div style={styles.settingsActions}>
                <button
                  style={styles.primaryButton}
                  onClick={() => {
                    resetShowForm();
                    setView("addShow");
                  }}
                  onMouseEnter={addButtonHover}
                  onMouseLeave={removeButtonHover}
                >
                  + ADD SHOW
                </button>

                <button
                  style={styles.secondaryButton}
                  onClick={() => setView("dashboard")}
                  onMouseEnter={addButtonHover}
                  onMouseLeave={removeButtonHover}
                >
                  BACK TO BAND
                </button>
              </div>
            </div>

            {loadingShows ? (
              <div style={styles.roadie}>Loading shows...</div>
            ) : shows.length === 0 ? (
              <div style={styles.sharedPanel}>
                <p style={styles.kicker}>NO SHOWS YET</p>
                <h2 style={styles.sectionTitle}>Start the gig list</h2>
                <p style={styles.sectionSubtitle}>
                  Add the next show date, location, call time, setlist, and
                  Instagram link.
                </p>
              </div>
            ) : (
              <div style={styles.showsGrid}>
                {shows.map((show) => (
                  <div key={show.id} style={styles.showCard}>
                    <p style={styles.sectionValue}>{formatShowDate(show.date)}</p>
                    <h2 style={styles.sectionTitle}>{show.title}</h2>

                    <p style={styles.sectionSubtitle}>
                      <strong>Location:</strong> {show.location}
                    </p>

                    <p style={styles.sectionSubtitle}>
                      <strong>Call Time:</strong>{" "}
                      {show.callTime ? formatTimeLabel(show.callTime) : "TBD"}
                    </p>

                    {show.songs?.length > 0 && (
                      <div style={styles.songList}>
                        <p style={styles.kicker}>SETLIST</p>
                        {show.songs.map((song, index) => (
                          <p key={index} style={styles.songItem}>
                            {index + 1}. {song}
                          </p>
                        ))}
                      </div>
                    )}

                    {show.instagramLink && (
                      <a
                        style={styles.linkButton}
                        href={show.instagramLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        OPEN INSTAGRAM LINK
                      </a>
                    )}

                    <div style={styles.showActions}>
                      <button
                        style={styles.secondaryButton}
                        onClick={() => startEditShow(show)}
                        disabled={saving}
                        onMouseEnter={addButtonHover}
                        onMouseLeave={removeButtonHover}
                      >
                        EDIT
                      </button>

                      <button
                        style={styles.dangerButton}
                        onClick={() => deleteShow(show)}
                        disabled={saving}
                        onMouseEnter={addButtonHover}
                        onMouseLeave={removeButtonHover}
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "addShow" && (
          <div style={styles.settingsPage}>
            <div style={styles.settingsHeader}>
              <div>
                <p style={styles.kicker}>{editingShowId ? "EDIT SHOW" : "NEW SHOW"}</p>
                <h1 style={styles.bandPageTitle}>
                  {editingShowId ? "Edit Show" : "Add Show"}
                </h1>
              </div>

              <button
                style={styles.secondaryButton}
                onClick={() => {
                  resetShowForm();
                  setView("showsHome");
                }}
                onMouseEnter={addButtonHover}
                onMouseLeave={removeButtonHover}
              >
                BACK
              </button>
            </div>

            <div style={styles.settingsPanel}>
              <input
                style={styles.input}
                placeholder="Show name / event title"
                value={showForm.title}
                onMouseEnter={addInputHover}
                onMouseLeave={removeInputHover}
                onChange={(e) =>
                  setShowForm((prev) => ({ ...prev, title: e.target.value }))
                }
              />

              <label style={styles.fileLabel}>Show Date</label>
              <input
                style={styles.input}
                type="date"
                value={showForm.date}
                onMouseEnter={addInputHover}
                onMouseLeave={removeInputHover}
                onChange={(e) =>
                  setShowForm((prev) => ({ ...prev, date: e.target.value }))
                }
              />

              <input
                style={styles.input}
                placeholder="Location / venue"
                value={showForm.location}
                onMouseEnter={addInputHover}
                onMouseLeave={removeInputHover}
                onChange={(e) =>
                  setShowForm((prev) => ({ ...prev, location: e.target.value }))
                }
              />

              <label style={styles.fileLabel}>Call Time</label>
              <input
                style={styles.input}
                type="time"
                value={showForm.callTime}
                onMouseEnter={addInputHover}
                onMouseLeave={removeInputHover}
                onChange={(e) =>
                  setShowForm((prev) => ({ ...prev, callTime: e.target.value }))
                }
              />

              <textarea
                style={styles.textarea}
                placeholder={"Songs you're gonna play. Put one song per line."}
                value={showForm.songs}
                onMouseEnter={addInputHover}
                onMouseLeave={removeInputHover}
                onChange={(e) =>
                  setShowForm((prev) => ({ ...prev, songs: e.target.value }))
                }
              />

              <input
                style={styles.input}
                placeholder="Instagram show link"
                value={showForm.instagramLink}
                onMouseEnter={addInputHover}
                onMouseLeave={removeInputHover}
                onChange={(e) =>
                  setShowForm((prev) => ({
                    ...prev,
                    instagramLink: e.target.value,
                  }))
                }
              />

              <button
                style={styles.primaryButton}
                onClick={saveShow}
                disabled={saving}
                onMouseEnter={addButtonHover}
                onMouseLeave={removeButtonHover}
              >
                {saving ? "SAVING..." : editingShowId ? "SAVE CHANGES" : "ADD SHOW"}
              </button>
            </div>
          </div>
        )}

        {view === "goalsHome" && (
          <div style={styles.availabilityPage}>
            <div style={styles.settingsHeader}>
              <div>
                <p style={styles.kicker}>BAND MISSION</p>
                <h1 style={styles.bandPageTitle}>Band Goals</h1>
              </div>

              <div style={styles.settingsActions}>
                <button
                  style={styles.primaryButton}
                  onClick={() => {
                    resetGoalForm();
                    setView("addGoal");
                  }}
                  onMouseEnter={addButtonHover}
                  onMouseLeave={removeButtonHover}
                >
                  + ADD GOAL
                </button>

                <button
                  style={styles.secondaryButton}
                  onClick={() => setView("dashboard")}
                  onMouseEnter={addButtonHover}
                  onMouseLeave={removeButtonHover}
                >
                  BACK TO BAND
                </button>
              </div>
            </div>

            {loadingGoals ? (
              <div style={styles.roadie}>Loading goals...</div>
            ) : goals.length === 0 ? (
              <div style={styles.sharedPanel}>
                <p style={styles.kicker}>NO GOALS YET</p>
                <h2 style={styles.sectionTitle}>Add the first mission</h2>
                <p style={styles.sectionSubtitle}>
                  Create goals for releases, shows, recording, practice focus, or anything
                  the band needs to lock in.
                </p>
              </div>
            ) : (
              <div style={styles.showsGrid}>
                {goals.map((goal) => (
                  <div key={goal.id} style={styles.showCard}>
                    <p style={styles.sectionValue}>
                      Deadline {formatShowDate(goal.deadline)}
                    </p>

                    <h2 style={styles.sectionTitle}>{goal.title}</h2>

                    {goal.description && (
                      <p style={styles.sectionSubtitle}>
                        <strong>Description:</strong> {goal.description}
                      </p>
                    )}

                    {goal.why && (
                      <div style={styles.songList}>
                        <p style={styles.kicker}>WHY</p>
                        <p style={styles.songItem}>{goal.why}</p>
                      </div>
                    )}

                    {goal.how && (
                      <div style={styles.songList}>
                        <p style={styles.kicker}>HOW</p>
                        <p style={styles.songItem}>{goal.how}</p>
                      </div>
                    )}

                    <div style={styles.showActions}>
                      <button
                        style={styles.secondaryButton}
                        onClick={() => startEditGoal(goal)}
                        disabled={saving}
                        onMouseEnter={addButtonHover}
                        onMouseLeave={removeButtonHover}
                      >
                        EDIT
                      </button>

                      <button
                        style={styles.dangerButton}
                        onClick={() => deleteGoal(goal)}
                        disabled={saving}
                        onMouseEnter={addButtonHover}
                        onMouseLeave={removeButtonHover}
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "addGoal" && (
          <div style={styles.settingsPage}>
            <div style={styles.settingsHeader}>
              <div>
                <p style={styles.kicker}>{editingGoalId ? "EDIT GOAL" : "NEW GOAL"}</p>
                <h1 style={styles.bandPageTitle}>
                  {editingGoalId ? "Edit Goal" : "Add Goal"}
                </h1>
              </div>

              <button
                style={styles.secondaryButton}
                onClick={() => {
                  resetGoalForm();
                  setView("goalsHome");
                }}
                onMouseEnter={addButtonHover}
                onMouseLeave={removeButtonHover}
              >
                BACK
              </button>
            </div>

            <div style={styles.settingsPanel}>
              <input
                style={styles.input}
                placeholder="Goal title"
                value={goalForm.title}
                onMouseEnter={addInputHover}
                onMouseLeave={removeInputHover}
                onChange={(e) =>
                  setGoalForm((prev) => ({ ...prev, title: e.target.value }))
                }
              />

              <textarea
                style={styles.textarea}
                placeholder="Description — what is the goal?"
                value={goalForm.description}
                onMouseEnter={addInputHover}
                onMouseLeave={removeInputHover}
                onChange={(e) =>
                  setGoalForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />

              <textarea
                style={styles.textarea}
                placeholder="Why does this matter?"
                value={goalForm.why}
                onMouseEnter={addInputHover}
                onMouseLeave={removeInputHover}
                onChange={(e) =>
                  setGoalForm((prev) => ({ ...prev, why: e.target.value }))
                }
              />

              <textarea
                style={styles.textarea}
                placeholder="How are we going to make it happen?"
                value={goalForm.how}
                onMouseEnter={addInputHover}
                onMouseLeave={removeInputHover}
                onChange={(e) =>
                  setGoalForm((prev) => ({ ...prev, how: e.target.value }))
                }
              />

              <label style={styles.fileLabel}>Deadline</label>
              <input
                style={styles.input}
                type="date"
                value={goalForm.deadline}
                onMouseEnter={addInputHover}
                onMouseLeave={removeInputHover}
                onChange={(e) =>
                  setGoalForm((prev) => ({ ...prev, deadline: e.target.value }))
                }
              />

              <button
                style={styles.primaryButton}
                onClick={saveGoal}
                disabled={saving}
                onMouseEnter={addButtonHover}
                onMouseLeave={removeButtonHover}
              >
                {saving ? "SAVING..." : editingGoalId ? "SAVE CHANGES" : "ADD GOAL"}
              </button>
            </div>
          </div>
        )}

        {view === "practicesHome" && (
          <div style={styles.availabilityPage}>
            <div style={styles.settingsHeader}>
              <div>
                <p style={styles.kicker}>LOCK IT IN</p>
                <h1 style={styles.bandPageTitle}>Upcoming Practices</h1>
              </div>

              <div style={styles.settingsActions}>
                <button
                  style={styles.primaryButton}
                  onClick={() => {
                    resetPracticeForm();
                    setView("addPractice");
                  }}
                  onMouseEnter={addButtonHover}
                  onMouseLeave={removeButtonHover}
                >
                  + ADD PRACTICE
                </button>

                <button
                  style={styles.secondaryButton}
                  onClick={() => setView("dashboard")}
                  onMouseEnter={addButtonHover}
                  onMouseLeave={removeButtonHover}
                >
                  BACK TO BAND
                </button>
              </div>
            </div>

            {loadingPractices ? (
              <div style={styles.roadie}>Loading practices...</div>
            ) : practices.length === 0 ? (
              <div style={styles.sharedPanel}>
                <p style={styles.kicker}>NO PRACTICES YET</p>
                <h2 style={styles.sectionTitle}>Add a hard practice</h2>
                <p style={styles.sectionSubtitle}>
                  Lock in the date, title, location, and focus goal so nobody has to
                  dig through the group chat.
                </p>
              </div>
            ) : (
              <div style={styles.showsGrid}>
                {practices.map((practice) => (
                  <div key={practice.id} style={styles.showCard}>
                    <p style={styles.sectionValue}>{formatShowDate(practice.date)}</p>
                    <h2 style={styles.sectionTitle}>{practice.title}</h2>

                    <p style={styles.sectionSubtitle}>
                      <strong>Location:</strong> {practice.location}
                    </p>

                    {practice.goal && (
                      <div style={styles.songList}>
                        <p style={styles.kicker}>PRACTICE GOAL</p>
                        <p style={styles.songItem}>{practice.goal}</p>
                      </div>
                    )}

                    <div style={styles.showActions}>
                      <button
                        style={styles.secondaryButton}
                        onClick={() => startEditPractice(practice)}
                        disabled={saving}
                        onMouseEnter={addButtonHover}
                        onMouseLeave={removeButtonHover}
                      >
                        EDIT
                      </button>

                      <button
                        style={styles.dangerButton}
                        onClick={() => deletePractice(practice)}
                        disabled={saving}
                        onMouseEnter={addButtonHover}
                        onMouseLeave={removeButtonHover}
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "addPractice" && (
          <div style={styles.settingsPage}>
            <div style={styles.settingsHeader}>
              <div>
                <p style={styles.kicker}>
                  {editingPracticeId ? "EDIT PRACTICE" : "NEW PRACTICE"}
                </p>
                <h1 style={styles.bandPageTitle}>
                  {editingPracticeId ? "Edit Practice" : "Add Practice"}
                </h1>
              </div>

              <button
                style={styles.secondaryButton}
                onClick={() => {
                  resetPracticeForm();
                  setView("practicesHome");
                }}
                onMouseEnter={addButtonHover}
                onMouseLeave={removeButtonHover}
              >
                BACK
              </button>
            </div>

            <div style={styles.settingsPanel}>
              <input
                style={styles.input}
                placeholder="Practice title"
                value={practiceForm.title}
                onMouseEnter={addInputHover}
                onMouseLeave={removeInputHover}
                onChange={(e) =>
                  setPracticeForm((prev) => ({ ...prev, title: e.target.value }))
                }
              />

              <label style={styles.fileLabel}>Practice Date</label>
              <input
                style={styles.input}
                type="date"
                value={practiceForm.date}
                onMouseEnter={addInputHover}
                onMouseLeave={removeInputHover}
                onChange={(e) =>
                  setPracticeForm((prev) => ({ ...prev, date: e.target.value }))
                }
              />

              <input
                style={styles.input}
                placeholder="Location"
                value={practiceForm.location}
                onMouseEnter={addInputHover}
                onMouseLeave={removeInputHover}
                onChange={(e) =>
                  setPracticeForm((prev) => ({ ...prev, location: e.target.value }))
                }
              />

              <textarea
                style={styles.textarea}
                placeholder="Goal for this practice"
                value={practiceForm.goal}
                onMouseEnter={addInputHover}
                onMouseLeave={removeInputHover}
                onChange={(e) =>
                  setPracticeForm((prev) => ({ ...prev, goal: e.target.value }))
                }
              />

              <button
                style={styles.primaryButton}
                onClick={savePractice}
                disabled={saving}
                onMouseEnter={addButtonHover}
                onMouseLeave={removeButtonHover}
              >
                {saving
                  ? "SAVING..."
                  : editingPracticeId
                  ? "SAVE CHANGES"
                  : "ADD PRACTICE"}
              </button>
            </div>
          </div>
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
                <p style={styles.sectionValue}>NEXT 2 WEEKS</p>
                <h2 style={styles.sectionTitle}>Set My Availability</h2>
                <p style={styles.sectionSubtitle}>
                  Choose the days and times you can practice across two Monday-to-Sunday weeks.
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
                onClick={() => setView("practicesHome")}
                onMouseEnter={addHoverLift}
                onMouseLeave={removeHoverLift}
              >
                <p style={styles.sectionValue}>BAND TOOL</p>
                <h2 style={styles.sectionTitle}>Schedule Practice</h2>
                <p style={styles.sectionSubtitle}>
                  Lock in a hard practice date, location, and goal.
                </p>
              </div>
            </div>
          </div>
        )}

        {view === "setAvailability" && (
          <div style={styles.availabilityPage}>
            <div style={styles.settingsHeader}>
              <div>
                <p style={styles.kicker}>NEXT 2 WEEKS</p>
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

            <div style={styles.weekSection}>
              <p style={styles.kicker}>WEEK 1 · MONDAY TO SUNDAY</p>
              <div style={styles.weekGrid}>
                {currentWeekDays.map((day) => {
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
            </div>

            <div style={styles.weekSection}>
              <p style={styles.kicker}>WEEK 2 · MONDAY TO SUNDAY</p>
              <div style={styles.weekGrid}>
                {nextWeekDays.map((day) => {
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
            </div>

            <button
              style={{ ...styles.primaryButton, marginTop: 30 }}
              onClick={saveMyAvailability}
              disabled={saving}
              onMouseEnter={addButtonHover}
              onMouseLeave={removeButtonHover}
            >
              {saving ? "SAVING..." : "SAVE 2 WEEKS"}
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
                          {getMemberName(member)}
                        </h2>

                        <div style={styles.memberWeekSection}>
                          <p style={styles.kicker}>WEEK 1 · MONDAY TO SUNDAY</p>
                          <div style={styles.memberDaysGrid}>
                            {currentWeekDays.map((day) => {
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

                        <div style={styles.memberWeekSection}>
                          <p style={styles.kicker}>WEEK 2 · MONDAY TO SUNDAY</p>
                          <div style={styles.memberDaysGrid}>
                            {nextWeekDays.map((day) => {
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

              <div style={styles.memberSettingsBox}>
                <p style={styles.kicker}>BAND MEMBERS</p>

                {loadingMembers ? (
                  <p style={styles.sectionSubtitle}>Loading members...</p>
                ) : memberProfiles.length === 0 ? (
                  <p style={styles.sectionSubtitle}>No members loaded yet.</p>
                ) : (
                  <div style={styles.memberSettingsList}>
                    {memberProfiles.map((member) => (
                      <div key={member.uid} style={styles.memberSettingsRow}>
                        <div>
                          <h3 style={styles.memberName}>
                            {buildFullName(member) || member.displayName || "Band Member"}
                          </h3>
                        </div>

                        <select
                          style={styles.select}
                          value={member.instrument || "Unassigned"}
                          onChange={(e) =>
                            updateMemberInstrument(member.uid, e.target.value)
                          }
                          onMouseEnter={addInputHover}
                          onMouseLeave={removeInputHover}
                        >
                          <option value="Unassigned">Unassigned</option>
                          <option value="Guitar">Guitar</option>
                          <option value="Drums">Drums</option>
                          <option value="Vocals">Vocals</option>
                          <option value="Bass">Bass</option>
                        </select>
                      </div>
                    ))}
                  </div>
                )}
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

  joinBandPanel: {
    maxWidth: 820,
    marginBottom: 42,
    background: "rgba(10,10,10,0.86)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 25px 80px rgba(0,0,0,0.65)",
    backdropFilter: "blur(10px)",
    borderRadius: 24,
    padding: 26,
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },

  joinBandRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: 12,
    alignItems: "center",
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

  showsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 22,
    marginTop: 34,
  },

  showCard: {
    background: "rgba(10,10,10,0.84)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 24,
    padding: 26,
    boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
  },

  songList: {
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
  },

  songItem: {
    margin: "8px 0",
    opacity: 0.86,
    fontWeight: 800,
  },

  showActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 18,
  },

  textarea: {
    minHeight: 140,
    resize: "vertical",
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
    fontFamily: "inherit",
  },

  linkButton: {
    display: "inline-block",
    marginTop: 18,
    padding: "14px 18px",
    borderRadius: 12,
    border: "1px solid rgba(255,0,21,0.6)",
    background: "rgba(255,0,21,0.16)",
    color: "white",
    fontWeight: 900,
    textDecoration: "none",
    textTransform: "uppercase",
    letterSpacing: 1,
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

  weekSection: {
    marginTop: 34,
  },

  memberWeekSection: {
    marginTop: 22,
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

  memberSettingsBox: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 18,
    padding: 20,
  },

  memberSettingsList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: 12,
  },

  memberSettingsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 180px",
    gap: 14,
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    background: "rgba(0,0,0,0.24)",
    border: "1px solid rgba(255,255,255,0.08)",
  },

  memberName: {
    margin: 0,
    fontSize: 18,
    textTransform: "uppercase",
    letterSpacing: "-0.5px",
  },

  memberEmail: {
    margin: "6px 0 0",
    opacity: 0.58,
    fontWeight: 700,
    wordBreak: "break-word",
  },

  select: {
    padding: "14px",
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

  memberDayTitle: {
    margin: "10px 0 8px",
    fontSize: 18,
    textTransform: "uppercase",
  },
};