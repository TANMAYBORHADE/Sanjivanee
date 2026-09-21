import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const body = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "Sanjeevani — traceability for Ayurvedic herbs",
  description:
    "Sanjeevani records where a herb was picked, who held it next, and what the lab found — as a chain of signed events anyone with the bottle can read.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <div className="bg" aria-hidden="true">
          <div className="blob b1" />
          <div className="blob b2" />
          <div className="blob b3" />
        </div>
        <div className="grain" aria-hidden="true" />

        <header>
          <div className="wrap nav">
            <Link href="/" className="brand">
              <svg className="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M16 3C9 8 6 13 6 18a10 10 0 0 0 20 0c0-5-3-10-10-15Z" stroke="#7CF5B4" strokeWidth="1.6" />
                <path d="M16 27V11" stroke="#7CF5B4" strokeWidth="1.6" />
                <path d="M16 17l5-4M16 21l-5-4" stroke="#34C77B" strokeWidth="1.6" />
              </svg>
              Sanjeevani
            </Link>
            <ul>
              <li><Link href="/verify">Verify</Link></li>
              <li><Link href="/dashboard">Dashboard</Link></li>
              <li><Link href="/login">Log in</Link></li>
            </ul>
            <Link href="/verify" className="cta">
              <span className="dot" /> Scan a batch
            </Link>
          </div>
        </header>

        {children}

        <footer>
          <div className="wrap fgrid">
            <div>
              <div className="big-cta">Trust, but verify.</div>
              <p>Sanjeevani — a traceability ledger for Ayurvedic herbs. Built with Next.js, Express, Postgres, Solidity and IPFS.</p>
            </div>
            <Link href="/verify" className="cta">
              <span className="dot" /> Scan a batch
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}