"use client";

import React, { useState, useEffect } from 'react';
import { defaultSettings, StoreSettings } from './StoreSettings';

import Image from 'next/image';
import { 
  FaSync, 
  FaTachometerAlt, 
  FaHome, 
  FaShoppingCart, 
  FaBoxOpen, 
  FaChartBar,
  FaExclamationTriangle,
  FaCog
} from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import StoreSettingsModal from './StoreSettings';

interface CommonHeaderProps {
  activePage: 'home' | 'dashboard';
  onRefresh?: () => void;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

const CommonHeader: React.FC<CommonHeaderProps> = ({ 
  activePage, 
  onRefresh,
  activeTab,
  setActiveTab 
}) => {
  const router = useRouter();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(defaultSettings);

    // Load store settings
    useEffect(() => {
        try {
            const savedSettings = localStorage.getItem('storeSettings');
            if (savedSettings) {
                setStoreSettings(JSON.parse(savedSettings));
            }
        } catch (err) {
            console.error('Error loading store settings:', err);
        }
    }, []);

    // Listen for store settings updates
    useEffect(() => {
        const handleSettingsUpdate = (event: CustomEvent<StoreSettings>) => {
            setStoreSettings(event.detail);
        };
        
        window.addEventListener('storeSettingsUpdated', handleSettingsUpdate as EventListener);
        
        return () => {
            window.removeEventListener('storeSettingsUpdated', handleSettingsUpdate as EventListener);
        };
    }, []);
  
  // Navigation functions
  const navigateToHome = () => {
    router.push('/');
  };

  const navigateToDashboard = () => {
    router.push('/dashboard');
  };
  
  // Handle refresh button click
  const handleRefresh = () => {
    if (onRefresh) onRefresh();
  };

  // Handle tab change
  const handleTabChange = (tab: string) => {
    if (setActiveTab) {
      setActiveTab(tab);
    }
  };

  return (
    <header className=" text-white z-50 bg-teal-700">
      {/* Main Header */}
      <div className="py-2 px-6 ">
        <div className="container mx-auto">
          <div className="flex justify-between items-center">
            {/* Left Section: Navigation */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center rounded-lg overflow-hidden">
                {activePage === 'home' ? (
                  <button 
                    className="bg-teal-600 hover:bg-teal-800 text-white px-4 py-2 flex items-center"
                    onClick={navigateToDashboard}
                  >
                    <FaTachometerAlt className="mr-2" />
                    Dashboard
                  </button>
                ) : (
                  <button 
                    className="bg-teal-600 hover:bg-teal-800 text-white px-4 py-2 flex items-center"
                    onClick={navigateToHome}
                  >
                    <FaHome className="mr-2" />
                    POS
                  </button>
                )}
              </div>
            </div>

            {/* Logo - Center */}
            <div className=" text-white text-center cursor-pointer" onClick={navigateToHome}>
             { /* <Image src="/logo.png" alt="PharmaSynx" width={192} height={64} priority /> */}
             <h1 className='font-bold text-5xl  '>{storeSettings.storeName}</h1>
            </div>

            {/* Right Section: Refresh Button and Settings */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                className="bg-teal-600 hover:bg-teal-800 text-white p-3 rounded-full "
                title="Refresh Data"
              >
                <FaSync />
              </button>
              
              <button
                onClick={() => setShowSettingsModal(true)}
                className="bg-teal-600 hover:bg-teal-800 text-white p-3 rounded-full"
                title="Store Settings"
              >
                <FaCog />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Tabs - Only shown on dashboard page */}
      {activePage === 'dashboard' && (
        <div className="bg-teal-800 shadow-sm  mt-1 ">
          <div className="container mx-auto">
            <div className="flex overflow-x-auto ">
              <button 
                onClick={() => handleTabChange('overview')} 
                className={`px-5 py-2 font-medium  ${activeTab === 'overview' 
                  ? 'bg-white text-teal-700' 
                  : 'bg-transparent hover:bg-teal-600 text-white'}`}
              >
                <FaTachometerAlt className="inline mr-2" />
                Overview
              </button>
              <button 
                onClick={() => handleTabChange('sales')} 
                className={`px-5 py-2 font-medium ${activeTab === 'sales' 
                  ? 'bg-white text-teal-700' 
                  : 'bg-transparent hover:bg-teal-600 text-white'}`}
              >
                <FaShoppingCart className="inline mr-2" />
                Sales
              </button>
              <button 
                onClick={() => handleTabChange('inventory')} 
                className={`px-5 py-2 font-medium ${activeTab === 'inventory' 
                  ? 'bg-white text-teal-700' 
                  : 'bg-transparent hover:bg-teal-600 text-white'}`}
              >
                <FaBoxOpen className="inline mr-2" />
                Inventory
              </button>
              <button 
                onClick={() => handleTabChange('stock')} 
                className={`px-5 py-2 font-medium ${activeTab === 'stock' 
                  ? 'bg-white text-teal-700' 
                  : 'bg-transparent hover:bg-teal-600 text-white'}`}
              >
                <FaBoxOpen className="inline mr-2" />
                Stock Management
              </button>
              <button 
                onClick={() => handleTabChange('alerts')} 
                className={`px-5 py-2 font-medium ${activeTab === 'alerts' 
                  ? 'bg-white text-teal-700' 
                  : 'bg-transparent hover:bg-teal-600 text-white'}`}
              >
                <FaExclamationTriangle className="inline mr-2" />
                Inventory Alerts
              </button>
              <button 
                onClick={() => handleTabChange('reports')} 
                className={`px-5 py-2 font-medium ${activeTab === 'reports' 
                  ? 'bg-white text-teal-700' 
                  : 'bg-transparent hover:bg-teal-600 text-white'}`}
              >
                <FaChartBar className="inline mr-2" />
                Reports
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Settings Modal */}
      <StoreSettingsModal 
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </header>
  );
};

export default CommonHeader;