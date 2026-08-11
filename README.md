# 🎸 Band Practice

**Band Practice** is a full-stack web application designed to help bands organize rehearsals, availability, shows, goals, and members from one shared dashboard.

Instead of coordinating everything through group chats, spreadsheets, calendars, and scattered messages, Band Practice gives every member a centralized place to manage the band's schedule and plans.

The application is built with **React, Vite, and Firebase** and is currently deployed and being tested with real users.

---

## 🎯 Why I Built It

Scheduling a practice with multiple band members can become surprisingly complicated.

One person is available after work, another has school, someone else is only available for a few hours, and all of that information usually gets buried inside a group chat.

I built Band Practice to solve that problem.

The original idea was a simple availability tracker, but the project evolved into a larger band-management platform containing:

- Member management
- Multi-band support
- Shared availability
- Practice scheduling
- Show planning
- Band goals
- Invitation codes
- Persistent cloud data

The project gave me experience designing a real application around an actual problem and iterating on it after putting it in the hands of real users.

---

# ✨ Core Features

## 🔐 Authentication & User Profiles

Band Practice includes a complete authentication flow using Firebase Authentication.

Users can:

- Create an account with email and password
- Sign in with Google
- Verify their email address
- Maintain persistent login sessions
- Store profile information in Cloud Firestore
- Access their bands across devices

User profile data is separated from authentication data so application-specific information can be managed independently.

---

## 🎸 Multi-Band System

Users are not limited to one band.

They can:

- Create new bands
- Join existing bands
- Switch between their bands
- Upload custom band logos
- Edit band information
- View band-specific dashboards

Each band maintains its own members, availability, practices, shows, goals, and settings.

---

## 🔗 Invitation Code / Join Band System

Every band receives a unique invitation code.

A member can enter that code from their dashboard to join an existing band.

The application:

1. Searches Firestore for the matching invitation code
2. Validates the band
3. Adds the authenticated user to the band's member list
4. Creates the user's band membership record
5. Updates the interface with the newly joined band

Invitation codes can also be regenerated from Band Settings.

---

## 👥 Band Member Management

Band Settings includes a live member list for everyone currently associated with the band.

Members can be assigned an instrument:

- Guitar
- Bass
- Drums
- Vocals

Instrument selections are persisted in Firestore and shared across users.

The application also resolves user profile information from Firestore so members are represented by their names rather than authentication email addresses.

---

## 📅 Two-Week Availability System

Members can submit detailed availability for an upcoming two-week period.

The interface displays:

**Week 1**
- Monday → Sunday

**Week 2**
- Monday → Sunday

Each member can mark individual days as available or unavailable.

Available days can contain multiple time ranges.

Example:

```text
Monday
Available

10:00 AM – 2:00 PM
5:00 PM – 10:00 PM
```

All availability is stored in Firestore and associated with:

- User
- Band
- Availability period
- Individual dates
- Time ranges

This allows availability to remain synchronized between different band members and devices.

---

## 👀 Band Availability View

Members can view availability submitted by everyone in the band from one screen.

The dashboard displays:

- Member names
- Individual dates
- Available/unavailable status
- Multiple availability windows
- Two weeks of scheduling information

This gives the entire band a shared scheduling view instead of requiring members to compare schedules manually through messages.

---

## ⚡ Practice Window Detection

Band Practice analyzes submitted availability to identify useful practice opportunities.

When enough members share a compatible practice window, the application can surface it as a **Best Practice Window**.

This feature is being expanded to support increasingly intelligent overlap detection between different time ranges.

Example:

```text
Christian: 10:00 AM – 3:00 PM
Greg:      11:00 AM – 2:00 PM
Rachel:     9:00 AM – 4:00 PM

Common Window:
11:00 AM – 2:00 PM
```

This scheduling logic is one of the main areas of continued development.

---

## 🥁 Practice Scheduling

Bands can create official practices containing:

- Practice title
- Date
- Location
- Practice goal

Scheduled practices are stored in Firestore and displayed through the band's Upcoming Practices section.

This separates confirmed practices from general member availability.

---

## 🎤 Upcoming Shows

Band members can maintain a shared gig schedule.

Each show can include:

- Show title
- Date
- Venue/location
- Call time
- Setlist
- Instagram/show link

Shows can be created, edited, and deleted.

The band's dashboard surfaces upcoming show information so important gig details are immediately visible to members.

---

## 🎯 Band Goals

Bands can create shared goals and milestones.

Each goal contains:

- Title
- Description
- Why the goal matters
- How the band plans to accomplish it
- Deadline

Examples include:

```text
Finish recording an EP
Book the band's first show
Release a single
Complete new merchandise
Plan a tour
```

Goals are persisted in Firestore and accessible to everyone in the band.

---

## ⚙️ Band Settings

The Band Settings system provides centralized management for:

- Band name
- Band logo
- Invitation code
- Invitation code regeneration
- Band members
- Member instruments

Band images are uploaded through Firebase Storage while structured band information is stored in Cloud Firestore.

---

# 🏗️ Architecture

Band Practice uses Firebase as a serverless backend.

```text
                React + Vite
                     │
                     ▼
              Firebase SDK
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
 Firebase Auth    Firestore     Storage
        │            │            │
     Accounts      App Data     Band Logos
```

### Firebase Authentication

Handles:

- Email/password authentication
- Google OAuth
- Email verification
- Authentication state
- Persistent sessions

### Cloud Firestore

Stores application data including:

```text
users/
bands/
band memberships/
availability/
shows/
practices/
goals/
member roles/instruments/
```

### Firebase Storage

Stores uploaded band logos and images.

---

# 🗃️ Firestore Data Design

Availability uses nested band-specific collections.

Example:

```text
bands/{bandId}/availability/{periodId}/members/{userId}
```

An availability document contains data similar to:

```javascript
{
  uid,
  displayName,
  email,
  bandId,
  periodId,
  periodStart,
  days,
  updatedAt
}
```

Individual days contain availability and one or more time slots:

```javascript
{
  "2026-08-17": {
    available: true,
    slots: [
      {
        start: "17:00",
        end: "22:00"
      }
    ]
  }
}
```

This structure allows availability to remain isolated by band, scheduling period, and user.

---

# 🛠️ Tech Stack

### Frontend

- React
- JavaScript
- Vite
- CSS

### Backend / Cloud Services

- Firebase Authentication
- Cloud Firestore
- Firebase Storage

### Authentication

- Email/password authentication
- Google OAuth
- Firebase session persistence
- Email verification

### Development & DevOps

- Git
- GitHub
- GitHub Actions
- ESLint
- Vitest
- Firebase Hosting

---

# 🧪 Testing & CI

The repository includes automated development checks for:

- ESLint
- Vitest
- Production builds

Before deployment, the application can be validated with:

```bash
npm run lint
npm run test:run
npm run build
```

GitHub Actions provides automated CI checks when changes are pushed to the repository.

This helps catch linting, testing, and build failures before changes reach production.

---

# 🚀 Production Deployment

Band Practice is deployed as a production Vite application using Firebase Hosting.

The deployment process builds an optimized production bundle and publishes the generated assets to Firebase's hosting infrastructure.

```bash
npm run build
firebase deploy --only hosting
```

The application uses Firebase's cloud services for authentication, database persistence, file storage, and hosting.

---

# 💻 Running Locally

Clone the repository:

```bash
git clone https://github.com/ChristianBarajas/band-practice.git
cd band-practice
```

Install dependencies:

```bash
npm install
```

Create a `.env.local` file containing the Firebase web configuration:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

Start the development server:

```bash
npm run dev -- --host 127.0.0.1 --port 3000 --strictPort
```

Then open:

```text
http://127.0.0.1:3000
```

---

# 📁 Key Project Files

```text
band-practice/
│
├── src/
│   ├── App.jsx
│   ├── firebase.js
│   ├── App.test.jsx
│   └── setupTests.js
│
├── public/
│   └── favicon.png
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── firebase.json
├── vite.config.js
├── package.json
└── README.md
```

---

# 🚧 Continued Development

Band Practice is functional and being tested with real users.

Current areas of continued development include:

### Smarter Availability Matching

Improve scheduling algorithms so the application can calculate intersections between different availability ranges instead of relying only on identical time slots.

### Notifications

Potential reminders for:

- Upcoming practices
- Missing availability
- Newly scheduled practices
- Upcoming shows

### Responsive Design

Continue improving layouts for phones and smaller screens.

### Automated Testing

Expand the test suite around:

- Date calculations
- Time formatting
- Availability intersections
- Band membership logic

### Firestore Security

Continue tightening Firestore security rules around band membership and user-specific write permissions.

---

# 💡 Engineering Takeaways

Building Band Practice involved more than creating a user interface.

The project required designing and integrating:

- Authentication flows
- OAuth
- Persistent user sessions
- NoSQL data modeling
- Nested Firestore collections
- Multi-user shared state
- File uploads
- Invitation-based membership
- Date and time handling
- Scheduling logic
- CRUD operations
- Cloud deployment
- Automated CI checks
- Production debugging

The application also moved beyond local development and is now being tested by real band members, allowing development decisions to be driven by actual user feedback.

---

# 🎸 Project Vision

Band Practice started with one question:

**When can everyone practice?**

The goal is to grow that idea into a simple digital home base where independent bands can organize everything surrounding the music:

**Availability → Practices → Goals → Shows**

without needing to coordinate across several different apps and group chats.

---

# Developer

**Christian Barajas**  
Computer Science Graduate  
California State University, Fullerton

Built with React, Firebase, and a lot of loud music. 🤘