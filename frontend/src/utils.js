export function getCurrentUserLogin() {
    return window.amit24ve || localStorage.getItem('username') || '';
}
