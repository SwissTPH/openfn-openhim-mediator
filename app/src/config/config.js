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
export const MEDIATOR_URN =
  process.env.MEDIATOR_URN || 'urn:mediator:skeleton-production-mediator'
export const MEDIATOR_NAME =
  process.env.MEDIATOR_NAME || 'Skeleton Production Bootstrap Mediator'
export const MEDIATOR_DESCRIPTION =
  process.env.MEDIATOR_DESCRIPTION || 'Skeleton Production Bootstrap Mediator'
export const CONTAINER_NAME = process.env.CONTAINER_NAME || 'mediator-default'
export const URL_PATTERN = process.env.URL_PATTERN || '^/defaultEndpoint'
export const ROUTE_NAME = process.env.ROUTE_NAME || 'Production Route'
