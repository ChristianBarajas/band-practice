import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import App from "./App";

vi.mock("./firebase", () => {
  return {
    auth: {},
    db: {},
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
    doc: vi.fn(),
    setDoc: vi.fn(),
    serverTimestamp: vi.fn(() => "mock-timestamp"),
  };
});

describe("App", () => {
  test("shows the auth page when no user is logged in", async () => {
    render(<App />);

    // Updated to match your new UI
    expect(
      await screen.findByText(/welcome to band practice/i)
    ).toBeInTheDocument();

    expect(screen.getByText(/login/i)).toBeInTheDocument();
    expect(
      screen.getByText(/continue with google/i)
    ).toBeInTheDocument();
  });
});