# Keenetic build and install

This fork builds a static Zashboard archive and installs it into the directory
configured by Mihomo's `external-ui`. On the target router that resolves to
`/opt/etc/mihomo/zash`.

## Build

```sh
FONT=cdn ./scripts/keenetic/build.sh
```

`FONT=cdn` is the default and keeps the router artifact small. The archive and
its SHA-256 file are written to `dist/keenetic/`.

## Deploy from a workstation

```sh
./scripts/keenetic/deploy.sh dist/keenetic/zashboard-*.tar.gz
```

The deploy script uses `root@192.168.1.1` on SSH port `222` by default and
does not store a password. Override `ROUTER` or `ROUTER_PORT` when needed.

Installation extracts into a sibling staging directory, verifies
`index.html`, moves the previous dashboard into
`/opt/etc/mihomo/backup/ui/`, and atomically switches directories. Mihomo does
not need to be restarted. Relative `external-ui` paths are resolved from
`CONFIG_DIR`, which defaults to Mihomo's working directory `/opt/etc/mihomo`.
