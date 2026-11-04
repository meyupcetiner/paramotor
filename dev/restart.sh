#!/bin/bash
# yerel test sunucusunu yeniden başlatır (temiz veritabanıyla: FRESH=1)
cd "$(dirname "$0")/.."
[ -f /tmp/claude-0/srv.pid ] && kill $(cat /tmp/claude-0/srv.pid) 2>/dev/null
sleep 0.4
[ "$FRESH" = "1" ] && rm -f /tmp/claude-0/dev.db
PORT=8790 DBFILE=/tmp/claude-0/dev.db nohup node dev/server.mjs > /tmp/claude-0/srv.log 2>&1 &
echo $! > /tmp/claude-0/srv.pid
sleep 1.2; tail -1 /tmp/claude-0/srv.log
