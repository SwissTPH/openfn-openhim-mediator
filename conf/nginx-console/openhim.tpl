server {
    listen       80;
    listen  [::]:80;
    server_name  localhost;

    location / {
        root   /usr/share/nginx/html;
        index  index.html index.htm;
    }

    error_page   500 502 503 504  /50x.html;
    location = /50x.html {
        root   /usr/share/nginx/html;
    }


}
server {
        listen       443 ssl;
        server_name ${DOMAIN};
        root /usr/share/nginx/html/;

        # Add index.php to the list if you are using PHP
        index index.html index.htm index.nginx-debian.html;
    	server_name YOUR-HOST; # managed by Certbot


        location / {
                # First attempt to serve request as file, then
                # as directory, then fall back to displaying a 404.
                try_files $uri $uri/ =404;
        }

        location /api/ {
                proxy_pass https://core:8080/;
                proxy_set_header   Host ${DOMAIN};
                proxy_set_header   X-Real-IP $remote_addr;
                proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header   X-Forwarded-Host $server_name;
        }

        location /channel/ {
                proxy_pass http://core:5001/;
                proxy_set_header   Host ${DOMAIN};
                proxy_set_header   X-Real-IP $remote_addr;
                proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header   X-Forwarded-Host $server_name;
        }

        location /auditing/ {
                proxy_pass http://core:5050/;
                proxy_set_header   Host ${DOMAIN};
                proxy_set_header   X-Environment legacy;
                proxy_set_header   X-Real-IP $remote_addr;
                proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header   X-Forwarded-Host $host;
        }

        ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
		include       mime.types;
		default_type  application/octet-stream;
		gzip on; # Enables compression, incl Web API content-types
		gzip_types
			"application/json;charset=utf-8" application/json
			"application/javascript;charset=utf-8" application/javascript text/javascript
			"application/xml;charset=utf-8" application/xml text/xml
			"text/css;charset=utf-8" text/css
			"text/plain;charset=utf-8" text/plain;

		# Disallow Search Engine Crawling
		location = /robots.txt {
		  add_header  Content-Type  text/plain;
		  return 200 "User-agent: *\nDisallow: /\n";
		}
        
 

}

