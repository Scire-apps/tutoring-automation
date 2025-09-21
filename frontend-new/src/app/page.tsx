import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.wrap} role="main" aria-label="Under development">
      <div className={styles.card} role="status">
        <div className={styles.icon} aria-hidden>
          <svg viewBox="0 0 24 24" width="56" height="56" strokeWidth="1.75" stroke="currentColor" fill="none">
            <circle cx="12" cy="12" r="9" opacity="0.15" />
            <path d="M8 12h8" strokeLinecap="round" />
            <path d="M12 8v8" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className={styles.title}>Under Development</h1>
        <p className={styles.text}>
          We&apos;re building something great. Thanks for your patience — please check back soon.
        </p>
        <div className={styles.dots} aria-hidden>
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>
        <small className={styles.hint}>Status: active • last updated just now</small>
      </div>
    </main>
  );
}