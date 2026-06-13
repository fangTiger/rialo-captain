import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useMe } from "../hooks/useMe";

export function GoogleSignIn() {
  const navigate = useNavigate();
  const { refresh } = useMe();

  async function onSuccess(cred: CredentialResponse) {
    if (!cred.credential) return;

    await apiFetch<unknown>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ id_token: cred.credential }),
    });
    await refresh();
    navigate("/", { replace: true });
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
