    location / {
        # Panel klienta: pliki do 20 MB (+ zapas na multipart). Bez tego nginx odcina duże pliki 413.
        client_max_body_size 25m;
        client_body_timeout 300s;
        proxy_request_buffering off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_pass http://estateos_next;
        proxy_http_version 1.1;
        access_log /var/log/nginx/estateos-access.log estateos_timed;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Request-ID $request_id;
        add_header X-Request-ID $request_id always;
        proxy_cache_bypass $http_upgrade;
    }
