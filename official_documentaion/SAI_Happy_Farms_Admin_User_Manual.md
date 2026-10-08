# SAI Happy Farms Farm ERP — Administrator User Manual

**Version:** 1.0  
**Date:** 04 October 2026  
**Status:** Official Documentation  
**Target Audience:** System Administrators  

---

## Table of Contents
1. [Admin Role & Dashboard](#1-admin-role--dashboard)
2. [User Management](#2-user-management)
3. [Farm & Master Inventory Management](#3-farm--master-inventory-management)
4. [Prediction Engine](#4-prediction-engine)
5. [Historical Data Import (XLSX, CSV, XML)](#5-historical-data-import-xlsx-csv-xml)
6. [Import Revert / Rollback Procedure](#6-import-revert--rollback-procedure)
7. [Security & Infrastructure Controls](#7-security--infrastructure-controls)
8. [Admin Testing Checklist](#8-admin-testing-checklist)

---

## 1. Admin Role & Dashboard

The Administrator holds absolute control over the ERP system. While Farmers and Supervisors interact with limited datasets, the Admin has global read/write access.

The **Enterprise Analytics Dashboard** functions identically for Admins as it does for Supervisors, but with zero farm restrictions—you can view and filter data for every farm in the organization.

---

## 2. User Management

Located via the `AdminUsersPage` interface, this module leverages the Node.js Express backend API (using the Firebase Admin SDK) to bypass standard restrictions.

### Creation and Assignment
* **Roles:** You can create users and assign them the roles of `Farmer`, `Supervisor`, or `Admin`.
* **Farm Mapping:** A user's `farmIds` array dictates their access. You map farmers to a specific farm, and supervisors to an array of farms.
* **Status Toggles:** An active toggle allows you to instantly revoke application access without deleting the user.

### Password Requirements
* **Strict Validation:** Passwords for ALL roles (Admin, Supervisor, Farmer) MUST be exactly 8 characters or more. Submitting a 7-character password will be rejected by the validation middleware.

*(Note: True hard-deletion functionality of user records is not verified from the available project evidence; use the Active status toggle to disable accounts).*

---

## 3. Farm & Master Inventory Management

Located in the `AdminFarmsPage`, this module controls the single source of truth for the organization.

* **Master Records:** The `currentBirdCount` and `currentFeedKg` act as the master ledgers.
* **Atomic Integrity:** When a farmer submits a daily report, Firestore utilizes atomic transactions to deduct mortality and feed from this master record. 

---

## 4. Prediction Engine

The system features an automated forecasting model located on the `PredictionPage`.

* **Purpose:** To forecast egg production output over the next 14, 21, or 30 days.
* **Logic:** The engine utilizes a **Weighted Moving Average (WMA)** alongside **Linear Regression**, blended against hardcoded standard breeder curves (`CF_STD` and `FR_STD`).
* **Limitations:** The engine requires sufficient historical data to establish an accurate trend line.
* **Important:** Predictions are statistical forecasts, not AI-guaranteed outcomes. Do not present them to stakeholders as absolute guarantees.

---

## 5. Historical Data Import (XLSX, CSV, XML)

*Note: The precise functional execution rate for import tests is not verified from the available project evidence, but the workflow is defined per the requirements.*

Admins can initiate batch imports of legacy data to bootstrap the system.

### Workflow
1. **Upload:** Select an XLSX, CSV, or XML file.
2. **Parsing & Mapping:** The system parses columns and maps them to database fields.
3. **Farm Matching:** The system attempts to match rows to existing `farmId`s.
   * *Strict Rule:* Unknown or ambiguous farm mappings are explicitly rejected. The system will NOT silently guess assignments.
4. **Conflict Handling:** The system identifies duplicate records.
5. **Execution:** The batch imports and logs an entry in the Import History.

---

## 6. Import Revert / Rollback Procedure

If a batch import executes with severe mapping errors or unintended data pollution, Admins can execute a total rollback.

**The Exact Verified Workflow:**
1. Navigate to the **Import History**.
2. Select the specific batch that needs rolling back.
3. Open the **Revert Entire Import Batch** dialog.
4. Read the destructive warning notice.
5. **Check the agreement box.** (If left unchecked, the Confirm button remains completely disabled).
6. **Enter the EXACT Batch ID** in the text field. The system supports case-insensitive exact matching and is robust against trailing/leading spaces. (Compatible with both `id` and `batchId` properties).
7. The **Confirm** button will ONLY become enabled when *both* the ID matches perfectly and the agreement is checked.
8. Execute the Revert. The batch is pulled entirely from Firestore.

---

## 7. Security & Infrastructure Controls

As the Admin, you rely on several automated backend protections:
* **BOLA Prevention:** Firestore Security Rules strictly mathematically block unauthorized reads/writes to unassigned farms. (Verified by 179 passing security tests).
* **Error Sanitization:** The Express backend intercepts unhandled 500 errors and strips out internal stack traces, ensuring infrastructure details are never leaked to the client.
* **Log Redaction:** Passwords and API tokens are automatically scrubbed from server logs.

---

## 8. Admin Testing Checklist

| Test ID | Module | Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| ADM-001 | User Validation | Attempt to create a user with a 6-character password. | Validation explicitly rejects request. | |
| ADM-002 | Rollback Safety | Open Revert dialog. Leave agreement unchecked. Type correct ID. | Confirm button strictly remains disabled. | |
| ADM-003 | Rollback Execute | Check agreement, type exact Batch ID. | Confirm button enables. Execution removes batch. | |
| ADM-004 | Prediction Engine | Run prediction on a newly created farm (0 days history). | Graceful handling of insufficient data. | |
| ADM-005 | Security Audit | Confirm Admin dashboard can read all farms regardless of explicit assignment list. | Success. Global visibility confirmed. | |

---
**End of Document**
