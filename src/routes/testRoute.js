'use strict'

import logger from '../logger'
import {buildReturnObject} from './utils'
//import {execute} from 'core/lib/cli'
//import Execute from 'core/lib/'
import {execute, createTEI} from 'language-dhis2/lib/Adaptor'
const exec = require('child_process').exec
import * as path from 'path'

// The DHIS2 config is controlled via Environment Variables too to prevent ever having to
// risk committing sensitive data to source control
import {DHIS2_PASSWORD, DHIS2_URL, DHIS2_USERNAME} from '../config/config'
import {log} from 'async'

module.exports = (_req, res) => {
  var state = _req.body
  if (state.form['@name'] === 'Register to Child Program') {
    console.log('---Event Triggered---')
    state.configuration = {
      username: DHIS2_USERNAME,
      password: DHIS2_PASSWORD,
      hostUrl: DHIS2_URL
    }
    //logger.info(state)
    // fs.writeFile('state.json', JSON.stringify(state), function(err) {
    //   if (err) return console.log(err)
    // })
    // //TODO change path to have dynamic path directory
    // var command =
    //   'core execute -l ./language-dhis2.Adaptor -s ./state.json' +
    //   ' -o output.json -e ./src/createTrackedEntity.js'
    // exec(command, (error, stdout, stderr) => {
    //   console.log(`stdout: ${stdout}`)
    //   console.log(`stderr: ${stderr}`)
    //   if (error !== null) {
    //     // in case of error, send 400 code for bad request.
    //     const returnObject = buildReturnObject('Failed', 400, {
    //       message: `exec error: ${error}`,
    //       url: _req.url,
    //       method: _req.method
    //     })
    //     res.status(400).send(returnObject)
    //   } else {
    //     const returnObject = buildReturnObject(
    //       `stdout: SUCCESSFUL`,
    //       '200',
    //       'Test Endpoint Response!'
    //     )
    //     return res.send(returnObject)
    //   }
    // })
    execute(
      createTEI({
        trackedEntityType: 'nEenWmSyUEp',
        orgUnit: 'g8upMTyEZGZ',
        attributes: [
          {
            attribute: 'w75KJ2mc4zz', // Attribute Id for FirstName in DHIS2
            value: state.form.case.update.patient_first_name //Question in CommCare form
          },
          {
            attribute: 'zDhUuAYrxNC', // LastName attribute
            value: state.form.case.update.patient_family_name
          }
        ],
        enrollments: [
          {
            orgUnit: 'g8upMTyEZGZ',
            program: 'IpHINAT79UW', //enroll in Child program
            enrollmentDate: state.received_on.substring(0, 9),
            incidentDate: state.metadata.timeStart.substring(0, 9)
          }
        ]
      })
    )(state).catch(error => {
      logger.error(error)
      return buildReturnObject('Failed', '400', `Error: ${error}`)
    })
    const returnObject = buildReturnObject(
      'SUCCESSFUL',
      '200',
      'Test Endpoint Response!'
    )
    return res.send(returnObject)
  }
}
