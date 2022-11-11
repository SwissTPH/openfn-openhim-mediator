#!/bin/bash

# update the main config with the domain name
export DOMAIN && envsubst  '$$DOMAIN' < /etc/nginx/conf.d/openhim.tpl > /etc/nginx/conf.d/default.conf
# update the dev config with the domain name
export DOMAIN && envsubst  '$$DOMAIN' < /usr/share/nginx/html/config/default.tpl.json > /usr/share/nginx/html/config/default.json
# Launch server
nginx -g 'daemon off;'