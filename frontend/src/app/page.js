"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

const SPECIES = [
  { word: "ASHWAGANDHA", css: "linear-gradient(140deg,#C98A3E,#6B4A18)" },
  { word: "TULSI", css: "linear-gradient(140deg,#48D68E,#0E5C36)" },
  { word: "BRAHMI", css: "linear-gradient(140deg,#5AC8D8,#165A6B)" },
];

export default function LandingPage() {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups = [];

    // ---- scroll reveals ----
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    const rvEls = root.querySelectorAll(".rv");
    rvEls.forEach((el, i) => {
      el.style.transitionDelay = (i % 4) * 70 + "ms";
      io.observe(el);
    });
    cleanups.push(() => io.disconnect());

    // ---- hero word morph + swatches ----
    const bw = root.querySelector("#bigword");
    const swatches = [...root.querySelectorAll(".sw")];
    let wi = 0;
    function setWord(w) {
      bw.classList.add("out");
      setTimeout(() => {
        bw.innerHTML = "<span>" + w + "</span>";
        requestAnimationFrame(() => bw.classList.remove("out"));
      }, 380);
    }
    const swatchHandlers = swatches.map((s, idx) => {
      const handler = () => {
        swatches.forEach((x) => x.setAttribute("aria-pressed", "false"));
        s.setAttribute("aria-pressed", "true");
        wi = idx;
        setWord(SPECIES[idx].word);
      };
      s.addEventListener("click", handler);
      return handler;
    });
    let interval;
    if (!reduced) {
      interval = setInterval(() => {
        wi = (wi + 1) % SPECIES.length;
        swatches.forEach((x, i) => x.setAttribute("aria-pressed", i === wi ? "true" : "false"));
        setWord(SPECIES[wi].word);
      }, 4200);
    }
    cleanups.push(() => {
      swatches.forEach((s, i) => s.removeEventListener("click", swatchHandlers[i]));
      if (interval) clearInterval(interval);
    });

    // ---- card hover glow follows cursor ----
    const cards = [...root.querySelectorAll(".card")];
    const cardHandlers = cards.map((c) => {
      const handler = (e) => {
        const r = c.getBoundingClientRect();
        c.style.setProperty("--mx", e.clientX - r.left + "px");
        c.style.setProperty("--my", e.clientY - r.top + "px");
      };
      c.addEventListener("pointermove", handler);
      return handler;
    });
    cleanups.push(() => cards.forEach((c, i) => c.removeEventListener("pointermove", cardHandlers[i])));

    // ---- progress bars when visible ----
    const barIO = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.style.width = e.target.dataset.p + "%";
            barIO.unobserve(e.target);
          }
        }),
      { threshold: 0.6 }
    );
    root.querySelectorAll(".mini i").forEach((b) => barIO.observe(b));
    cleanups.push(() => barIO.disconnect());

    // ---- chain: stages light up on scroll ----
    const chainBlock = root.querySelector("#chainblock");
    const fill = root.querySelector("#fill");
    const sts = [...root.querySelectorAll(".st")];
    let chainDone = false;
    const chainIO = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting && !chainDone) {
            chainDone = true;
            sts.forEach((s, i) =>
              setTimeout(() => {
                s.classList.add("on");
                fill.style.width = ((i + 1) / sts.length) * 100 + "%";
              }, i * 260)
            );
          }
        }),
      { threshold: 0.35 }
    );
    if (chainBlock) chainIO.observe(chainBlock);
    cleanups.push(() => chainIO.disconnect());

    // ---- verify demo sequence (illustrative only on the landing page) ----
    const vbtn = root.querySelector("#vbtn");
    const vsteps = [...root.querySelectorAll("#vsteps li")];
    const seal = root.querySelector("#seal");
    let running = false;
    function runDemo() {
      if (running) return;
      running = true;
      seal.classList.remove("show");
      vsteps.forEach((l) => l.classList.remove("active", "done"));
      vbtn.textContent = "Verifying…";
      let i = 0;
      const next = () => {
        if (i > 0) vsteps[i - 1].classList.replace("active", "done");
        if (i >= vsteps.length) {
          seal.classList.add("show");
          vbtn.textContent = "Run demo again";
          running = false;
          return;
        }
        vsteps[i].classList.add("active");
        i++;
        setTimeout(next, reduced ? 60 : 620);
      };
      next();
    }
    if (vbtn) vbtn.addEventListener("click", runDemo);
    cleanups.push(() => vbtn && vbtn.removeEventListener("click", runDemo));

    // ---- QR (deterministic decorative pattern) ----
    const qr = root.querySelector("#qr");
    if (qr && qr.childElementCount === 0) {
      const N = 17;
      let seed = 4417;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
      };
      const finder = (r, c) => {
        const inBox = (r0, c0) => r >= r0 && r < r0 + 7 && c >= c0 && c < c0 + 7;
        if (inBox(0, 0) || inBox(0, N - 7) || inBox(N - 7, 0)) {
          const r0 = r < 7 ? 0 : N - 7,
            c0 = c < 7 ? 0 : N - 7;
          const dr = r - r0,
            dc = c - c0;
          const edge = dr === 0 || dr === 6 || dc === 0 || dc === 6;
          const core = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          return edge || core;
        }
        return null;
      };
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) {
          const f = finder(r, c);
          const on = f === null ? rnd() > 0.5 : f;
          const cell = document.createElement("i");
          if (!on) cell.className = "o";
          qr.appendChild(cell);
        }
    }

    // ---- dashboard preview tabs ----
    const tabs = [...root.querySelectorAll(".tab")];
    const tabHandlers = tabs.map((t) => {
      const handler = () => {
        tabs.forEach((x) => x.setAttribute("aria-selected", "false"));
        t.setAttribute("aria-selected", "true");
        root.querySelectorAll(".pane").forEach((p) => p.classList.remove("on"));
        root.querySelector("#" + t.dataset.p).classList.add("on");
      };
      t.addEventListener("click", handler);
      return handler;
    });
    cleanups.push(() => tabs.forEach((t, i) => t.removeEventListener("click", tabHandlers[i])));

    // ---- floating 3D specimen (three.js, desktop + motion-allowed only) ----
    let raf;
    let disposed = false;
    if (!reduced && window.innerWidth >= 700) {
      const existing = document.querySelector('script[data-threejs="sanjeevani"]');
      const startThree = () => {
        if (disposed) return;
        const canvas = root.querySelector("#three");
        if (!canvas || !window.THREE) return;
        const host = canvas.parentElement;
        const renderer = new window.THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        const scene = new window.THREE.Scene();
        const cam = new window.THREE.PerspectiveCamera(45, 1, 0.1, 100);
        cam.position.z = 7;

        const group = new window.THREE.Group();
        scene.add(group);

        const core = new window.THREE.Mesh(
          new window.THREE.IcosahedronGeometry(1.5, 0),
          new window.THREE.MeshPhongMaterial({ color: 0x2fa96b, transparent: true, opacity: 0.35, shininess: 70, flatShading: true })
        );
        const shell = new window.THREE.LineSegments(
          new window.THREE.EdgesGeometry(new window.THREE.IcosahedronGeometry(1.52, 0)),
          new window.THREE.LineBasicMaterial({ color: 0x7cf5b4, transparent: true, opacity: 0.6 })
        );
        group.add(core, shell);

        const nodes = new window.THREE.Group();
        group.add(nodes);
        const dotGeo = new window.THREE.SphereGeometry(0.07, 10, 10);
        for (let i = 0; i < 7; i++) {
          const m = new window.THREE.Mesh(dotGeo, new window.THREE.MeshBasicMaterial({ color: i < 4 ? 0xf0a93b : 0x7cf5b4 }));
          const a = (i / 7) * Math.PI * 2,
            r = 2.7;
          m.position.set(Math.cos(a) * r, Math.sin(a * 1.6) * 0.8, Math.sin(a) * r);
          nodes.add(m);
        }
        const ring = new window.THREE.Mesh(
          new window.THREE.TorusGeometry(2.7, 0.006, 6, 120),
          new window.THREE.MeshBasicMaterial({ color: 0x7cf5b4, transparent: true, opacity: 0.28 })
        );
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        scene.add(new window.THREE.AmbientLight(0x6fffc0, 0.7));
        const key = new window.THREE.PointLight(0xffffff, 1.1);
        key.position.set(4, 5, 6);
        scene.add(key);
        const warm = new window.THREE.PointLight(0xf0a93b, 0.7);
        warm.position.set(-5, -3, 3);
        scene.add(warm);

        let mx = 0,
          my = 0;
        const onMove = (e) => {
          mx = e.clientX / innerWidth - 0.5;
          my = e.clientY / innerHeight - 0.5;
        };
        addEventListener("pointermove", onMove, { passive: true });

        const onResize = () => {
          const w = host.clientWidth,
            h = host.clientHeight;
          renderer.setSize(w, h, false);
          cam.aspect = w / h;
          cam.updateProjectionMatrix();
        };
        addEventListener("resize", onResize);
        onResize();

        let t = 0;
        const loop = () => {
          if (disposed) return;
          raf = requestAnimationFrame(loop);
          t += 0.01;
          group.rotation.y += 0.004;
          group.rotation.x = Math.sin(t * 0.6) * 0.16 + my * 0.25;
          group.position.y = Math.sin(t) * 0.22;
          group.position.x = mx * 0.6;
          nodes.rotation.y -= 0.006;
          renderer.render(scene, cam);
        };
        loop();

        cleanups.push(() => {
          removeEventListener("pointermove", onMove);
          removeEventListener("resize", onResize);
          if (raf) cancelAnimationFrame(raf);
        });
      };

      if (existing && window.THREE) {
        startThree();
      } else if (!existing) {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
        s.dataset.threejs = "sanjeevani";
        s.onload = startThree;
        document.head.appendChild(s);
      } else {
        existing.addEventListener("load", startThree);
      }
    }

    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return (
    <div ref={rootRef}>
      {/* ============ HERO ============ */}
      <div className="wrap hero">
        <div className="pillrow" role="tablist" aria-label="View">
          <button className="pill" role="tab" aria-selected="true">Trace</button>
          <Link href="/verify" className="pill" role="tab" aria-selected="false">Verify</Link>
        </div>

        <div className="stage">
          <canvas id="three" aria-hidden="true" />
          <h2 className="bigword" id="bigword" aria-live="polite"><span>ASHWAGANDHA</span></h2>

          <svg className="specimen" viewBox="0 0 400 300" aria-hidden="true">
            <defs>
              <linearGradient id="gl" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#BFF6D8" stopOpacity=".55" />
                <stop offset=".5" stopColor="#34C77B" stopOpacity=".32" />
                <stop offset="1" stopColor="#0B3D2A" stopOpacity=".6" />
              </linearGradient>
              <linearGradient id="lq" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#7CF5B4" stopOpacity=".85" />
                <stop offset="1" stopColor="#127A4C" stopOpacity=".95" />
              </linearGradient>
              <linearGradient id="cap" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#F0A93B" />
                <stop offset=".5" stopColor="#FFD79A" />
                <stop offset="1" stopColor="#C0791D" />
              </linearGradient>
            </defs>
            <g id="vial" transform="translate(200 150)">
              <rect x="-46" y="-118" width="92" height="22" rx="8" fill="url(#cap)" />
              <path d="M-40 -96h80v128a40 40 0 0 1-40 40 40 40 0 0 1-40-40Z" fill="url(#gl)" stroke="#9BF0C6" strokeOpacity=".5" strokeWidth="1.5" />
              <path d="M-34 10h68v22a34 34 0 0 1-34 34 34 34 0 0 1-34-34Z" fill="url(#lq)" />
              <path d="M-26 -84c0 40 6 66 26 86" stroke="#E7FFF3" strokeOpacity=".38" strokeWidth="4" strokeLinecap="round" fill="none" />
              <g opacity=".95">
                <path d="M6 -70c-22 6-34 24-32 44 20 4 38-10 44-30Z" fill="#2FA96B" />
                <path d="M6 -70c-8 20-2 38 12 50 14-14 14-38 2-52Z" fill="#48D68E" />
                <path d="M-26 -26c14 6 30 6 44 0" stroke="#0B3D2A" strokeOpacity=".5" strokeWidth="1.5" fill="none" />
              </g>
            </g>
          </svg>
        </div>

        <div className="heroGrid">
          <div className="lede rv">
            <h1>Every leaf gets a paper trail it can&apos;t rewrite.</h1>
            <p>Sanjeevani records where a herb was picked, who held it next, and what the lab found — as a chain of signed events anyone with the bottle can read.</p>
            <div className="trust">
              <span className="chip">7 custody stages</span>
              <span className="chip">Lab reports on IPFS</span>
            </div>
          </div>

          <div />

          <div className="rail rv">
            <h4>Pick a species</h4>
            <div className="swatches" id="swatches">
              {SPECIES.map((s, i) => (
                <button
                  key={s.word}
                  className="sw"
                  aria-pressed={i === 0 ? "true" : "false"}
                  aria-label={s.word}
                  style={{ background: s.css }}
                />
              ))}
            </div>
            <h4>Open a live batch</h4>
            <div className="batchchips">
              <Link href="/verify?code=SNJ-4417-ASH" className="bchip">SNJ-4417-ASH</Link>
              <Link href="/verify?code=SNJ-4392-TLS" className="bchip">SNJ-4392-TLS</Link>
              <Link href="/dashboard" className="bchip">Open your dashboard</Link>
            </div>
          </div>
        </div>
      </div>

      {/* ============ CHAIN ============ */}
      <section id="chain">
        <div className="wrap">
          <div className="head rv">
            <h2>A batch can only move forward.</h2>
            <p>Each handover is signed by whoever currently holds the batch. Skipping a stage, repeating one, or backdating one is rejected before it ever reaches the chain.</p>
          </div>

          <div className="chain rv" id="chainblock">
            <div className="track"><i className="fill" id="fill" /></div>
            <div className="stages">
              <div className="st"><div className="node" /><h5>Collected</h5><p>GPS, species and weight captured in the field.</p><div className="who">Farmer</div></div>
              <div className="st"><div className="node" /><h5>Aggregated</h5><p>Small harvests pooled into one traceable lot.</p><div className="who">Aggregator</div></div>
              <div className="st"><div className="node" /><h5>Processed</h5><p>Dried, cleaned and milled to spec.</p><div className="who">Processor</div></div>
              <div className="st"><div className="node" /><h5>Lab tested</h5><p>Report pinned to IPFS, hash written on-chain.</p><div className="who">Testing lab</div></div>
              <div className="st"><div className="node" /><h5>Manufactured</h5><p>Blended into a finished formulation.</p><div className="who">Manufacturer</div></div>
              <div className="st"><div className="node" /><h5>Packaged</h5><p>Each pack gets its own scannable code.</p><div className="who">Manufacturer</div></div>
              <div className="st"><div className="node" /><h5>Distributed</h5><p>Shipped, and still readable on the shelf.</p><div className="who">Distributor</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ BATCHES (illustrative — real data lives in /dashboard) ============ */}
      <section id="batches">
        <div className="wrap">
          <div className="head rv">
            <h2>Batches moving right now.</h2>
            <p>An example of what shows up in the ledger — species, origin district, who holds it, and how far along it is.</p>
          </div>

          <div className="cards" id="cards">
            <article className="card rv">
              <div className="cardtop">
                <div><div className="species">Ashwagandha</div><div className="latin">Withania somnifera</div></div>
                <span className="badge b-ok">Lab tested</span>
              </div>
              <dl className="meta">
                <div><dt>Batch</dt><dd>SNJ-4417-ASH</dd></div>
                <div><dt>Origin</dt><dd>Neemuch, MP</dd></div>
                <div><dt>Held by</dt><dd>Vardhan Labs</dd></div>
                <div><dt>Weight</dt><dd>420 kg</dd></div>
              </dl>
              <div className="mini"><i data-p="57" style={{ width: 0 }} /></div>
              <div className="minilabel"><span>4 of 7 stages</span><span>Updated 2h ago</span></div>
            </article>

            <article className="card rv">
              <div className="cardtop">
                <div><div className="species">Tulsi</div><div className="latin">Ocimum tenuiflorum</div></div>
                <span className="badge b-move">In transit</span>
              </div>
              <dl className="meta">
                <div><dt>Batch</dt><dd>SNJ-4392-TLS</dd></div>
                <div><dt>Origin</dt><dd>Satara, MH</dd></div>
                <div><dt>Held by</dt><dd>Konkan Freight</dd></div>
                <div><dt>Weight</dt><dd>180 kg</dd></div>
              </dl>
              <div className="mini"><i data-p="100" style={{ width: 0 }} /></div>
              <div className="minilabel"><span>7 of 7 stages</span><span>Updated 20m ago</span></div>
            </article>

            <article className="card rv">
              <div className="cardtop">
                <div><div className="species">Brahmi</div><div className="latin">Bacopa monnieri</div></div>
                <span className="badge b-wait">Awaiting lab</span>
              </div>
              <dl className="meta">
                <div><dt>Batch</dt><dd>SNJ-4460-BRH</dd></div>
                <div><dt>Origin</dt><dd>Thrissur, KL</dd></div>
                <div><dt>Held by</dt><dd>Anand Processing</dd></div>
                <div><dt>Weight</dt><dd>96 kg</dd></div>
              </dl>
              <div className="mini"><i data-p="43" style={{ width: 0 }} /></div>
              <div className="minilabel"><span>3 of 7 stages</span><span>Updated 1d ago</span></div>
            </article>
          </div>
        </div>
      </section>

      {/* ============ VERIFY DEMO ============ */}
      <section id="verify-demo">
        <div className="wrap">
          <div className="head rv">
            <h2>Check a bottle in four seconds.</h2>
            <p>Scan the code on the pack. Sanjeevani re-hashes the stored lab report and compares it against the hash written on-chain the day it was uploaded. Try the demo below, or open the real thing.</p>
          </div>

          <div className="verifyWrap">
            <div className="rv">
              <div className="qrbox">
                <div className="qr" id="qr" aria-hidden="true" />
              </div>
              <p className="qrcap">Printed on pack SNJ-4417-ASH · opens without a login</p>
            </div>

            <div className="vpanel rv">
              <div className="vfield">
                <input defaultValue="SNJ-4417-ASH" spellCheck="false" aria-label="Batch code" readOnly />
                <button className="cta" id="vbtn">Run demo</button>
              </div>
              <ul className="steps" id="vsteps">
                <li><span className="tick" /> Reading the on-chain record <code>block 8,412,905</code></li>
                <li><span className="tick" /> Fetching the lab report from IPFS <code>bafybe…7qd4</code></li>
                <li><span className="tick" /> Recomputing SHA-256 <code>e3b0c442…1b7852b8</code></li>
                <li><span className="tick" /> Comparing against the anchored hash <code>match</code></li>
              </ul>
              <div className="seal" id="seal">
                <svg className="sealmark" viewBox="0 0 48 48" aria-hidden="true">
                  <circle cx="24" cy="24" r="21" fill="none" stroke="#F0A93B" strokeWidth="2" strokeDasharray="4 5" />
                  <path d="M15 24.5l6.5 6.5L33 19" fill="none" stroke="#F0A93B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>
                  <h5>Genuine, and unchanged since 14 Jan</h5>
                  <p>Collected in Neemuch by Ramesh Patil · tested by Vardhan Labs · tx 0x7a3f…c210</p>
                </div>
              </div>
              <Link href="/verify" className="cta ghost" style={{ marginTop: 14, width: "100%", justifyContent: "center" }}>
                Verify a real batch instead
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ DASHBOARD PREVIEW ============ */}
      <section id="dash">
        <div className="wrap">
          <div className="head rv">
            <h2>One tool, four jobs.</h2>
            <p>Farmers, labs, processors and admins each see only the actions they&apos;re allowed to take — enforced on the server, not just hidden in the UI. This is a preview; sign in to use the real thing.</p>
          </div>

          <div className="tabs rv" role="tablist" aria-label="Dashboards">
            <button className="tab" role="tab" aria-selected="true" data-p="p1">Farmer</button>
            <button className="tab" role="tab" aria-selected="false" data-p="p2">Lab</button>
            <button className="tab" role="tab" aria-selected="false" data-p="p3">Processor</button>
            <button className="tab" role="tab" aria-selected="false" data-p="p4">Admin</button>
          </div>

          <div className="pane on rv" id="p1">
            <div className="panehead"><i className="d" /><i className="d" /><i className="d" /><span>Record a collection</span></div>
            <div className="panebody">
              <div>
                <div className="fieldrow"><label>Species</label><div className="fake">Ashwagandha — Withania somnifera</div></div>
                <div className="two">
                  <div className="fieldrow"><label>Wet weight</label><div className="fake">420 kg</div></div>
                  <div className="fieldrow"><label>Harvest date</label><div className="fake">14 Jan 2026</div></div>
                </div>
                <div className="fieldrow"><label>Location (from your phone)</label><div className="fake">24.4738° N, 74.8706° E · Neemuch, MP</div></div>
                <Link href="/dashboard" className="cta">Sign in to record a batch</Link>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--sage)", display: "block", marginBottom: 14 }}>Your recent batches</label>
                <ul className="timeline">
                  <li><b>SNJ-4417-ASH · 420 kg</b><small>Handed to Anand Processing</small><code>0x7a3f…c210</code></li>
                  <li><b>SNJ-4390-ASH · 310 kg</b><small>Lab tested, passed</small><code>0x91b2…44ef</code></li>
                  <li className="pend"><b>SNJ-4460-BRH · 96 kg</b><small>Waiting on pickup</small></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="pane rv" id="p2">
            <div className="panehead"><i className="d" /><i className="d" /><i className="d" /><span>Upload a test report</span></div>
            <div className="panebody">
              <div>
                <div className="fieldrow"><label>Batch</label><div className="fake">SNJ-4417-ASH · Ashwagandha</div></div>
                <div className="two">
                  <div className="fieldrow"><label>Withanolides</label><div className="fake">2.8%</div></div>
                  <div className="fieldrow"><label>Heavy metals</label><div className="fake">Within limits</div></div>
                </div>
                <div className="fieldrow"><label>Report file</label><div className="fake muted">vardhan-4417.pdf · 1.2 MB · pins to IPFS on save</div></div>
                <Link href="/dashboard" className="cta">Sign in to publish a result</Link>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--sage)", display: "block", marginBottom: 14 }}>Queue</label>
                <ul className="timeline">
                  <li><b>SNJ-4417-ASH</b><small>Received today · 420 kg</small></li>
                  <li className="pend"><b>SNJ-4460-BRH</b><small>Expected Friday</small></li>
                  <li className="pend"><b>SNJ-4471-TLS</b><small>Expected Friday</small></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="pane rv" id="p3">
            <div className="panehead"><i className="d" /><i className="d" /><i className="d" /><span>Move a batch on</span></div>
            <div className="panebody">
              <div>
                <div className="fieldrow"><label>Batch</label><div className="fake">SNJ-4392-TLS · Tulsi</div></div>
                <div className="fieldrow"><label>Next stage</label><div className="fake">Processed → Lab tested</div></div>
                <div className="fieldrow"><label>Hand custody to</label><div className="fake">Vardhan Labs · verified</div></div>
                <Link href="/dashboard" className="cta">Sign in to transfer custody</Link>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--sage)", display: "block", marginBottom: 14 }}>Chain so far</label>
                <ul className="timeline">
                  <li><b>Collected</b><small>Satara, MH · 12 Jan</small><code>0x2c9a…8b01</code></li>
                  <li><b>Aggregated</b><small>Satara co-op · 13 Jan</small><code>0x55de…10a7</code></li>
                  <li><b>Processed</b><small>Anand Processing · 15 Jan</small><code>0x8fa1…c33b</code></li>
                  <li className="pend"><b>Lab tested</b><small>Not yet recorded</small></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="pane rv" id="p4">
            <div className="panehead"><i className="d" /><i className="d" /><i className="d" /><span>Approve new actors</span></div>
            <div className="panebody">
              <div>
                <div className="fieldrow"><label>Applicant</label><div className="fake">Konkan Freight Pvt Ltd</div></div>
                <div className="two">
                  <div className="fieldrow"><label>Requested role</label><div className="fake">Distributor</div></div>
                  <div className="fieldrow"><label>Licence</label><div className="fake">AY-MH-20981</div></div>
                </div>
                <div className="fieldrow"><label>Documents</label><div className="fake muted">3 files · uploaded 2 days ago</div></div>
                <Link href="/dashboard" className="cta">Sign in to approve actors</Link>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--sage)", display: "block", marginBottom: 14 }}>Pending review</label>
                <ul className="timeline">
                  <li className="pend"><b>Konkan Freight</b><small>Distributor · 2 days</small></li>
                  <li className="pend"><b>Sahyadri Herbs Co-op</b><small>Aggregator · 4 days</small></li>
                  <li><b>Vardhan Labs</b><small>Approved 8 Jan</small></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}