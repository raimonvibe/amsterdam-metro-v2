import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { guardTranslatorDom, keepSiteLanguage } from "./i18n/translated";

guardTranslatorDom();
keepSiteLanguage();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
