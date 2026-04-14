// src/keyboard.ts — PicoCalc on-screen keyboard overlay
//
// Positions are percentages of the device image dimensions (507 × 810 px).
// Key codes sent to _picocalc_web_set_key match the existing keydown handler:
//   Printable ASCII, 8=BS, 9=Tab, 13=CR, 27=Esc, 32=Space, 127=Del
//   128=↑ 129=↓ 130=← 131=→,  132-136 = F1-F5

export interface KeyDef {
  label: string;
  primary: number;     // sent when unshifted (0 = modifier-only)
  shifted?: number;    // sent when Shift is active
  left: number;        // % from left edge of device image
  top: number;         // % from top edge of device image
  width: number;       // % of image width
  height: number;      // % of image height
  modifier?: 'shift' | 'ctrl' | 'alt' | 'caps';
}

// ── Key layout (measured against 507 × 810 device image) ─────────────────────
export const KEY_DEFS: KeyDef[] = [

  // ── D-pad ──────────────────────────────────────────────────────────────────
  { label: '↑', primary: 128, left: 14.7, top: 54, width: 8.1, height: 4.8 },
  { label: '↓', primary: 129, left: 14.7, top: 61, width: 8.1, height: 4.8 },
  { label: '←', primary: 130, left:  9, top: 57.5, width: 8.1, height: 4.8 },
  { label: '→', primary: 131, left: 20.5, top: 57.5, width: 8.1, height: 4.8 },

  // ── Function key row (right of D-pad, y ≈ 54-59%) ─────────────────────────
  { label: 'F1', primary: 132, left: 34, top: 55, width: 11, height: 3.2 },
  { label: 'F2', primary: 133, left: 45.2, top: 55, width: 11, height: 3.2 },
  { label: 'F3', primary: 134, left: 57.2, top: 55, width: 11, height: 3.2 },
  { label: 'F4', primary: 135, left: 69, top: 55, width: 11, height: 3.2 },
  { label: 'F5', primary: 136, left: 81.5, top: 55, width: 11, height: 3.2 },

  // ── Esc / Tab / CapsLK / Del / Back row (y ≈ 59-64%) ─────────────────────
  { label: 'Esc',  primary: 27,  left: 34, top: 59.2, width: 11, height: 3.2 },
  { label: 'Tab',  primary: 9,   left: 45.2, top: 59.2, width: 11, height: 3.2 },
  { label: 'Caps', primary: 0, modifier: 'caps',
                               left: 57.2, top: 59.2, width: 11, height: 3.2 },
  { label: 'Del',  primary: 127, left: 69, top: 59.2, width: 11, height: 3.2 },
  { label: '⌫',    primary: 8,   left: 81.5, top: 59.2, width: 11, height: 3.2 },

  // ── Special chars row ` ~ / ? \ | - _ = + [ { ] } ─────────────────────────
  //   7 keys spanning x ≈ 157-472 px
  { label: '`',  primary:  96, shifted: 126, left: 33.8, top: 63, width: 7.8, height: 4.8 },
  { label: '/',  primary:  47, shifted:  63, left: 42, top: 63, width: 7.8, height: 4.8 },
  { label: '\\', primary:  92, shifted: 124, left: 50.5, top: 63, width: 7.8, height: 4.8 },
  { label: '-',  primary:  45, shifted:  95, left: 58.9, top: 63, width: 7.8, height: 4.8 },
  { label: '=',  primary:  61, shifted:  43, left: 67.5, top: 63, width: 7.8, height: 4.8 },
  { label: '[',  primary:  91, shifted: 123, left: 76.4, top: 63, width: 7.8, height: 4.8 },
  { label: ']',  primary:  93, shifted: 125, left: 84.5, top: 63, width: 7.8, height: 4.8 },

  // ── Number row 1! 2@ 3# 4$ 5% 6^ 7& 8* 9( 0)  ─────────────────────────────
  //   10 keys spanning x ≈ 18-487 px → each ≈ 46.9 px = 9.2 %
  { label: '1', primary: 49, shifted:  33, left:  8, top: 68.4, width: 7.8, height: 4.8 },
  { label: '2', primary: 50, shifted:  64, left: 16.7, top: 68.4, width: 7.8, height: 4.8 },
  { label: '3', primary: 51, shifted:  35, left: 25.2, top: 68.4, width: 7.8, height: 4.8 },
  { label: '4', primary: 52, shifted:  36, left: 33.5, top: 68.4, width: 7.8, height: 4.8 },
  { label: '5', primary: 53, shifted:  37, left: 42, top: 68.4, width: 7.8, height: 4.8 },
  { label: '6', primary: 54, shifted:  94, left: 50.7, top: 68.4, width: 7.8, height: 4.8 },
  { label: '7', primary: 55, shifted:  38, left: 59.2, top: 68.4, width: 7.8, height: 4.8 },
  { label: '8', primary: 56, shifted:  42, left: 67.7, top: 68.4, width: 7.8, height: 4.8 },
  { label: '9', primary: 57, shifted:  40, left: 76.1, top: 68.4, width: 7.8, height: 4.8 },
  { label: '0', primary: 48, shifted:  41, left: 84.9, top: 68.4, width: 7.8, height: 4.8 },

  // ── QWERTY row ─────────────────────────────────────────────────────────────
  { label: 'Q', primary: 113, left:  8, top: 73.5, width: 7.8, height: 4.8 },
  { label: 'W', primary: 119, left: 16.7, top: 73.5, width: 7.8, height: 4.8 },
  { label: 'E', primary: 101, left: 25.2, top: 73.5, width: 7.8, height: 4.8 },
  { label: 'R', primary: 114, left: 33.5, top: 73.5, width: 7.8, height: 4.8 },
  { label: 'T', primary: 116, left: 42, top: 73.5, width: 7.8, height: 4.8 },
  { label: 'Y', primary: 121, left: 50.7, top: 73.5, width: 7.8, height: 4.8 },
  { label: 'U', primary: 117, left: 59.2, top: 73.5, width: 7.8, height: 4.8 },
  { label: 'I', primary: 105, left: 67.7, top: 73.5, width: 7.8, height: 4.8 },
  { label: 'O', primary: 111, left: 76.1, top: 73.5, width: 7.8, height: 4.8 },
  { label: 'P', primary: 112, left: 84.9, top: 73.5, width: 7.8, height: 4.8 },

  // ── ASDF row + tall Enter ──────────────────────────────────────────────────
  { label: 'A', primary:  97, left:  8, top: 78.8, width: 7.8, height: 4.8 },
  { label: 'S', primary: 115, left: 16.7, top: 78.8, width: 7.8, height: 4.8 },
  { label: 'D', primary: 100, left: 25.2, top: 78.8, width: 7.8, height: 4.8 },
  { label: 'F', primary: 102, left: 33.5, top: 78.8, width: 7.8, height: 4.8 },
  { label: 'G', primary: 103, left: 42, top: 78.8, width: 7.8, height: 4.8 },
  { label: 'H', primary: 104, left: 50.7, top: 78.8, width: 7.8, height: 4.8 },
  { label: 'J', primary: 106, left: 59.2, top: 78.8, width: 7.8, height: 4.8 },
  { label: 'K', primary: 107, left: 67.7, top: 78.8, width: 7.8, height: 4.8 },
  { label: 'L', primary: 108, left: 76.1, top: 78.8, width: 7.8, height: 4.8 },
  // Enter spans ASDF + ZXCV rows
  { label: '↵', primary: 13, left: 84.9, top: 78.8, width: 7.8, height: 10 },

  // ── ZXCV row ───────────────────────────────────────────────────────────────
  { label: 'Z', primary: 122, left:  8, top: 84, width: 7.8, height: 4.8 },
  { label: 'X', primary: 120, left: 16.7, top: 84, width: 7.8, height: 4.8 },
  { label: 'C', primary:  99, left: 25.2, top: 84, width: 7.8, height: 4.8 },
  { label: 'V', primary: 118, left: 33.5, top: 84, width: 7.8, height: 4.8 },
  { label: 'B', primary:  98, left: 42, top: 84, width: 7.8, height: 4.8 },
  { label: 'N', primary: 110, left: 50.7, top: 84, width: 7.8, height: 4.8 },
  { label: 'M', primary: 109, left: 59.2, top: 84, width: 7.8, height: 4.8 },
  { label: ',', primary:  44, shifted:  60, left: 67.7, top: 84, width: 7.8, height: 4.8 },
  { label: '.', primary:  46, shifted:  62, left: 76.1, top: 84, width: 7.8, height: 4.8 },

  // ── Bottom row: Shift Ctrl Alt Space ;: "" Shift ───────────────────────────
  { label: 'Shift', primary: 0, modifier: 'shift', left:  9.2, top: 89.4, width: 13, height: 4.8 },
  { label: 'Ctrl',  primary: 0, modifier: 'ctrl',  left: 23, top: 89.4, width: 7.8, height: 4.8 },
  { label: 'Alt',   primary: 0, modifier: 'alt',   left: 31, top: 89.4, width: 7.8, height: 4.8 },
  { label: '⎵',     primary: 32,                   left: 40, top: 89.4, width: 20.5, height: 4.8 },
  { label: ';',     primary: 59, shifted: 58,       left: 61, top: 89.4, width: 7.8, height: 4.8 },
  { label: "'",     primary: 39, shifted: 34,       left: 69.8, top: 89.4, width: 7.8, height: 4.8 },
  { label: 'Shift', primary: 0, modifier: 'shift',  left: 78.5, top: 89.4, width: 12.4, height: 4.8 },
];

// ── Build keyboard overlay ─────────────────────────────────────────────────────
export function buildKeyboard(
  container: HTMLElement,
  sendKey: (code: number) => void,
): void {
  let shift = false;
  let ctrl  = false;
  let alt   = false;
  let caps  = false;

  const modBtns: Record<string, HTMLButtonElement[]> = {
    shift: [], ctrl: [], alt: [], caps: [],
  };

  function syncModUI() {
    for (const b of modBtns.shift) b.classList.toggle('mod-active', shift);
    for (const b of modBtns.ctrl)  b.classList.toggle('mod-active', ctrl);
    for (const b of modBtns.alt)   b.classList.toggle('mod-active', alt);
    for (const b of modBtns.caps)  b.classList.toggle('mod-active', caps);
  }

  function fire(def: KeyDef) {
    if (def.modifier) {
      if (def.modifier === 'shift') shift = !shift;
      else if (def.modifier === 'ctrl')  ctrl  = !ctrl;
      else if (def.modifier === 'alt')   alt   = !alt;
      else if (def.modifier === 'caps')  caps  = !caps;
      syncModUI();
      return;
    }

    let code = def.primary;
    if (!code) return;

    const isLowerLetter = code >= 97 && code <= 122;

    if (isLowerLetter) {
      // Caps XOR Shift → uppercase
      if (shift !== caps) code -= 32;
      if (ctrl) { sendKey(code - 64); }   // Ctrl+A=1 … Ctrl+Z=26
      else       { sendKey(code); }
    } else {
      const c = (shift && def.shifted !== undefined) ? def.shifted : code;
      sendKey(c);
    }

    // One-shot shift: auto-release after a non-modifier key
    if (shift) { shift = false; syncModUI(); }
  }

  for (const def of KEY_DEFS) {
    const btn = document.createElement('button');
    btn.className = 'key-btn';
    btn.setAttribute('aria-label', def.label);
    btn.setAttribute('data-key', def.label);
    btn.style.left   = `${def.left}%`;
    btn.style.top    = `${def.top}%`;
    btn.style.width  = `${def.width}%`;
    btn.style.height = `${def.height}%`;

    if (def.modifier) {
      modBtns[def.modifier].push(btn);
    }

    // pointerdown gives immediate feedback with no 300 ms mobile delay
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      fire(def);
    });

    container.appendChild(btn);
  }
}
