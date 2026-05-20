import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import App from "./App";

vi.mock("./firebase", () => {
  return {
    auth: {},
    db: {},
    storage: {},
  };
});

vi.mock("firebase/auth", () => {
  return {
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    sendEmailVerification: vi.fn(),
    signOut: vi.fn(),
    GoogleAuthProvider: vi.fn(),
    signInWithPopup: vi.fn(),
    onAuthStateChanged: vi.fn((auth, callback) => {
      callback(null);
      return vi.fn();
    }),
  };
});

vi.mock("firebase/firestore", () => {
  return {
    addDoc: vi.fn(),
    collection: vi.fn(),
    doc: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    serverTimestamp: vi.fn(() => "mock-timestamp"),
    setDoc: vi.fn(),
    where: vi.fn(),
  };
});

vi.mock("firebase/storage", () => {
  return {
    getDownloadURL: vi.fn(),
    ref: vi.fn(),
    uploadBytes: vi.fn(),
  };
});

describe("App", () => {
  test("shows the auth page when no user is logged in", async () => {
    render(<App />);

    expect(await screen.findByText(/welcome/i)).toBeInTheDocument();
    expect(screen.getByText(/to band/i)).toBeInTheDocument();
    expect(screen.getByText(/practice/i)).toBeInTheDocument();

    expect(screen.getByText(/login/i)).toBeInTheDocument();
    expect(screen.getByText(/continue with google/i)).toBeInTheDocument();
  });
});