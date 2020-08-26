import request from 'superagent'

export function post({
  username,
  password,
  body,
  url
}) {
  return new Promise((resolve, reject) => {
    request.post(url)
      .type('json')
      .accept('json')
      .auth(username, password)
      .send(JSON.stringify(body))
      .end((error, res) => {
        if (!!error || !res.ok) {
          reject(error)
        }
        resolve(res)
      })
  })
}

export function put({
  username,
  password,
  body,
  url
}) {
  return new Promise((resolve, reject) => {
    request.put(url)
      .type('json')
      .accept('json')
      .auth(username, password)
      .send(JSON.stringify(body))
      .end((error, res) => {
        if (!!error || !res.ok) {
          reject(error)
        }
        resolve(res)
      })
  })
}

export function get({
  username,
  password,
  query,
  url}) {
  return new Promise((resolve, reject) => {
    request.get(url)
      .query(query)
      .type('json')
      .accept('json')
      .auth(username, password)
      .end((error, res) => {
        if (!!error || !res.ok) {
          reject(error)
        }
        resolve(res)
      })
  })
}

export function getUsingQueryString({
  username,
  password,
  query,
  url}) {
  return new Promise((resolve, reject) => {
    request.get(url)
      .query(query)
      .options({useQuerystring: true})
      .type('json')
      .accept('json')
      .auth(username, password)
      .end((error, res) => {
        if (!!error || !res.ok) {
          reject(error)
        }
        resolve(res)
      })
  })
}
