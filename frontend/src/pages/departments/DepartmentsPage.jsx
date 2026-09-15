import React, { useEffect, useState } from 'react';
import { employeeService } from '../../services/employeeService.js';
import { Briefcase, Award, Building2, Users, Search } from 'lucide-react';
import { DataTable } from '../../components/common/DataTable.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Input } from '../../components/common/Input.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';

export const DepartmentsPage = () => {
  const [metadata, setMetadata] = useState({ departments: [], designations: [], organizations: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('departments'); // 'departments' | 'designations'
  const [searchTerm, setSearchTerm] = useState('');

  const fetchMeta = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await employeeService.getMetadata();
      setMetadata(data);
    } catch (err) {
      setError(err.message || 'Failed to load organizational units.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeta();
  }, []);

  const filteredDepartments = metadata.departments.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDesignations = metadata.designations.filter(
    (ds) =>
      ds.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ds.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const deptColumns = [
    {
      header: 'Department',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">{row.name}</div>
            <div className="text-xs text-slate-400 font-mono">{row.code}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Organization',
      accessor: 'orgId',
      render: (row) => {
        const org = metadata.organizations.find((o) => o.id === row.orgId);
        return org ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-700">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>{org.name}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        );
      },
    },
    {
      header: 'Description',
      accessor: 'description',
      render: (row) => (
        <span className="text-xs text-slate-600 max-w-md truncate block">
          {row.description || 'Core operational departmental unit.'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: () => <Badge variant="success">Active</Badge>,
    },
  ];

  const desigColumns = [
    {
      header: 'Designation Title',
      accessor: 'title',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">{row.title}</div>
            <div className="text-xs text-slate-400 font-mono">{row.code}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Department / Scope',
      accessor: 'deptId',
      render: (row) => {
        const dept = metadata.departments.find((d) => d.id === row.deptId);
        return (
          <span className="text-xs font-medium text-slate-700">
            {dept?.name || 'General Operations'}
          </span>
        );
      },
    },
    {
      header: 'Classification',
      accessor: 'level',
      render: () => <Badge variant="brand">Standard Staff</Badge>,
    },
    {
      header: 'Status',
      accessor: 'status',
      render: () => <Badge variant="success">Active</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-indigo-600" />
            Departments & Designations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational hierarchy, departmental units, and standardized corporate job titles.
          </p>
        </div>

        {/* Tab switch */}
        <div className="inline-flex rounded-xl bg-slate-200/70 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('departments')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'departments'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Departments ({metadata.departments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('designations')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'designations'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Designations ({metadata.designations.length})
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <Input
          placeholder={`Search ${activeTab}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          icon={Search}
        />
      </div>

      {/* Table based on active tab */}
      {activeTab === 'departments' ? (
        <DataTable
          columns={deptColumns}
          data={filteredDepartments}
          isLoading={loading}
          error={error}
          emptyTitle="No departments found"
        />
      ) : (
        <DataTable
          columns={desigColumns}
          data={filteredDesignations}
          isLoading={loading}
          error={error}
          emptyTitle="No designations found"
        />
      )}
    </div>
  );
};
