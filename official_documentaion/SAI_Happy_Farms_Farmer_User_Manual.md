# SAI Happy Farms Farm ERP — Farmer User Manual

**Version:** 1.0  
**Date:** 04 October 2026  
**Status:** Official Documentation  
**Target Audience:** Field Farmers  

---

## Table of Contents
1. [Introduction](#1-introduction)
2. [Login](#2-login)
3. [Farmer Dashboard](#3-farmer-dashboard)
4. [Language Selection](#4-language-selection)
5. [Daily Data Entry](#5-daily-data-entry)
6. [Calculated Values](#6-calculated-values)
7. [Submission & Corrections](#7-submission--corrections)
8. [Common Errors](#8-common-errors)
9. [What Farmers Can and Cannot Access](#9-what-farmers-can-and-cannot-access)
10. [Farmer Testing Checklist](#10-farmer-testing-checklist)

---

## 1. Introduction

Welcome to the **SAI Happy Farms Farm ERP**. This application is designed specifically to make logging your daily farm data easy, accurate, and completely paperless. You will use this system every day to report vital farm metrics such as bird mortality, feed usage, and egg production.

---

## 2. Login

To access the system, you must authenticate securely:
1. Open the application on your mobile device or tablet.
2. Enter your assigned **Email Address** and **Password**. (Passwords must be at least 8 characters long).
3. Tap **Login**.
4. Upon successful login, you will securely access your assigned farm's dashboard.

*Note: You are strictly isolated to your own farm. You cannot view another farmer's data.*

---

## 3. Farmer Dashboard

Once logged in, you will see your main Farmer Dashboard. The dashboard displays:
* **The Application Date:** The date is generated and locked automatically. You cannot change it.
* **Your Farm Inventory:** The total live birds currently on your farm (Opening Bird Count).
* **The "Start Report" Button:** Tap this to begin your daily entry wizard.

---

## 4. Language Selection

The system supports multiple languages to help you work comfortably.
You can change the language immediately by tapping the language selector at the top of your screen.

Supported Languages:
* **English**
* **Kannada**
* **Telugu**
* **Tamil**

*(Note: Hindi translation is not verified from the available project evidence).*

---

## 5. Daily Data Entry

The daily reporting form is separated into four easy steps.

### Step 1: Feed and Temperature
* **Feed Used (Kilograms):** Enter the total feed given to the flock today.
  * *Constraint:* Must be a positive number. You cannot enter more feed than what is currently available in your silo.
* **Shed Temperature Min/Max (°C):** Enter the lowest and highest temperature recorded today.
  * *Constraint:* Must be between `-10` and `60`. Minimum cannot be higher than maximum.

### Step 2: Mortality and Culling
* **Mortality:** The number of birds that died today.
  * *Constraint:* Must be 0 or greater. Cannot exceed the total number of live birds on your farm.
* **Culling:** The number of birds removed today.
  * *Constraint:* Must be 0 or greater. Mortality + Culling cannot exceed your total live birds.

### Step 3: Egg Production
* **Egg Production:** Total number of eggs collected today.
* **Selection Eggs:** Number of premium selected eggs.
* **Egg Weight Min/Max/Avg (grams):** Enter the weight metrics of the eggs.
  * *Constraint:* Must be positive numbers. Min must be less than or equal to Max.

### Step 4: Health and Remarks
* **Body Weight Min/Max/Avg (grams):** Enter the bird body weight readings.
* **Ammonia Level (ppm):** Enter the shed ammonia reading.
  * *Constraint:* Must be between `0` and `100`.
* **Remarks:** Enter any additional text notes for your supervisor (optional).

---

## 6. Calculated Values

The system will do the math for you. After entering your data, you will automatically see:
* **Feed (Grams per Bird):** Converted automatically from the kilograms you entered.
* **Mortality %:** Percentage of the flock lost today.
* **Culling %:** Percentage of the flock culled today.
* **Egg Production %:** Total eggs compared to the total birds.
* **Selection Egg %:** Selected eggs compared to total eggs.

---

## 7. Submission & Corrections

### Submission
After reviewing your calculated values on the final verification screen, tap **Submit**. The data will securely upload to the database and update your farm's master inventory instantly.

### Correction / Revision Process
If you make a mistake, you can re-open the form on the same day and submit a **Version 2 Correction**.
1. Return to the dashboard.
2. Edit your report and adjust the numbers.
3. Tap **Submit**. The system will intelligently calculate the difference and adjust the master inventory without double-charging you.

---

## 8. Common Errors

| Problem | Cause | What You Should Do |
| :--- | :--- | :--- |
| **"Insufficient Birds"** | You entered a mortality number higher than the total live birds on the farm. | Double-check your mortality and culling counts. |
| **"Insufficient Feed"** | You entered a feed usage number higher than your farm's total stock. | Double-check your feed amount. If correct, request a feed load from your supervisor. |
| **"Correction Limit Reached"** | You attempted to submit an identical duplicate report for the same day. | No action needed. Your report is already saved. |
| **"Farm Not Assigned"** | Your user account has lost authorization to write data. | Contact your Administrator. |

---

## 9. What Farmers Can and Cannot Access

* **You CAN:** View your master bird count, submit daily reports, and submit same-day corrections.
* **You CANNOT:** View Analytics, view Supervisor dashboards, change the system date, edit reports from previous days, or view data from other farms.

---

## 10. Daily Usage Procedure

1. Wake up and complete farm rounds.
2. Log in to the application.
3. Ensure the language is set correctly.
4. Input Feed and Temperature.
5. Input Mortality and Culling.
6. Input Egg Production metrics.
7. Input Body Weight and Ammonia.
8. Verify calculated results.
9. Tap Submit.

---

## 11. Farmer Testing Checklist

| Test ID | Test | Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| FARM-001 | Valid Submission | Enter valid data across all 4 steps and submit. | Success notification. Inventory updates. | |
| FARM-002 | Negative Data | Enter -10 for feed. | Validation immediately rejects the entry. | |
| FARM-003 | Insufficient Birds | Enter 5000 mortality when only 1000 birds exist. | Submission blocked. "Insufficient Birds" error. | |
| FARM-004 | Language Switch | Select 'Tamil' from the dropdown. | All labels translate immediately. | |

---
**End of Document**
