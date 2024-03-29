[uri_license]: http://www.gnu.org/licenses/agpl.html
[uri_license_image]: https://img.shields.io/badge/License-AGPL%20v3-blue.svg

[![License: AGPL v3][uri_license_image]][uri_license]

## Useful links
* Additional information on mediators and configuration: http://openhim.org/docs/dev-guide/developing-mediators/
* OpenFN github repositories (inc. languages): https://github.com/OpenFn/
* OpenFN platform, which influenced this project https://www.openfn.org/
* To manually install and setup mongodb when not using docker (requirement for the manual installation of openhim) : https://docs.mongodb.com/manual/installation/ 
* If you want to install openHIM manually: http://openhim.org/docs/installation/manual
* If you want to install openHIM with npm: http://openhim.org/docs/installation/npm

# Openhim mediator with openFN

For easy usage of the platform, using docker is advised. It can be downloaded from [here](https://www.docker.com/)

To start using OpenHIM and the provided mediator following steps should be followed:

1. 
     - Create an .env file in the root directory with the parameters:
          - OPENHIM_USERNAME=YOURUSERNAME
          - OPENHIM_PASSWORD=YOURPASSWORDTOUSER
          - DOMAIN=YOURDOMAIN
          - OPENHIM_URL=YOURURL
          - OPENHIM_USER=YOURUSER

     1.1  - Run start.sh shell script inside of the "conf/nginx-console" and "conf/openhim-core"
     
2    - Run ```docker-compose build```and ``` docker-compose up -d``` in the root directory. This is provided by the openHIM team to easily setup the platform and its database and was extended to build and run the mediator as well, you can change the environmental variables in the same file.
     - CHANGE THE NAMES MY-HOST AND YOUR-HOST ACCORDINGLY (They should be the same)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;1.1: There are environmental variables in the mediator that can be changed in order for you to have e.g. multiple mediators running, make sure that you change them if you have multiple of those in your docker-file. Even if you dont use the code in this repo, you may take this snippet and have it in your openhim dockerfile as to build your mediator automatically. If you do so, you will only need the variables OPENHIM_URL, TRUST_SELF_SIGNED, OPENHIM_PASSWORD, SERVER_PORT. 
```
mediator-default:
     container_name: mediator-default
     restart: unless-stopped
     networks:
       - openhim
     expose:
       - "4321"
     build: ../
     environment:
       - OPENHIM_URL=https://openhim-core:8080
       - TRUST_SELF_SIGNED=true
       - OPENHIM_PASSWORD=password
       - SERVER_PORT=4321
       - CONTAINER_NAME=mediator-default
       - MEDIATOR_NAME=mediator-default
       - MEDIATOR_URN=urn:mediator:skeleton-production-mediator-default
       - MEDIATOR_DESCRIPTION=Mediator for a default project
       - URL_PATTERN=^/defaultEndpoint
       - ROUTE_NAME=Default production route
 ```
       

3 - After having the openhim network running, follow step 3 to 5 of the openHIM [tutorial](https://github.com/jembi/openhim-mediator-tutorial/blob/master/0_Starting_OpenHIM.md)

4 - Platform should be accessible under localhost:9000 or with your host instead of local in case you modified it.

5 - For it to be accessible in a different host, you will have to follow following steps:
  
   &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;4.2 - You will have to create a certificate in your external host for it to be secure to access. One way to do this, is by installing certbot and running
    ```certbot —nginx -d YOUR-HOST```
    
   &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;4.3 - The certificates will now have to be copied to the containers as well, which is done in the docker-compose file. Make sure to alter the YOUR-HOST part in the docker-compose to fit your certificate path and in the default.conf file. 
  
   &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;4.4 - The configuration inside the container has also to be altered, so that it takes the certificates, this is also done in the docker-compose by pushing the configuration files inside openhim-core-conf folder, if you use NODE_ENV=development you will need to alter the file openhim-core-conf/development.json, else if you choose to delete this NODE_ENV or set it to production, the file openhim-core-conf/default.json will be read. 
  NOTE: if you only want to use it locally on your localhost, just use the docker-compose file provided by the openhim in the tutorial above. 

6 - By clicking on the mediator tab, you will see all mediators registered in the platform. Here you should see the mediator created with step 3 and 4. By clicking in the settings icon, you will be able to configure your job.

![alt text](app/images/openhim_mediator.png "Mediators in Openhim")

7 - After the mediator is properly shown in the platform, you will need to install the chanel by clicking on the mediator, and then clicking on the plus sign, as illustrated

![alt text](app/images/installChanel_mediator.png "Installation of the chanel")

8 - A configuration menu will open. In the first window, you can define the trigger, which if met, will continue with the execution of the provided expression. In the second window, you may specify the URL of the endserver as well as the corresponding credentials. In the last window, is where you can provide the expression, which corresponds to the action you wish to perform on the endserver, as well as the language that this action requires, e.g. for an action on the dhis2 server you would require the language-dhis2. 

![alt text](app/images/configuration_mediator.png "Configuration of the Mediator")

## Configuration

To configure the openhim credentials, URL and the port of the server without using the environment variables within the docker command, you can access the file in src/config/config.js and change the according variables.

![alt text](app/images/config_openhim.png "Configuration of OpenHIM")

To configure the mediator itself e.g. the name or the fields shown in the platform, you can easily edit the file "mediatorConfig.json". In the following image you can see how the sector for the external server on the platform (with the expression and language was created). To group similar parameters you can use a struct, for a large open field you can use bigstring and so on. Check the useful links for more on this. 

![alt text](app/images/mediator_config_server.png "Low lever configuration of mediator")

Additionally you can access the variables and even change them in the script "openhim.js" where the mediator configuration is parsed. In the following snippet, the list of languages in, shown in the previous image is accessed and printed. Analog to this, you can access the name and other parameters as well. 

![alt text](app/images/openhim_config_js.png "Accessing parameters outside the config file")

## Utility functions in javascript for expression manipulation

The file "src/routes/expression-utils.js" can be extended to have utility functions that can be used in the expression to better prepare the payload.
The existing functions are:

### convertToBoolean(x)
will convert numerical representations of booleans to their corresponding true or false value. For example 1 and "1" would be converted to true and 0, "0", "-1" and -1 will be converted to false. WARNING: everything else will be returning true.


### convertMultipleChoice(chosenAnswers, condition, conditionsDict, delimiter=" ")
This function assumes a string of strings here called chosenAnswers e.g. "blue green brown" from a set of answers e.g. ["blue", "yellow", "green". "brown", "red"]. ConditionsDict would have multiple titles for those answer sets e.g. for the previous one, the title (in this case condition) could be color so that ```color: ["blue", "yellow", "green". "brown", "red"]``` would be an entry in the dictionary. In the end the conditionsDict would look something like: 
```
conditionsDict = { 
     color: ["blue", "yellow", "green". "brown", "red"],
     name: ["name1", "name2", "name3"]
}
```
In the end, the function would return a dictionary that would have each element of the possible answers and wether they were chosen i.e. are represented in the chosenAnswers string or not, with their corresponding boolean representations. In the previous example the output would be:
```
answer = {
     blue: true,
     yellow: false,
     green: true,
     brown: true,
     red: false
}
```
The default delimiter for the chosenAnswers split is space " ". 
### indexOf(array, target)
This function is similar to the array.indexOf(target) javascript function and will return -1 if the target element is not found in the array or the index of the element in the array. 


### checkAnswers(array, target, delimiter=" ")
This function will split a string of elements separated with a delimiter and will check wether the target is contained in the array or not. The default delimiter is space " ". 


# Launch Docker

1. Edit the `docker-compose.yml` file to point to the **public** host and port of your server (DOMAIN environement variable). If you are just testing on localhost you can leave it set at the defaults.

2. Spin up the OpenHIM core and console easily with docker compose:

3. Generate the cert files on the host matching yoiur DOMAIN  

4. start the compose
```
docker-compose build && docker-compose up -d
```

5. Access on https://localhost or at https://<your_server>

6. Access API on https://localhost/api or at https://<your_server>/api

7. Send traffic to mediator https://localhost/channel or at https://<your_server>/channel



