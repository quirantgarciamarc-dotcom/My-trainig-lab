# Garmin server-side integration (not active yet)

Do not deploy a fake Garmin Connect endpoint. The actual OAuth, webhook verification,
subscription, payload and Pull/Push contracts must be implemented from Garmin's
approved Developer Portal documentation after access is granted.

Expected server-side functions are described in `../../GARMIN_INTEGRATION_PLAN.md`.
Store credentials only in Netlify private environment variables. Never expose Garmin
client secrets or service-role keys through `EXPO_PUBLIC_*` variables or client code.
