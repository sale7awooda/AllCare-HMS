import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export const PatientTest = () => {
  const [patients, setPatients] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getPatients()
      .then(data => {
        console.log('Patients from API:', data);
        setPatients(data);
      })
      .catch(err => {
        console.error('API Error:', err);
        setError(err.message);
      });
  }, []);

  return (
    <div className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Patient Test</h2>
      {error && <p className="text-red-500">Error: {error}</p>}
      <pre className="bg-slate-100 p-2 rounded">{JSON.stringify(patients, null, 2)}</pre>
    </div>
  );
};
