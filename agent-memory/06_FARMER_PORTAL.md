# Farmer Portal Workflow

The Farmer Portal is the primary data ingestion point for the ERP, mapped to the root route (`/`).

## Core Responsibilities
- Submit daily operational metrics (Mortality, Culling, Feed, Eggs, Environmental data).
- Ensure data is bound strictly to the correct Master Farm.
- Prevent duplicate day submissions unless explicitly executing a "Correction" (Version 2).

## Application Flow
1. **Initialization:**
   - Evaluates `AuthContext`. If user is a `farmer`, mounts `FarmerFormPage.tsx`.
   - Extracts the primary `farmId` from the user's `farmIds[0]` array.
   
2. **Data Binding (CRITICAL):**
   - Initiates a real-time subscription to `farms/{farmId}`.
   - Initiates a real-time subscription to `dailyReports/{uid}/dailyLogs/{YYYY-MM-DD}` (today's report).
   - *Logic:* The UI headers ("OPENING BIRDS", "TOTAL FEED AVAILABLE") are governed by the `displayOpeningBirds` and `displayTotalFeed` variables. These variables explicitly prioritize the frozen snapshots inside today's `dailyLog` if it exists, otherwise they fall back to the live master `farmDoc.currentBirdCount`.

3. **Data Entry:**
   - The farmer uses a multi-step wizard.
   - Fields: Mortality, Culling, Feed Kg, Egg counts, Weights, Temperatures.
   - All inputs are strongly validated client-side to prevent `NaN`, negative values, or values exceeding current inventory limits.

4. **Submission:**
   - Invokes `submitReport` from `reportService.ts`.
   - Executes an atomic transaction against Firestore.
   - Updates `farms/{farmId}` with deducted live inventory.
   - Saves the transaction to `dailyReports/{uid}/dailyLogs/{YYYY-MM-DD}`.

5. **Correction (Version 2):**
   - If a report was already submitted, the UI enters "Edit" mode.
   - The user modifies the values.
   - Submission calculates the *delta* (e.g., if mortality changed from 5 to 7, the delta is 2) and applies only the delta to the master inventory.
   - **Rule:** The start-of-day snapshot fields (`openingBirdCount`, `openingFeedKg`) are strictly preserved during correction to ensure historical immutability for that date.
