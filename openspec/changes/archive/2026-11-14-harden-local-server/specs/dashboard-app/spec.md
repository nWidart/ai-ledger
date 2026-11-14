# Spec Delta

## ADDED Requirements

### Requirement: Refuse cross-site requests
The app SHALL answer 403 to a request to `/api`, or any POST, that another site made in the user's browser. It SHALL read `Sec-Fetch-Site` and refuse `cross-site` and `same-site`. When the request has no `Sec-Fetch-Site` and has an `Origin`, it SHALL refuse every origin except its own. It SHALL NOT run a refused request. Page navigations, assets, and requests with neither header SHALL pass.

#### Scenario: Cross-site refresh
- **WHEN** a page on another site posts to `/api/refresh` with `Sec-Fetch-Site: cross-site`
- **THEN** the app answers 403 and starts no ingest

#### Scenario: Cross-site read
- **WHEN** a page on another site asks for `/api/status`, or opens the Live event stream, with `Sec-Fetch-Site: same-site`
- **THEN** the app answers 403

#### Scenario: Origin without fetch metadata
- **WHEN** a request to `/api/refresh` has `Origin: https://example.com` and no `Sec-Fetch-Site`
- **THEN** the app answers 403

#### Scenario: The app's own page
- **WHEN** the app's page asks for `/api/status` with `Sec-Fetch-Site: same-origin`, or the user opens `/api/status` in the address bar
- **THEN** the app answers the request

#### Scenario: Command line
- **WHEN** curl posts to `/api/refresh` with neither `Sec-Fetch-Site` nor `Origin`
- **THEN** the app answers the request

### Requirement: Send security headers
Every response SHALL carry `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `X-Frame-Options: DENY` and a `Permissions-Policy` that turns off the camera, microphone, geolocation and the other device features the app does not use.

#### Scenario: Any response
- **WHEN** the app answers a page, an asset, a JSON route, an event stream or an error
- **THEN** the response carries the security headers

#### Scenario: Framed page
- **WHEN** another site embeds the app's page in a frame
- **THEN** the browser refuses to show it

### Requirement: Restrict what the page loads
A page response SHALL carry a `Content-Security-Policy` that allows scripts only from the app's own origin and the page's inline theme script, by a hash the app works out from the `index.html` it serves; that allows the Google Fonts stylesheet and font files and no other outside origin; and that forbids framing, `<base>` and plugins.

#### Scenario: Inline script after a rebuild
- **WHEN** the frontend is rebuilt and its inline theme script changes
- **THEN** the policy served with the page names the new script's hash, with no change to the app

#### Scenario: Script from another origin
- **WHEN** a script from an origin other than the app's own is added to the page
- **THEN** the browser does not run it

### Requirement: Revalidate the page
The app SHALL serve a page route with `Cache-Control: no-cache` and a strong ETag, and SHALL answer a request whose `If-None-Match` names that ETag with 304 and no body. The 304 SHALL carry the same headers as the page. Responses from `/api` SHALL stay `no-store`, and hashed assets SHALL stay cacheable without limit.

#### Scenario: Unchanged page
- **WHEN** the browser asks for `/usage` again with the ETag it was given
- **THEN** the app answers 304 with no body

#### Scenario: Rebuilt page
- **WHEN** the frontend is rebuilt and the browser asks with the old ETag
- **THEN** the app answers 200 with the new page
