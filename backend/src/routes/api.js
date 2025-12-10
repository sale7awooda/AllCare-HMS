
// ... existing code ...
router.get('/medical/requests/operations', authorizeRoles(Permissions.VIEW_OPERATIONS), medicalController.getScheduledOperations);
router.post('/medical/requests/operations/:id/process', authorizeRoles(Permissions.MANAGE_OPERATIONS), medicalController.processOperationRequest);
router.post('/medical/requests/operations/:id/confirm', authorizeRoles(Permissions.MANAGE_OPERATIONS), medicalController.confirmOperation);
router.post('/medical/requests/operations/:id/complete', authorizeRoles(Permissions.MANAGE_OPERATIONS), medicalController.completeOperation);


// --- CONFIGURATION ROUTES (Admin Only) ---
// ... existing code ...
