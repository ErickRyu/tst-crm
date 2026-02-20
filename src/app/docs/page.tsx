"use client";

import { useEffect } from "react";

export default function DocsPage() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css";
    document.head.appendChild(link);

    const presetScript = document.createElement("script");
    presetScript.src =
      "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js";
    document.head.appendChild(presetScript);

    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js";
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      w.SwaggerUIBundle({
        url: "/api/openapi",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [w.SwaggerUIBundle.presets.apis, w.SwaggerUIStandalonePreset],
        plugins: [w.SwaggerUIBundle.plugins.DownloadUrl],
        layout: "StandaloneLayout",
      });
    };
    document.head.appendChild(script);

    return () => {
      link.remove();
      script.remove();
      presetScript.remove();
    };
  }, []);

  return <div id="swagger-ui" />;
}
