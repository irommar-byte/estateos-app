# Dołącz wewnątrz server { } dla estateos.pl (HTTPS), PRZED ogólnym location /:
#   include /home/rommar/estateos/deploy/nginx-well-known-proxy.inc;
#
# Port jak w PM2 / next start (domyślnie 3000).

    location = /.well-known/apple-app-site-association {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /.well-known/assetlinks.json {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
