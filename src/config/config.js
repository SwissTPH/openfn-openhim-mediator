'use strict'

export const SERVER_PORT = process.env.SERVER_PORT || 4321
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info'

// OpenHIM
export const OPENHIM_URL = process.env.OPENHIM_URL || 'https://localhost:8080'
export const OPENHIM_USERNAME =
  process.env.OPENHIM_USERNAME || 'root@openhim.org'
export const OPENHIM_PASSWORD =
  process.env.OPENHIM_PASSWORD || 'openhim-password'
export const TRUST_SELF_SIGNED = process.env.TRUST_SELF_SIGNED === 'true'

// DHIS2
export const DHIS2_URL =
  process.env.DHIS2_URL || 'https://play.dhis2.org/2.34.1'
export const DHIS2_USERNAME = process.env.DHIS2_USERNAME || 'admin'
export const DHIS2_PASSWORD = process.env.DHIS2_PASSWORD || 'district'
