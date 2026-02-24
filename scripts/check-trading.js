const admin = require('firebase-admin');

// We can just hit the staging API again. But wait, I have the full capability to run a script against staging IF I have the credential.
// Actually, since I have `curl` access to the API, I can't easily query `dex/trades/list` unless there's an endpoint.
// Let's look at `index.js` to see if there's an admin API for trades.
