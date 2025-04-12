"use client";

import { useState, useEffect } from 'react';
import { FaTimes, FaSave, FaCog } from 'react-icons/fa';
import { createPortal } from 'react-dom';

export interface StoreSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  taxRate: number;
  currency: string;
  receiptFooter: string;
  logo: string; // URL or base64
}

const defaultSettings: StoreSettings = {
  storeName: 'PharmaSynx',
  storeAddress: '123 Main Street, City',
  storePhone: '123-456-7890',
  storeEmail: 'contact@PharmaSynx.com',
  taxRate: 0,
  currency: 'Rs.',
  receiptFooter: 'Thank you for your purchase!\nProducts once sold cannot be returned.',
  logo: '/logo.png'
};

interface StoreSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const StoreSettingsModal: React.FC<StoreSettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    setMounted(true);
    loadSettings();
  }, []);

  const loadSettings = () => {
    try {
      const savedSettings = localStorage.getItem('storeSettings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
        setLogoPreview(parsedSettings.logo);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      setError('Failed to load settings');
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);
      
      // Save to localStorage
      localStorage.setItem('storeSettings', JSON.stringify(settings));
      
      // Publish an event so other components can update
      const event = new CustomEvent('storeSettingsUpdated', { detail: settings });
      window.dispatchEvent(event);
      
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) { // Limit to 1MB
      setError('Logo image is too large. Maximum size is 1MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Logo = reader.result as string;
      setSettings({...settings, logo: base64Logo});
      setLogoPreview(base64Logo);
    };
    reader.readAsDataURL(file);
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 bg-teal-600 text-white flex justify-between items-center rounded-t-lg">
          <h2 className="text-xl font-bold flex items-center">
            <FaCog className="mr-2" /> Store Settings
          </h2>
          <button onClick={onClose} className="text-white hover:text-red-200 transition-colors">
            <FaTimes size={24} />
          </button>
        </div>
        
        <div className="p-6">
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4 rounded">
              {success}
            </div>
          )}
          
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); onClose();}}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 text-gray-800">
              <div>
                <label className="block text-gray-800 mb-2">Store Name</label>
                <input 
                  type="text"
                  value={settings.storeName}
                  onChange={(e) => setSettings({...settings, storeName: e.target.value})}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-700 mb-2">Phone Number</label>
                <input 
                  type="text"
                  value={settings.storePhone}
                  onChange={(e) => setSettings({...settings, storePhone: e.target.value})}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              
              <div className="col-span-1 md:col-span-2">
                <label className="block text-gray-700 mb-2">Store Address</label>
                <input 
                  type="text"
                  value={settings.storeAddress}
                  onChange={(e) => setSettings({...settings, storeAddress: e.target.value})}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 mb-2">Email Address</label>
                <input 
                  type="email"
                  value={settings.storeEmail}
                  onChange={(e) => setSettings({...settings, storeEmail: e.target.value})}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 mb-2">Currency Symbol</label>
                <input 
                  type="text"
                  value={settings.currency}
                  onChange={(e) => setSettings({...settings, currency: e.target.value})}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Rs."
                  maxLength={5}
                />
              </div>
              
              <div>
                <label className="block text-gray-700 mb-2">Tax Rate (%)</label>
                <input 
                  type="number"
                  value={settings.taxRate}
                  onChange={(e) => setSettings({...settings, taxRate: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 mb-2">
                  Store Logo
                  <span className="text-xs text-gray-500 ml-2">(Max 1MB)</span>
                </label>
                <div className="flex items-center space-x-4">
                  {logoPreview && (
                    <div className="h-16 w-16 border rounded overflow-hidden">
                      <img 
                        src={logoPreview} 
                        alt="Store Logo" 
                        className="h-full w-full object-contain"
                      />
                    </div>
                  )}
                  <label className="cursor-pointer px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors">
                    Upload Logo
                    <input 
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleLogoUpload}
                    />
                  </label>
                </div>
              </div>
              
              <div className="col-span-1 md:col-span-2">
                <label className="block text-gray-700 mb-2">Receipt Footer Text</label>
                <textarea 
                  value={settings.receiptFooter}
                  onChange={(e) => setSettings({...settings, receiptFooter: e.target.value})}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                  rows={3}
                  placeholder="Thank you message or return policy..."
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors flex items-center"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <FaSave className="mr-2" />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default StoreSettingsModal;
export { defaultSettings };