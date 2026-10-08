# SAI Happy Farms Farm ERP — Release Notes / What's New

**Version:** 1.0  
**Date:** 04 October 2026  
**Status:** Official Release Documentation  

---

## Overview

This release focuses heavily on infrastructure hardening, robust data synchronization, and strict Role-Based Access Control (RBAC) implementations. The core changes guarantee absolute data privacy between independent farms and ensure mathematical consistency across master inventory ledgers.

---

## 1. Security Improvements

The system's security posture has been heavily audited and fortified (Verified via 179 passing assertions in the Security Test Suite).

* **BOLA Prevention (Broken Object Level Authorization):**
  * **Previous Behaviour:** Read/write permissions were loosely coupled to UI hiding.
  * **Current Behaviour:** Firestore Security Rules and backend middleware mathematically verify that the requesting user's UID is explicitly mapped to the `farmId` being requested.
  * **Verification:** Unauthorized cross-farm writes and exports are actively rejected with an HTTP 403 `AUTHORIZATION_DENIED`.

* **Error Sanitization:**
  * **Previous Behaviour:** Unhandled 500 errors could expose internal stack traces or raw database query strings to the client.
  * **Current Behaviour:** All backend errors are intercepted. Stack traces are stripped, and raw database strings (e.g., `auth/user-not-found`) are replaced with generic security-safe messages.
  * **Verification:** Validated by `firebaseErrors.security.test.ts`.

* **Sensitive Log Redaction:**
  * **Previous Behaviour:** API keys and passwords could be logged in plain text in production server logs.
  * **Current Behaviour:** Automated middleware dynamically scrubs strings resembling passwords, API tokens, and idTokens from logs.
  * **Verification:** Validated via automated tests ensuring log immutability and redaction.

* **Password Validation Enforcement:**
  * **Previous Behaviour:** Weak passwords were systematically possible.
  * **Current Behaviour:** Passwords for all roles (Farmer, Supervisor, Admin) are strictly rejected by the backend if they are less than 8 characters long.

* **Production Console Stripping:**
  * **Previous Behaviour:** Diagnostic `console.log` statements existed in the production bundle.
  * **Current Behaviour:** The Vite build process successfully strips out diagnostic logging from the production output while retaining essential `console.error` logs.
  * **Verification:** Manual inspection of build bundle verified clean stripping.

---

## 2. Data Integrity Improvements

* **Atomic Inventory Deductions:**
  * **Previous Behaviour:** Potential for overlapping race conditions when updating bird/feed master ledgers.
  * **Current Behaviour:** Submissions use strict Firestore atomic transactions. If mortality exceeds live birds, or feed usage exceeds master stock, the transaction explicitly aborts with `INSUFFICIENT_BIRDS` or `INSUFFICIENT_FEED`.

* **Report Corrections (Version 2 Delta Engine):**
  * **Previous Behaviour:** Correcting a report could lead to double-deductions in master inventory.
  * **Current Behaviour:** Correcting a report automatically calculates the delta between V1 and V2. Only the mathematical difference is subtracted/added to the master ledger, and the V1 report is safely archived in a `/revisions/` subcollection.
  * **Verification:** Validated by Scenario Test T06.

---

## 3. Import / Revert Improvements

* **Revert Batch Safety Mechanism:**
  * **Previous Behaviour:** Batches could potentially be reverted without strict secondary confirmation.
  * **Current Behaviour:** The Revert Batch workflow implements a mandatory two-step validation lock. 
    1. An agreement checkbox must be checked.
    2. The exact, case-insensitive `batchId` must be entered into a text field.
  * **Verification:** The confirm button remains explicitly disabled if either condition is unmet.

* **Farm Mapping Rejection:**
  * **Previous Behaviour:** Import scripts could attempt to map ambiguous farms.
  * **Current Behaviour:** Unknown or ambiguous farm mappings are explicitly rejected during the import validation phase. The system refuses to silently guess farm assignments.

---

## 4. Known Limitations & Pending Verification

The following items were identified in legacy documentation but remain **Not verified from the available project evidence** in this specific release cycle:

1. **Test Execution Statistics:** Specific historical claims regarding exact test counts (e.g., "XLSX import: 42/42 passed", "Frontend: 163 tests passed") are omitted pending official UAT re-execution.
2. **Push / Email Notifications:** Alert mechanisms are currently strictly in-app visual cards. External push notifications via FCM or Email are not implemented.
3. **Data Export:** Direct CSV/Excel export functionality from the dashboards is not present.
4. **Hindi Localization:** The translation directory does not currently contain a verified `hi.json` file. Language support is limited to English, Kannada, Telugu, and Tamil.

---
**End of Document**
