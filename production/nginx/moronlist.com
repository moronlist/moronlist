server {
    server_name moronlist.com www.moronlist.com;

    root /home/moronlistuser/frontend/moronlist;
    index index.html;

    # SPA fallback - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # SSL will be added by certbot
}
