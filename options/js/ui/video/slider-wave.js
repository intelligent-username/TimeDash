'use strict';

/**
 * Draws an animated sine-wave track on the speed slider canvas.
 * - Bar is flat at rest, becomes wavy while the slider is being dragged.
 * - Wave amplitude eases in/out smoothly.
 * - Thumb rides the wave via --thumb-wave-y CSS custom property.
 * - Bar thickness is uniform (top & bottom edges are parallel).
 */
export function initSliderWave() {
    const canvas = document.querySelector('.speed-slider-wave');
    const slider = document.getElementById('currentSpeedSlider');
    if (!canvas || !slider) return;

    const ctx = canvas.getContext('2d');
    let animId = null;
    let phase = 0;
    let running = false;

    const TRACK_H = 14;
    const BAR_THICKNESS = 7;          // constant visual thickness of the bar
    const MAX_AMPLITUDE = 3.5;        // peak wave displacement
    const FREQUENCY = 0.04;
    const SPEED = 0.025;              // phase shift per frame (faster during drag)

    let amplitude = 0;                // current animated amplitude
    let targetAmplitude = 0;          // 0 = flat, MAX_AMPLITUDE = wavy
    const EASE_IN_RATE = 0.08;        // how fast amplitude ramps up
    const EASE_OUT_RATE = 0.03;       // how fast amplitude settles back

    /* ── Drag detection ──────────────────────────────────────────────── */
    let _dragging = false;

    function onDragStart() {
        _dragging = true;
        targetAmplitude = MAX_AMPLITUDE;
    }

    function onDragEnd() {
        _dragging = false;
        targetAmplitude = 0;
    }

    slider.addEventListener('mousedown', onDragStart);
    slider.addEventListener('touchstart', onDragStart, { passive: true });
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('touchend', onDragEnd);

    /* ── Theme colour ────────────────────────────────────────────────── */
    function getTrackColor() {
        return (
            getComputedStyle(document.documentElement)
                .getPropertyValue('--border')
                .trim() || '#3a3a3c'
        );
    }

    function isVisible() {
        const rect = canvas.parentElement.getBoundingClientRect();
        return rect.width > 0;
    }

    function resize() {
        const rect = canvas.parentElement.getBoundingClientRect();
        if (rect.width === 0) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = TRACK_H * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = TRACK_H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /**
     * Wave Y offset at pixel position x — composite of 3 harmonics
     * @param {number} x - Pixel X position.
     * @returns {number} Wave Y offset.
     */
    function waveY(x) {
        return (
            Math.sin(x * FREQUENCY + phase) * 0.55 +
            Math.sin(x * FREQUENCY * 2.3 + phase * 1.4 + 0.8) * 0.28 +
            Math.sin(x * FREQUENCY * 0.6 - phase * 0.7 + 2.1) * 0.17
        ) * amplitude;
    }

    function draw() {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.width / dpr;
        const midY = TRACK_H / 2;
        const halfBar = BAR_THICKNESS / 2;

        // Ease amplitude toward target
        if (amplitude < targetAmplitude) {
            amplitude += (targetAmplitude - amplitude) * EASE_IN_RATE;
            if (targetAmplitude - amplitude < 0.01) amplitude = targetAmplitude;
        } else if (amplitude > targetAmplitude) {
            amplitude += (targetAmplitude - amplitude) * EASE_OUT_RATE;
            if (amplitude - targetAmplitude < 0.01) amplitude = targetAmplitude;
        }

        ctx.clearRect(0, 0, w, TRACK_H);

        const color = getTrackColor();
        ctx.fillStyle = color;
        ctx.beginPath();

        // Top edge: sine wave offset up by half bar thickness
        ctx.moveTo(0, midY + waveY(0) - halfBar);
        for (let x = 1; x <= w; x++) {
            ctx.lineTo(x, midY + waveY(x) - halfBar);
        }

        // Bottom edge: SAME sine wave offset down (parallel → uniform thickness)
        for (let x = w; x >= 0; x--) {
            ctx.lineTo(x, midY + waveY(x) + halfBar);
        }

        ctx.closePath();
        ctx.fill();

        // Round the ends
        const r = halfBar;
        const leftWave = waveY(0);
        const rightWave = waveY(w);
        ctx.beginPath();
        ctx.arc(r, midY + leftWave, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(w - r, midY + rightWave, r, 0, Math.PI * 2);
        ctx.fill();

        // ── Drive thumb along the wave ──────────────────────────────────
        const min = parseFloat(slider.min) || 0;
        const max = parseFloat(slider.max) || 16;
        const val = parseFloat(slider.value) || 1;
        const pct = (val - min) / (max - min);

        const thumbHalf = 9;
        const usableW = w - thumbHalf * 2;
        const thumbX = thumbHalf + pct * usableW;

        const offsetY = waveY(thumbX);
        slider.style.setProperty('--thumb-wave-y', offsetY.toFixed(2) + 'px');

        // Advance phase only when there's wave activity
        if (amplitude > 0.01) {
            phase += SPEED;
        }

        animId = requestAnimationFrame(draw);
    }

    function start() {
        if (running) return;
        running = true;
        resize();
        draw();
    }

    function stop() {
        if (!running) return;
        running = false;
        if (animId) {
            cancelAnimationFrame(animId);
            animId = null;
        }
    }

    if (isVisible()) {
        start();
    }

    const tabPane = canvas.closest('.tab-pane');
    if (tabPane) {
        const tabObserver = new MutationObserver(() => {
            if (tabPane.classList.contains('active')) {
                requestAnimationFrame(() => {
                    resize();
                    start();
                });
            } else {
                stop();
            }
        });
        tabObserver.observe(tabPane, {
            attributes: true,
            attributeFilter: ['class'],
        });
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (running) resize();
        }, 100);
    });
}
