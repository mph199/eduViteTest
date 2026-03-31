import crypto from 'crypto';
import { db } from '../db/database.js';
import { sql } from 'kysely';

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
    const rows = await db.selectFrom('oauth_providers')
        .select(['id', 'provider_key', 'display_name', 'enabled'])
        .where('enabled', '=', true)
        .orderBy('display_name')
        .execute();
    return Array.isArray(rows)
        ? rows.map((r) => ({
            providerKey: r.provider_key,
            displayName: r.display_name,
        }))
        : [];
}

export async function getEnabledProvider(providerKey) {
    const row = await db.selectFrom('oauth_providers')
        .selectAll()
        .where('provider_key', '=', providerKey)
        .where('enabled', '=', true)
        .executeTakeFirst();
    return row || null;
}

export async function getAllProviders() {
    const rows = await db.selectFrom('oauth_providers')
        .select([
            'id', 'provider_key', 'display_name', 'enabled', 'client_id',
            'discovery_url', 'scopes', 'email_claim', 'name_claim',
            'allowed_domains', 'auto_provisioning', 'created_at', 'updated_at',
        ])
        .orderBy('display_name')
        .execute();
    return Array.isArray(rows) ? rows : [];
}

export async function createProvider(data) {
    const encryptedSecret = encrypt(data.clientSecret);
    const row = await db.insertInto('oauth_providers')
        .values({
            provider_key: data.providerKey,
            display_name: data.displayName,
            enabled: data.enabled ?? false,
            client_id: data.clientId,
            client_secret_encrypted: encryptedSecret,
            discovery_url: data.discoveryUrl,
            scopes: data.scopes || 'openid profile email',
            email_claim: data.emailClaim || 'email',
            name_claim: data.nameClaim || 'name',
            allowed_domains: data.allowedDomains || null,
            auto_provisioning: data.autoProvisioning ?? false,
        })
        .returning(['id', 'provider_key', 'display_name', 'enabled'])
        .executeTakeFirst();
    return row;
}

export async function updateProvider(id, data) {
    const updates = {};

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
            updates[col] = data[key];
        }
    }

    // Client secret only if explicitly provided
    if (data.clientSecret) {
        updates.client_secret_encrypted = encrypt(data.clientSecret);
    }

    if (Object.keys(updates).length === 0) return null;

    updates.updated_at = sql`NOW()`;

    const row = await db.updateTable('oauth_providers')
        .set(updates)
        .where('id', '=', id)
        .returning(['id', 'provider_key', 'display_name', 'enabled'])
        .executeTakeFirst();
    return row || null;
}

export async function deleteProvider(id) {
    const result = await db.deleteFrom('oauth_providers')
        .where('id', '=', id)
        .returning(['id'])
        .executeTakeFirst();
    return !!result;
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

    // Validate not-before (nbf) if present
    if (payload.nbf && payload.nbf > Math.floor(Date.now() / 1000)) {
        throw new Error('ID-Token noch nicht gueltig (nbf)');
    }

    // Validate signature with JWKS (mandatory)
    if (!discovery.jwks_uri) {
        throw new Error('jwks_uri fehlt im Discovery-Dokument – Signaturvalidierung nicht moeglich');
    }

    {
        if (!header.kid) {
            throw new Error('ID-Token-Header enthaelt kein kid');
        }
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
    const linkRow = await sql`
        SELECT u.id, u.username, u.role, u.teacher_id, u.token_version,
               u.force_password_change
        FROM oauth_user_links oul
        JOIN users u ON u.id = oul.user_id
        WHERE oul.provider_id = ${provider.id} AND oul.provider_subject = ${sub}
    `.execute(db);

    if (linkRow.rows.length > 0) {
        // Update last_login_at
        await db.updateTable('oauth_user_links')
            .set({ last_login_at: sql`NOW()`, provider_email: email })
            .where('provider_id', '=', provider.id)
            .where('provider_subject', '=', sub)
            .execute();
        return buildUserObject(linkRow.rows[0]);
    }

    // 2. Match by email
    const emailRow = await db.selectFrom('users')
        .select(['id', 'username', 'role', 'teacher_id', 'token_version', 'force_password_change'])
        .where(sql`LOWER(email)`, '=', sql`LOWER(${email})`)
        .executeTakeFirst();

    if (emailRow) {
        // Create link automatically
        await db.insertInto('oauth_user_links')
            .values({
                user_id: emailRow.id,
                provider_id: provider.id,
                provider_subject: sub,
                provider_email: email,
                last_login_at: sql`NOW()`,
            })
            .execute();
        logger.info({ userId: emailRow.id, provider: provider.provider_key }, 'OAuth-Link automatisch erstellt (E-Mail-Match)');
        return buildUserObject(emailRow);
    }

    // 3. Auto-provisioning
    if (!provider.auto_provisioning) {
        throw new Error('Kein Konto gefunden. Bitte wenden Sie sich an die Administration.');
    }

    // Create new user (teacher role, no password)
    let username = email.split('@')[0];
    // Ensure unique username (retry with random suffix on conflict)
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const created = await db.insertInto('users')
                .values({
                    username,
                    email,
                    role: 'teacher',
                    password_hash: null,
                })
                .returning(['id', 'username', 'role', 'teacher_id', 'token_version', 'force_password_change'])
                .executeTakeFirst();

            // Create link
            await db.insertInto('oauth_user_links')
                .values({
                    user_id: created.id,
                    provider_id: provider.id,
                    provider_subject: sub,
                    provider_email: email,
                    last_login_at: sql`NOW()`,
                })
                .execute();

            logger.info({ userId: created.id, email, provider: provider.provider_key }, 'Neuer OAuth-User angelegt (Auto-Provisioning)');
            return buildUserObject(created);
        } catch (insertErr) {
            if (insertErr.code === '23505' && insertErr.constraint?.includes('username')) {
                username = `${email.split('@')[0]}_${crypto.randomBytes(4).toString('hex')}`;
                continue;
            }
            throw insertErr;
        }
    }
    throw new Error('Username-Vergabe fehlgeschlagen nach mehreren Versuchen');
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
    const updates = {};

    if (tokens.refresh_token) {
        updates.refresh_token_encrypted = encrypt(tokens.refresh_token);
    }
    if (tokens.access_token) {
        updates.access_token_encrypted = encrypt(tokens.access_token);
    }
    if (tokens.expires_in) {
        updates.token_expires_at = sql`NOW() + make_interval(secs => ${parseInt(tokens.expires_in, 10) || 3600}::int)`;
    }

    if (Object.keys(updates).length === 0) return;

    await db.updateTable('oauth_user_links')
        .set(updates)
        .where('user_id', '=', userId)
        .where('provider_id', '=', providerId)
        .execute();
}
