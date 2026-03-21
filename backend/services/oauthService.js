import crypto from 'crypto';
import { query } from '../config/db.js';
import { encrypt, decrypt } from '../config/encryption.js';
import logger from '../config/logger.js';

// ── Discovery Cache ──

const discoveryCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function fetchDiscovery(discoveryUrl) {
    const cached = discoveryCache.get(discoveryUrl);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return cached.data;
    }
    const res = await fetch(discoveryUrl);
    if (!res.ok) {
        throw new Error(`Discovery-Endpunkt Fehler: ${res.status}`);
    }
    const data = await res.json();
    discoveryCache.set(discoveryUrl, { data, ts: Date.now() });
    return data;
}

// ── Provider CRUD ──

export async function getEnabledProviders() {
    const result = await query(
        `SELECT id, provider_key, display_name, enabled
         FROM oauth_providers
         WHERE enabled = TRUE
         ORDER BY display_name`
    );
    return result.rows.map((r) => ({
        providerKey: r.provider_key,
        displayName: r.display_name,
    }));
}

export async function getEnabledProvider(providerKey) {
    const result = await query(
        `SELECT * FROM oauth_providers WHERE provider_key = $1 AND enabled = TRUE`,
        [providerKey]
    );
    return result.rows[0] || null;
}

export async function getAllProviders() {
    const result = await query(
        `SELECT id, provider_key, display_name, enabled, client_id,
                discovery_url, scopes, email_claim, name_claim,
                allowed_domains, auto_provisioning, created_at, updated_at
         FROM oauth_providers
         ORDER BY display_name`
    );
    return result.rows;
}

export async function createProvider(data) {
    const encryptedSecret = encrypt(data.clientSecret);
    const result = await query(
        `INSERT INTO oauth_providers
            (provider_key, display_name, enabled, client_id, client_secret_encrypted,
             discovery_url, scopes, email_claim, name_claim, allowed_domains, auto_provisioning)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, provider_key, display_name, enabled`,
        [
            data.providerKey, data.displayName, data.enabled ?? false,
            data.clientId, encryptedSecret, data.discoveryUrl,
            data.scopes || 'openid profile email',
            data.emailClaim || 'email', data.nameClaim || 'name',
            data.allowedDomains || null, data.autoProvisioning ?? false,
        ]
    );
    return result.rows[0];
}

export async function updateProvider(id, data) {
    const fields = [];
    const values = [];
    let idx = 1;

    const allowedFields = {
        displayName: 'display_name',
        enabled: 'enabled',
        clientId: 'client_id',
        discoveryUrl: 'discovery_url',
        scopes: 'scopes',
        emailClaim: 'email_claim',
        nameClaim: 'name_claim',
        allowedDomains: 'allowed_domains',
        autoProvisioning: 'auto_provisioning',
    };

    for (const [key, col] of Object.entries(allowedFields)) {
        if (data[key] !== undefined) {
            fields.push(`${col} = $${idx++}`);
            values.push(data[key]);
        }
    }

    // Client secret only if explicitly provided
    if (data.clientSecret) {
        fields.push(`client_secret_encrypted = $${idx++}`);
        values.push(encrypt(data.clientSecret));
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
        `UPDATE oauth_providers SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, provider_key, display_name, enabled`,
        values
    );
    return result.rows[0] || null;
}

export async function deleteProvider(id) {
    const result = await query(
        `DELETE FROM oauth_providers WHERE id = $1 RETURNING id`,
        [id]
    );
    return result.rows.length > 0;
}

// ── PKCE ──

export function generatePKCE() {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
    return { codeVerifier, codeChallenge };
}

export function generateState() {
    return crypto.randomBytes(32).toString('hex');
}

// ── Token Exchange ──

export async function exchangeCode(provider, code, codeVerifier, redirectUri, discovery) {
    const clientSecret = decrypt(provider.client_secret_encrypted);

    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: provider.client_id,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
    });

    const res = await fetch(discovery.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    if (!res.ok) {
        const err = await res.text();
        logger.error({ status: res.status, body: err }, 'OAuth Token-Austausch fehlgeschlagen');
        throw new Error('Token-Austausch fehlgeschlagen');
    }

    return res.json();
}

// ── JWKS Validation ──

const jwksCache = new Map();
const JWKS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchJWKS(jwksUri) {
    const cached = jwksCache.get(jwksUri);
    if (cached && Date.now() - cached.ts < JWKS_CACHE_TTL) {
        return cached.keys;
    }
    const res = await fetch(jwksUri);
    if (!res.ok) throw new Error(`JWKS fetch fehlgeschlagen: ${res.status}`);
    const data = await res.json();
    const keys = data.keys || [];
    jwksCache.set(jwksUri, { keys, ts: Date.now() });
    return keys;
}

function jwkToPublicKey(jwk) {
    return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

export async function validateIdToken(idToken, provider, discovery) {
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new Error('Ungueltiges ID-Token-Format');

    // Decode header to get kid
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

    // Validate issuer
    if (payload.iss !== discovery.issuer) {
        throw new Error(`Issuer mismatch: erwartet ${discovery.issuer}, erhalten ${payload.iss}`);
    }

    // Validate audience
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(provider.client_id)) {
        throw new Error('Audience stimmt nicht mit client_id ueberein');
    }

    // Validate expiry (mandatory per OIDC spec)
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('ID-Token ist abgelaufen oder hat keinen exp-Claim');
    }

    // Validate signature with JWKS (mandatory)
    if (!discovery.jwks_uri) {
        throw new Error('jwks_uri fehlt im Discovery-Dokument – Signaturvalidierung nicht moeglich');
    }

    {
        const keys = await fetchJWKS(discovery.jwks_uri);
        const matchingKey = keys.find((k) => k.kid === header.kid);
        if (!matchingKey) {
            throw new Error(`Kein passender JWK fuer kid=${header.kid} gefunden`);
        }
        const publicKey = jwkToPublicKey(matchingKey);
        const signatureInput = `${parts[0]}.${parts[1]}`;
        const signature = Buffer.from(parts[2], 'base64url');

        const algMap = {
            RS256: 'RSA-SHA256', RS384: 'RSA-SHA384', RS512: 'RSA-SHA512',
            ES256: 'SHA256', ES384: 'SHA384', ES512: 'SHA512',
        };
        const alg = algMap[header.alg];
        if (!alg) {
            throw new Error(`Nicht unterstuetzter Algorithmus: ${header.alg}`);
        }

        const verifyOpts = header.alg.startsWith('ES') ? { dsaEncoding: 'ieee-p1363' } : undefined;
        const isValid = crypto.createVerify(alg)
            .update(signatureInput)
            .verify({ key: publicKey, ...(verifyOpts ? { dsaEncoding: verifyOpts.dsaEncoding } : {}) }, signature);
        if (!isValid) {
            throw new Error('ID-Token-Signatur ungueltig');
        }
    }

    return payload;
}

// ── User Matching ──

export async function matchOrCreateUser(claims, provider) {
    const email = claims[provider.email_claim];
    const sub = claims.sub;
    const name = claims[provider.name_claim] || '';

    if (!email) {
        throw new Error('Keine E-Mail im ID-Token gefunden');
    }

    // Domain check
    if (provider.allowed_domains) {
        const allowed = provider.allowed_domains.split(',').map((d) => d.trim().toLowerCase());
        const emailDomain = email.split('@')[1]?.toLowerCase();
        if (!allowed.includes(emailDomain)) {
            throw new Error(`E-Mail-Domain ${emailDomain} ist nicht erlaubt`);
        }
    }

    // 1. Check existing link
    const linkResult = await query(
        `SELECT u.id, u.username, u.role, u.teacher_id, u.token_version,
                u.force_password_change
         FROM oauth_user_links oul
         JOIN users u ON u.id = oul.user_id
         WHERE oul.provider_id = $1 AND oul.provider_subject = $2`,
        [provider.id, sub]
    );

    if (linkResult.rows.length > 0) {
        // Update last_login_at
        await query(
            `UPDATE oauth_user_links SET last_login_at = NOW(), provider_email = $1
             WHERE provider_id = $2 AND provider_subject = $3`,
            [email, provider.id, sub]
        );
        const u = linkResult.rows[0];
        return buildUserObject(u);
    }

    // 2. Match by email
    const emailResult = await query(
        `SELECT id, username, role, teacher_id, token_version, force_password_change
         FROM users WHERE LOWER(email) = LOWER($1)`,
        [email]
    );

    if (emailResult.rows.length > 0) {
        const u = emailResult.rows[0];
        // Create link automatically
        await query(
            `INSERT INTO oauth_user_links (user_id, provider_id, provider_subject, provider_email, last_login_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [u.id, provider.id, sub, email]
        );
        logger.info({ userId: u.id, provider: provider.provider_key }, 'OAuth-Link automatisch erstellt (E-Mail-Match)');
        return buildUserObject(u);
    }

    // 3. Auto-provisioning
    if (!provider.auto_provisioning) {
        throw new Error('Kein Konto gefunden. Bitte wenden Sie sich an die Administration.');
    }

    // Create new user (teacher role, no password)
    let username = email.split('@')[0];
    // Ensure unique username
    const existing = await query(`SELECT id FROM users WHERE username = $1`, [username]);
    if (existing.rows.length > 0) {
        username = `${username}_${Date.now() % 10000}`;
    }
    const newUser = await query(
        `INSERT INTO users (username, email, role, password_hash)
         VALUES ($1, $2, 'teacher', NULL)
         RETURNING id, username, role, teacher_id, token_version, force_password_change`,
        [username, email]
    );
    const created = newUser.rows[0];

    // Create link
    await query(
        `INSERT INTO oauth_user_links (user_id, provider_id, provider_subject, provider_email, last_login_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [created.id, provider.id, sub, email]
    );

    logger.info({ userId: created.id, email, provider: provider.provider_key }, 'Neuer OAuth-User angelegt (Auto-Provisioning)');
    return buildUserObject(created);
}

function buildUserObject(row) {
    return {
        id: row.id,
        username: row.username,
        role: row.role,
        teacherId: row.teacher_id,
        tokenVersion: row.token_version ?? 0,
        forcePasswordChange: !!row.force_password_change,
    };
}

// ── Token Persistence (for WebDAV) ──

export async function saveOAuthTokens(userId, providerId, tokens) {
    const updates = [];
    const values = [];
    let idx = 1;

    if (tokens.refresh_token) {
        updates.push(`refresh_token_encrypted = $${idx++}`);
        values.push(encrypt(tokens.refresh_token));
    }
    if (tokens.access_token) {
        updates.push(`access_token_encrypted = $${idx++}`);
        values.push(encrypt(tokens.access_token));
    }
    if (tokens.expires_in) {
        updates.push(`token_expires_at = NOW() + ($${idx++} || ' seconds')::INTERVAL`);
        values.push(String(parseInt(tokens.expires_in, 10) || 3600));
    }

    if (updates.length === 0) return;

    values.push(userId, providerId);
    await query(
        `UPDATE oauth_user_links SET ${updates.join(', ')}
         WHERE user_id = $${idx++} AND provider_id = $${idx}`,
        values
    );
}
