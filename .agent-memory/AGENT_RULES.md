# AGENT_RULES.md

*Strict instructions for future coding agents working on this project.*

---

## BEFORE MAKING CHANGES

1. Read these files in order:
   - `AGENT_RULES.md` (this file)
   - `PROJECT_CONTEXT.md`
   - `CURRENT_ARCHITECTURE.md`
   - `FIRESTORE_SCHEMA.md`
   - `CURRENT_STATUS.md`
   - `TODO.md`
   - `DECISIONS.md`

2. Inspect the actual code before modifying it. Never assume the schema from old code is still correct.

3. Check `CURRENT_STATUS.md` for known issues and `TODO.md` for planned work.

---

## SCHEMA RULES

4. **Never assume the Firestore schema from old code.** The schema has changed from flat `dailyReports/{randomId}` to nested `dailyReports/{userId}/dailyLogs/{date}`. Always check `FIRESTORE_SCHEMA.md`.

5. **Never delete Firestore data** unless explicitly instructed with confirmation.

6. **Never automatically migrate old dailyReports** unless explicitly instructed. Old reports at `dailyReports/{randomReportId}` must remain untouched.

7. **Preserve backward compatibility** with old test data where possible.

---

## DASHBOARD RULES

8. **Do not hardcode dashboard values.** All KPI calculations must come from actual Firestore data.

9. **If data cannot be loaded**, display "--" or "No data available" — never show fake values like 0, 10%, or 0.1%.

10. **Use `collectionGroup('dailyLogs')`** for querying new report format. Do NOT query `dailyReports` parent documents as if they were reports.

11. **Do not propagate collectionGroup errors to the UI** as fatal errors. Log them to console with index creation hints.

---

## INVENTORY RULES

12. **Do not allow frontend clients to freely modify authoritative inventory.** Bird count and feed stock are system-managed values.

13. **Use atomic transactions** for report submission and inventory updates. Never update inventory separately from report creation.

14. **Prevent duplicate daily submissions** and double inventory deductions. Check for existing report before creating.

15. **Farmers do not enter master bird count or master feed stock.** These are read from `farms/{farmId}/inventory/birds` and `feed`.

---

## AUTHENTICATION RULES

16. **Always normalize roles** using `normalizeRole()` before comparison. Firestore data may have inconsistent casing or whitespace.

17. **Never store or log secrets**, API keys, or service account credentials in code.

18. **Verify Firebase configuration** is correct before debugging auth issues.

---

## ENVIRONMENT RULES

19. **Do not modify Production Firebase** configuration, credentials, or data unless explicitly instructed.

20. **All current development is on TEST environment** (`farm-form` project). Clearly label any test-only changes.

21. **Do not commit secrets** (service-account.json, .env, API keys) to git.

---

## CODE QUALITY RULES

22. **Inspect existing code patterns** before adding new code. Follow the existing code style.

23. **Do not add comments** unless explicitly requested.

24. **Do not break existing functionality** when adding new features. Test before committing.

25. **Run `npx tsc --noEmit`** from the `frontend/` directory before committing to verify TypeScript compiles.

---

## DOCUMENTATION RULES

26. **After completing a task**, update these files:
    - `CURRENT_STATUS.md` — mark what now works/broken
    - `TODO.md` — move completed items, add new items found
    - `IMPLEMENTATION_LOG.md` — append detailed entry
    - `CHANGELOG.md` — add concise entry
    - `FIRESTORE_SCHEMA.md` — if schema changed
    - `DECISIONS.md` — if an architecture decision changed

27. **Never erase previous entries** in IMPLEMENTATION_LOG.md. Always append.

28. **If a requested change conflicts** with a previous documented decision in DECISIONS.md, do not silently change it. Document the conflict and ask for clarification.

29. **Leave the repository documentation accurate enough** for another agent with zero conversation context to continue work.

---

## CONFLICT RESOLUTION

30. If you find conflicting information between documentation files and actual code, **trust the actual code** but update the documentation to match.

31. If you find a feature documented as "implemented" but the code doesn't support it, **mark it as broken** in CURRENT_STATUS.md and add it to TODO.md.
