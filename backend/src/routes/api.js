
// ... existing code ...
router.get('/lab/requests', authorizeRoles(Permissions.VIEW_LABORATORY), medicalController.getLabRequests); // Updated handler name
router.post('/lab/requests', authorizeRoles(Permissions.MANAGE_LABORATORY), medicalController.createLabRequest);
router.post('/lab/requests/:id/complete', authorizeRoles(Permissions.MANAGE_LABORATORY), medicalController.completeLabRequest); // Added

router.get('/nurse/requests', authorizeRoles(Permissions.VIEW_DASHBOARD), medicalController.getNurseRequests);
// ... existing code ...
