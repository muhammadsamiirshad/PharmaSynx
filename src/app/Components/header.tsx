"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { FaBarcode, FaPlus, FaThLarge, FaBell, FaChartLine, FaTachometerAlt } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import ProductModals from './ProductModals';
import StockModals from './StockModals';

// Define the Product interface
interface Product {
    id: string;
    name: string;
    stock: number;
    expiry_date?: string;
}

const Header: React.FC = () => {
    const router = useRouter();
    const [showAddProductModal, setShowAddProductModal] = useState(false);
    const [showListProductModal, setShowListProductModal] = useState(false);
    const [showStockModal, setShowStockModal] = useState(false);
    const [showAddStockModal, setShowAddStockModal] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<{
        outOfStock: Product[];
        expired: Product[];
        lowStock: Product[];
    }>({
        outOfStock: [],
        expired: [],
        lowStock: []
    });

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/products');
                if (!response.ok) {
                    throw new Error('Failed to fetch products');
                }

                const products = await response.json();
                
                // Current date for expiry comparison
                const currentDate = new Date();
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(currentDate.getDate() + 30); // For calculating products expiring soon
                
                // Filter products
                const outOfStock = products.filter((p: Product) => p.stock <= 0);
                const lowStock = products.filter((p: Product) => p.stock > 0 && p.stock <= 5);
                
                // Filter expired products that have an expiry_date
                const expired = products.filter((p: Product) => {
                    if (!p.expiry_date) return false;
                    const expiryDate = new Date(p.expiry_date);
                    return expiryDate <= currentDate;
                });
                
                setNotifications({
                    outOfStock,
                    expired,
                    lowStock
                });
                
            } catch (error) {
                console.error('Error fetching notifications:', error);
            }
        };
        
        fetchNotifications();
        
        // Set up an interval to refresh notifications
        const intervalId = setInterval(fetchNotifications, 30000); // refresh every 30 seconds
        
        return () => clearInterval(intervalId);
    }, []);
    
    // Calculate total notification count
    const notificationCount = 
        notifications.outOfStock.length + 
        notifications.expired.length +
        notifications.lowStock.length;

    const navigateToDashboard = () => {
        router.push('/dashboard');
    };

    const navigateToHome = () => {
        router.push('/');
    };

    return (
        <div className="flex justify-between items-center px-6 bg-teal-700 py-2">
            {/* Left Section: Products & Dashboard */}
            <div className="flex items-center space-x-3">
                <div className="flex items-center rounded-lg overflow-hidden">
                    <button 
                        className="bg-teal-600 hover:bg-teal-800 text-white px-4 py-2 flex items-center"
                        onClick={() => setShowAddProductModal(true)}
                    >
                        <FaPlus className="mr-2" />
                        Add Products
                    </button>
                    <button 
                        className="bg-teal-500 hover:bg-teal-700 text-white px-4 py-2 flex items-center"
                        onClick={() => setShowListProductModal(true)}
                    >
                        <FaBarcode className="mr-2" />
                        Products
                    </button>
                </div>
                
                {/* Dashboard Button */}
                <div className="flex items-center rounded-lg overflow-hidden">
                    <button 
                        className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 flex items-center"
                        onClick={navigateToDashboard}
                    >
                        <FaTachometerAlt className="mr-2" />
                        Dashboard
                    </button>
                </div>
            </div>

            {/* Logo - Center */}
            <div className="w-48 h-20 text-white text-center rounded-lg cursor-pointer" onClick={navigateToHome}>
                <Image src="/logo.png" alt="PharmaSynx" width={192} height={80} priority />
            </div>

            {/* Right Section: Stock & Notifications */}
            <div className="flex items-center gap-3">
                <div className="flex items-center rounded-lg overflow-hidden">
                    <button 
                        className="bg-teal-600 hover:bg-teal-800 text-white px-4 py-2 flex items-center"
                        onClick={() => setShowAddStockModal(true)}
                    >
                        <FaPlus className="mr-2" />
                        Add Stock
                    </button>
                    <button 
                        className="bg-teal-500 hover:bg-teal-700 text-white px-4 py-2 flex items-center"
                        onClick={() => setShowStockModal(true)}
                    >
                        <FaThLarge className="mr-2" />
                        View Stock
                    </button>
                </div>
                
                {/* Notifications bell */}
                <div className="relative">
                    <button 
                        className="bg-teal-600 hover:bg-teal-800 text-white p-3 rounded-full flex items-center justify-center"
                        onClick={() => setShowNotifications(!showNotifications)}
                    >
                        <FaBell className="text-xl" />
                        {notificationCount > 0 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-xs font-bold text-white rounded-full h-5 w-5 flex items-center justify-center">
                                {notificationCount}
                            </span>
                        )}
                    </button>
                    
                    {/* Notifications dropdown */}
                    {showNotifications && notificationCount > 0 && (
                        <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                            <div className="p-3 border-b border-gray-200">
                                <h3 className="font-bold text-gray-700">Notifications</h3>
                            </div>
                            
                            <div className="max-h-60 overflow-y-auto p-2">
                                {notifications.outOfStock.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold text-red-600 px-2 pt-2">Out of Stock Products</h4>
                                        <ul className="mb-2">
                                            {notifications.outOfStock.slice(0, 5).map((product) => (
                                                <li key={product.id} className="px-2 py-1 hover:bg-gray-100 text-sm">
                                                    {product.name} - <span className="text-red-500 font-medium">Out of stock</span>
                                                </li>
                                            ))}
                                            {notifications.outOfStock.length > 5 && (
                                                <li className="px-2 py-1 text-xs text-gray-500">
                                                    + {notifications.outOfStock.length - 5} more items
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                                
                                {notifications.lowStock.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold text-amber-600 px-2 pt-2">Low Stock Products</h4>
                                        <ul className="mb-2">
                                            {notifications.lowStock.slice(0, 5).map((product) => (
                                                <li key={product.id} className="px-2 py-1 hover:bg-gray-100 text-sm">
                                                    {product.name} - <span className="text-amber-600 font-medium">Only {product.stock} left</span>
                                                </li>
                                            ))}
                                            {notifications.lowStock.length > 5 && (
                                                <li className="px-2 py-1 text-xs text-gray-500">
                                                    + {notifications.lowStock.length - 5} more items
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                                
                                {notifications.expired.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold text-red-600 px-2 pt-2">Expired Products</h4>
                                        <ul className="mb-2">
                                            {notifications.expired.slice(0, 5).map((product) => (
                                                <li key={product.id} className="px-2 py-1 hover:bg-gray-100 text-sm">
                                                    {product.name} - <span className="text-red-600 font-medium">Expired</span>
                                                </li>
                                            ))}
                                            {notifications.expired.length > 5 && (
                                                <li className="px-2 py-1 text-xs text-gray-500">
                                                    + {notifications.expired.length - 5} more items
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                            
                            <div className="p-2 border-t border-gray-200">
                                <button 
                                    onClick={navigateToDashboard}
                                    className="w-full text-center py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
                                >
                                    View All in Dashboard
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {(showListProductModal || showAddProductModal) && (
                <ProductModals 
                    showAddModal={showAddProductModal}
                    showListModal={showListProductModal}
                    setShowAddModal={setShowAddProductModal}
                    setShowListModal={setShowListProductModal}
                />
            )}

            {(showStockModal || showAddStockModal) && (
                <StockModals 
                    showStockModal={showStockModal}
                    showAddStockModal={showAddStockModal}
                    setShowStockModal={setShowStockModal}
                    setShowAddStockModal={setShowAddStockModal} 
                />
            )}
        </div>
    );
};

export default Header;