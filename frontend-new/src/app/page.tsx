export default function Home() {
  return (
    <main className="wrap" role="main" aria-label="Under development">
      <div className="card" role="status">
        <div className="icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="56" height="56" strokeWidth="1.75" stroke="currentColor" fill="none">
            <circle cx="12" cy="12" r="9" opacity="0.15" />
            <path d="M8 12h8" strokeLinecap="round" />
            <path d="M12 8v8" strokeLinecap="round" />
          </svg>
        </div>
        <h1>Under Development</h1>
        <p>
          We&apos;re building something great. Thanks for your patience — please check back soon.
        </p>
        <div className="dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <small className="hint">Status: active • last updated just now</small>
      </div>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          background: radial-gradient(1200px 600px at 10% -10%, #e0f2fe 0%, transparent 60%),
                      radial-gradient(1200px 600px at 110% 110%, #e9d5ff 0%, transparent 60%),
                      linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
          color: #0f172a;
        }

        .card {
          width: min(680px, 100%);
          background: #ffffffcc;
          backdrop-filter: saturate(160%) blur(6px);
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 32px 28px;
          box-shadow: 0 10px 30px rgba(2, 6, 23, 0.08), 0 1px 0 rgba(2, 6, 23, 0.04) inset;
          text-align: center;
        }

        .icon {
          width: 88px;
          height: 88px;
          margin: 0 auto 12px;
          display: grid;
          place-items: center;
          color: #2563eb;
          background: conic-gradient(from 210deg at 50% 50%, #93c5fd, #c4b5fd, #93c5fd);
          border-radius: 999px;
          box-shadow: 0 10px 24px rgba(37, 99, 235, 0.25);
        }

        h1 {
          margin: 8px 0 8px;
          font-size: 28px;
          line-height: 1.2;
          letter-spacing: -0.01em;
        }

        p {
          margin: 0 auto 18px;
          max-width: 48ch;
          color: #334155;
          font-size: 16px;
          line-height: 1.6;
        }

        .dots {
          display: inline-flex;
          gap: 8px;
          margin: 8px 0 14px;
        }
        .dots span {
          width: 8px;
          height: 8px;
          background: #2563eb;
          border-radius: 999px;
          animation: bounce 1.2s infinite ease-in-out;
        }
        .dots span:nth-child(2) { animation-delay: 0.15s; }
        .dots span:nth-child(3) { animation-delay: 0.3s; }

        .hint {
          color: #64748b;
        }

        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.6; }
          40% { transform: translateY(-6px); opacity: 1; }
        }

        @media (prefers-color-scheme: dark) {
          .wrap { color: #e5e7eb; }
          .card {
            background: rgba(2, 6, 23, 0.6);
            border-color: rgba(148, 163, 184, 0.25);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), 0 1px 0 rgba(255, 255, 255, 0.02) inset;
          }
          p { color: #cbd5e1; }
          .icon { box-shadow: 0 10px 24px rgba(37, 99, 235, 0.35); }
        }
      `}</style>
    </main>
  );
}