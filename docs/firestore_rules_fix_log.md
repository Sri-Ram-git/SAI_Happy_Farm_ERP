# Firestore Rules 10 `get()` Evaluation Limit Fix
**Date:** October 3, 2026

## The Problem
The farmer portal "Submit Report" button consistently failed with `Missing or insufficient permissions` despite all user roles and permissions being logically correct.

## The Cause
The report submission process executed a large multi-document batch transaction in `reportService.ts`, involving 4 client reads (`users`, `dailyLogs`, `flocks`, `farms`) and up to 9 atomic writes (`revisions`, `flocks`, `farms`, `feedTransactions`, `dailyReports`, `dailyLogs`, `dailyReportLocks`, `birdTransactions`).

Firestore has a strict hard limit of **10 document access calls** (e.g., `get()`, `exists()`) per transaction request.
1. In batch writes and transactions, every document operation independently evaluates its security rules.
2. The rules for `dailyReports`, `dailyLogs`, and `revisions` checked `isUserActive()` and `hasFarmAccess()` which each called `getUserDoc()` (executing a `get()` against `users/{userId}`).
3. The cache for `get()` evaluations is scoped **per document rule evaluation** (not across the entire batch).
4. Between the reads and writes, the transaction triggered up to 13 separate evaluations of `getUserDoc()`, resulting in 13 `get()` calls.
5. Because 13 > 10, the entire transaction was rejected by Firestore immediately, raising a permission error.

## The Fix
We optimized `firestore.rules` using logical short-circuiting:
- We modified `match /dailyReports/{reportOrUserId}`, `match /dailyLogs/{logDate}`, and `match /revisions/{revId}`.
- We moved `isOwner(reportOrUserId)` to be the **first** condition evaluated in the OR (`||`) blocks.
- When a user submits their own report, `isOwner` evaluates to `true`, and Firestore short-circuits the rule execution. 
- This bypasses the need to evaluate `isUserActive()` and `hasFarmAccess()` on these specific document writes, eliminating 4 `get()` calls from the transaction.
- The transaction total was brought down to 9 `get()` calls, safely under the 10 limit.
- **Security is preserved** because the downstream canonical updates to `farms`, `flocks`, and `feedTransactions` still strictly enforce `isUserActive()` and `hasFarmAccess()`. If an unauthorized user attempts a submission, the transaction will still successfully block them on those aggregate writes.
