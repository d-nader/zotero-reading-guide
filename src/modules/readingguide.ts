import { config } from "../../package.json";

// simple settings
const PREF_COLOR = `extensions.${config.addonRef}.rulerColor`;
const PREF_MODE = `extensions.${config.addonRef}.columnMode`;
const DEFAULT_COLOR = "rgba(255, 212, 0, 0.4)";

const COLORS = [
  { val: "rgba(255, 212, 0, 0.4)", hex: "#ffd400", name: "Yellow" },
  { val: "rgba(46, 168, 229, 0.4)", hex: "#2ea8e5", name: "Blue" },
  { val: "rgba(95, 178, 54, 0.4)", hex: "#5fb236", name: "Green" },
  { val: "rgba(255, 102, 102, 0.4)", hex: "#ff6666", name: "Red" },
  { val: "rgba(162, 138, 229, 0.4)", hex: "#a28ae5", name: "Purple" },
  { val: "rgba(229, 110, 238, 0.4)", hex: "#e56eee", name: "Magenta" },
];

// icons
const ICON_FULL = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="14" height="8" rx="1"/></svg>`;
const ICON_COLS = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="2" width="6" height="12" rx="1"/><rect x="9" y="2" width="6" height="12" rx="1"/></svg>`;

export function initReadingGuide() {
  Zotero.Reader.registerEventListener(
    "renderToolbar",
    ({ reader, doc, append }) => {
      // FIX: Just use doc.defaultView and ensure it exists
      const win = doc.defaultView;
      if (!win) return;

      let isEnabled = false;
      let line: HTMLElement | null = null;
      let mouseFn: ((e: MouseEvent) => void) | null = null;
      let pdfDoc: Document | null = null;
      let menu: HTMLElement | null = null;
      let rafId: number | null = null;

      let btnFull: HTMLElement | null = null;
      let btnCols: HTMLElement | null = null;

      let useColumns = Zotero.Prefs.get(PREF_MODE, true) ?? false;

      const cleanup = () => {
        line?.remove();
        if (pdfDoc && mouseFn)
          pdfDoc.removeEventListener("mousemove", mouseFn, { capture: true });
        if (rafId) win.cancelAnimationFrame(rafId);
        line = mouseFn = pdfDoc = null;
      };

      const toggle = () => {
        isEnabled = !isEnabled;
        mainBtn.textContent = isEnabled ? "On" : "Off";

        if (isEnabled) {
          inject();
        } else {
          cleanup();
        }
      };

      const setMode = (cols: boolean) => {
        useColumns = cols;
        Zotero.Prefs.set(PREF_MODE, useColumns, true);
        updateMenuButtons();
        if (line) line.style.transition = "none";
      };

      const updateMenuButtons = () => {
        if (!btnFull || !btnCols) return;
        const active = "background: rgba(0,0,0,0.1); color: #000;";
        const inactive = "background: transparent; color: #888;";
        const base =
          "flex:1; cursor:pointer; padding:4px; border-radius:3px; display:flex; justify-content:center; ";

        btnFull.style.cssText = base + (!useColumns ? active : inactive);
        btnCols.style.cssText = base + (useColumns ? active : inactive);
      };

      const inject = () => {
        const frame = reader._iframe?.contentDocument?.querySelector(
          "#primary-view > iframe",
        ) as HTMLIFrameElement;
        if (!frame?.contentDocument?.body) return;
        pdfDoc = frame.contentDocument;

        line = pdfDoc.createElement("div");
        line.id = "reading-guide-line";
        const c = Zotero.Prefs.get(PREF_COLOR, true) || DEFAULT_COLOR;

        Object.assign(line.style, {
          position: "fixed",
          height: "32px",
          backgroundColor: c,
          zIndex: "99999",
          pointerEvents: "none",
          display: "none",
          mixBlendMode: "multiply",
          transform: "translateY(-50%)",
          transition: "width 0.1s linear, left 0.1s linear",
          borderRadius: "2px",
        });

        if (pdfDoc.body) pdfDoc.body.appendChild(line);

        mouseFn = (e: MouseEvent) => {
          if (!line) return;

          if (rafId) return;

          rafId = win.requestAnimationFrame(() => {
            rafId = null;
            if (!line) return;

            if (line.style.transition === "none")
              line.style.transition = "width 0.1s linear, left 0.1s linear";

            const p = (e.target as Element)?.closest(".page");
            const page =
              p ||
              (Array.from(pdfDoc!.querySelectorAll(".page")).find((x: any) => {
                const r = x.getBoundingClientRect();
                return e.clientY >= r.top && e.clientY <= r.bottom;
              }) as Element | undefined) ||
              pdfDoc!.querySelector(".page");

            if (page) {
              const r = page.getBoundingClientRect();
              let left = r.left + r.width * 0.05;
              let width = r.width * 0.9;

              if (useColumns) {
                const isRight = e.clientX - r.left > r.width / 2;
                const mid = r.left + r.width / 2;

                const spans = page.querySelectorAll(".textLayer > span");
                let minL = Infinity;
                let maxR = -Infinity;

                const edgeBuffer = r.width * 0.05;
                const vertBuffer = r.height * 0.05;

                for (const s of spans) {
                  const rect = s.getBoundingClientRect();

                  if (rect.left < r.left + edgeBuffer) continue;
                  if (rect.right > r.right - edgeBuffer) continue;
                  if (rect.top < r.top + vertBuffer) continue;
                  if (rect.bottom > r.bottom - vertBuffer) continue;

                  const belongs = isRight ? rect.left > mid : rect.right < mid;
                  if (belongs) {
                    if (rect.left < minL) minL = rect.left;
                    if (rect.right > maxR) maxR = rect.right;
                  }
                }

                if (minL !== Infinity) {
                  left = minL - 5;
                  width = maxR - minL + 10;
                } else {
                  left = r.left + r.width * (isRight ? 0.52 : 0.05);
                  width = r.width * 0.43;
                }
              }
              line.style.left = `${left}px`;
              line.style.width = `${width}px`;
            }
            line.style.display = "block";
            line.style.top = `${e.clientY}px`;
          });
        };
        pdfDoc.addEventListener("mousemove", mouseFn, { capture: true });
      };

      const onKey = (e: KeyboardEvent) => {
        if (!e.altKey) return;
        if (e.code === "KeyR" || e.key === "r") {
          e.preventDefault();
          toggle();
        }
        if (e.code === "KeyC" || e.key === "c") {
          e.preventDefault();
          setMode(!useColumns);
        }
      };
      doc.addEventListener("keydown", onKey);
      setTimeout(() => {
        const win = (
          reader._iframe?.contentDocument?.querySelector(
            "#primary-view > iframe",
          ) as HTMLIFrameElement
        )?.contentWindow;
        if (win) win.addEventListener("keydown", onKey);
      }, 1000);

      // --- UI Setup ---
      const wrapper = doc.createElement("div");
      wrapper.style.cssText =
        "position:relative; display:flex; align-items:center";

      const mainBtn = doc.createElement("button");
      mainBtn.className = `toolbar-button ${config.addonRef}-reader-button`;
      mainBtn.title = "Toggle Guide (Alt+R)\nRight-click for options";
      mainBtn.style.cssText = "min-width:40px; text-align:center";
      mainBtn.textContent = "Off";
      mainBtn.onclick = toggle;

      mainBtn.oncontextmenu = (e) => {
        e.preventDefault();
        if (menu) {
          menu.remove();
          menu = null;
          return;
        }

        const close = () => {
          menu?.remove();
          menu = null;
          doc.removeEventListener("click", close);
        };

        menu = doc.createElement("div");
        Object.assign(menu.style, {
          position: "absolute",
          top: "115%",
          left: "-50%",
          backgroundColor: "#fff",
          border: "1px solid #ccc",
          borderRadius: "4px",
          padding: "6px",
          width: "max-content",
          zIndex: "9999",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        });

        const grid = doc.createElement("div");
        grid.style.cssText =
          "display:grid; grid-template-columns:repeat(3, auto); gap:4px; justify-content:center";

        COLORS.forEach((c) => {
          const d = doc.createElement("div");
          Object.assign(d.style, {
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            backgroundColor: c.hex,
            cursor: "pointer",
            border: "1px solid rgba(0,0,0,0.1)",
          });
          d.onclick = (ev) => {
            ev.stopPropagation();
            Zotero.Prefs.set(PREF_COLOR, c.val, true);
            if (line) line.style.backgroundColor = c.val;
            close();
          };
          grid.appendChild(d);
        });
        menu.appendChild(grid);

        const hr = doc.createElement("hr");
        Object.assign(hr.style, {
          margin: "0",
          border: "0",
          borderTop: "1px solid #eee",
        });
        menu.appendChild(hr);

        const row = doc.createElement("div");
        row.style.cssText = "display:flex; gap:4px; padding-top:2px";

        btnFull = doc.createElement("div");
        btnFull.innerHTML = ICON_FULL;
        btnFull.title = "Full Width";
        btnFull.onclick = (ev) => {
          ev.stopPropagation();
          setMode(false);
        };

        btnCols = doc.createElement("div");
        btnCols.innerHTML = ICON_COLS;
        btnCols.title = "Column Mode";
        btnCols.onclick = (ev) => {
          ev.stopPropagation();
          setMode(true);
        };

        row.appendChild(btnFull);
        row.appendChild(btnCols);
        menu.appendChild(row);

        updateMenuButtons();
        wrapper.appendChild(menu);

        setTimeout(() => doc.addEventListener("click", close), 10);
      };

      wrapper.appendChild(mainBtn);
      append(wrapper);
    },
    addon.data.config.addonID,
  );
}
