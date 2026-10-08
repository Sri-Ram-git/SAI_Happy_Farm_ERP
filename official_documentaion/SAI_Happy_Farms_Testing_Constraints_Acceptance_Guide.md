# SAI Happy Farms Farm ERP — System Testing, Constraints & Acceptance Guide

**Version:** 1.0  
**Date:** 04 October 2026  
**Status:** Official Documentation  
**Target Audience:** QA, Management, Client Sign-off Representatives  

---

## 1. Testing Strategy

This guide outlines the Customer Acceptance Testing (CAT) protocol. Testing ensures the UI constraints, database synchronization, atomic transactions, and Role-Based Access Controls (RBAC) operate securely and accurately as defined by the system architecture.

The backend and frontend test suites have been verified programmatically, and this document defines the manual User Acceptance Testing (UAT) steps required for customer sign-off.

---

## 2. Test Environment
* **Platform:** Web / Mobile Browser
* **Database:** Production (or dedicated Staging) Firestore Environment
* **Target Roles:** Farmer, Supervisor, Admin

---

## 3. Complete Constraint Register

| ID | Module | Constraint | Expected Behaviour | Status |
| :--- | :--- | :--- | :--- | :--- |
| C-01 | Birds | Bird count cannot be negative | Explicit `INSUFFICIENT_BIRDS` error. | Implemented |
| C-02 | Mortality | Mortality cannot exceed current live birds | Explicit `INSUFFICIENT_BIRDS` error. | Implemented |
| C-03 | Culling | Culling cannot be negative | Client-side validation blocks. | Implemented |
| C-04 | Totals | Mortality + Culling <= Live Birds | Transaction rejection. | Implemented |
| C-05 | Feed | Feed amount must be positive | Client-side `isNaN` / negative check. | Implemented |
| C-06 | Feed | Feed cannot exceed master stock | Explicit `INSUFFICIENT_FEED` error. | Implemented |
| C-07 | Temperature | Must be between -10 and 60 °C | Client-side blocks form progression. | Implemented |
| C-08 | Ammonia | Must be between 0 and 100 ppm | Client-side validation blocks. | Implemented |
| C-09 | Duplicates | Identical daily submissions not allowed | Explicit `CORRECTION_LIMIT_REACHED`. | Implemented |
| C-10 | Auth | User must be explicitly assigned to a farm | `FARM_NOT_ASSIGNED` thrown on read/write. | Implemented |
| C-11 | Passwords | Passwords must be >= 8 characters | Backend validator rejects creation request. | Implemented |

---

## 4. Test Results Summary

The following metrics are derived explicitly from the execution of the isolated test suites (`SECURITY_TEST_RESULTS.md`, `TEST_RESULTS.md`):

* **Security Testing Suites:** 24 suites verified.
* **Security Assertions Passed:** 179 passing assertions.
* **Security Failures:** 0 failures.
* **Manual Data Synchronization Scenario Tests:** 17 tests executed successfully on live Firestore environments.
* **Production Build Integrity:** Frontend Vite build stripped of all diagnostic console logs successfully (Build time: 1.25s).

*(Note: Specific legacy numerical claims regarding exact backend test files or XLSX import permutations are not verified from the available project evidence).*

---

## 5. Customer UAT Checklist

Customers should execute the following matrices using live or staging credentials.

### Authentication & Authorization Testing
| Test ID | Module | Preconditions | Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| AUTH-001 | Security | Admin credentials | Log in and navigate to Users page. | Success. Page loads. | |
| AUTH-002 | RBAC | Farmer credentials | Attempt to force-navigate to Supervisor Dashboard URL. | Access Denied. Redirected. | |
| SEC-001 | Security | Authenticated Farmer | Execute a cross-farm read request for an unassigned farm. | HTTP 403 `AUTHORIZATION_DENIED`. | |

### Functional Validation Testing
| Test ID | Module | Preconditions | Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| FARM-001 | Farm Form | Farm has 1000 birds | Attempt to submit 1001 mortality. | Blocked. `INSUFFICIENT_BIRDS`. | |
| FEED-001 | Farm Form | Farm has 50kg feed | Attempt to submit 100kg feed used. | Blocked. `INSUFFICIENT_FEED`. | |
| EGG-001 | Farm Form | - | Input a negative number for eggs. | Form prevents navigation to next step. | |

### Database Integrity Testing
| Test ID | Module | Preconditions | Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| SYNC-001 | DB Sync | Farm has 1000 birds | Submit a valid daily report with 10 mortality. | Master count instantly reads 990. | |
| REV-001 | Correction | Submitted V1 Report | Correct the report (V2) to 5 mortality. | Master count adjusts by delta (reads 995). | |

### Administrative Workflows
| Test ID | Module | Preconditions | Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| ADM-001 | User | Admin credentials | Create a Farmer with a 7-character password. | Validation rejects creation. | |
| REVERT-001 | Import | Previous import batch | Leave agreement unchecked, enter Batch ID. | Revert button disabled. | |
| REVERT-002 | Import | Previous import batch | Check agreement, enter partial ID. | Revert button disabled. | |

---

## 6. Acceptance Sign-Off

By signing below, the customer representatives acknowledge that the UAT procedures have been completed, and the SAI Happy Farms Farm ERP meets the specified requirements and constraints.

**Customer Representative:** 
_______________________________________

**Title / Organization:** 
_______________________________________

**Signature:** 
_______________________________________

**Date:** 
_______________________________________


**Development / Project Representative:** 
_______________________________________

**Signature:** 
_______________________________________

**Date:** 
_______________________________________

**Remarks:**
___________________________________________________________________________________
___________________________________________________________________________________

---
**End of Document**
