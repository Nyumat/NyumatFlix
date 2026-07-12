#!/usr/bin/env bash
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/bootstrap-scrape-vpn.sh" ensure-local "$@"
