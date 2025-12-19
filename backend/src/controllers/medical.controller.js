
exports.completeOperation = (req, res) => {
    const { id } = req.params;
    try {
        db.prepare("UPDATE operations SET status = 'completed' WHERE id = ?").run(id);
        res.json({success: true});
    } catch(e) {
        res.status(500).json({error: e.message});
    }
};

exports.payOperationShare = (req, res) => {
    const { id } = req.params;
    const { targetType, targetIndex, amount, method, notes } = req.body; 
    // targetType: 'surgeon' | 'participant'
    // targetIndex: index in participants array (if targetType is participant)

    const tx = db.transaction(() => {
        const op = db.prepare('SELECT * FROM operations WHERE id = ?').get(id);
        if (!op) throw new Error('Operation not found');

        let details = {};
        try { details = JSON.parse(op.cost_details); } catch(e) { throw new Error('Invalid cost details'); }

        let payeeName = '';
        let description = '';

        if (targetType === 'surgeon') {
            if (details.surgeonPaid) throw new Error('Surgeon fee already paid');
            details.surgeonPaid = true;
            details.surgeonPaidDate = new Date().toISOString();
            payeeName = 'Lead Surgeon'; // Or fetch actual name if stored separately, but usually linked to operation doctor_id
            
            // Try to resolve surgeon name
            const doctor = db.prepare('SELECT full_name FROM medical_staff WHERE id = ?').get(op.doctor_id);
            if(doctor) payeeName = doctor.full_name;

            description = `Surgeon Fee Payout: ${op.operation_name} - ${payeeName}`;
        } else if (targetType === 'participant') {
            if (!details.participants || !details.participants[targetIndex]) throw new Error('Participant not found');
            if (details.participants[targetIndex].isPaid) throw new Error('Participant already paid');
            
            details.participants[targetIndex].isPaid = true;
            details.participants[targetIndex].paidDate = new Date().toISOString();
            payeeName = details.participants[targetIndex].name;
            description = `Surgical Team Payout (${details.participants[targetIndex].role}): ${payeeName} - ${op.operation_name}`;
        } else {
            throw new Error('Invalid target type');
        }

        // 1. Update Operation JSON
        db.prepare('UPDATE operations SET cost_details = ? WHERE id = ?').run(JSON.stringify(details), id);

        // 2. Create Expense Transaction
        db.prepare(`
            INSERT INTO transactions (type, category, amount, method, reference_id, date, description)
            VALUES ('expense', 'Operation Payout', ?, ?, ?, datetime('now'), ?)
        `).run(amount, method, id, description);
    });

    try {
        tx();
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
};

// --- ADMISSIONS ---
exports.getActiveAdmissions = (req, res) => {
