export const domUtils = {
    getFaviconUrl(domain) {
        return DomainUtils.getFaviconUrl(domain).replace('&sz=16', '&sz=32');
    },

    capitalize(str) {
        return DomainUtils.getDisplayName(str || '');
    },

    createElement(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);

        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') element.className = value;
            else if (key === 'style' && typeof value === 'object') Object.assign(element.style, value);
            else element.setAttribute(key, value);
        });

        if (typeof content === 'string') element.textContent = content;
        else if (content instanceof Node) element.appendChild(content);

        return element;
    },

    createSiteItem(siteData) {
        const { domain, todayTime, isBlocked } = siteData;
        const siteItem = this.createElement('div', { className: 'site-item' });
        const siteInfo = this.createElement('div', { className: 'site-item-info' });

        const favicon = this.createElement('img', {
            className: 'site-item-favicon',
            src: this.getFaviconUrl(domain),
            alt: domain,
            onerror: "this.style.display='none'"
        });

        const details = this.createElement('div', { className: 'site-item-details' });
        const name = this.createElement('div', { className: 'site-item-name' }, this.capitalize(domain));
        const time = this.createElement('div', { className: 'site-item-time' }, this.formatDetailedTime(todayTime));

        details.appendChild(name);
        details.appendChild(time);
        siteInfo.appendChild(favicon);
        siteInfo.appendChild(details);

        const actions = this.createElement('div', { className: 'site-item-actions' });
        const blockBtn = this.createElement('button', {
            className: `site-item-btn ${isBlocked ? 'blocked' : ''}`,
            title: isBlocked ? 'Unblock site' : 'Block site',
            'data-domain': domain
        });

        blockBtn.innerHTML = isBlocked
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12C20,14.4 19,16.5 17.3,18.1L5.9,6.7C7.5,5 9.6,4 12,4M12,20A8,8 0 0,1 4,12C4,9.6 5,7.5 6.7,5.9L18.1,17.3C16.5,19 14.4,20 12,20Z"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z"/></svg>';

        actions.appendChild(blockBtn);
        siteItem.appendChild(siteInfo);
        siteItem.appendChild(actions);

        return siteItem;
    },

    createLoadingSpinner() {
        const spinner = this.createElement('div', {
            className: 'loading-spinner',
            style: {
                width: '20px',
                height: '20px',
                border: '2px solid #f3f3f3',
                borderTop: '2px solid #2196F3',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                display: 'inline-block'
            }
        });

        if (!document.getElementById('spinner-styles')) {
            const styles = this.createElement('style', { id: 'spinner-styles' });
            styles.textContent = '@keyframes spin {0% { transform: rotate(0deg); }100% { transform: rotate(360deg); }}';
            document.head.appendChild(styles);
        }

        return spinner;
    }
};
