'use strict'

import fs from 'fs'
import path from 'path'
// The OpenHIM Mediator Utils is an essential package for quick mediator setup.
// It handles the OpenHIM authentication, mediator registration, and mediator heartbeat.
import {activateHeartbeat, registerMediator} from 'openhim-mediator-utils'
import logger from './logger'

// The OpenHIM config is controlled via Environment Variables to prevent ever having to
// risk committing sensitive data to source control
import {
  OPENHIM_PASSWORD,
  OPENHIM_URL,
  OPENHIM_USERNAME,
  TRUST_SELF_SIGNED
} from './config/config'

import {setMediatorUrn} from './routes/utils'

const mediatorSetup = () => {
  // The mediatorConfig file contains some basic configuration settings about the mediator
  // as well as details about the default channel setup.
  const mediatorConfigFile = fs.readFileSync(
    path.resolve(__dirname, '..', 'mediatorConfig.json')
  )

  let mediatorConfig
  try {
    mediatorConfig = JSON.parse(mediatorConfigFile)
  } catch (error) {
    logger.error(`Failed to parse JSON in mediatorConfig.json`)
    throw error
  }

  setMediatorUrn(mediatorConfig.urn)

  const openhimConfig = {
    apiURL: OPENHIM_URL,
    password: OPENHIM_PASSWORD,
    username: OPENHIM_USERNAME,
    trustSelfSigned: TRUST_SELF_SIGNED,
    urn: mediatorConfig.urn
  }

  // The purpose of registering the mediator is to allow easy communication between the mediator and the OpenHIM.
  // The details received by the OpenHIM will allow quick channel setup which will allow tracking of requests from
  // the client through any number of mediators involved and all the responses along the way(if the mediators are
  // properly configured). Moreover, if the request fails for any reason all the details are recorded and it can
  // be replayed at a later date to prevent data loss.
  registerMediator(openhimConfig, mediatorConfig, err => {
    if (err) {
      throw new Error(
        `Failed to register mediator. Check your Config: ${err.message}`
      )
    }

    logger.info('Successfully registered mediator!')

    // The activateHeartbeat method returns an Event Emitter which allows the mediator to attach listeners waiting
    // for specific events triggered by OpenHIM responses to the mediator posting its heartbeat.
    const emitter = activateHeartbeat(openhimConfig)
    emitter.on('error', err => {
      logger.error(`Heartbeat failed: ${JSON.stringify(err)}`)
    })
  })
}

exports.mediatorSetup = mediatorSetup
