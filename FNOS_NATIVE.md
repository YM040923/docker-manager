# fnOS Native App Build

This project can be packaged as a fnOS native app that uses the unified gateway.

## Access Model

- App package name: `ym040923.docker-manager`
- Gateway prefix: `/app/ym040923-docker-manager`
- Gateway socket: `app.sock`
- UI type: iframe
- Authentication: fnOS unified gateway headers
- Authorization: only fnOS administrators (`X-Trim-Isadmin: true`) can use the app

The native app does not expose port `13000` and does not use the local `admin` password page.

## Runtime Notes

The package follows the fnOS third-party native app template and uses `run-as: package`.
It declares `install_dep_apps=nodejs_v22` so fnOS installs the Node.js runtime before startup.

The app attempts to manage Docker through `/var/run/docker.sock`.
If fnOS does not allow the package user to access Docker, the app will install but Docker management calls will fail until the package is redesigned around fnOS Docker project support or an approved privileged integration.

The app uses SQLite at:

```bash
${TRIM_PKGVAR}/docker-manager.db
```

## Build on fnOS/Linux

Build the package on fnOS/Linux so `better-sqlite3` is installed for Linux, not Windows.

```bash
git clone https://github.com/YM040923/docker-manager.git
cd docker-manager
bash scripts/build-fnos-native.sh
```

The wrapper installs dependencies, downloads the verified Linux `fnpack` binary to `tools/fnpack/fnpack` when needed, builds the app, installs a minimal hoisted production dependency tree for the server, and runs `fnpack build`.
The resulting `.fpk` will be created in:

```bash
packaging/fnos-native/ym040923.docker-manager/
```

## Windows Development

On Windows, `pnpm build:fnos` prepares the package tree and verifies the gateway base path, but it does not install production `node_modules` for the package because `better-sqlite3` is a native Linux dependency.
It also cannot run the Linux `fnpack` binary. Use fnOS/Linux, WSL, or another Linux builder for the final `.fpk`.
