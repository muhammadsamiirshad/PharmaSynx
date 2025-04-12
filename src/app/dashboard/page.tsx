"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import * as XLSX from 'xlsx';
import ClientOnly from '../Components/ClientOnly';
import ProductModals from '../Components/ProductModals';
import StockModals from '../Components/StockModals';
import ReceiptModal from '../Components/ReceiptModal';
import CommonHeader from '../Components/CommonHeader';
import { 
    FaTachometerAlt, FaChartBar, FaBoxOpen, FaShoppingCart, FaExclamationTriangle, 
    FaArrowUp, FaArrowDown, FaTag, FaCalendarAlt, FaSyncAlt, FaHome, FaPlus, FaEdit,
    FaTrash, FaPrint, FaSearch, FaDownload, FaFilter, FaTimes, FaBars, FaEye,
    FaCheckCircle, FaFileExport, FaReceipt
} from 'react-icons/fa';
import Reports from '../Components/Reports';
import InventoryAlerts from '../Components/InventoryAlerts';
import Toast from '../Components/Toast';
import ClearDataButton from '../Components/ClearDataButton';

// Dynamic import for client-only chart components
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface CartItem {
    id: string;
    name: string;
    qty: number;
    price: number;
    unit: string;
}

interface SalesData {
    id: string;
    date: string;
    total: number;
    subtotal: number;
    discount: number;
    items: Array<{
        product_id: string;
        name: string;
        quantity: number;
        price: number;
        unit: string;
    }>;
}

// Update your ProductData interface to match the Product interface in ProductModals
interface ProductData {
    id: number; // Changed from string to number for SQLite
    name: string;
    description: string;
    category: string;
    price: number;
    stock: number;
    unit: string;
    defaultQty: number;
    photo: string; // Remove optional
    expiry_date?: string;
}

interface SalesAnalytics {
    totalSales: number;
    totalRevenue: number;
    averageOrderValue: number;
    todaysSales: number;
    weeklyChange: number;
}

const Dashboard: React.FC = () => {
    // Use the hooks directly without unwrapping
    const searchParams = useSearchParams();
    const params = useParams();
    
    const router = useRouter();
    const [salesData, setSalesData] = useState<SalesData[]>([]);
    const [productData, setProductData] = useState<ProductData[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<ProductData[]>([]);
    const [analytics, setAnalytics] = useState<SalesAnalytics>({
        totalSales: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        todaysSales: 0,
        weeklyChange: 0
    });
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<string>('overview');
    const [dashboardRefreshKey, setDashboardRefreshKey] = useState<number>(0);
    const [dateRange, setDateRange] = useState<{start: string, end: string}>({
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    
    // Product filter states
    const [categoryFilter, setCategoryFilter] = useState<string>("");
    const [searchFilter, setSearchFilter] = useState<string>("");

    // Use with window check to avoid hydration errors with SSR
    const isClient = typeof window !== 'undefined';

    const [selectedSale, setSelectedSale] = useState<SalesData | null>(null);
    const [showSaleDetails, setShowSaleDetails] = useState<boolean>(false);

    // States for ProductModals
    const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
    const [showListProductModal, setShowListProductModal] = useState<boolean>(false);
    const [showEditModal, setShowEditModal] = useState<boolean>(false);
    const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState<boolean>(false);
    const [editingProduct, setEditingProduct] = useState<ProductData | undefined>(undefined);

    // States for StockModals
    const [showStockModal, setShowStockModal] = useState<boolean>(false);
    const [showAddStockModal, setShowAddStockModal] = useState<boolean>(false);
    const [stockProduct, setStockProduct] = useState<ProductData | undefined>(undefined);

    // State for Receipt view
    const [viewReceipt, setViewReceipt] = useState<boolean>(false);

    // New state for search
    const [salesSearchTerm, setSalesSearchTerm] = useState<string>('');

    // Add these states for toast management
    const [toastState, setToastState] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Add this helper function - renamed from toast to toastActions to avoid conflict
    const toastActions = {
        success: (message: string) => {
            setToastState({ message, type: 'success' });
            setTimeout(() => setToastState(null), 3000);
        },
        error: (message: string) => {
            setToastState({ message, type: 'error' });
            setTimeout(() => setToastState(null), 3000);
        },
        info: (message: string) => {
            setToastState({ message, type: 'info' });
            setTimeout(() => setToastState(null), 3000);
        }
    };

    // Create a filtered sales data array
    const filteredSalesData = useMemo(() => {
        if (!salesSearchTerm.trim()) {
            return salesData;
        }
        
        return salesData.filter(sale => 
            sale.id.toString().includes(salesSearchTerm)
        );
    }, [salesData, salesSearchTerm]);

    // Navigation functions
    const navigateToHome = () => {
        router.push('/');
    };

    // Print handling function
    const handlePrint = () => {
        window.print();
        setViewReceipt(false);
    };

    // Function to show receipt modal
    const handleViewReceiptModal = (sale: SalesData) => {
        setSelectedSale(sale);
        setViewReceipt(true);
    };

    // Convert sale items to the format expected by ReceiptModal
    const convertSaleItemsToCartItems = (saleItems: any[]): CartItem[] => {
        return saleItems.map(item => ({
            id: item.product_id || '',
            name: item.name || '',
            qty: item.quantity || 0,
            price: item.price || 0,
            unit: item.unit || ''
        }));
    };

    // Calculate subtotal for the selected sale
    const calculateSaleSubtotal = (): string => {
        if (!selectedSale) return '0.00';
        const subtotal = selectedSale.subtotal || 0;
        return parseFloat(subtotal.toString()).toFixed(2);
    };

    // Calculate total for the selected sale
    const calculateSaleTotal = (): string => {
        if (!selectedSale) return '0.00';
        const total = selectedSale.total || 0;
        return parseFloat(total.toString()).toFixed(2);
    };

    // A dummy function that resolves immediately since we're viewing an existing sale
    const dummySaveSale = async (): Promise<boolean> => {
        return true;
    };

    // Sale view and print functions
    const handleViewSale = (sale: SalesData) => {
        setSelectedSale(sale);
        setShowSaleDetails(true);
    };

    // Update this function in the Dashboard component
    const handlePrintReceipt = (sale: SalesData) => {
        // First try to get store settings from localStorage
        let storeSettings;
        try {
            const savedSettings = localStorage.getItem('storeSettings');
            if (savedSettings) {
                storeSettings = JSON.parse(savedSettings);
            } else {
                // Use default settings if none found
                storeSettings = {
                    storeName: 'PharmaSynx',
                    storeAddress: '123 Main Street, City',
                    storePhone: '123-456-7890',
                    storeEmail: '',
                    taxRate: 0,
                    currency: 'Rs.',
                    receiptFooter: 'Thank you for your purchase!\nProducts once sold cannot be returned.',
                    logo: '/logo.png'
                };
            }
        } catch (err) {
            console.error('Error loading store settings:', err);
            // Fallback to basic settings
            storeSettings = {
                storeName: 'PharmaSynx',
                storeAddress: '123 Main Street, City',
                storePhone: '123-456-7890',
                currency: 'Rs.',
                receiptFooter: 'Thank you for your purchase!'
            };
        }

        const printWin = window.open('', '_blank');
        if (printWin) {
            // Create a proper HTML document with DOCTYPE and content
            // Interfaces for type safety
            interface StoreSettings {
                storeName: string;
                storeAddress: string;
                storePhone: string;
                storeEmail?: string;
                taxRate: number;
                currency: string;
                receiptFooter: string;
                logo?: string;
            }

            interface SaleItem {
                name: string;
                quantity: number;
                unit: string;
                price: number;
            }

            interface Sale {
                id: string;
                date: string;
                items: SaleItem[];
                subtotal: number;
                discount: number;
                total: number;
            }

            // The main function remains the same but with typed parameters
            const printReceipt = (printWin: Window, sale: Sale, storeSettings: StoreSettings): void => {
                printWin.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Sales Receipt</title>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <style>
                            @page {
                                size: 80mm auto;
                                margin: 0;
                            }
                            body {
                                font-family: Arial, sans-serif;
                                margin: 0;
                                padding: 10mm 5mm;
                                width: 70mm;
                                font-size: 12px;
                                background: white;
                            }
                            .receipt-header {
                                text-align: center;
                                margin-bottom: 10px;
                            }
                            .receipt-header h2 {
                                font-size: 18px;
                                margin-bottom: 5px;
                                color: #000;
                            }
                            .receipt-header p {
                                margin: 2px 0;
                                font-size: 10px;
                                color: #333;
                            }
                            .divider {
                                border-top: 1px dashed #000;
                                margin: 5px 0;
                            }
                            .order-details {
                                margin: 10px 0;
                                text-align: center;
                            }
                            .order-number {
                                font-weight: bold;
                                font-size: 14px;
                                background-color: #f3f3f3;
                                padding: 5px;
                                border-radius: 3px;
                            }
                            .date-line {
                                display: flex;
                                justify-content: space-between;
                                margin: 5px 0;
                                font-size: 10px;
                            }
                            table {
                                width: 100%;
                                border-collapse: collapse;
                                font-size: 10px;
                            }
                            th {
                                text-align: left;
                                border-bottom: 1px solid #000;
                                padding: 3px 0;
                            }
                            th:nth-child(2), td:nth-child(2),
                            th:nth-child(3), td:nth-child(3),
                            th:nth-child(4), td:nth-child(4) {
                                text-align: right;
                            }
                            td {
                                padding: 3px 0;
                            }
                            .totals {
                                margin-top: 10px;
                                text-align: right;
                            }
                            .total-line {
                                display: flex;
                                justify-content: space-between;
                            }
                            .grand-total {
                                font-weight: bold;
                                margin-top: 5px;
                                padding-top: 5px;
                                border-top: 1px dashed #000;
                            }
                            .footer {
                                margin-top: 15px;
                                text-align: center;
                                font-size: 10px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="receipt-header">
                            <h2>${storeSettings.storeName}</h2>
                            <p>${storeSettings.storeAddress}</p>
                            <p>Phone: ${storeSettings.storePhone}</p>
                            ${storeSettings.storeEmail ? `<p>Email: ${storeSettings.storeEmail}</p>` : ''}
                        </div>
                        
                        <div class="divider"></div>
                        
                        <div class="date-line">
                            <span>Date: ${new Date(sale.date).toLocaleDateString()}</span>
                            <span>Time: ${new Date(sale.date).toLocaleTimeString()}</span>
                        </div>
                        
                        <div class="order-details">
                            <div class="order-number">Order #: ${sale.id}</div>
                        </div>
                        
                        <div class="divider"></div>
                        
                        <table>
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Qty</th>
                                    <th>Price</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sale.items.map((item: SaleItem) => `
                                    <tr>
                                        <td>${item.name}</td>
                                        <td>${item.quantity} ${item.unit}</td>
                                        <td>${storeSettings.currency} ${parseFloat(item.price.toString()).toFixed(2)}</td>
                                        <td>${storeSettings.currency} ${(item.quantity * parseFloat(item.price.toString())).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        
                        <div class="totals">
                            <div class="total-line">
                                <span>Subtotal:</span>
                                <span>${storeSettings.currency} ${parseFloat(sale.subtotal.toString()).toFixed(2)}</span>
                            </div>
                            <div class="total-line">
                                <span>Discount:</span>
                                <span>${storeSettings.currency} ${parseFloat(sale.discount.toString()).toFixed(2)}</span>
                            </div>
                            ${storeSettings.taxRate > 0 ? `
                            <div class="total-line">
                                <span>Tax (${storeSettings.taxRate}%):</span>
                                <span>${storeSettings.currency} ${((parseFloat(sale.total.toString()) * storeSettings.taxRate) / 100).toFixed(2)}</span>
                            </div>
                            ` : ''}
                            <div class="total-line grand-total">
                                <span>Total:</span>
                                <span>${storeSettings.currency} ${parseFloat(sale.total.toString()).toFixed(2)}</span>
                            </div>
                        </div>
                        
                        <div class="divider"></div>
                        
                        <div class="footer">
                            ${storeSettings.receiptFooter.split('\\n').map((line: string) => `<p>${line}</p>`).join('')}
                            <p><b>Order #: ${sale.id}</b></p>
                        </div>
                        
                        <script>
                            window.onload = () => {
                                setTimeout(() => {
                                    window.print();
                                    window.close();
                                }, 500);
                            }
                        </script>
                    </body>
                    </html>
                `);
            };

            printReceipt(printWin, sale as Sale, storeSettings as StoreSettings);

            printWin.document.close();
        }
    };

    // Add this function with your other handler functions
    const handleAddStock = (product: ProductData) => {
        setStockProduct(product);
        setShowAddStockModal(true);
    };

    // Product handling functions for inventory tab
    const handleEditProduct = (product: ProductData) => {
        setEditingProduct(product);
        // Don't show the list modal, just the edit modal
        setShowListProductModal(false); 
        setShowAddProductModal(true); // Use this to trigger the ProductModals component
    };

    const handleDeleteProduct = (productId: string) => {
        const product = productData.find(p => p.id.toString() === productId);
        if (product) {
            setSelectedProduct(product);
            setDeleteConfirmVisible(true);
        }
    };

    const confirmDeleteProduct = async () => {
        if (!selectedProduct) return;
        
        try {
            const response = await fetch(`http://localhost:5000/api/products/${selectedProduct.id}`, {
                method: 'DELETE',
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete product');
            }
            
            // Remove from local state
            setProductData(productData.filter(p => p.id !== selectedProduct.id));
            setFilteredProducts(filteredProducts.filter(p => p.id !== selectedProduct.id));
            setDeleteConfirmVisible(false);
            setSelectedProduct(null);
            
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Failed to delete product. Please try again.');
        }
    };

    const handleAddNewProduct = () => {
        setEditingProduct(undefined);
        setShowAddProductModal(true);
    };

    // Add this function to your Dashboard component
    const refreshProductData = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/products');
            if (!response.ok) throw new Error('Failed to fetch products');
            const data = await response.json();
            setProductData(data);
            setFilteredProducts(data);
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

    // Export sales to Excel
    const handleExportSales = () => {
        try {
            const worksheet = XLSX.utils.json_to_sheet(
                salesData.map(sale => ({
                    'Order ID': sale.id,
                    'Date': new Date(sale.date).toLocaleString(),
                    'Items': sale.items.length,
                    'Subtotal (Rs.)': parseFloat(sale.subtotal.toString()).toFixed(2),
                    'Discount (Rs.)': parseFloat(sale.discount.toString()).toFixed(2),
                    'Total (Rs.)': parseFloat(sale.total.toString()).toFixed(2)
                }))
            );
            
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales');
            
            // Generate filename with current date
            const date = new Date().toISOString().split('T')[0];
            const filename = `PharmaSynx_Sales_${date}.xlsx`;
            
            XLSX.writeFile(workbook, filename);
        } catch (error) {
            console.error('Error exporting sales data:', error);
            alert('Failed to export sales data. Please try again.');
        }
    };
    
    // Export inventory to Excel
    const handleExportInventory = () => {
        try {
            const worksheet = XLSX.utils.json_to_sheet(
                productData.map(product => ({
                    'ID': product.id,
                    'Product Name': product.name,
                    'Category': product.category || 'Uncategorized',
                    'Description': product.description,
                    'Price (Rs.)': parseFloat(product.price.toString()).toFixed(2),
                    'Stock': product.stock,
                    'Unit': product.unit,
                    'Default Qty': product.defaultQty
                }))
            );
            
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
            
            // Generate filename with current date
            const date = new Date().toISOString().split('T')[0];
            const filename = `PharmaSynx_Inventory_${date}.xlsx`;
            
            XLSX.writeFile(workbook, filename);
        } catch (error) {
            console.error('Error exporting inventory data:', error);
            alert('Failed to export inventory data. Please try again.');
        }
    };

    // Then use this effect to refresh data when modals close
    useEffect(() => {
        if (!showAddProductModal && !showListProductModal && !showAddStockModal && !showStockModal) {
            refreshProductData();
        }
    }, [showAddProductModal, showListProductModal, showAddStockModal, showStockModal]);

    useEffect(() => {
        if (!isClient) return;
        
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            
            try {
                // Fetch sales data
                const salesResponse = await fetch(`http://localhost:5000/api/sales`);
                if (!salesResponse.ok) throw new Error('Failed to fetch sales data');
                const salesData = await salesResponse.json();
                
                // Filter sales data by date range
                const filteredSales = salesData.filter((sale: SalesData) => {
                    const saleDate = new Date(sale.date).toISOString().split('T')[0];
                    return saleDate >= dateRange.start && saleDate <= dateRange.end;
                });
                
                setSalesData(filteredSales);
                
                // Calculate analytics
                const totalRevenue = filteredSales.reduce((sum: number, sale: SalesData) => sum + parseFloat(sale.total.toString()), 0);
                const averageOrderValue = filteredSales.length ? totalRevenue / filteredSales.length : 0;
                
                // Get today's sales
                const today = new Date().toISOString().split('T')[0];
                const todaysSales = salesData.filter((sale: SalesData) => 
                    new Date(sale.date).toISOString().split('T')[0] === today
                ).length;
                
                // Get last week's sales for comparison
                const lastWeekStart = new Date();
                lastWeekStart.setDate(lastWeekStart.getDate() - 14);
                const lastWeekEnd = new Date();
                lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
                
                const lastWeekSales = salesData.filter((sale: SalesData) => {
                    const date = new Date(sale.date);
                    return date >= lastWeekStart && date <= lastWeekEnd;
                }).length;
                
                const thisWeekSales = salesData.filter((sale: SalesData) => {
                    const date = new Date(sale.date);
                    return date > lastWeekEnd;
                }).length;
                
                const weeklyChange = lastWeekSales 
                    ? ((thisWeekSales - lastWeekSales) / lastWeekSales) * 100 
                    : 0;
                
                setAnalytics({
                    totalSales: filteredSales.length,
                    totalRevenue,
                    averageOrderValue,
                    todaysSales,
                    weeklyChange
                });
                
                // Fetch product data
                const productsResponse = await fetch('http://localhost:5000/api/products');
                if (!productsResponse.ok) throw new Error('Failed to fetch products');
                const productData = await productsResponse.json();
                
                setProductData(productData);
                setFilteredProducts(productData);
                
            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Failed to load data. Please refresh and try again.');
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [dashboardRefreshKey, dateRange, isClient]);
    
    const refreshDashboard = () => {
        setDashboardRefreshKey(prev => prev + 1);
    };

    // Filter products based on search and category filters
    const filteredInventoryProducts = useMemo(() => {
        return productData.filter(product => {
            // Apply search filter
            const matchesSearch = searchFilter === '' || 
                product.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                product.id.toString().includes(searchFilter);
            
            // Apply category filter
            const matchesCategory = categoryFilter === '' || 
                product.category === categoryFilter;
            
            return matchesSearch && matchesCategory;
        });
    }, [productData, searchFilter, categoryFilter]);
    
    // Get unique categories for filter dropdown
    const uniqueCategories = useMemo(() => {
        const categories = productData
            .map(product => product.category)
            .filter((category, index, self) => 
                category && self.indexOf(category) === index
            );
        
        return categories;
    }, [productData]);

    // Prepare chart data for sales
    const salesChartData = useMemo(() => {
        // Group sales by date
        const salesByDate: Record<string, number> = {};
        
        salesData.forEach(sale => {
            const date = new Date(sale.date).toLocaleDateString();
            salesByDate[date] = (salesByDate[date] || 0) + parseFloat(sale.total.toString());
        });
        
        // Convert to arrays for the chart
        const dates = Object.keys(salesByDate);
        const amounts = Object.values(salesByDate);
        
        return {
            options: {
                chart: {
                    id: 'sales-chart',
                    type: 'line' as const,
                    height: 350,
                    toolbar: {
                        show: false
                    }
                },
                xaxis: {
                    categories: dates,
                    labels: {
                        style: {
                            cssClass: 'text-xs text-gray-600'
                        }
                    }
                },
                yaxis: {
                    labels: {
                        formatter: function (value: number) {
                            return `Rs.${value.toFixed(0)}`;
                        }
                    }
                },
                colors: ['#0d9488'],
                stroke: {
                    curve: 'smooth' as const,
                    width: 2
                },
                title: {
                    text: 'Sales Trend',
                    align: 'left' as 'left',
                    style: {
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: '#263238'
                    }
                },
                grid: {
                    borderColor: '#e0e0e0',
                    row: {
                        colors: ['#f8f9fa', 'transparent'],
                        opacity: 0.5
                    }
                }
            },
            series: [
                {
                    name: 'Sales',
                    data: amounts
                }
            ]
        };
    }, [salesData]);

    // Product category chart data
    const categoryChartData = useMemo(() => {
        const categoryCount: Record<string, number> = {};
        
        productData.forEach(product => {
            const category = product.category || 'Uncategorized';
            categoryCount[category] = (categoryCount[category] || 0) + 1;
        });
        
        const categories = Object.keys(categoryCount);
        const counts = Object.values(categoryCount);
        
        return {
            options: {
                chart: {
                    type: 'pie' as const,
                    height: 350
                },
                labels: categories,
                responsive: [{
                    breakpoint: 480,
                    options: {
                        chart: {
                            height: 300
                        },
                        legend: {
                            position: 'bottom'
                        }
                    }
                }],
                colors: [
                    '#0d9488', '#64748b', '#0ea5e9', '#8b5cf6', '#ec4899', 
                    '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#84cc16'
                ]
            },
            series: counts
        };
    }, [productData]);

    // Prepare top selling products
    const topSellingProducts = useMemo(() => {
        // Count product occurrences in sales
        const productCounts: Record<string, { count: number, revenue: number }> = {};
        
        salesData.forEach(sale => {
            sale.items.forEach(item => {
                const productId = item.product_id;
                if (!productCounts[productId]) {
                    productCounts[productId] = { count: 0, revenue: 0 };
                }
                productCounts[productId].count += item.quantity;
                productCounts[productId].revenue += item.quantity * parseFloat(item.price.toString());
            });
        });
        
        // Convert to array and sort by count
        const sortedProducts = Object.entries(productCounts)
            .map(([productId, data]) => {
                // Look up the product in the productData array instead of salesData
                const product = productData.find(p => p.id.toString() === productId);
                
                return {
                    id: productId,
                    name: product ? product.name : 'Unknown Product',
                    count: data.count,
                    revenue: data.revenue
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // Get top 5
        
        return sortedProducts;
    }, [salesData, productData]); // Add productData as a dependency

    // Get low stock products
    const lowStockProducts = useMemo(() => {
        return productData
            .filter(product => product.stock <= 5)
            .sort((a, b) => a.stock - b.stock)
            .slice(0, 5);
    }, [productData]);

    // First, add or update this function in your Dashboard component:
    const refreshStockData = async () => {
        try {
            setLoading(true);
            await refreshProductData();
            toastActions.success("Stock data refreshed successfully");
        } catch (error) {
            console.error("Error refreshing stock data:", error);
            toastActions.error("Failed to refresh stock data");
        } finally {
            setLoading(false);
        }
    };

    // Add this function to handle successful data clearing
    const handleDataCleared = () => {
        // Refresh all data
        refreshDashboard();
        toastActions.success("All data has been cleared successfully");
    };

    // Update your existing SSE connection to handle data reset events

    // Add this function before the useEffect
    const fetchSalesData = async () => {
        try {
            const salesResponse = await fetch(`http://localhost:5000/api/sales`);
            if (!salesResponse.ok) throw new Error('Failed to fetch sales data');
            const salesData = await salesResponse.json();
            
            // Filter sales data by date range
            const filteredSales = salesData.filter((sale: SalesData) => {
                const saleDate = new Date(sale.date).toISOString().split('T')[0];
                return saleDate >= dateRange.start && saleDate <= dateRange.end;
            });
            
            setSalesData(filteredSales);
        } catch (error) {
            console.error('Error fetching sales data:', error);
            setError('Failed to load sales data');
        }
    };

    useEffect(() => {
      const eventSource = new EventSource('http://localhost:5000/api/products/updates');
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'product_update' && data.product) {
            // Existing product update logic...
          } else if (data.type === 'data_reset') {
            // Refresh data based on what was reset
            if (data.type === 'all' || !data.type) {
              refreshDashboard(); // Refresh all data
              toastActions.info("All data has been reset");
            } else if (data.type === 'sales') {
              fetchSalesData(); // Only refresh sales data
              toastActions.info("Sales data has been reset");
            } else if (data.type === 'inventory') {
              refreshProductData(); // Only refresh inventory data
              toastActions.info("Inventory data has been reset");
            }
          }
        } catch (error) {
          console.error('Error processing update:', error);
        }
      };
      
      eventSource.onerror = () => {
        eventSource.close();
        setTimeout(() => {
          eventSource.close();
        }, 5000);
      };
      
      return () => {
        eventSource.close();
      };
    }, []);

    if (loading) {
        return (
            <ClientOnly>
                <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-teal-600 mx-auto mb-4"></div>
                        <p className="text-lg text-gray-700">Loading dashboard data...</p>
                    </div>
                </div>
            </ClientOnly>
        );
    }

    return (
        <ClientOnly>
            <div className="flex flex-col h-screen w-full overflow-hidden">
                {/* Common Header */}
                <CommonHeader 
                    activePage="dashboard" 
                    onRefresh={refreshDashboard} 
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                />
                
                {/* Main content area with fixed header and scrollable content */}
                <div className="flex flex-col flex-grow overflow-hidden bg-gray-100">
                    {/* Date range selection - fixed section */}
                    <div className="bg-white px-6 py-2 shadow-sm">
                        <div className="container mx-auto">
                            <div className="flex flex-wrap items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-700">Date Range</h2>
                                <div className="flex flex-wrap gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                                        <input 
                                            type="date" 
                                            value={dateRange.start}
                                            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                                            className="border rounded px-3 py-2 text-gray-700"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">End Date</label>
                                        <input 
                                            type="date" 
                                            value={dateRange.end}
                                            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                                            className="border rounded px-3 py-2 text-gray-700"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable content area */}
                    <div className="flex-grow overflow-y-auto p-6">
                        <div className="container mx-auto">
                            {error ? (
                                <div className="bg-red-50 border-l-4 border-red-500 p-4">
                                    <p className="text-red-700">{error}</p>
                                    <button 
                                        onClick={refreshDashboard} 
                                        className="mt-2 px-4 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            ) : (
                                activeTab === 'overview' ? (
                                    <div className="space-y-6">
                                        {/* Add the button with space between it and the header */}
                                        <div className="flex justify-between items-center">
                                            <h1 className="text-2xl font-semibold text-gray-800">Dashboard Overview</h1>
                                            <ClearDataButton 
                                                onSuccess={handleDataCleared} 
                                                activeTab={activeTab} // Pass the active tab
                                            />
                                        </div>
                                        
                                        {/* Overview tab content */}
                                        {/* Quick stats */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ">
                                            <div className="bg-white p-6 rounded-lg shadow-sm hover:text-white">
                                                <div className="flex justify-between ">
                                                    <div>
                                                        <p className="text-sm text-gray-500">Total Sales</p>
                                                        <p className="text-2xl font-bold text-teal-600">{analytics.totalSales}</p>
                                                    </div>
                                                    <div className="h-12 w-12 bg-teal-100 rounded-lg flex items-center justify-center">
                                                        <FaShoppingCart className="text-teal-600 text-xl" />
                                                    </div>
                                                </div>
                                                <p className="mt-2 text-xs text-gray-500">For selected date range</p>
                                            </div>

                                            <div className="bg-white p-6 rounded-lg shadow-sm">
                                                <div className="flex justify-between">
                                                    <div>
                                                        <p className="text-sm text-gray-500">Revenue</p>
                                                        <p className="text-2xl font-bold text-teal-600">Rs. {analytics.totalRevenue.toFixed(2)}</p>
                                                    </div>
                                                    <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                                        <FaTag className="text-blue-600 text-xl" />
                                                    </div>
                                                </div>
                                                <p className="mt-2 text-xs text-gray-500">Total revenue for period</p>
                                            </div>

                                            <div className="bg-white p-6 rounded-lg shadow-sm">
                                                <div className="flex justify-between">
                                                    <div>
                                                        <p className="text-sm text-gray-500">Today's Sales</p>
                                                        <p className="text-2xl font-bold text-teal-600">{analytics.todaysSales}</p>
                                                    </div>
                                                    <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                                        <FaCalendarAlt className="text-purple-600 text-xl" />
                                                    </div>
                                                </div>
                                                <p className="mt-2 text-xs text-gray-500">Orders placed today</p>
                                            </div>

                                            <div className="bg-white p-6 rounded-lg shadow-sm">
                                                <div className="flex justify-between">
                                                    <div>
                                                        <p className="text-sm text-gray-500">Weekly Change</p>
                                                        <div className="flex items-center">
                                                            <p className={`text-2xl font-bold ${analytics.weeklyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {analytics.weeklyChange.toFixed(1)}%
                                                            </p>
                                                            {analytics.weeklyChange >= 0 ? (
                                                                <FaArrowUp className="ml-2 text-green-600" />
                                                            ) : (
                                                                <FaArrowDown className="ml-2 text-red-600" />
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className={`h-12 w-12 ${analytics.weeklyChange >= 0 ? 'bg-green-100' : 'bg-red-100'} rounded-lg flex items-center justify-center`}>
                                                        <FaChartBar className={`${analytics.weeklyChange >= 0 ? 'text-green-600' : 'text-red-600'} text-xl`} />
                                                    </div>
                                                </div>
                                                <p className="mt-2 text-xs text-gray-500">From previous week</p>
                                            </div>
                                        </div>

                                        {/* Charts Row */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 ">
                                            {/* Sales Chart */}
                                            <div className="bg-white   p-4 rounded-lg shadow-sm">
                                                <h3 className="text-lg font-semibold text-gray-700 mb-3">Sales Trend</h3>
                                                {isClient && (
                                                    <Chart
                                                        options={salesChartData.options}
                                                        series={salesChartData.series}
                                                        type="line"
                                                        height={350}
                                                    />
                                                )}
                                            </div>

                                            {/* Category Distribution Chart */}
                                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                                <h3 className="text-lg font-semibold text-gray-700 mb-3">Product Categories</h3>
                                                {isClient && (
                                                    <Chart
                                                        options={categoryChartData.options}
                                                        series={categoryChartData.series}
                                                        type="pie"
                                                        height={350}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        {/* Tables */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* Top Selling Products */}
                                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h3 className="text-lg font-semibold text-gray-700">Top Selling Products</h3>
                                                </div>
                                                
                                                {topSellingProducts.length > 0 ? (
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm">
                                                            <thead className="bg-gray-50 text-gray-700">
                                                                <tr>
                                                                    <th className="py-2 px-3 text-left">Product</th>
                                                                    <th className="py-2 px-3 text-right">Quantity Sold</th>
                                                                    <th className="py-2 px-3 text-right">Revenue</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {topSellingProducts.map((product) => (
                                                                    <tr key={product.id} className="border-b border-gray-100">
                                                                        <td className="py-2 px-3 text-gray-600">{product.name}</td>
                                                                        <td className="py-2 px-3 text-right text-gray-600">{product.count}</td>
                                                                        <td className="py-2 px-3 text-right text-gray-600">Rs. {product.revenue.toFixed(2)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : (
                                                    <p className="text-gray-600 text-center py-4">No sales data available</p>
                                                )}
                                                
                                                <div className="mt-4 text-right">
                                                    <button 
                                                        onClick={() => setActiveTab('sales')}
                                                        className="text-teal-600 hover:text-teal-800 text-sm font-semibold"
                                                    >
                                                        View all sales →
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Low Stock Products */}
                                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h3 className="text-lg font-semibold text-gray-700">Low Stock Alert</h3>
                                                </div>
                                                
                                                {lowStockProducts.length > 0 ? (
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm">
                                                            <thead className="bg-gray-50 text-gray-700">
                                                                <tr>
                                                                    <th className="py-2 px-3 text-left">Product</th>
                                                                    <th className="py-2 px-3 text-right">Stock</th>
                                                                    <th className="py-2 px-3 text-center">Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {lowStockProducts.map((product) => (
                                                                    <tr key={product.id} className="border-b border-gray-100 ">
                                                                        <td className="py-2 px-3 text-gray-600">{product.name}</td>
                                                                        <td className="py-2 px-3 text-right text-gray-600">{product.stock} {product.unit}</td>
                                                                        <td className="py-2 px-3 text-center text-gray-600">
                                                                            {product.stock === 0 ? (
                                                                                <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded">
                                                                                    Out of Stock
                                                                                </span>
                                                                            ) : (
                                                                                <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-0.5 rounded">
                                                                                    Low Stock
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center py-8">
                                                        <div className="text-center">
                                                            <FaCheckCircle className="mx-auto text-green-500 text-3xl mb-2" />
                                                            <p className="text-gray-600">All products are well stocked</p>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                <div className="mt-4 text-right">
                                                    <button 
                                                        onClick={() => setActiveTab('inventory')}
                                                        className="text-teal-600 hover:text-teal-800 text-sm font-semibold"
                                                    >
                                                        View all inventory →
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : activeTab === 'sales' ? (
                                    <div className="p-6">
                                        <div className="bg-white p-6 rounded-lg shadow-sm">
                                            <div className="flex justify-between items-center mb-6">
                                                <h2 className="text-xl font-semibold text-gray-800">Sales History</h2>
                                                <ClearDataButton 
                                                    onSuccess={handleDataCleared} 
                                                    activeTab={activeTab} // Pass the active tab
                                                />
                                            </div>
                                            
                                            {/* Add search bar for sales */}
                                            <div className="mb-6 relative">
                                                <input
                                                    type="text"
                                                    placeholder="Search by order number..."
                                                    value={salesSearchTerm}
                                                    onChange={(e) => setSalesSearchTerm(e.target.value)}
                                                    className="w-full md:w-80 pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                                />
                                                <FaSearch className="absolute left-3 top-3 text-gray-500" />
                                            </div>
                                            
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left" id="salesTable">
                                                    <thead className="bg-gray-300 text-gray-800">
                                                        <tr>
                                                            <th className="px-6 py-3">Order ID</th>
                                                            <th className="px-6 py-3">Date</th>
                                                            <th className="px-6 py-3">Items</th>
                                                            <th className="px-6 py-3">Subtotal</th>
                                                            <th className="px-6 py-3">Discount</th>
                                                            <th className="px-6 py-3">Total</th>
                                                            <th className="px-6 py-3">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredSalesData.map((sale) => (
                                                            <tr key={sale.id} className="border-b hover:bg-gray-50 x">
                                                                <td className="px-6 py-4 text-gray-700">{sale.id}</td>
                                                                <td className="px-6 py-4 text-gray-700">{new Date(sale.date).toLocaleDateString()}</td>
                                                                <td className="px-6 py-4 text-gray-700">{sale.items.length}</td>
                                                                <td className="px-6 py-4 text-gray-700">Rs. {parseFloat(sale.subtotal.toString()).toFixed(2)}</td>
                                                                <td className="px-6 py-4 text-gray-700">Rs. {parseFloat(sale.discount.toString()).toFixed(2)}</td>
                                                                <td className="px-6 py-4 text-gray-700">Rs. {parseFloat(sale.total.toString()).toFixed(2)}</td>
                                                                <td className="px-6 py-4 flex gap-2 ">
                                                                    <button
                                                                        onClick={() => handleViewReceiptModal(sale)}
                                                                        className="bg-teal-600 hover:bg-teal-700 text-white p-2 rounded"
                                                                        title="View Receipt"
                                                                    >
                                                                        <FaReceipt size={16} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handlePrintReceipt(sale)}
                                                                        className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded"
                                                                        title="Print Receipt"
                                                                    >
                                                                        <FaPrint size={16} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                
                                                {filteredSalesData.length === 0 && (
                                                    <div className="text-center py-8 text-gray-600">
                                                        {salesSearchTerm ? 'No sales found matching your search.' : 'No sales data available.'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : activeTab === 'inventory' ? (
                                    <div className="bg-white p-6 rounded-lg shadow-md">
                                        <div className="flex justify-between items-center mb-4">
                                            <h2 className="text-xl font-semibold text-gray-800">Inventory Management</h2>
                                            <div className="flex space-x-2">
                                                <ClearDataButton 
                                                    onSuccess={handleDataCleared} 
                                                    activeTab={activeTab} // Pass the active tab
                                                />
                                                <button 
                                                    onClick={handleExportInventory}
                                                    className="px-4 py-2 bg-gray-500 text-white rounded flex items-center hover:bg-gray-600"
                                                >
                                                    <FaDownload className="mr-2" />
                                                    Export
                                                </button>
                                                <button 
                                                    onClick={handleAddNewProduct}
                                                    className="px-4 py-2 bg-teal-600 text-white rounded flex items-center hover:bg-teal-700"
                                                >
                                                    <FaPlus className="mr-2" />
                                                    Add Product
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {/* Inventory filters */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-gray-600">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Search products..."
                                                    value={searchFilter}
                                                    onChange={(e) => setSearchFilter(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                                />
                                                <FaSearch className="absolute left-3 top-3 text-black" />
                                            </div>
                                            
                                            <div className="relative">
                                                <select
                                                    value={categoryFilter}
                                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none"
                                                >
                                                    <option value="">All Categories</option>
                                                    {uniqueCategories.map((category) => (
                                                        <option key={category} value={category}>
                                                            {category}
                                                        </option>
                                                    ))}
                                                </select>
                                                <FaFilter className="absolute left-3 top-3 text-black" />
                                            </div>
                                        </div>
                                        
                                        {/* Inventory table */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left" id="inventoryTable">
                                                <thead className="bg-gray-300 text-gray-900">
                                                    <tr>
                                                        <th className="px-6 py-3">ID</th>
                                                        <th className="px-6 py-3">Product</th>
                                                        <th className="px-6 py-3">Category</th>
                                                        <th className="px-6 py-3">Price</th>
                                                        <th className="px-6 py-3">Expiry Date</th>
                                                        <th className="px-6 py-3">Stock</th>
                                                        <th className="px-6 py-3">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredInventoryProducts.map((product) => (
                                                        <tr key={product.id} className="border-b hover:bg-gray-50 ">
                                                            <td className="px-6 py-4 text-gray-700">{product.id}</td>
                                                            <td className="px-6 py-4 text-gray-700">{product.name}</td>
                                                            <td className="px-6 py-4 text-gray-700">{product.category || 'Uncategorized'}</td>
                                                            <td className="px-6 py-4 text-gray-700">Rs. {parseFloat(product.price.toString()).toFixed(2)}</td>
                                                            <td className="px-6 py-4 text-gray-700">{product.expiry_date || 'N/A'}</td>
                                                            <td className="px-6 py-4 text-gray-700">
                                                                <span className={`${product.stock <= 5 ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                                                                    {product.stock} {product.unit}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex space-x-2">
                                                                    <button
                                                                        onClick={() => handleEditProduct(product)}
                                                                        className="text-blue-600 hover:text-blue-800"
                                                                        title="Edit Product"
                                                                    >
                                                                        <FaEdit />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleAddStock(product)}
                                                                        className="text-green-600 hover:text-green-800"
                                                                        title="Add Stock"
                                                                    >
                                                                        <FaPlus />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteProduct(product.id.toString())}
                                                                        className="text-red-600 hover:text-red-800"
                                                                        title="Delete Product"
                                                                    >
                                                                        <FaTrash />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>

                                            {filteredInventoryProducts.length === 0 && (
                                                <div className="text-center py-4 text-gray-500">
                                                    No products found matching your search criteria
                                                </div>
                                            )}
                                        </div>
                                        
                                        {filteredInventoryProducts.length > 0 && (
                                            <div className="mt-4 flex justify-between items-center">
                                                <div>
                                                    <span className="text-gray-600">
                                                        Showing {Math.min(1, filteredInventoryProducts.length)} to {filteredInventoryProducts.length} of {filteredInventoryProducts.length} entries
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : activeTab === 'stock' ? (
                                    <div className="bg-white p-6 rounded-lg shadow-md">
                                        <div className="flex justify-between items-center mb-6">
                                            <h2 className="text-xl font-semibold text-gray-800">Stock Management</h2>
                                            <div className="flex space-x-2">
                                                <ClearDataButton 
                                                    onSuccess={handleDataCleared} 
                                                    activeTab={activeTab} // Pass the active tab
                                                />
                                                <button 
                                                    onClick={refreshStockData}
                                                    className="px-4 py-2 bg-teal-600 text-white rounded flex items-center hover:bg-teal-700"
                                                >
                                                    <FaSyncAlt className="mr-2" />
                                                    Refresh Data
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-gray-700">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Search products..."
                                                    value={searchFilter}
                                                    onChange={(e) => setSearchFilter(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                                />
                                                <FaSearch className="absolute left-3 top-3 text-gray-700" />
                                            </div>
                                            
                                            <div className="relative">
                                                <select
                                                    value={categoryFilter}
                                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none"
                                                >
                                                    <option value="">All Categories</option>
                                                    {uniqueCategories.map((category) => (
                                                        <option key={category} value={category}>
                                                            {category}
                                                        </option>
                                                    ))}
                                                </select>
                                                <FaFilter className="absolute left-3 top-3 text-black" />
                                            </div>
                                        </div>
                                        
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left" id="stockTable">
                                                <thead className="bg-gray-300 text-gray-900">
                                                    <tr>
                                                        <th className="px-6 py-3">ID</th>
                                                        <th className="px-6 py-3">Product</th>
                                                        <th className="px-6 py-3">Category</th>
                                                        <th className="px-6 py-3">Current Stock</th>
                                                        <th className="px-6 py-3">Unit</th>
                                                        <th className="px-6 py-3">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredInventoryProducts.map((product) => (
                                                        <tr key={product.id} className="border-b hover:bg-gray-50">
                                                            <td className="px-6 py-4 text-gray-700">{product.id}</td>
                                                            <td className="px-6 py-4 text-gray-700">{product.name}</td>
                                                            <td className="px-6 py-4 text-gray-700">{product.category || 'Uncategorized'}</td>
                                                            <td className="px-6 py-4 text-gray-700">
                                                                <span className={`${product.stock <= 5 ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                                                                    {product.stock}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-700">{product.unit}</td>
                                                            <td className="px-6 py-4">
                                                                <button 
                                                                    onClick={() => handleAddStock(product)}
                                                                    className="text-teal-600 hover:text-teal-800 px-2 py-1 bg-teal-100 rounded-md"
                                                                >
                                                                    <FaPlus className="inline mr-1" /> Add Stock
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : activeTab === 'reports' ? (
                                    <div>
                                        <div className="flex justify-between items-center mb-6">
                                            <h2 className="text-xl font-semibold text-gray-800">Reports</h2>
                                            <ClearDataButton 
                                                onSuccess={handleDataCleared} 
                                                activeTab={activeTab} // Pass the active tab
                                            />
                                        </div>
                                        <Reports 
                                            salesData={salesData} 
                                            productData={productData}
                                            dateRange={dateRange}
                                        />
                                    </div>
                                ) : activeTab === 'alerts' && (
                                    <div>
                                        <div className="flex justify-between items-center mb-6">
                                            <h2 className="text-xl font-semibold text-gray-800">Inventory Alerts</h2>
                                            <ClearDataButton 
                                                onSuccess={handleDataCleared} 
                                                activeTab={activeTab} // Pass the active tab
                                            />
                                        </div>
                                        <InventoryAlerts 
                                            productData={productData}
                                            onAddStock={handleAddStock}
                                            onEditProduct={handleEditProduct}
                                            onDeleteProduct={handleDeleteProduct}
                                        />
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>

                {/* Delete Confirmation Modal */}
                {deleteConfirmVisible && selectedProduct && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-lg shadow-lg w-[90%] max-w-md">
                            <h3 className="text-xl font-bold text-gray-800 mb-4">Confirm Delete</h3>
                            <p className="text-gray-600 mb-6">
                                Are you sure you want to delete <span className="font-semibold">{selectedProduct.name}</span>? 
                                This action cannot be undone.
                            </p>
                            <div className="flex justify-end space-x-4">
                                <button
                                    onClick={() => setDeleteConfirmVisible(false)}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDeleteProduct}
                                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Import ProductModals for editing and adding products */}
                {(showAddProductModal || showListProductModal) && (
                    <ProductModals 
                        showAddModal={showAddProductModal}
                        showListModal={showListProductModal}
                        setShowAddModal={setShowAddProductModal}
                        setShowListModal={setShowListProductModal}
                        productToEdit={editingProduct ? {...editingProduct, photo: editingProduct.photo || '', expiry_date: editingProduct.expiry_date || ''} : undefined}
                        editModeOnly={!!editingProduct} // Add this line - if editingProduct exists, use edit mode only
                    />
                )}

                {/* StockModals Component */}
                {(showStockModal || showAddStockModal) && (
                    <StockModals 
                        showStockModal={showStockModal}
                        showAddStockModal={showAddStockModal}
                        setShowStockModal={setShowStockModal}
                        setShowAddStockModal={setShowAddStockModal}
                        productToStock={stockProduct ? {...stockProduct, id: stockProduct.id.toString()} : undefined}
                    />
                )}

                {/* Receipt View Modal */}
                {viewReceipt && selectedSale && (
                    <ReceiptModal
                        items={convertSaleItemsToCartItems(selectedSale.items)}
                        discount={selectedSale.discount || 0}
                        calculateSubtotal={calculateSaleSubtotal}
                        calculateTotal={calculateSaleTotal}
                        handlePrint={handlePrint}
                        onClose={() => setViewReceipt(false)}
                        saveSale={dummySaveSale}
                        orderNumber={selectedSale.id.toString()} // Pass the original ID without formatting
                    />
                )}

                {/* Add this to your JSX to display the toast */}
                {toastState && (
                    <Toast 
                        message={toastState.message} 
                        type={toastState.type} 
                        onClose={() => setToastState(null)} 
                    />
                )}
            </div>
        </ClientOnly>
    );
};

export default Dashboard;