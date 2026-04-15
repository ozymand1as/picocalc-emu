import './style.css'
import { buildKeyboard } from './keyboard.js'

declare global {
  interface Window { createBramble: () => Promise<any>; }
}

// ── State ────────────────────────────────────────────────────────────────────
let brambleModule: any    = null;
let displayBufferPtr: number = 0;
let emulatorRunning = false;
let displayView: Uint8ClampedArray | null = null;
let lastWasmBuffer: ArrayBuffer | null = null;

const canvas   = document.getElementById('lcd') as HTMLCanvasElement;
const ctx      = canvas.getContext('2d')!;
const imageData = ctx.createImageData(320, 320);

// ── Emulator init ─────────────────────────────────────────────────────────────
async function initEmulator() {
    console.log('Loading WASM module...');
    if (!window.createBramble) {
        console.error('createBramble not found — is bramble.js loaded?');
        return;
    }
    brambleModule = await window.createBramble();
    console.log('WASM module loaded.');

    brambleModule._picocalc_web_init();
    displayBufferPtr = brambleModule._picocalc_web_get_display_buffer();
    console.log(`Display buffer at WASM offset: ${displayBufferPtr}`);

    // Start render loop immediately (shows black before firmware)
    requestAnimationFrame(renderLoop);

    let logBufferPtr = 0;
    const LOG_BUFFER_SIZE = 16384;
    let traceBufferPtr = 0;
    const TRACE_SIZE = 16;
    let regsBufferPtr = 0;
    
    let prevLastCmd = -1;
    let prevLastSector = -1;
    let lastHalted = [false, false];
    let lastPCLog = 0;

    // Diagnostic polling
    setInterval(() => {
        if (brambleModule) {
            if (!logBufferPtr) logBufferPtr = brambleModule._malloc(LOG_BUFFER_SIZE);
            if (!traceBufferPtr) traceBufferPtr = brambleModule._malloc(TRACE_SIZE * 4);
            if (!regsBufferPtr) regsBufferPtr = brambleModule._malloc(17 * 4);

            const steps = brambleModule._picocalc_web_get_total_steps();
            const spiCount = brambleModule._picocalc_web_get_spi_count();
            const pixelCount = brambleModule._picocalc_web_get_pixel_count();
            const uartCount = brambleModule._picocalc_web_get_uart_count();
            const uart0CR = brambleModule._picocalc_web_get_uart_enabled(0);
            const uart1CR = brambleModule._picocalc_web_get_uart_enabled(1);
            const shCount = brambleModule._picocalc_web_get_sh_count();
            
            // Get UART logs
            const logLen = brambleModule._picocalc_web_get_uart_log(logBufferPtr, LOG_BUFFER_SIZE);
            if (logLen > 0) {
                const logs = brambleModule.UTF8ToString(logBufferPtr);
                console.log(`[Pico] Captured ${logLen} bytes`); // Diagnostic
                console.log("%c[Pico] " + logs, "color: #00ff00; background: #000;");
            }

            const u0Status = (uart0CR & 0x100) ? "U0:ON" : "U0:off";
            const u1Status = (uart1CR & 0x100) ? "U1:ON" : "U1:off";
            
            const sioLC = brambleModule._picocalc_web_get_sio_launch_count();
            const nvic0E = brambleModule._picocalc_web_get_nvic_enabled(0).toString(16).toUpperCase();
            const nvic0P = brambleModule._picocalc_web_get_nvic_pending(0).toString(16).toUpperCase();
            const nvic1E = brambleModule._picocalc_web_get_nvic_enabled(1).toString(16).toUpperCase();
            const nvic1P = brambleModule._picocalc_web_get_nvic_pending(1).toString(16).toUpperCase();

            
            

            const lastCmd = brambleModule._picocalc_web_get_last_sd_cmd();
            const lastSector = brambleModule._picocalc_web_get_last_sd_sector();
            const lastMISO = brambleModule._picocalc_web_get_last_sd_miso();

            // Log SD activity to console for easier tracking
            if (lastCmd !== prevLastCmd) {
                console.log(`%c[SD] Current CMD: ${lastCmd}`, "color: #ff00ff;");
                prevLastCmd = lastCmd;
            }
            if (lastSector !== prevLastSector) {
                console.log(`%c[SD] Reading Sector: ${lastSector}`, "color: #ff00ff;");
                const launchCount = brambleModule._picocalc_web_get_sio_launch_count();
                console.log(`%c[SD] SIO Launch Count: ${launchCount}`, "color: #ff00ff;");
                prevLastSector = lastSector;
            }

            let statusStr = `Steps: ${steps.toLocaleString()} | SPI: ${spiCount.toLocaleString()} | UART: ${uartCount.toLocaleString()} (${u0Status}/${u1Status}) | SH: ${shCount} | Pixels: ${pixelCount.toLocaleString()} | SIO-LC: ${sioLC}`;
            statusStr += `\nNVIC0: E:${nvic0E} P:${nvic0P} | NVIC1: E:${nvic1E} P:${nvic1P}`;
            statusStr += `\nSD: LastCMD:${lastCmd} Sector:${lastSector} MISO:0x${lastMISO.toString(16).toUpperCase()}`;

            for (let c = 0; c < 2; c++) {
                const getPC = c === 0 ? brambleModule._picocalc_web_get_pc0 : brambleModule._picocalc_web_get_pc1;
                
                
                const pc = getPC();
                
                
                const flags = brambleModule._picocalc_web_get_core_flags(c);
                const irq = brambleModule._picocalc_web_get_irq(c);
                const irqStr = irq === 0xFFFFFFFF ? 'None' : irq.toString();

                statusStr += `\nCORE${c}: 0x${pc.toString(16).padStart(8, '0')} [${flags}|IRQ:${irqStr}]`;

                // Trace logging on halt
                const isHalted = (flags & 1) !== 0;
                if (isHalted && !lastHalted[c]) {
                    console.warn(`[Pico] CORE ${c} HALTED at 0x${pc.toString(16).padStart(8, '0')}`);
                    
                    const pcBuffer = brambleModule._malloc(16 * 4);
                    const instrBuffer = brambleModule._malloc(16 * 2);

                    const count = brambleModule._picocalc_web_get_pc_trace(c, pcBuffer, instrBuffer);
                    const trace = [];
                    for (let i = 0; i < count; i++) {
                        const pcVal = (brambleModule.getValue(pcBuffer + i * 4, 'i32') >>> 0).toString(16).padStart(8, '0');
                        const instrVal = (brambleModule.getValue(instrBuffer + i * 2, 'i16') >>> 0).toString(16).padStart(4, '0');
                        trace.push(`0x${pcVal} [0x${instrVal}]`);
                    }
                    brambleModule._free(pcBuffer);
                    brambleModule._free(instrBuffer);
                    console.log(`[Pico] CORE ${c} Trace: ${trace.join(' -> ')}`);
                }
                lastHalted[c] = isHalted;

                if (irq === 3) {
                    const framePtr = brambleModule._malloc(8 * 4);
                    brambleModule._picocalc_web_get_fault_frame(c, framePtr);
                    
                    const r0 = brambleModule.getValue(framePtr + 0 * 4, 'i32') >>> 0;
                    const r1 = brambleModule.getValue(framePtr + 1 * 4, 'i32') >>> 0;
                    const r2 = brambleModule.getValue(framePtr + 2 * 4, 'i32') >>> 0;
                    const r3 = brambleModule.getValue(framePtr + 3 * 4, 'i32') >>> 0;
                    const r12 = brambleModule.getValue(framePtr + 4 * 4, 'i32') >>> 0;
                    const lr_fault = brambleModule.getValue(framePtr + 5 * 4, 'i32') >>> 0;
                    const pc_fault = brambleModule.getValue(framePtr + 6 * 4, 'i32') >>> 0;
                    const psr_fault = brambleModule.getValue(framePtr + 7 * 4, 'i32') >>> 0;
                    brambleModule._free(framePtr);

                    const faultInstr = brambleModule._picocalc_web_read_mem16(pc_fault);
                    console.error(`%c[Pico] CORE ${c} HARDFAULT at 0x${pc_fault.toString(16)} [0x${faultInstr.toString(16)}]`, "font-weight: bold; font-size: 14px;");
                    console.log(`[Pico] Stack Frame: R0:${r0.toString(16)} R1:${r1.toString(16)} R2:${r2.toString(16)} R3:${r3.toString(16)} R12:${r12.toString(16)} LR:${lr_fault.toString(16)} PC:${pc_fault.toString(16)} PSR:${psr_fault.toString(16)}`);
                    
                    // Stack Peek
                    const sp_at_crash = brambleModule[c === 0 ? '_picocalc_web_get_sp0' : '_picocalc_web_get_sp1']();
                    const peekCount = 32;
                    const peekPtr = brambleModule._malloc(peekCount * 4);
                    const peekStart = (sp_at_crash - 32) & ~3;
                    brambleModule._picocalc_web_dump_mem(peekStart, peekCount * 4, peekPtr);
                    const peekData = new Uint32Array(brambleModule.HEAPU8.buffer, peekPtr, peekCount);
                    console.warn(`[Pico] Stack Peek around 0x${sp_at_crash.toString(16)}:`);
                    for (let i = 0; i < peekCount; i += 4) {
                        const addr = peekStart + (i * 4);
                        const vals = Array.from(peekData.slice(i, i + 4)).map(v => v.toString(16).padStart(8, '0')).join(" ");
                        console.log(`  0x${addr.toString(16)}: ${vals}`);
                    }
                    brambleModule._free(peekPtr);

                    brambleModule._picocalc_web_get_regs(c, regsBufferPtr);
                    const regs: string[] = [];
                    for (let i = 0; i < 16; i++) {
                        const val = brambleModule.getValue(regsBufferPtr + i * 4, 'i32') >>> 0;
                        regs.push(`R${i}:${val.toString(16).padStart(8, '0')}`);
                    }
                    console.log(`[Pico] Core ${c} Registers (at crash):`, regs.slice(0, 8).join(" "), regs.slice(8, 16).join(" "));

                    brambleModule._picocalc_web_get_pc_trace(c, traceBufferPtr);
                    const trace = [];
                    for (let i = 0; i < TRACE_SIZE; i++) {
                        const addr = brambleModule.getValue(traceBufferPtr + i * 4, 'i32') >>> 0;
                        trace.push("0x" + addr.toString(16));
                    }
                    console.warn(`[Pico] Core ${c} Trace: ` + trace.join(" <- "));
                }

            }
            
            
            const diagEl = document.getElementById('diagnostics');
            if (diagEl) diagEl.textContent = statusStr;

            // Log PC periodically to detect loops
            const now = Date.now();
            if (emulatorRunning && (now - lastPCLog > 2000)) {
                const pc = brambleModule._picocalc_web_get_pc0();
                console.log(`[Diagnostic] Core 0 PC: 0x${pc.toString(16)}`);
                lastPCLog = now;
            }
        }
    }, 500);

    // Enable the firmware button now that the module is ready
    const btn = document.getElementById('uf2-upload') as HTMLInputElement;
    if (btn) btn.disabled = false;

    // Build on-screen keyboard overlays
    const deviceContainer = document.getElementById('device-container');
    if (deviceContainer) {
        buildKeyboard(deviceContainer, (code: number) => {
            if (brambleModule && emulatorRunning) {
                brambleModule._picocalc_web_set_key(code);
            }
        });
    }

    updateStatus('Loading firmware…');
    // Auto-load firmware.uf2 from the server (placed in /public/firmware.uf2)
    try {
        const resp = await fetch(import.meta.env.BASE_URL + 'firmware.uf2');
        if (resp.ok) {
            const buf = await resp.arrayBuffer();
            await loadUF2(new File([buf], 'firmware.uf2'));
            console.log('Auto-loaded firmware.uf2');
        } else {
            updateStatus('Ready — select a .uf2 firmware file to boot');
        }
    } catch (e) {
        console.warn('Could not auto-load firmware:', e);
        updateStatus('Ready — select a .uf2 firmware file to boot');
    }
}

// ── Render loop ───────────────────────────────────────────────────────────────
function renderLoop() {
    if (brambleModule && displayBufferPtr) {
        // Reuse the view unless WASM memory grew (buffer reference changes)
        if (brambleModule.HEAPU8.buffer !== lastWasmBuffer) {
            lastWasmBuffer = brambleModule.HEAPU8.buffer as ArrayBuffer;
            displayView = new Uint8ClampedArray(lastWasmBuffer, displayBufferPtr, 320 * 320 * 4);
        }
        imageData.data.set(displayView!);
        ctx.putImageData(imageData, 0, 0);
    }
    requestAnimationFrame(renderLoop);
}

// ── Firmware loading ──────────────────────────────────────────────────────────
async function loadUF2(file: File) {
    if (!brambleModule) { console.error('Module not ready'); return; }

    console.log(`Loading firmware: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`);
    updateStatus(`Loading ${file.name}…`);

    const buffer = await file.arrayBuffer();
    const u8 = new Uint8Array(buffer);

    const ptr = brambleModule._malloc(u8.length);
    if (!ptr) { console.error('malloc failed — out of WASM memory'); return; }

    // writeArrayToMemory is safe; no detached-buffer issues from HEAPU8.set
    brambleModule.writeArrayToMemory(u8, ptr);

    const success: number = brambleModule._picocalc_web_load_uf2(ptr, u8.length);
    console.log('picocalc_web_load_uf2 returned:', success);

    if (!success) {
        console.error('Firmware load failed — check UF2 magic numbers in the log above');
        updateStatus('Load failed ✗');
        return;
    }

    updateStatus(`${file.name} loaded ✓ — booting…`);

    if (!emulatorRunning) {
        // simulateInfiniteLoop=0 → function returns normally, no 'unwind' throw
        brambleModule._picocalc_web_start();
        emulatorRunning = true;
        console.log('Emulator main loop started.');
    }
    // If already running (user loaded a second firmware), the loop keeps going
    // and the new flash contents will take effect on the next reset cycle.
}

// ── File input ────────────────────────────────────────────────────────────────
document.getElementById('uf2-upload')?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    await loadUF2(file);
    // Blur so keyboard events go to the canvas, not the input
    (e.target as HTMLInputElement).blur();
    (e.target as HTMLInputElement).value = '';   // allow re-selecting same file
});

document.getElementById('sd-upload')?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    
    console.log(`Loading SD image: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
    const buffer = await file.arrayBuffer();
    const u8 = new Uint8Array(buffer);
    
    const ptr = brambleModule._malloc(u8.length);
    if (ptr) {
        brambleModule.writeArrayToMemory(u8, ptr);
        const success = brambleModule._picocalc_web_load_sd_image(ptr, u8.length);
        console.log(`SD Load result: ${success} bytes`);
        brambleModule._free(ptr);

        // Enable export now that an image is in memory
        const exportBtn = document.getElementById('btn-sd-export') as HTMLButtonElement;
        if (exportBtn) exportBtn.disabled = false;
    }
    
    (e.target as HTMLInputElement).blur();
});

document.getElementById('btn-sd-export')?.addEventListener('click', () => {
    if (!brambleModule) return;
    const ptr: number = brambleModule._picocalc_web_get_sd_image_ptr();
    const size: number = brambleModule._picocalc_web_get_sd_image_size();
    if (!ptr || !size) {
        updateStatus('No SD image available to export.');
        return;
    }
    // Snapshot the buffer — avoids issues if WASM memory grows during download
    const data = new Uint8Array(brambleModule.HEAPU8.buffer.slice(ptr, ptr + size));
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'picocalc-sd.img';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    updateStatus('SD image exported.');
});

// ── Keyboard input → I2C emulation ───────────────────────────────────────────
document.addEventListener('keydown', (e) => {
    if (!brambleModule || !emulatorRunning) return;
    e.preventDefault();

    let key = 0;
    if (e.key.length === 1) {
        key = e.key.charCodeAt(0);
    } else {
        switch (e.key) {
            case 'Enter':     key = 0x0A; break;  // KEY_ENTER
            case 'Backspace': key = 0x08; break;  // KEY_BACKSPACE
            case 'Escape':    key = 0xB1; break;  // KEY_ESC
            case 'ArrowUp':   key = 0xB5; break;  // KEY_UP
            case 'ArrowDown': key = 0xB6; break;  // KEY_DOWN
            case 'ArrowLeft': key = 0xB4; break;  // KEY_LEFT
            case 'ArrowRight':key = 0xB7; break;  // KEY_RIGHT
            case 'Tab':       key = 0x09; break;  // KEY_TAB
            case 'Delete':    key = 0xD4; break;  // KEY_DEL
            case 'F1':        key = 0x81; break;
            case 'F2':        key = 0x82; break;
            case 'F3':        key = 0x83; break;
            case 'F4':        key = 0x84; break;
            case 'F5':        key = 0x85; break;
            case 'F6':        key = 0x86; break;
            case 'F7':        key = 0x87; break;
            case 'F8':        key = 0x88; break;
            case 'F9':        key = 0x89; break;
            case 'F10':       key = 0x90; break;
            case 'Home':      key = 0xD2; break;  // KEY_HOME
            case 'Insert':    key = 0xD1; break;  // KEY_INSERT
            case 'PageUp':    key = 0xD6; break;  // KEY_PAGE_UP
            case 'PageDown':  key = 0xD7; break;  // KEY_PAGE_DOWN
        }
    }
    if (key) brambleModule._picocalc_web_set_key(key);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function updateStatus(msg: string) {
    const el = document.getElementById('status-text');
    if (el) el.textContent = msg;
}

// ── Verbose Toggle ────────────────────────────────────────────────────────────
const verboseLabels = ['Silent', 'Normal', 'Verbose'];
document.getElementById('btn-verbose')?.addEventListener('click', () => {
    if (!brambleModule) return;
    const cur = brambleModule._picocalc_web_get_verbose();
    const next = (cur + 1) % 3;
    brambleModule._picocalc_web_set_verbose(next);
    const btn = document.getElementById('btn-verbose') as HTMLButtonElement;
    if (btn) btn.textContent = `Log: ${verboseLabels[next]}`;
});

// ── Memory Dumper ─────────────────────────────────────────────────────────────
document.getElementById('btn-dump')?.addEventListener('click', () => {
    if (!brambleModule) return;
    const addrInput = document.getElementById('mem-addr') as HTMLInputElement;
    const dumpEl = document.getElementById('mem-dump') as HTMLPreElement;
    
    let addr = parseInt(addrInput.value, 16);
    if (isNaN(addr)) addr = 0x10000000;
    
    const count = 256;
    const ptr = brambleModule._malloc(count);
    brambleModule._picocalc_web_dump_mem(addr, count, ptr);
    
    const data = new Uint8Array(brambleModule.HEAPU8.buffer, ptr, count);
    let hex = `Dump at 0x${addr.toString(16).padStart(8, '0')}:\n`;
    for (let i = 0; i < count; i += 16) {
        const line = Array.from(data.slice(i, i + 16))
            .map(x => x.toString(16).padStart(2, '0'))
            .join(' ');
        const ascii = Array.from(data.slice(i, i + 16))
            .map(x => (x >= 32 && x <= 126) ? String.fromCharCode(x) : '.')
            .join('');
        hex += `${(addr + i).toString(16).padStart(8, '0')}: ${line.padEnd(48)} | ${ascii}\n`;
    }
    
    dumpEl.textContent = hex;
    brambleModule._free(ptr);
});

// ── Initial canvas state ──────────────────────────────────────────────────────
ctx.fillStyle = '#0a0a0f';
ctx.fillRect(0, 0, 320, 320);
ctx.fillStyle = '#555';
ctx.font = '14px monospace';
ctx.fillText('Initializing emulator…', 70, 160);

// ── Bootstrap: load bramble.js then init ─────────────────────────────────────
const script = document.createElement('script');
script.src = import.meta.env.BASE_URL + 'bramble.js';
script.onload = () => {
    if (typeof (window as any).createBramble === 'function') {
        initEmulator();
    } else {
        console.error('bramble.js loaded but createBramble not found');
    }
};
script.onerror = () => console.error('Failed to load bramble.js — run build_wasm.sh first');
document.body.appendChild(script);

// ── PWA: register service worker ─────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register(import.meta.env.BASE_URL + 'sw.js')
            .then((reg) => console.log('[PWA] Service worker registered, scope:', reg.scope))
            .catch((err) => console.warn('[PWA] Service worker registration failed:', err));
    });
}
