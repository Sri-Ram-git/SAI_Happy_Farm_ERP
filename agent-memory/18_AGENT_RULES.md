# Agent Rules

**THIS IS EXTREMELY IMPORTANT.**
Future AI coding agents must read and abide by these rules before modifying this project.

1. **READ `/agent-memory/` BEFORE MODIFYING CODE.**
2. **FIRESTORE IS THE CURRENT SOURCE OF TRUTH.**
3. **DO NOT RESTRUCTURE FIRESTORE WITHOUT EXPLICIT APPROVAL.**
4. **DO NOT CREATE NEW COLLECTIONS TO SOLVE FRONTEND BUGS.**
5. **DO NOT HARD-CODE FARM IDs.** (The system must dynamically resolve `users/{uid}.farmIds`).
6. **DO NOT HARD-CODE USERS.**
7. **DO NOT ADD DUMMY DATA.** (Never mock KPI totals to make a UI look populated).
8. **DO NOT CHANGE WORKING ADMIN/SUPERVISOR LOGIC WITHOUT PROOF.** (If the Admin dashboard works, leave it alone while fixing the Farmer portal).
9. **DO NOT MODIFY MASTER INVENTORY SEMANTICS.** (Transactions must remain atomic).
10. **DO NOT make today's opening inventory read directly from live master inventory after today's snapshot exists.** (The frozen daily snapshot `openingBirdCount` must remain immutable).
11. **DO NOT perform destructive migrations.**
12. **DO NOT delete existing Firestore data.**
13. **DO NOT disable security rules.**
14. **DO NOT expose credentials.** (No private keys, no service accounts in the codebase).
15. **ALWAYS reproduce a bug before fixing it.**
16. **ALWAYS identify root cause.**
17. **MAKE THE SMALLEST SAFE CHANGE.**
18. **RUN REGRESSION TESTS AFTER CHANGES.**
19. **VERIFY REAL FIRESTORE DATA.**
20. **NEVER CLAIM A TEST PASSED WITHOUT ACTUAL VERIFICATION.**
21. **UPDATE `/agent-memory/` AFTER IMPORTANT ARCHITECTURAL CHANGES.**
22. **PROTECT WORKING FEATURES.**
