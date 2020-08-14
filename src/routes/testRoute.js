'use strict'

import logger from '../logger'
import {buildReturnObject} from './utils'
//import {execute} from 'core/lib/cli'
//import Execute from 'core/lib/'
import fs from 'fs'
import {execute as execute_dhis2} from 'language-dhis2/lib/Adaptor'
import {execute as execute_omrs} from 'language-openmrs/lib/Adaptor'
//import {execute} from (openhim.config.job.language+'/lib/Adaptor')


import openhim from '../openhim'
const exec = require('child_process').exec
import config from '../openhim'
import * as path from 'path'

// The DHIS2 config is controlled via Environment Variables too to prevent ever having to
// risk committing sensitive data to source control
import {log} from 'async'

module.exports = (_req, res) => {
  var state = _req.body
  if (state.form['@name'] === 'Register to Child Program') { // change to get parameter from platform
    var language = require(openhim.config.job.language + '/lib/Adaptor')
    console.log('---Event Triggered---')
    console.log(openhim.config)
    state.configuration = {
      username: openhim.config.server.user,
      password: openhim.config.server.password,
      hostUrl: openhim.config.server.url
    }
    fs.writeFile('state.json', JSON.stringify(state), function(err) {
       if (err) return console.log(err)
    })
    fs.writeFile('expression.js', openhim.config.job.expression, function(err) {
      if (err) return console.log(err)
    })
    //console.log(expression)
    var command =
       `core execute -l ./languages/${openhim.config.job.language}.Adaptor -s ./state.json` +
       ' -o output.json -e ./expression.js'
     exec(command, (error, stdout, stderr) => {
       console.log(`stdout: ${stdout}`)
       console.log(`stderr: ${stderr}`)
       if (error !== null) {
         // in case of error, send 400 code for bad request.
         const returnObject = buildReturnObject('Failed', 400, {
           message: `exec error: ${error}`,
           url: _req.url,
           method: _req.method
         })
         res.status(400).send(returnObject)
       } else {
         const returnObject = buildReturnObject(
          `stdout: SUCCESSFUL`,
           '200',
           'Test Endpoint Response!'
         )
         return res.send(returnObject)
       }
     })
    var funct = openhim.config.job.expression
    var temp = openhim.config.job.expression.split('({',1)[0]
    var newFunct = new Function(funct.toString().replace(temp,''))
    let pos= temp.length+1; // +1 because of the parenthesis
    // -1 to remove the last parenthesis
    funct = 'newFunct = ' + funct.substr(pos, funct.length-pos-1)
    eval(funct)
    language['execute'](
        language[`${temp}`](newFunct)
    )(state).then((result)=>{
      const returnObject = buildReturnObject(
          result.references[0].body.httpStatus,
          result.references[0].body.httpStatusCode,
          result.references[0].body.message
      )
      return res.send(returnObject)
    })
        .catch(error => {
          logger.error(error)
          const returnObject = buildReturnObject(
              'Failed',
              '400',
              `${error}`
          )
          return res.send(returnObject)
        })
  }
}
