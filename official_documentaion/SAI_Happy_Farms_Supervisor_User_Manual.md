# SAI Happy Farms Farm ERP — Supervisor User Manual

**Version:** 1.0  
**Date:** 04 October 2026  
**Status:** Official Documentation  
**Target Audience:** Operational Farm Supervisors  

---

## Table of Contents
1. [Introduction](#1-introduction)
2. [Supervisor Login](#2-supervisor-login)
3. [Enterprise Analytics Dashboard](#3-enterprise-analytics-dashboard)
4. [Assigned Farms & Filtering](#4-assigned-farms--filtering)
5. [KPIs & Analytics](#5-kpis--analytics)
6. [Farm Performance Ranking](#6-farm-performance-ranking)
7. [Alerts & Monitoring](#7-alerts--monitoring)
8. [Supervisor Restrictions](#8-supervisor-restrictions)
9. [Supervisor Testing Checklist](#9-supervisor-testing-checklist)

---

## 1. Introduction

As a Supervisor for SAI Happy Farms, your primary responsibility is to monitor daily operational metrics for the farms explicitly assigned to you. This ERP system centralizes real-time data submitted by farmers, allowing you to instantly track mortality, feed stock, and egg production without waiting for weekly paper reports.

---

## 2. Supervisor Login

1. Navigate to the application URL on your desktop, tablet, or mobile device.
2. Enter your secure Email and Password (passwords must be >= 8 characters).
3. Upon login, the system will securely verify your role and map you only to your assigned farms.

---

## 3. Enterprise Analytics Dashboard

Your main workspace is the **Enterprise Analytics Dashboard**. It is designed to provide immediate visual insights based on real-time data. 

**Dashboard Components:**
* **Summary KPI Cards:** Quick numeric readouts for current master stock and production.
* **Analytics Charts:** 8 visual Recharts mapping trends such as Production %, Mortality, and Feed.
* **Farm Performance Comparison:** A ranking table scoring your farmers based on their performance.
* **Alert Feed:** Inline alerts highlighting critical operational issues.

---

## 4. Assigned Farms & Filtering

The dashboard strictly enforces data privacy. You can only view data for farms mapped to your account.

* **Farm Filter:** Use the top dropdown to view data for a specific farm or select "All Assigned Farms" to view aggregated data. 
* **Date Filter:** Switch between **7-Day** and **30-Day** historical views. Selecting a timeframe will instantly query the database and re-render all visual charts.

---

## 5. KPIs & Analytics

The system automatically computes Key Performance Indicators (KPIs) in real-time utilizing the daily logs submitted by farmers.

### Calculated Formulas
* **Mortality %:** `(Daily Mortality / Current Bird Count) * 100`
* **Culling %:** `(Daily Culling / Current Bird Count) * 100`
* **Egg Production %:** `(Eggs Produced / Current Bird Count) * 100`
* **Selection Egg %:** `(Selection Eggs / Total Eggs Produced) * 100`
* **Feed per Bird:** `(Feed Kg * 1000) / Current Bird Count` (Output in grams)
* **Feed per Egg:** `Total Feed Kg / (Total Eggs / 12)` (Output in Kg/Dozen)

These metrics allow you to track real-world health and output without manual mathematics.

---

## 6. Farm Performance Ranking

The dashboard includes a **Farm Performance Comparison** table. This engine ranks your assigned farms based on a calculated **Farm Performance Score**.

The score evaluates:
* **Production Gap** (How close actual production is to standard curves)
* **FCR** (Feed Conversion Ratio)
* **Egg Damage/Selection %**
* **Mortality %**

*(Note: Specific algorithm weightings are driven internally by the analytics engine. Detailed tie-break conditions are not verified from the available project evidence).*

---

## 7. Alerts & Monitoring

The dashboard will actively flag conditions requiring your attention. These in-app visual alert cards will appear when:
* **Missing Submissions:** A farmer has failed to submit their daily report.
* **Mortality Spikes:** The daily mortality count indicates a potential health crisis.
* **Production Drops:** Egg production suddenly falls below acceptable thresholds.

*Note: The alerts are visible only while you are actively viewing the dashboard. The system does not currently send external SMS or Email notifications (Not Implemented).*

---

## 8. Supervisor Restrictions

To maintain system integrity, your Supervisor account is subject to strict security constraints:

**What you CAN do:**
* View dashboards and charts for your assigned farms.
* Monitor live KPIs and farm performance rankings.
* Filter historical data by 7-day and 30-day windows.

**What you CANNOT do:**
* You cannot edit or delete farmer data submissions.
* You cannot view data for farms that belong to another supervisor. The database will explicitly block the connection (`HTTP 403`).
* You cannot add new farmers, reassign farms, or execute master data imports. Those functions require Administrator privileges.

---

## 9. Supervisor Testing Checklist

| Test ID | Module | Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| SUP-001 | Farm Access | Log in and open Farm filter dropdown. | Only assigned farms are listed. | |
| SUP-002 | Date Filter | Switch filter from 7-day to 30-day view. | Charts instantly redraw for the 30-day period. | |
| SUP-003 | Authorization | Attempt to directly view a URL/ID of an unassigned farm. | Blocked by Firestore security rules. | |
| SUP-004 | Alert Visibility | Locate a farm with a missed submission. | "Missing Submission" alert card rendered. | |

---
**End of Document**
