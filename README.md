# Band Practice

A modern web app built for bands to organize practice schedules, track goals, manage members, and stop relying on chaotic group chats.

---

# Overview

Band Practice helps bands stay organized by giving members one place to:

- Create and manage bands
- Upload band logos
- Join bands through invitation codes
- Track upcoming practices
- Plan future shows
- Set band goals and milestones
- Manage member availability

The long-term vision is to create a central operating system for independent bands and local music scenes.

---

# Features

## Authentication

- Email/password sign up
- Google authentication
- Email verification system
- Persistent user sessions

---

## Band System

- Create bands
- Upload custom band logos
- Edit band settings
- Generate invitation codes
- Dedicated band dashboard pages

---

## Dashboard

Every band gets its own dashboard containing:

- Upcoming Shows
- Upcoming Practices
- Band Goals
- Member Availability

---

# Tech Stack

## Frontend

- React
- Vite

## Backend / Services

- Firebase Authentication
- Cloud Firestore
- Firebase Storage

## Deployment / Tooling

- GitHub
- GitHub Actions CI/CD
- ESLint

---

# Screenshots

Coming soon.

---

# Installation

## Clone the repository

```bash
git clone https://github.com/ChristianBarajas/band-practice.git
```

## Move into the project

```bash
cd band-practice
```

## Install dependencies

```bash
npm install
```

---

# Firebase Setup

Create a `.env.local` file in the root directory.

Add your Firebase credentials:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

---

# Running Locally

Start the development server:

```bash
npm run dev -- --host 127.0.0.1 --port 3000 --strictPort
```

Open:

```text
http://127.0.0.1:3000
```

---

# Build for Production

```bash
npm run build
```

---

# Linting

```bash
npm run lint
```

---

# Current Project Status

## MVP Stage

Core systems are functional:

- Authentication
- User profiles
- Band creation
- Band dashboards
- Band logo uploads
- Invitation codes
- Settings page

---

# Future Plans

## Planned Features

### Availability System

Members can mark:

- Available all day
- Partially available
- Not available

Bands will automatically detect overlapping practice windows.

---

### Practice Scheduling

Band leaders will be able to:

- Schedule official practices
- Notify all members
- View attendance responses

---

### Goals / Progression System

Bands can create goals such as:

- Record EP
- Play first show
- Finish demo
- Book tour

Completed goals will visually level up the band profile.

---

### Show Management

Planned additions:

- Venue tracking
- Set times
- Flyer uploads
- Ticket links
- Show history archive

---

### Notifications

Future notification systems:

- Practice reminders
- Member activity alerts
- Availability reminders
- Goal completion notifications

---

### Mobile Optimization

Future updates will improve:

- Mobile responsiveness
- Native-app feel
- Touch interactions

---

# Long-Term Vision

The goal of Band Practice is to become a full organizational platform for local bands and music communities.

Not just a scheduling tool —
a digital home base for independent artists.

---

# Contributing

This project is currently in active solo development.

---

# License

MIT License

---

# Developer

Created by Christian Barajas

Computer Science Graduate — California State University, Fullerton
