FROM node:dubnium-alpine

WORKDIR /app

COPY package.json package-lock.json ./

##RUN apk update and apk add git && npm install
#https://github.com/nodejs/docker-node/issues/586
RUN apk add --no-cache git

RUN npm install

#COPY ./app-macos .
COPY . .
CMD npm start
#CMD ./app-macos
#CMD npm run dev
EXPOSE 4321
