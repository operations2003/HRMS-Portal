import React from 'react';
import { ShieldCheck, User, Mail, Key } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { Avatar } from '../common/Avatar.jsx';

export const UserPermissionsViewModal = ({ isOpen, onClose, user }) => {
  if (!user) return null;

  const permissions = user.permissions || [];
  const isAdminRole = user.roleName === 'Admin' || user.roleName === 'SuperAdmin';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Effective User Permissions"
      subtitle={`Assigned permissions for ${user.firstName} ${user.lastName}`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {/* User Summary Card */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar
              src={user.avatarUrl}
              firstName={user.firstName}
              lastName={user.lastName}
              size="md"
              shape="rounded"
              fallbackGradient="bg-slate-800 text-white"
            />
            <div>
              <p className="text-xs font-semibold text-slate-900">{user.firstName} {user.lastName}</p>
              <p className="text-[11px] text-slate-500 font-mono">{user.email}</p>
            </div>
          </div>
          <Badge variant="brand">{user.roleName || 'Employee'}</Badge>
        </div>

        <div>
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
            <span className="text-xs font-bold text-slate-700">
              Granted Permissions ({permissions.length})
            </span>
            {isAdminRole && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Unrestricted Admin Scope
              </span>
            )}
          </div>

          {permissions.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">
              No specific granular permissions assigned directly.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto pr-1">
              {permissions.map((perm) => {
                const code = typeof perm === 'string' ? perm : perm.code || perm.name;
                return (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-1 rounded-md border border-slate-200/80"
                  >
                    <Key className="w-2.5 h-2.5 text-slate-400" />
                    {code}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
