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
    } /*,
      {
        "attribute": "h5FuguPFF2j", // Case Id
        "value": dataValue("id")(state)
      },
      {
        "attribute": "KdQqUHPqlqM", // Case Status
        "value": dataValue("form.case.update.patient_case_status")(state)
      }*/
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
