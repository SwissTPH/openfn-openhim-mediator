#!/bin/bash

# update the nginx config with the domain name
export DOMAIN && envsubst  '$$DOMAIN' < /usr/src/app/config/default.tpl.json > /usr/src/app/config/default.json
# update the console config with the domain name
export DOMAIN && envsubst  '$$DOMAIN' < /usr/src/app/config/development.tpl.json > /usr/src/app/config/development.json
# start server
node lib/server.js