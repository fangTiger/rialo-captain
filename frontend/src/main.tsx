import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./design/tokens.css";
import App from "./App";
import { publicDeployConfig } from "./config/deployment";

const clientId = publicDeployConfig.googleClientId;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>,
);
