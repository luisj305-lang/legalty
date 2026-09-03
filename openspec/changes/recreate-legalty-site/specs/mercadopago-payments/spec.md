# Delta for Mercado Pago Payments

## ADDED Requirements

### Requirement: Services catalog
The Servicios page MUST render the firm's services catalog; payable services SHOULD expose a pay action that initiates checkout.

#### Scenario: Catalog with pay actions
- GIVEN Servicios is loaded
- WHEN the page renders
- THEN each service is listed
- AND payable services expose a pay/checkout action

### Requirement: Create preference endpoint
A POST serverless function (`api/create-preference.js`) MUST create a Mercado Pago preference using the official Node SDK and return the Checkout Pro URL.

#### Scenario: Preference created
- GIVEN valid service and pricing data
- WHEN the client POSTs to `/api/create-preference`
- THEN the function calls the MP SDK to create a preference
- AND responds with JSON containing the Checkout Pro redirect URL

#### Scenario: Invalid payload rejected
- GIVEN a request missing required fields
- WHEN POSTed to `/api/create-preference`
- THEN the function returns a 4xx error
- AND does not create a preference

### Requirement: Redirect to Checkout Pro
After successful preference creation, the client MUST redirect the user to the Mercado Pago Checkout Pro URL.

#### Scenario: Redirect occurs
- GIVEN create-preference returns a valid URL
- WHEN the client processes the response
- THEN the user is redirected to Mercado Pago Checkout Pro

### Requirement: Webhook/IPN confirmation
A serverless function (`api/webhook.js`) MUST handle Mercado Pago IPN/notifications, validating the request signature and idempotency (rejecting duplicates) before recording payment status.

#### Scenario: Valid notification accepted
- GIVEN a signed MP notification for a known payment
- WHEN POSTed to `/api/webhook`
- THEN the function validates the signature
- AND records the status (approved/rejected/pending)
- AND returns a success response

#### Scenario: Invalid or duplicate rejected
- GIVEN an unsigned, forged, or duplicate notification
- WHEN POSTed to `/api/webhook`
- THEN the function rejects it
- AND does not record a duplicate status change

### Requirement: Sandbox-first and env credentials
The integration MUST target Mercado Pago sandbox first. Credentials (access token, public key, webhook secret) MUST be read from environment variables only and MUST NOT be hardcoded or exposed client-side.

#### Scenario: Credentials from env
- GIVEN the deployed functions
- WHEN create-preference/webhook run
- THEN credentials are read from environment variables
- AND no credentials appear in source or client bundles

#### Scenario: Sandbox mode
- GIVEN sandbox credentials configured
- WHEN a checkout is exercised
- THEN the flow completes against MP sandbox endpoints

### Requirement: Status pages
The flow MUST present success and failure status pages after checkout (success on approval, failure on rejection/error).

#### Scenario: Success page
- GIVEN a payment is approved
- WHEN the user returns
- THEN a success status page is shown

#### Scenario: Failure page
- GIVEN a payment is rejected or errors
- WHEN the user returns
- THEN a failure status page is shown
