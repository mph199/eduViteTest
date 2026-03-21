import express from 'express';
import rateLimit from 'express-rate-limit';
import {
    fetchDiscovery,
    getEnabledProviders,
    getEnabledProvider,
    generatePKCE,
    generateState,
    exchangeCode,
    validateIdToken,
    matchOrCreateUser,
    saveOAuthTokens,
} from '../services/oauthService.js';
import { generateToken } from '../middleware/auth.js';
import { logSecurityEvent } from '../middleware/audit-log.js';
import logger from '../config/logger.js';
import { query } from '../config/db.js';

const router = express.Router();

const isProduction = process.env.NODE_ENV === 'production';
const cookieSecure = process.env.COOKIE_SECURE && process.env.COOKIE_SECURE !== ''
    ? process.env.COOKIE_SECURE === 'true'
    : isProduction;

function cookieOptions() {
    return {
        httpOnly: true,
        secure: cookieSecure,
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000,
        path: '/',
    };
}

const oauthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Zu viele OAuth-Anfragen. Bitte spaeter erneut versuchen.' },
});

function getBaseUrl(req) {
    if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
    const proto = req.protocol;
    const host = req.get('host');
    return `${proto}://${host}`;
}

// ── GET /api/auth/providers – Liste aktiver Provider (public) ──

router.get('/providers', async (_req, res) => {
    try {
        const providers = await getEnabledProviders();
        res.json(providers);
    } catch (err) {
        logger.error({ err }, 'Fehler beim Laden der OAuth-Provider');
        res.json([]);
    }
});

// ── GET /api/auth/oauth/:providerKey – Redirect zum IdP ──

router.get('/oauth/:providerKey', oauthLimiter, async (req, res) => {
    try {
        const provider = await getEnabledProvider(req.params.providerKey);
        if (!provider) {
            return res.redirect('/login?error=provider_not_found');
        }

        const discovery = await fetchDiscovery(provider.discovery_url);
        const state = generateState();
        const { codeVerifier, codeChallenge } = generatePKCE();
        const baseUrl = getBaseUrl(req);
        const redirectUri = `${baseUrl}/api/auth/oauth/${provider.provider_key}/callback`;

        // State + Code Verifier in httpOnly Cookie
        res.cookie('oauth_state', JSON.stringify({
            state,
            codeVerifier,
            providerKey: provider.provider_key,
        }), {
            httpOnly: true,
            secure: cookieSecure,
            sameSite: 'lax',
            maxAge: 10 * 60 * 1000,
            path: '/api/auth/oauth',
        });

        const params = new URLSearchParams({
            client_id: provider.client_id,
            response_type: 'code',
            redirect_uri: redirectUri,
            scope: provider.scopes,
            state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
        });

        res.redirect(`${discovery.authorization_endpoint}?${params}`);
    } catch (err) {
        logger.error({ err, provider: req.params.providerKey }, 'OAuth Redirect fehlgeschlagen');
        res.redirect('/login?error=oauth_error');
    }
});

// ── GET /api/auth/oauth/:providerKey/callback – Callback vom IdP ──

router.get('/oauth/:providerKey/callback', oauthLimiter, async (req, res) => {
    try {
        const { code, state, error: oauthError } = req.query;

        if (oauthError) {
            logger.warn({ error: oauthError }, 'OAuth Provider hat Fehler zurueckgegeben');
            return res.redirect(`/login?error=oauth_denied`);
        }

        if (!code || !state) {
            return res.redirect('/login?error=oauth_missing_params');
        }

        // Parse stored state from cookie
        let stored;
        try {
            stored = JSON.parse(req.cookies?.oauth_state || '{}');
        } catch {
            return res.redirect('/login?error=oauth_state_invalid');
        }

        // CSRF check
        if (!stored.state || stored.state !== state) {
            logSecurityEvent(null, 'OAUTH_STATE_MISMATCH', { providerKey: req.params.providerKey }, req.ip);
            return res.redirect('/login?error=oauth_state_mismatch');
        }

        const provider = await getEnabledProvider(stored.providerKey);
        if (!provider) {
            return res.redirect('/login?error=provider_not_found');
        }

        const discovery = await fetchDiscovery(provider.discovery_url);
        const baseUrl = getBaseUrl(req);
        const redirectUri = `${baseUrl}/api/auth/oauth/${provider.provider_key}/callback`;

        // Exchange code for tokens
        const tokens = await exchangeCode(provider, code, stored.codeVerifier, redirectUri, discovery);

        if (!tokens.id_token) {
            throw new Error('Kein ID-Token in der Antwort');
        }

        // Validate ID token
        const claims = await validateIdToken(tokens.id_token, provider, discovery);

        // Match or create user
        const user = await matchOrCreateUser(claims, provider);

        // Check account lockout
        const lockCheck = await query(
            `SELECT locked_until FROM users WHERE id = $1`,
            [user.id]
        );
        if (lockCheck.rows[0]?.locked_until && new Date(lockCheck.rows[0].locked_until) > new Date()) {
            return res.redirect('/login?error=account_locked');
        }

        // Load module access
        const moduleResult = await query(
            `SELECT module_key FROM user_module_access WHERE user_id = $1`,
            [user.id]
        );
        user.modules = moduleResult.rows.map((r) => r.module_key);

        // Generate JWT and set cookie
        const jwtToken = generateToken(user);
        res.cookie('token', jwtToken, cookieOptions());

        // Clear OAuth state cookie
        res.clearCookie('oauth_state', { path: '/api/auth/oauth' });

        // Save refresh token for WebDAV
        if (tokens.refresh_token) {
            await saveOAuthTokens(user.id, provider.id, tokens);
        }

        logSecurityEvent(user.id, 'OAUTH_LOGIN_SUCCESS', { provider: provider.provider_key }, req.ip);
        logger.info({ userId: user.id, provider: provider.provider_key }, 'OAuth-Login erfolgreich');

        res.redirect('/teacher');
    } catch (err) {
        logger.error({ err, provider: req.params.providerKey }, 'OAuth Callback fehlgeschlagen');

        // User-friendly error for known cases
        const msg = err.message;
        if (msg.includes('Kein Konto gefunden')) {
            return res.redirect('/login?error=oauth_no_account');
        }
        if (msg.includes('Domain') && msg.includes('nicht erlaubt')) {
            return res.redirect('/login?error=oauth_domain_blocked');
        }
        res.redirect('/login?error=oauth_error');
    }
});

export default router;
