import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CustomerApp from './customer/CustomerApp';
import AdminApp from './admin/AdminApp';

export default function App() {
  const [role, setRole] = useState<'user' | 'admin' | null>(null);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*" element={<AdminApp role={role} onLogin={setRole} onLogout={() => setRole(null)} />} />
        <Route path="*" element={<CustomerApp role={role} onLogin={setRole} onLogout={() => setRole(null)} />} />
      </Routes>
    </BrowserRouter>
  );
}
