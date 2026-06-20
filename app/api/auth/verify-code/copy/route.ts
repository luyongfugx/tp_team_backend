import { NextResponse } from "next/server"

function normalizeCode(value: string | null) {
  const code = value?.trim() || ""
  return /^\d{6}$/.test(code) ? code : ""
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export async function GET(req: Request) {
  const code = normalizeCode(new URL(req.url).searchParams.get("code"))
  const escapedCode = escapeHtml(code)
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Copy Verification Code</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f6f7f9;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #111;
      }
      .card {
        width: min(440px, calc(100vw - 32px));
        box-sizing: border-box;
        background: #fff;
        border: 1px solid #edf0f3;
        border-radius: 18px;
        padding: 32px;
        box-shadow: 0 12px 36px rgba(15, 23, 42, 0.06);
        text-align: center;
      }
      img {
        width: 72px;
        height: 72px;
        border-radius: 16px;
      }
      .code {
        margin: 28px 0 20px;
        font-size: 44px;
        line-height: 1;
        font-weight: 800;
        letter-spacing: 8px;
      }
      button {
        appearance: none;
        border: 0;
        border-radius: 10px;
        background: #111;
        color: #fff;
        padding: 13px 20px;
        font-size: 17px;
        font-weight: 700;
      }
      p {
        color: #555;
        font-size: 15px;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <img src="/timeprint-mail-icon.png" alt="Timeprint" />
      ${
        code
          ? `<div id="code" class="code">${escapedCode}</div>
             <button id="copyButton" type="button">Copy code</button>
             <p id="status">Tap the button if the code was not copied automatically.</p>`
          : `<p>Invalid verification code.</p>`
      }
    </main>
    <script>
      const code = ${JSON.stringify(code)};
      const status = document.getElementById("status");
      async function copyCode() {
        if (!code || !navigator.clipboard) return false;
        try {
          await navigator.clipboard.writeText(code);
          if (status) status.textContent = "Verification code copied.";
          return true;
        } catch {
          if (status) status.textContent = "Copy failed. Press and hold the code to copy it manually.";
          return false;
        }
      }
      document.getElementById("copyButton")?.addEventListener("click", copyCode);
      copyCode();
    </script>
  </body>
</html>`

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
