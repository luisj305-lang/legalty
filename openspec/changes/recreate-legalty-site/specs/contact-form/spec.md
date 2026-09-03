# Delta for Contact Form

## ADDED Requirements

### Requirement: Form fields
The Contáctenos page MUST render a form with fields: name, email, message.

#### Scenario: Form renders
- GIVEN Contáctenos is loaded
- WHEN the page renders
- THEN inputs for name, email, and message are present
- AND the form exposes a submit action

### Requirement: Client validation
The form MUST validate that name and message are non-empty and email is well-formed.

#### Scenario: Invalid submission blocked
- GIVEN name is empty or email is malformed
- WHEN the user submits
- THEN the form does not submit
- AND an inline error is shown next to the offending field

#### Scenario: Valid submission accepted
- GIVEN name, valid email, and non-empty message
- WHEN the user submits
- THEN the form submits to the endpoint

### Requirement: Submission endpoint
The form MUST POST to a real serverless endpoint (e.g. `/api/contact`) that delivers the message. The broken template form MUST NOT be reproduced (no dead target, no no-op handler).

#### Scenario: Endpoint receives message
- GIVEN a valid submission
- WHEN the form POSTs to the contact endpoint
- THEN the endpoint returns a success response
- AND the message is delivered to the firm

#### Scenario: Broken template not reproduced
- GIVEN the original Simbla broken form
- WHEN the new form is compared
- THEN the new form points to a functional endpoint
- AND the submit handler performs a real request

### Requirement: Success and error states
The form MUST show a success confirmation on success and an error message on failure, and MUST NOT lose entered data on a failed submit.

#### Scenario: Success state
- GIVEN the endpoint returns success
- WHEN the response is received
- THEN a success confirmation is shown
- AND the form is reset

#### Scenario: Error state
- GIVEN the endpoint fails or returns an error
- WHEN the response is received
- THEN an error message is shown
- AND the user's entered data is preserved
