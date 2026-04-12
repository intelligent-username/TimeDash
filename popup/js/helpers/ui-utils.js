export const uiUtils = {
    showToast(message, type = 'info', duration = 3000) {
        const existingToast = document.querySelector('.toast');
        if (existingToast) existingToast.remove();

        const colors = { success: '#4CAF50', error: '#F44336', warning: '#FF9800', info: '#2196F3' };
        const toast = this.createElement('div', {
            className: 'toast',
            style: {
                position: 'fixed',
                top: '20px',
                right: '20px',
                background: colors[type] || colors.info,
                color: 'white',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                zIndex: '10000',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                transform: 'translateX(100%)',
                transition: 'transform 0.3s ease, opacity 0.3s ease',
                maxWidth: '300px',
                wordWrap: 'break-word'
            }
        }, message);

        document.body.appendChild(toast);
        requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
        }, duration);
    },

    updateWithFade(element, content) {
        element.style.opacity = '0.5';
        setTimeout(() => {
            if (typeof content === 'string') {
                element.textContent = content;
            } else if (content instanceof Node) {
                element.innerHTML = '';
                element.appendChild(content);
            }
            element.style.opacity = '1';
        }, 150);
    },

    animateIn(element) {
        element.style.opacity = '0';
        element.style.transform = 'translateY(10px)';
        element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        requestAnimationFrame(() => {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        });
    },

    showBanner(message, type = 'info') {
        let banner = document.getElementById('banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'banner';
            document.body.prepend(banner);
        }

        banner.className = `banner ${type}`;
        banner.setAttribute('role', type === 'error' ? 'alert' : 'status');
        banner.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
        banner.textContent = message;
        banner.style.display = 'block';
    },

    hideBanner() {
        const banner = document.getElementById('banner');
        if (banner) banner.style.display = 'none';
    },

    createSkeletonLine(width = '100%') {
        const line = document.createElement('div');
        line.className = 'skeleton-line';
        line.style.width = width;
        return line;
    },

    injectSkeletonList(container, rows = 3) {
        if (!container) return;
        container.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'skeleton-list';

        for (let i = 0; i < rows; i++) {
            const row = document.createElement('div');
            row.className = 'skeleton-row';
            row.appendChild(this.createSkeletonLine('60%'));
            row.appendChild(this.createSkeletonLine('30%'));
            wrapper.appendChild(row);
        }

        container.appendChild(wrapper);
    }
};
