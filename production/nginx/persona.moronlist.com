server {
    server_name persona.moronlist.com;

    # Block internal API from public access - only accessible via Docker network
    location /internal/ {
        return 403;
    }

    location / {
        proxy_pass http://127.0.0.1:6005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SSL will be added by certbot
}
