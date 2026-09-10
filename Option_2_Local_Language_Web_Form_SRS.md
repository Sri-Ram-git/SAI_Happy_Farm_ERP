# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)
## SAI HAPPY FARMS — FARM DATA CAPTURE SYSTEM
### OPTION 2: LOCAL-LANGUAGE WEB FORM & RELATED SPECIFICATIONS

**Project:** Digital Farm Data Collection System  
**Reference Farm:** AP 12  
**Application Type:** Web-Based System  
**Document Type:** Software Requirements Specification  
**Version:** 1.0  
**Date:** 20 August 2026  

---

## 1. INTRODUCTION

### 1.1 Purpose
The purpose of this system is to digitize the existing manual farm reporting process used by SAI Happy Farms Pvt. Ltd.

Currently, farmers record daily farm information in handwritten weekly registers. At the end of the week, photographs of these registers are sent to the office, where employees manually enter the information into Excel. Excel then performs calculations and generates reports.

The proposed web application will replace this manual workflow with a centralized digital system that supports:
- Daily farm data entry
- User verification and correction of data
- Centralized farm database
- Automatic KPI calculations
- Dashboards and reports
- Production and performance curves
- Farm comparison
- Alerts and notifications
- Farmer and supervisor performance tracking

The existing process currently involves four stages: handwritten entry, WhatsApp photo sharing, manual Excel entry, and Excel-based calculation.

---

## 2. SCOPE

### 2.1 In Scope
The system shall provide the following major modules:
- User Authentication
- Role-Based Access Control
- Farm Management
- Farmer Management
- Daily Farm Data Entry
- Weekly Report Management
- Centralized Database
- Automatic KPI Calculation
- Dashboard
- Daily/Weekly/Monthly Reports
- Production Curves
- Farm Comparison
- Farmer Performance Ranking
- Alerts and Notifications
- Data Search and Filtering
- Report Export
- System Administration

The system must capture the same fields currently present in the weekly register, including bird count, feed, mortality, culling, egg production, selection eggs, temperature, egg weight, body weight, remarks and ammonia test results.

---

## 3. EXISTING SYSTEM

### 3.1 Current Workflow
The existing process operates as follows:
Farmer → Handwritten Weekly Register → Photo via WhatsApp → Office Staff → Manual Excel Entry → Excel Calculations → Reports

The process requires the same information to effectively be recorded twice: first by the farmer and later by office staff during Excel entry.

### 3.2 Problems with Existing System
The current system has the following limitations:
- Manual data entry is time-consuming.
- Reports are delayed until office staff complete Excel entry.
- Handwritten values can be incorrectly interpreted.
- Duplicate data entry is required.
- There are no immediate alerts for abnormal farm conditions.
- Historical data is difficult to manage centrally.
- Real-time monitoring is unavailable.
- Production deviations may only become visible after weekly processing.

The proposal specifically identifies slow turnaround, lack of real-time alerts and duplicated effort as major problems.

---

## 4. PROPOSED SYSTEM — OPTION 2 OVERVIEW

### 4.1 System Overview: Option 2 — Local-Language Web Form
The farmer directly enters the required farm information through a simple web-based form available in the required local language. The data is validated and stored directly in the centralized database.

### 4.2 Workflow & Purpose
The second option eliminates handwritten-register processing for farmers who are able to enter information digitally.

#### Workflow
```
Farmer
  ↓
Local-Language Web Form
  ↓
Input Validation
  ↓
Central Database
```

#### Purpose
- This option provides a simpler and more direct method of data collection.
- The farmer enters the required information directly into a mobile-friendly web application.
- No photograph processing or OCR is required.

---

## 5. OPTION 2 — LOCAL-LANGUAGE WEB FORM SPECIFICATIONS

### 5.1 Farmer Web Interface
The system shall provide a simple mobile-friendly web interface designed for farm personnel.

The interface shall minimize technical terminology and use:
- Local-language labels
- Simple instructions
- Large input fields
- Numeric input fields
- Dropdowns where appropriate
- Clear validation messages
- Simple navigation

### 5.2 Language Support
The application may provide language selection based on the languages required by the company.

Possible languages may include:
- English
- Kannada
- Telugu
- Tamil
- Hindi

The final languages shall be determined by the operational requirements of SAI Happy Farms.

Changing the interface language shall translate:
- Field labels
- Buttons
- Instructions
- Validation messages
- Basic navigation

The underlying database values shall remain language-independent.

---

## 6. FARM DATA FIELDS

The system shall support the following fields:
- Date
- Number of Birds
- Feed — grams
- Feed — kilograms
- Mortality — number
- Mortality — percentage
- Culling — number
- Culling — percentage
- Egg Production — number
- Egg Production — percentage
- Selection Eggs — number
- Selection Eggs — percentage
- Shed Temperature
- Egg Weight — minimum
- Egg Weight — maximum
- Egg Weight — average
- Body Weight — minimum
- Body Weight — maximum
- Body Weight — average
- Remarks
- Ammonia Test Result

---

## 7. DATE CONTROL

### 7.1 Automatic Date Generation
- The date of the farm submission shall be generated automatically by the system.
- The farmer shall not be allowed to manually select or modify the submission date.
- The application shall use a trusted server-side date/time rather than relying on the date configured on the farmer's device.

### 7.2 Date Locking
Once the daily record is created, its original system-generated date shall remain locked.

The user interface shall display the date as read-only.

**Example:**
```
Today's Farm Report
Date: 20/08/2026
```
The farmer cannot change the date to another date through the form.

### 7.3 Purpose
This control is intended to prevent users from intentionally or accidentally submitting a report under an incorrect date.  
The system shall maintain the original server-generated submission timestamp for traceability.

---

## 8. INPUT VALIDATION

The system shall validate farm information before saving it.

Examples include:
- Bird count cannot be negative.
- Mortality cannot exceed the bird count.
- Culling cannot be negative.
- Percentages must remain within valid ranges.
- Feed values must be numeric.
- Temperature must contain a valid numeric value.
- Egg weight must be numeric.
- Body weight must be numeric.
- Required fields must be completed.
- Duplicate daily submissions should be detected.
- Invalid values shall generate a clear validation message.

---

## 9. DATABASE

### 9.1 Centralized Data Storage
The system shall store verified farm information in a centralized database. The database shall maintain the submitted farm records.

### 9.2 Basic Record Structure
Each farm record should contain information such as:
- Record ID
- Farm ID
- Date
- Bird count
- Feed
- Mortality
- Culling
- Egg production
- Selection eggs
- Temperature
- Egg weight
- Body weight
- Remarks
- Ammonia result
- Submission method
- Submitted by
- Created timestamp

### 9.3 Submission Method
The system shall identify how each record was created:
- Value: `Digital Form` (Distinguishes records generated through Option 2).

---

## 10. OPTION 2 DATA FLOW

The complete Option 2 process shall be:
```
Farmer
  ↓
Local-Language Web Form
  ↓
Automatic Server Date
  ↓
Input Validation
  ↓
Database
```
- The farmer's data shall be stored directly after successful validation.
- No OCR processing is required.

---

## 11. USER INTERFACE — OPTION 2

The farmer-facing form should use a simple step-by-step structure:

### Step 1 — Basic Information
- **Date:** `[ Automatically Generated ]`
- **Number of Birds:** `[ Enter Number ]`

### Step 2 — Feed
- **Feed Used:** `[ Enter Value ]`

### Step 3 — Farm Health
- **Mortality:** `[ Enter Number ]`
- **Culling:** `[ Enter Number ]`
- **Temperature:** `[ Enter Value ]`

### Step 4 — Egg Production
- **Eggs Produced:** `[ Enter Number ]`
- **Selection Eggs:** `[ Enter Number ]`

### Step 5 — Weights
- **Egg Weight:**
  - Minimum `[ ]`
  - Maximum `[ ]`
  - Average `[ ]`
- **Body Weight:**
  - Minimum `[ ]`
  - Maximum `[ ]`
  - Average `[ ]`

### Step 6 — Additional Information
- **Ammonia Test:** `[ Enter Value ]`
- **Remarks:** `[________________________]`

**[ Submit Daily Report ]**

---

## 12. SUBMISSION CONFIRMATION

After successful submission, the system shall display a confirmation.

**Example:**
```
Daily Report Submitted Successfully
Farm: AP 12
Date: 20/08/2026
Submission Method: Digital Form

✓ Data Validated
✓ Data Saved
```
The system shall not allow the farmer to modify the original system-generated submission date.

---

## 13. TECHNOLOGY — OPTION 2

The recommended implementation for Option 2 is a Firebase-based web application.

Firebase can be used for:
- User authentication
- Database storage
- File storage where required
- Server-generated timestamps
- Web application hosting
- Access control through security rules

The farmer-facing application can be implemented as a responsive web application optimized for mobile phones.  
A separate OCR service is not required for Option 2.

### Option 2 Technology Stack
| Component | Recommended Technology |
| :--- | :--- |
| **Farmer Input** | Mobile Web Application |
| **Frontend** | React / Next.js or equivalent |
| **Database** | Firebase Firestore |
| **Authentication** | Firebase Authentication |
| **Hosting** | Firebase Hosting |
| **Backend** | Firebase Cloud Functions where required |
| **Notifications** | Firebase Cloud Messaging (FCM) |
| **File Storage** | Firebase Storage only if required |
| **Domain** | Custom .com / .in domain |
| **Security** | Firebase Security Rules + HTTPS |
| **Monitoring** | Firebase / Google Cloud monitoring |
| **Source Control** | GitHub |

---

## 14. COST ESTIMATION — OPTION 2

### 14.1 Infrastructure Characteristics
Option 2 does not require:
- WhatsApp API
- OCR service
- Register photograph storage for normal submissions
- OCR processing charges

### 14.2 Costing Assumptions
For budgeting purposes, the following usage volume applies to the initial implementation:
- Up to 25 farmers/users
- Approximately 750 daily submissions per month
- Approximately 9,000 submissions per year
- Mobile-first web application
- Firebase-based backend
- One production environment
- One custom domain
- Regular application backups

### 14.3 Infrastructure Rate Breakdown
- **Firebase Authentication:** Free up to 50,000 Monthly Active Users (MAU).
- **Firebase Cloud Messaging (FCM):** 100% Free / Unlimited push notifications.
- **Firebase Web Hosting:** Free up to 10 GB storage and 10 GB/month data transfer.

### 14.4 Monthly Cost Estimate (Tiered Range Format)
| Cost Component | Baseline Cost (750 Submissions/mo) | Scaled Production Range (1,000–5,000 Submissions/mo) |
| :--- | :--- | :--- |
| Firebase Firestore Database | ₹0 | ₹150 – ₹900 |
| Firebase Hosting | ₹0 | ₹0 |
| Firebase Cloud Functions | ₹0 | ₹0 – ₹70 |
| Firebase Storage | ₹0 | ₹0 |
| Authentication | ₹0 | ₹0 |
| Notifications / FCM | ₹0 | ₹0 |
| Monitoring / Logs | ₹0 | ₹0 |
| Backup / Usage Reserve | ₹50 – ₹200 | ₹200 – ₹500 |
| **Total Monthly Operating Cost** | **₹50 – ₹200 / month** | **₹350 – ₹1,470 / month** |

**Recommended Proposal Budget (Option 2):**  
Standard Operational Ceiling: ₹500 – ₹1,000 per month (Includes maintenance reserve).

### 14.5 Annual Cost Estimate
| Cost Component | Baseline Annual Cost (9,000 Submissions/yr) | Scaled Annual Range (12,000–60,000 Submissions/yr) |
| :--- | :--- | :--- |
| Firebase Database | ₹0 | ₹1,800 – ₹10,800 |
| Firebase Hosting | ₹0 | ₹0 |
| Cloud Functions | ₹0 | ₹0 – ₹840 |
| Firebase Storage | ₹0 | ₹0 |
| Authentication | ₹0 | ₹0 |
| Notifications / Miscellaneous | ₹0 | ₹0 |
| Monitoring / Logs | ₹0 | ₹0 |
| Backup / Usage Reserve | ₹600 – ₹2,400 | ₹2,400 – ₹6,000 |
| **Estimated Annual Operating Cost** | **₹600 – ₹2,400 / year** | **₹4,200 – ₹17,640 / year** |

**Recommended Proposal Budget (Option 2):**  
Option 2 Recommended Operating Budget: ₹6,000 – ₹12,000 / year.

### 14.6 Domain Cost
The system should use a company-owned custom domain (e.g., `farm.saihappyfarms.com`).
- **.in Domain Registration / Renewal:** ₹600 – ₹900 / year
- **.com Domain Registration / Renewal:** ₹900 – ₹1,500 / year
- **Domain Budget:** ₹800 – ₹1,500 / year

### 14.7 Web Hosting Cost
Firebase Hosting provides 10 GB hosting storage and 10 GB/month data transfer on the Blaze plan free quota.
- **0 – 10 GB/month Transfer:** ₹0 / month
- **10.1 GB – 100 GB/month Transfer:** ₹120 – ₹1,100 / month ($0.15/GB data transfer)

### 14.8 Firebase Database Cost
Firebase Firestore free quotas cover 1 GiB stored data, 50,000 reads/day, and 20,000 writes/day.
- **0 – 750 daily submissions/month:** ₹0 / month
- **750 – 5,000 daily submissions/month:** ₹150 – ₹900 / month
- **5,000 – 20,000 daily submissions/month:** ₹1,000 – ₹4,500 / month

### 14.9 Mobile APK Distribution Cost
- **Android (Google Play Console):** US$25 one-time registration fee (~₹2,100 one-time).
- **Apple iOS (Apple Developer Program):** US$99 annual subscription fee (~₹8,700 / year, required only if App Store listing is selected).

### 14.10 APK / Mobile App Development Cost
If a standalone Android APK packaging is required instead of a Progressive Web App (PWA):
- Android APK packaging and publishing setup: ₹20,000 – ₹30,000 one-time.

### 14.11 Total Year-One Budget (Option 2 — Local-Language Web Form)
- **Annual Operating Budget (Baseline with Reserve):** ₹6,000 – ₹12,000
- **Custom Domain:** ₹800 – ₹1,500
- **Android Developer Account:** ₹2,100
- **Total Year-1 Budget (Android):** ₹8,900 – ₹15,600 (or ₹17,600 – ₹24,300 with iOS Developer Program)

### 14.12 Development Cost vs Operating Cost
- **One-Time Development Cost:** Includes UI/UX development, Web application development, Firebase integration, Database design, Authentication setup, Local-language interface, Validation rules engine, Testing and deployment, System documentation, APK / PWA packaging where applicable.
- **Recurring Operating Cost:** Includes Firebase Firestore, Firebase Cloud Storage, Firebase Hosting, Domain maintenance, Cloud Functions executions, Backup and logging reserves.

### 14.13 Recommended Cost Buffer
- **Option 2 Operational Ceiling:** ₹500 – ₹1,000 / month (₹6,000 – ₹12,000 / year).
- Actual consumption within baseline limits will result in lower billing due to provider free-tier allowances.

### 14.14 Cost Recommendation
Based on the proposed architecture, Option 2 — Local-Language Web Form is expected to have the lower recurring operating cost.  
The major reason is that it removes:
- WhatsApp API dependency
- WhatsApp message charges
- OCR API charges
- OCR processing infrastructure
- Register photograph storage
- OCR verification processing

**Architecture Flow:**
```
Local-Language Web Form → Validation → Firebase
```

### 14.15 Costing Disclaimer
Disclaimer: All costs in this section are conservative planning estimates and are intentionally rounded upward to provide a safety margin. They are not guaranteed monthly invoices.  
Actual costs will depend on:
- Number of farmers
- Number of daily submissions
- Database operations
- Storage retention period
- Network traffic
- Selected domain
- Applicable taxes
- Cloud provider pricing changes

Firebase provides substantial no-cost usage quotas, so the proposed Firebase amounts should be treated as budget reserves rather than expected minimum bills.

---

## 15. OPTION 2 CHARACTERISTICS & COMPARISON SUMMARY

| Area | Option 2 — Local-Language Web Form |
| :--- | :--- |
| **Farmer workflow** | Direct digital entry |
| **Input method** | Web form |
| **OCR required** | No |
| **WhatsApp integration** | No |
| **OCR processing cost** | Not applicable |
| **Image storage** | Not required for normal entry |
| **Data verification** | Form validation |
| **Handwriting errors** | Avoided |
| **Local-language interface** | Core feature |
| **Real-time data entry** | Yes |
| **System complexity** | Lower |
| **Software/service components** | Fewer |
| **Storage requirements** | Lower for normal data entry |
| **Suitable for** | Direct digital workflow |

### Recommended Implementation Rationale
- Recommended when the company is willing to move farmers toward direct digital entry.
- The farmer enters the information directly through a simple local-language web application.
- **Main advantages:**
  - No handwriting recognition
  - No OCR processing
  - No register photograph processing
  - Faster data availability
  - Direct database storage
  - Simpler system architecture
  - Lower ongoing service requirements

---

## 16. COMPLETE DATA & SYSTEM FLOW (OPTION 2)

```
Farmer
  ↓
Local-Language Web Form
  ↓
Automatic Date
  ↓
Data Validation
  ↓
Firebase Database
  ↓
KPI Engine
  ↓
Dashboard
  ↓
Alerts / Reports
  ↓
Google Sheets / Excel
```

---

## 17. IMPLEMENTATION TIMELINE (OPTION 2 & COMMON MODULES)

**Project Start Date:** 24 August 2026  
**Target Completion Date:** 30 September 2026  
**Implementation Duration:** 6 Weeks  

### 17.1 Implementation Schedule Breakdown
- **Week 1 (24–30 Aug):**
  - *Option 2 Track:* Farmer form design & data-entry workflow.
  - *Common Track:* Firebase, authentication, roles, database, farm management.
  - *Details:* Design farmer-facing mobile interface, define supported language structure, design daily data-entry form, define field sequence, define required and optional fields, define numeric input controls, define validation requirements, define automatic date behaviour.
- **Week 2 (31 Aug–6 Sep):**
  - *Option 2 Track:* Local-language form development.
  - *Common Track:* Data validation, storage, submission workflow.
  - *Details:* Local-language interface, daily data-entry screen, farm selection/assignment, automatic date, bird information, feed information, mortality, culling, egg production, selection eggs, temperature, egg weight, body weight, ammonia, remarks, submission confirmation.
- **Week 3 (7–13 Sep):**
  - *Option 2 Track:* Form validation & submission completion.
  - *Common Track:* KPI engine, dashboard foundation.
  - *Details:* Real-time validation, required-field validation, numeric validation, range validation, duplicate-date validation, submission confirmation, error messages, successful database submission. (Bypasses OCR and stores validated values directly in Firebase).
  - *Common KPI Engine:* Bird Balance, Mortality %, Culling %, Egg Production %, Selection Egg %, Feed per Bird, Feed per Egg, Weekly Average, Monthly Average, Standard Production %, Actual Production %.
- **Week 4 (14–20 Sep):**
  - *Option 2 Track:* End-to-end digital-entry workflow.
  - *Common Track:* Reports, charts, alerts, Google Sheets.
  - *Details:* Dashboard metrics, charts (Standard vs Actual Production, trends), reports (daily, weekly, monthly, farm-wise, farmer-wise), Google Sheets export, and alerts (production drop, mortality, temperature, ammonia, missing submission).
- **Week 5 (21–27 Sep):**
  - *Option 2 Track:* Farmer usability & workflow testing.
  - *Common Track:* Security, Excel verification, UAT.
  - *Details:* Mobile usability, language selection, data-entry workflow, automatic date verification, validation, duplicate prevention, submission, database storage, KPI calculation, dashboard update. Excel cross-verification and security/date integrity testing.
- **Week 6 (28–30 Sep):**
  - *Option 2 Track:* Final corrections & production configuration.
  - *Common Track:* Deployment, handover & sign-off.
  - *Details:* Final local-language configuration, final farmer interface testing, final mobile responsiveness testing, final validation testing, production form configuration, deployment, admin handover, system documentation, project sign-off.