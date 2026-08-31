export interface OAuthState {
    platform: string;
    redirect: string;
}

// The app's mobile OAuth callback may be an exp:// URL (Expo Go) or a custom
// scheme like churcheden:// (dev/standalone build). We only follow callbacks
// we own, to avoid turning the server-side redirect into an open redirector.
export const isAllowedMobileCallback = (uri: string): boolean =>
    uri.startsWith('exp://') ||
    uri.startsWith('churcheden://') ||
    uri.startsWith('http://localhost:') ||
    uri.startsWith('https://localhost:');

// Passed through Google's `state` parameter as `<platform>|<redirect>` so the
// callback can rebuild the exact URL to return the browser to.
export const buildOAuthState = (platform: string, redirect?: string): string =>
    redirect && isAllowedMobileCallback(redirect) ? `${platform}|${redirect}` : platform;

export const parseOAuthState = (state?: string): OAuthState => {
    if (!state) {
        return { platform: 'web', redirect: '' };
    }
    const sep = state.indexOf('|');
    if (sep === -1) {
        return { platform: state, redirect: '' };
    }
    return { platform: state.slice(0, sep), redirect: state.slice(sep + 1) };
};