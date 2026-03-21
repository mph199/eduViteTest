BEGIN;

-- OAuth-Provider-Konfiguration pro Instanz
CREATE TABLE IF NOT EXISTS oauth_providers (
    id SERIAL PRIMARY KEY,
    provider_key VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    client_id VARCHAR(500) NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    discovery_url TEXT NOT NULL,
    scopes VARCHAR(500) NOT NULL DEFAULT 'openid profile email',
    email_claim VARCHAR(100) NOT NULL DEFAULT 'email',
    name_claim VARCHAR(100) NOT NULL DEFAULT 'name',
    allowed_domains TEXT,
    auto_provisioning BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OAuth-Verknuepfung: Welcher IdP-User gehoert zu welchem eduVite-User
CREATE TABLE IF NOT EXISTS oauth_user_links (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id INTEGER NOT NULL REFERENCES oauth_providers(id) ON DELETE CASCADE,
    provider_subject VARCHAR(500) NOT NULL,
    provider_email VARCHAR(500),
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    refresh_token_encrypted TEXT,
    access_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,
    UNIQUE(provider_id, provider_subject),
    UNIQUE(user_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_user_links_user ON oauth_user_links(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_user_links_provider ON oauth_user_links(provider_id);

-- password_hash nullable machen fuer OAuth-only User
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

COMMIT;
