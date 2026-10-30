import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import { Search, Bell, User, LogOut, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AppHeaderProps {
  title: string;
  onMobileMenuToggle?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ title, onMobileMenuToggle }) => {
  const { user, logout } = useAuth();
  const { openSearch } = useModal();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 bg-[#F2E7D5]/90 backdrop-blur-md border-b border-[#DDE5DA] px-4 sm:px-8 py-3.5 flex items-center justify-between">
      {/* Title & Mobile Toggle */}
      <div className="flex items-center gap-3">
        {onMobileMenuToggle && (
          <button
            onClick={onMobileMenuToggle}
            className="lg:hidden p-2 text-[#47634C] hover:bg-[#E7F0E4] rounded-xl transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-xl sm:text-2xl font-bold text-[#26352A] tracking-tight">{title}</h1>
      </div>

      {/* Right Action Bar */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Global Search */}
        <button
          onClick={openSearch}
          className="hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 bg-white border border-[#DDE5DA] rounded-xl text-xs text-[#66736A] hover:border-[#47634C] transition-colors shadow-2xs"
        >
          <Search className="w-4 h-4 text-[#47634C]" />
          <span>Search Medrynx...</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#F8F3EA] text-[#47634C] border border-[#DDE5DA] rounded-md">
            Ctrl K
          </kbd>
        </button>
        <button onClick={openSearch} className="sm:hidden p-2 text-[#47634C] hover:bg-[#E7F0E4] rounded-xl">
          <Search className="w-5 h-5" />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              if (user?.role === 'patient') navigate('/patient/notifications');
              else setIsNotifOpen(!isNotifOpen);
            }}
            className="relative p-2 text-[#47634C] hover:bg-[#E7F0E4] rounded-xl transition-colors"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#C85C5C] border-2 border-white rounded-full" />
          </button>
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 pl-2 border-l border-[#DDE5DA]"
            aria-label="Open user menu"
          >
            <div className="w-8 h-8 rounded-full bg-[#47634C] text-[#A8CBA0] flex items-center justify-center font-bold text-xs shadow-xs">
              {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <div className="hidden md:block text-left">
              <span className="text-xs font-bold text-[#26352A] block leading-tight">{user?.name}</span>
              <span className="text-[10px] text-[#66736A] capitalize font-medium">{user?.role}</span>
            </div>
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-[#DDE5DA] rounded-2xl shadow-xl py-2 z-50">
              <div className="px-3.5 py-2 border-b border-[#DDE5DA]">
                <p className="text-xs font-bold text-[#26352A] truncate">{user?.name}</p>
                <p className="text-[10px] text-[#66736A] truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-[#C85C5C] hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
