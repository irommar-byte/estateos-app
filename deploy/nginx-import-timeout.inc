# Include inside server { } for estateos.pl — long-running portal import create/analyze.
location ~ ^/api/(mobile/v1/)?(pro/)?otodom-import(/create)?$ {
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    proxy_connect_timeout 60s;
}
