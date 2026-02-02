# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Security Model

### Credential Storage

Glance stores API credentials in an encrypted SQLite database using industry-standard cryptography:

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Derivation**: PBKDF2 with SHA-256, 100,000 iterations
- **IV**: Random 128-bit initialization vector per credential
- **Authentication**: GCM auth tag prevents tampering

The encryption key is derived from an `AUTH_TOKEN`. If you don't provide one, Glance auto-generates a secure token and stores it in `data/.auth_token`. **Keep this token secret** — anyone with access to both your database file and AUTH_TOKEN can decrypt your credentials.

### What This Protects Against

- Database file theft (without AUTH_TOKEN)
- Casual inspection of the database
- Accidental exposure in backups

### What This Does NOT Protect Against

- Attackers with access to your running server (they can read AUTH_TOKEN from memory/env)
- Malware on your machine
- Compromised AUTH_TOKEN

### Widget Sandbox

Custom widgets can execute server-side code to fetch data. This code runs in a restricted environment:

**Client-side (browser)**:

- Widgets render in the main React context
- No sandbox — widgets have full access to the page
- Only use widgets from trusted sources

**Server-side (Node.js)**:

- Code executes in Node.js `vm` module with a restricted context
- Blocked patterns: `process`, `require`, `import`, `eval`, `Function`, filesystem access
- Network requests are allowed (needed for API calls)
- Credentials accessed via `getCredential()` helper

**Important**: The server-side sandbox is a defense-in-depth measure, NOT a security boundary. It prevents accidental misuse but determined attackers could potentially escape it. Only run widget code you trust.

### Local-First Architecture

Glance is designed to run locally on your machine:

- All data stored in local SQLite database
- No cloud sync or external data transmission
- No user accounts or telemetry
- Network requests only made by widgets you configure

### Recommendations

1. **Keep AUTH_TOKEN secret**: Generate a strong random token and never commit it to version control
2. **Secure your database**: The SQLite file at `./data/glance.db` contains your encrypted credentials
3. **Review widget code**: Before adding custom widgets, review their source code
4. **Use environment variables**: For production deployments, use environment variables rather than `.env` files
5. **Regular updates**: Keep Glance updated to receive security patches

## Security Checklist for Self-Hosting

- [ ] If using custom AUTH_TOKEN, ensure it's not committed to version control
- [ ] Database directory (`data/`) has appropriate file permissions
- [ ] The `data/.auth_token` file (if auto-generated) has restricted permissions (600)
- [ ] Running behind a reverse proxy with HTTPS (if exposed to network)
- [ ] Reviewed any custom widgets before adding them
