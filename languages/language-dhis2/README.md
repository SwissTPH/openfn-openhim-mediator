Language DHIS2 [![Build Status](https://travis-ci.org/OpenFn/language-dhis2.svg?branch=master)](https://travis-ci.org/OpenFn/language-dhis2)
==============

Language Pack for building expressions and operations for working with
the [DHIS2 API](http://dhis2.github.io/dhis2-docs/master/en/developer/html/dhis2_developer_manual.html).

Documentation
-------------
## Sample State
```json
{
  "configuration": {
    "username": "admin",
    "password": "district",
    "hostUrl": "https://play.dhis2.org/2.31.1"
  },
  "data": {
    "a": 1,
    "b": 2,
  }
}
```


## Analytics API

#### Fetch analytics data for PMTCT data over last 6 months.
```js
fetchAnalytics({
  query: {
    dimension: ["dx:CYI5LEmm3cG;GDVU1o5rTNF", "pe:LAST_6_MONTHS"],
    filter: "ou:GHlyx9Pg9mn",
    displayProperty: "NAME",
    outputIdScheme: "UID"
  }
});
```

## Tracked Entity API

#### Create a new tracked entity instance and enroll them from a CommCare form submission.
```js
createTEI({
  "trackedEntityType": "nEenWmSyUEp",
  "orgUnit": "g8upMTyEZGZ",
  "attributes": [
    {
      "attribute": "w75KJ2mc4zz",
      "value": dataValue("form.first_name")(state)
    },
    {
      "attribute": "zDhUuAYrxNC",
      "value": dataValue("form.last_name")(state)
    }
  ],
  "enrollments": [
    {
        "orgUnit": "g8upMTyEZGZ",
        "program": "IpHINAT79UW",
        "enrollmentDate": "2019-04-08",
        "incidentDate": "2019-04-08"
     }
   ]
});
```

## Events API

#### `Events API` expression
```js
event(
  fields(
    field("program", "eBAyeGv0exc"),
    field("orgUnit", "DiszpKrYNg8"),
    field("eventDate", dataValue("date")),
    field("status", "COMPLETED"),
    field("storedBy", "admin"),
    field("coordinate", {
      "latitude": "59.8",
      "longitude": "10.9"
    }),
    field("dataValues", function(state) {
      return [
        dataElement("qrur9Dvnyt5", dataValue("prop_a"))(state)
        dataElement("oZg33kd9taw", dataValue("prop_b"))(state)
        dataElement("msodh3rEMJa", dataValue("prop_c"))(state)
      ]
    })
  )
)
```

#### Current `fetchEvents API` expression (Optional `postUrl` for a complete fetch)
```js
fetchEvents({
  fields: {
    orgUnit: 'DiszpKrYNg8',
    program: 'eBAyeGv0exc',
    endDate: '2016-01-01'
  },
  postUrl: "https://www.openfn.org/inbox/123"
})
```
#### Reference on how to query and read events https://docs.dhis2.org/2.22/en/developer/html/ch01s15.html#d5e1994

## Data Values / Data Value Sets API

#### Current `DataValueSets API` expression
```js
dataValueSet({
  dataSet: dataValue("set"),
  orgUnit: "DiszpKrYNg8",
  period: "201402",
  completeData: "2014-03-03",
  dataValues: [
    dataElement("f7n9E0hX8qk", dataValue("data[0].site_school_number")),
    dataElement("Ix2HsbDMLea", dataValue("age")),
    dataElement("eY5ehpbEsB7", 30)
  ]
});
```

#### Current `fetchData API` expression (Optional `postUrl` for a complete fetch)
```js
fetchData({
  fields: {
    dataSet: 'pBOMPrpg1QX',
    orgUnit: 'DiszpKrYNg8',
    period: '201711'
  },
  postUrl: "https://www.openfn.org/inbox/123"
})
```
#### Reference on how to read data values https://docs.dhis2.org/2.22/en/developer/html/ch01s13.html#d5e1642


[Docs](docs/index)


Development
-----------

Clone the repo, run `npm install`.

Run tests using `npm run test` or `npm run test:watch`

Build the project using `make`.
