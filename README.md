# DatSan Front v2

React + Vite interface for the DatSan sports-field booking application. Database and image-storage requests are routed through `datsan-back-v2`.

## Run locally

1. Install Node.js 20.19+ or 22.12+.
2. Copy `.env.example` to `.env` and set `VITE_API_URL` to the API address.
3. Run `npm install`, then `npm run dev`.

The API must be running separately. Login/OTP and several booking screens in the inherited UI are still placeholders or demo flows; see the backend README before deploying.
