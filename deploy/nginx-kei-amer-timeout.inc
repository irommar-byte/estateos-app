# Dłuższy timeout + wyłączenie buforowania dla SSE (postęp importu na żywo).
location ~ ^/api/admin/kei-amer/(export-latest|export-stream|preview|peek|peek-image) {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_read_timeout 300s;
    proxy_connect_timeout 60s;
    proxy_send_timeout 300s;
    proxy_buffering off;
    proxy_cache off;
    gzip off;
    chunked_transfer_encoding on;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Accel-Buffering no;
    proxy_cache_bypass $http_upgrade;
}
