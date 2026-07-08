export function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

export function formatCurrentTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function formatTimeAgo(pubDateStr) {
    if (!pubDateStr) return "recentemente";
    const diffMins = Math.floor((new Date() - new Date(pubDateStr)) / 60000);
    if (diffMins < 1) return "ora";
    if (diffMins < 60) return `${diffMins} min fa`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} ore fa`;
    return `${Math.floor(diffHours / 24)} gg fa`;
}

export function sanitizeUrl(url) {
    if (!url) return "";
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return "";
}
