import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { useSWRConfig } from "swr";
import { apiFetch } from "../api/client";
import { resolvePublicDeployConfig } from "../config/deployment";

export function GoogleSignIn() {
  const navigate = useNavigate();
  const { mutate } = useSWRConfig();
  const clientId = resolvePublicDeployConfig().googleClientId;
  const hasClientId = Boolean(
    clientId && !clientId.startsWith("your-google-client-id"),
  );

  async function onSuccess(cred: CredentialResponse) {
    if (!cred.credential) return;

    await apiFetch<unknown>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ id_token: cred.credential }),
    });
    await mutate("/me");
    navigate("/", { replace: true });
  }

  if (!hasClientId) {
    return (
      <div
        style={{
          color: "var(--warn-amber)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
        }}
      >
        Google OAuth client id missing
      </div>
    );
  }

  return (
    <div style={{ display: "grid", placeItems: "center" }}>
      <GoogleLogin
        onSuccess={onSuccess}
        onError={() => console.warn("Google 登录失败")}
        theme="filled_black"
        text="signin_with"
        shape="pill"
      />
    </div>
  );
}
