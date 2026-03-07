FALLBACK_WEBSITE_NGINX_CONFIG_TEMPLATE = """server {{
    listen 80;
    server_name {server_name};

    # Logs
    access_log /var/log/nginx/{server_name}.access.log;
    error_log /var/log/nginx/{server_name}.error.log;

    location / {{
        # Proxy to your Python fallback/request-access server
        proxy_pass http://{backend_host}:{backend_port};

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
}}
"""
