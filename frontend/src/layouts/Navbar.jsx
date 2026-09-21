import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LogOut, Menu, User, Shield, ChevronDown } from 'lucide-react';
import { Badge } from '../components/common/Badge.jsx';
import { ConfirmDialog } from '../components/common/ConfirmDialog.jsx';
import { NotificationBell } from '../components/notifications/NotificationBell.jsx';

export const Navbar = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    logout();
  };

  return (
    <>
      <header className="sticky top-0 z-30 h-16 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between shadow-sm">
        {/* Mobile menu button & Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-2 -ml-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 lg:hidden focus:outline-none"
            aria-label="Toggle navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Dashboard</span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-medium text-brand-600">Enterprise Console</span>
          </div>
        </div>

        {/* User profile dropdown & Logout */}
        <div className="flex items-center gap-3">
          <NotificationBell />
          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-100 transition-colors text-left focus:outline-none"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-brand-100">
                  {user.firstName?.[0] || 'U'}
                </div>
                <div className="hidden md:block">
                  <div className="text-sm font-semibold text-slate-800 leading-tight">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                </div>
                <Badge variant="brand" size="sm" className="hidden sm:inline-flex">
                  {user.roleName}
                </Badge>
                <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
              </button>

              {/* Dropdown popup */}
              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white shadow-xl border border-slate-200 py-2 z-50 animate-fade-in">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Signed in as</p>
                      <p className="text-sm font-semibold text-slate-900 truncate mt-1">{user.email}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-brand-600 font-semibold bg-brand-50 px-2 py-1 rounded-lg inline-flex">
                        <Shield className="w-3.5 h-3.5" />
                        <span>{user.roleName}</span>
                      </div>
                    </div>

                    <div className="py-1 border-b border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          navigate('/profile');
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium transition-colors"
                      >
                        <User className="w-4 h-4 text-slate-500" />
                        <span>My Profile</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        setShowLogoutConfirm(true);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleConfirmLogout}
        title="Sign Out"
        message="Are you sure you want to log out of TaskNera HRMS?"
        confirmText="Sign Out"
        variant="danger"
      />
    </>
  );
};
