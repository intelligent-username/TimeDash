/**
 * Builds the interactive SVG circular time picker for setting restricted daily limits.
 * @param {object} blockingUI - Instance of BlockingUI
 */
export function buildCircularPicker(blockingUI) {
    const container = document.getElementById('restrictedPickerMount');
    if (!container) return;

    const SIZE = 110;
    const CX = SIZE / 2;
    const CY = SIZE / 2;
    const R = 42;

    let maxMin = blockingUI.controller?.settings?.restrictedSliderMax || 120;

    const minutesToAngle = (m) => (m / maxMin) * 360 - 90;
    const angleToMinutes = (deg) => {
        const d = (((deg + 90) % 360) + 360) % 360;
        return Math.max(0, Math.min(maxMin, Math.round((d / 360) * maxMin)));
    };
    const polarToXY = (angleDeg, r) => {
        const rad = (angleDeg * Math.PI) / 180;
        return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
    };
    const describeArc = (startAngle, endAngle, r) => {
        const e = polarToXY(endAngle, r);
        const large = (endAngle - startAngle + 360) % 360 > 180 ? 1 : 0;
        return `M ${CX} ${CY - r} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
    };

    const wrap = document.createElement('div');
    wrap.className = 'circ-picker-inner-wrap';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
    svg.setAttribute('class', 'circ-picker-svg');
    svg.setAttribute('aria-hidden', 'true');

    const trackCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    trackCircle.setAttribute('cx', CX);
    trackCircle.setAttribute('cy', CY);
    trackCircle.setAttribute('r', R);
    trackCircle.setAttribute('class', 'circ-track');
    svg.appendChild(trackCircle);

    const arcPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arcPath.setAttribute('class', 'circ-arc');
    svg.appendChild(arcPath);

    const handleCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    handleCircle.setAttribute('r', 6);
    handleCircle.setAttribute('class', 'circ-handle');
    handleCircle.setAttribute('tabindex', '0');
    handleCircle.setAttribute('role', 'slider');
    handleCircle.setAttribute('aria-label', 'Time limit');
    svg.appendChild(handleCircle);

    wrap.appendChild(svg);

    const centerInput = document.createElement('input');
    centerInput.type = 'number';
    centerInput.className = 'circ-center-input';
    centerInput.min = '0';
    centerInput.setAttribute('aria-label', 'Daily time limit in minutes');
    centerInput.setAttribute('autocomplete', 'off');
    centerInput.setAttribute('name', 'restricted-minutes');
    wrap.appendChild(centerInput);

    container.appendChild(wrap);

    const update = (minutes) => {
        blockingUI._restrictedMinutes = Math.max(0, Math.min(maxMin, minutes));
        const angle = minutesToAngle(blockingUI._restrictedMinutes);
        const hPos = polarToXY(angle, R);
        handleCircle.setAttribute('cx', hPos.x);
        handleCircle.setAttribute('cy', hPos.y);
        handleCircle.setAttribute('aria-valuenow', blockingUI._restrictedMinutes);
        handleCircle.setAttribute('aria-valuemin', '0');
        handleCircle.setAttribute('aria-valuemax', maxMin);

        if (blockingUI._restrictedMinutes > 0) {
            arcPath.setAttribute('d', describeArc(-90, angle, R));
            arcPath.style.display = '';
        } else {
            arcPath.style.display = 'none';
        }

        if (document.activeElement !== centerInput) {
            centerInput.value = blockingUI._restrictedMinutes;
        }
        centerInput.max = maxMin;
    };

    update(blockingUI._restrictedMinutes);

    const getAngleFromEvent = (e) => {
        const rect = svg.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
    };

    let dragging = false;

    const startDrag = (e) => {
        dragging = true;
        document.body.style.userSelect = 'none';
        e.preventDefault();
    };
    const moveDrag = (e) => {
        if (!dragging) return;
        e.preventDefault();
        update(angleToMinutes(getAngleFromEvent(e)));
    };
    const stopDrag = () => {
        dragging = false;
        document.body.style.userSelect = '';
    };

    handleCircle.addEventListener('mousedown', startDrag);
    handleCircle.addEventListener('touchstart', startDrag, { passive: false });
    svg.addEventListener('mousemove', moveDrag);
    svg.addEventListener('touchmove', moveDrag, { passive: false });
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('touchend', stopDrag);

    svg.addEventListener('click', (e) => {
        if (e.target === handleCircle) return;
        update(angleToMinutes(getAngleFromEvent(e)));
    });

    handleCircle.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            update(blockingUI._restrictedMinutes + 1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            update(blockingUI._restrictedMinutes - 1);
        }
    });

    centerInput.addEventListener('keydown', (e) => {
        if (['-', '+', 'e', 'E'].includes(e.key)) {
            e.preventDefault();
        }
    });
    centerInput.addEventListener('input', () => {
        if (!centerInput.validity.valid || centerInput.value.includes('-')) {
            centerInput.value = centerInput.value.replace(/[-+eE]/g, '');
        }
        const v = parseInt(centerInput.value, 10);
        if (!isNaN(v) && v >= 0) {
            blockingUI._restrictedMinutes = Math.min(maxMin, v);
            update(blockingUI._restrictedMinutes);
        }
    });
    centerInput.addEventListener('blur', () => {
        const v = parseInt(centerInput.value, 10);
        if (isNaN(v) || v < 0 || !centerInput.validity.valid) {
            blockingUI._restrictedMinutes = 30;
        }
        centerInput.value = '';
        update(blockingUI._restrictedMinutes);
    });

    const maxInput = document.getElementById('restrictedSliderMax');
    if (maxInput) {
        maxInput.addEventListener('change', () => {
            const v = parseInt(maxInput.value, 10);
            if (!isNaN(v) && v >= 1) {
                maxMin = v;
                update(Math.min(blockingUI._restrictedMinutes, maxMin));
            }
        });
    }
}
