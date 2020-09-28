# Openhim mediator with openFN

For easy usage of the platform, using docker is advised. It can be downloaded from [here](https://www.docker.com/)

To start using OpenHIM and the provided mediator following steps should be followed:

1 - Go to the network directory and run ``` docker-compose up ```. This is provided by the openHIM team to easily setup the platform and its database.

2 - Go back to the root directory and run ```docker build -t mediator . ```. The name mediator is arbritrary but you should remember it as it is how you will access your mediator. 

3 - Run the command ``` docker run -e OPENHIM_URL=https://openhim-core:8080 -e TRUST_SELF_SIGNED=true -e OPENHIM_PASSWORD=password -e SERVER_PORT=4321 --network network_openhim --name mediator --rm mediator ```. Replace "mediator" with the name that you chose in step 2.

