import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.container}>
      {/* Top Tagline */}
      <div className={styles.tagline}>
        Simple • Fast • Secure
      </div>

      {/* Main Heading */}
      <h1 className={styles.mainHeading}>Match. Learn. Excel.</h1>

      {/* Description */}
      <p className={styles.description}>
        Join as a tutor or request help as a tutee. Get matched, schedule sessions, and track progress — all in one place.
      </p>

      {/* Call-to-Action Boxes */}
      <div className={styles.actionBoxes}>
        {/* Tutor Box */}
        <div className={`${styles.actionBox} ${styles.tutorBox}`}>
          <div className={styles.boxIcon}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
          <div className={styles.boxContent}>
            <h3 className={styles.boxTitle}>Sign up as Tutor</h3>
            <p className={styles.boxDescription}>Browse opportunities and start tutoring.</p>
          </div>
        </div>

        {/* Tutee Box */}
        <div className={`${styles.actionBox} ${styles.tuteeBox}`}>
          <div className={styles.boxIcon}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M7 14l5-5 5 5z"/>
            </svg>
          </div>
          <div className={styles.boxContent}>
            <h3 className={styles.boxTitle}>Sign up as Tutee</h3>
            <p className={styles.boxDescription}>Request help for subjects and schedule sessions.</p>
          </div>
        </div>
      </div>

      {/* Email Information Box */}
      <div className={styles.emailBox}>
        <h4 className={styles.emailTitle}>Use your @hdsb.ca email</h4>
        <p className={styles.emailDescription}>
          You can create two separate accounts with the same school email — one as a Tutor and one as a Tutee. 
          Just sign up for each role using your @hdsb.ca address.
        </p>
      </div>

      {/* Login Link */}
      <div className={styles.loginLink}>
        Already have an account? Log in →
      </div>
    </main>
  );
}