import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GoogleSignIn } from "../auth/GoogleSignIn";

vi.mock("@react-oauth/google", () => ({
  GoogleLogin: () => <button type="button">google login loaded</button>,
}));

describe("GoogleSignIn", () => {
  it("does not mount Google login when client id is missing", () => {
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <GoogleSignIn />
      </MemoryRouter>,
    );

    expect(screen.queryByText("google login loaded")).not.toBeInTheDocument();
    expect(screen.getByText("Google OAuth client id missing")).toBeInTheDocument();
  });
});
