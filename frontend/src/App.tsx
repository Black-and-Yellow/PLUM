import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { SubmitClaim } from './pages/SubmitClaim';
import { ClaimDetails } from './pages/ClaimDetails';
import { PolicyAdmin } from './pages/PolicyAdmin';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/submit" element={<SubmitClaim />} />
          <Route path="/claim/:id" element={<ClaimDetails />} />
          <Route path="/admin" element={<PolicyAdmin />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
