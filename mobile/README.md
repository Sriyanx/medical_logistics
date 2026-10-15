# MediSales Android app

React Native/Expo client for the MediSales medical wholesale platform. It connects to the existing Express API; the backend remains the source of truth for authentication, catalogue, stock, orders, invoices, and requirements.

## Setup

```bash
cd mobile
npm install
npm start
```

Set the API URL before starting:

```bash
# Windows PowerShell
$env:EXPO_PUBLIC_API_URL="http://192.168.1.10:3000/api"

# Android emulator (backend on the same computer)
$env:EXPO_PUBLIC_API_URL="http://10.0.2.2:3000/api"
```

Use a reachable HTTPS URL for production. Do not put JWT secrets or GitHub tokens in the mobile app.

## Included mobile flows

- Role-aware login for pharmacy and wholesaler accounts
- Medicine catalogue search with server autocomplete suggestions
- Pharmacy cart and order placement
- Pharmacy order history and invoice list
- Medicine requirement submission
- Wholesaler dashboard metrics
- Wholesaler inventory batch list
- Wholesaler order approval/rejection/status transitions
- Wholesaler invoice register, invoice generation, and payment updates
- Pull-to-refresh and logout

## Android release

For a Play Store build, configure an Expo/EAS project, application ID, signing credentials, privacy policy, and production API URL. Run `npx eas build -p android` only after those release values are reviewed.
