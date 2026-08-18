"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import ClientOnly from '../Components/ClientOnly';
import ProductModals, { type Product as ProductModalProduct } from '../Components/ProductModals';
import StockModals, { type Product as StockModalProduct } from '../Components/StockModals';
import ReceiptModal from '../Components/ReceiptModal';
import CommonHeader from '../Components/CommonHeader';
import { 
    FaChartBar, FaShoppingCart,
    FaArrowUp, FaArrowDown, FaTag, FaCalendarAlt, FaSyncAlt, FaPlus, FaEdit,
    FaTrash, FaPrint, FaSearch, FaDownload, FaFilter, FaTimes,
    FaCheckCircle, FaReceipt, FaUndo
} from 'react-icons/fa';
import InventoryAlerts from '../Components/InventoryAlerts';
import Toast from '../Components/Toast';
import ClearDataButton from '../Components/ClearDataButton';

// Dynamic import for client-only chart components
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });
const Reports = dynamic(() => import('../Components/Reports'), {
    ssr: false,
    loading: () => <div className="p-4 text-sm text-gray-500">Loading reports...</div>
});

interface CartItem {
    id: string;
    name: string;
    qty: number;
    price: number;
    unit: string;
    lineTotal?: number;
}

interface SalesData {
    id: string;
    date: string;
    total: number;
    subtotal: number;
    discount: number;
    items: Array<{
        product_id: string;
        name?: string;
        quantity?: number;
        qty?: number;
        price?: number;
        line_total?: number;
        unit?: string;
    }>;
}

interface ReturnItemData {
    id: number;
    return_transaction_id?: number;
    sale_id: number;
    product_id: number;
    return_qty_base: number;
    refund_amount: number;
    return_invoice_no?: string;
    created_at?: string;
    product_name?: string;
}

interface ReturnTransactionData {
    id: number;
    original_sale_id: number;
    return_invoice_no: string;
    total_refunded: number;
    created_at: string;
    date: string;
    original_sale_total?: number;
    original_subtotal?: number;
    original_discount?: number;
    original_amount_received?: number;
    original_change_return?: number;
    items: ReturnItemData[];
}

interface ReturnItemData {
    id: number;
    return_transaction_id?: number;
    sale_id: number;
    product_id: number;
    return_qty_base: number;
    refund_amount: number;
    return_invoice_no?: string;
    created_at?: string;
    product_name?: string;
}

interface ReturnTransactionData {
    id: number;
    original_sale_id: number;
    return_invoice_no: string;
    total_refunded: number;
    created_at: string;
    date: string;
    original_sale_total?: number;
    original_subtotal?: number;
    original_discount?: number;
    original_amount_received?: number;
    original_change_return?: number;
    items: ReturnItemData[];
}

// Update your ProductData interface to match the Product interface in ProductModals
interface ProductData {
    id: string | number;
    name: string;
    generic_name?: string;
    description?: string;
    category_id?: number;
    category_name?: string;
    price_per_box?: number;
    price_per_strip?: number;
    price_per_tablet?: number;
    base_stock: number;
    unit_config?: any;
    expiry_date?: string;
}

interface SalesAnalytics {
    totalSales: number;
    totalRevenue: number;
    averageOrderValue: number;
    todaysSales: number;
    weeklyChange: number;
}

interface ReturnQtyState {
    boxQty: number;
    stripQty: number;
    tabletQty: number;
}

interface CategoryData {
    id: number;
    name: string;
    unit_levels: number;
    level_1_name: string;
    level_2_name?: string | null;
    level_3_name?: string | null;
    conversion_1_to_2?: number | null;
    conversion_2_to_3?: number | null;
    created_at?: string;
}

interface CategoryFormState {
    name: string;
    unit_levels: number;
    level_1_name: string;
    level_2_name: string;
    level_3_name: string;
    conversion_1_to_2: string;
    conversion_2_to_3: string;
}

const Dashboard: React.FC = () => {
    const [salesData, setSalesData] = useState<SalesData[]>([]);
    const [returnsData, setReturnsData] = useState<ReturnTransactionData[]>([]);
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
    const [inventorySubTab, setInventorySubTab] = useState<'products' | 'categories'>('products');

    const [categoriesData, setCategoriesData] = useState<CategoryData[]>([]);
    const [showAddCategoryModal, setShowAddCategoryModal] = useState<boolean>(false);
    const [isSubmittingCategory, setIsSubmittingCategory] = useState<boolean>(false);
    const [categoryForm, setCategoryForm] = useState<CategoryFormState>({
        name: '',
        unit_levels: 1,
        level_1_name: '',
        level_2_name: '',
        level_3_name: '',
        conversion_1_to_2: '',
        conversion_2_to_3: ''
    });

    // Use with window check to avoid hydration errors with SSR
    const isClient = typeof window !== 'undefined';

    const [selectedSale, setSelectedSale] = useState<SalesData | null>(null);
    const [selectedReturnTransaction, setSelectedReturnTransaction] = useState<ReturnTransactionData | null>(null);
    // const [showSaleDetails, setShowSaleDetails] = useState<boolean>(false); // unused

    // States for ProductModals
    const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
    const [showListProductModal, setShowListProductModal] = useState<boolean>(false);
    // const [showEditModal, setShowEditModal] = useState<boolean>(false); // unused
    const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState<boolean>(false);
    const [editingProduct, setEditingProduct] = useState<ProductModalProduct | undefined>(undefined);

    // States for StockModals
    const [showStockModal, setShowStockModal] = useState<boolean>(false);
    const [showAddStockModal, setShowAddStockModal] = useState<boolean>(false);
    const [stockProduct, setStockProduct] = useState<StockModalProduct | undefined>(undefined);

    // State for Receipt view
    const [viewReceipt, setViewReceipt] = useState<boolean>(false);
    const [viewReturnReceipt, setViewReturnReceipt] = useState<boolean>(false);
    const [returnSaleData, setReturnSaleData] = useState<SalesData | null>(null);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState<boolean>(false);
    const [returnQuantities, setReturnQuantities] = useState<Record<string, ReturnQtyState>>({});
    const [isSubmittingReturn, setIsSubmittingReturn] = useState<boolean>(false);

    // New state for search
    const [salesSearchTerm, setSalesSearchTerm] = useState<string>('');
    const [returnsSearchTerm, setReturnsSearchTerm] = useState<string>('');

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

    const filteredReturnsData = useMemo(() => {
        if (!returnsSearchTerm.trim()) {
            return returnsData;
        }

        const query = returnsSearchTerm.toLowerCase();

        return returnsData.filter((returnTransaction) => {
            const returnInvoice = returnTransaction.return_invoice_no.toLowerCase();
            const originalSale = returnTransaction.original_sale_id.toString();
            const itemMatches = returnTransaction.items.some((item) =>
                getReturnItemName(item).toLowerCase().includes(query) ||
                item.product_id.toString().includes(query)
            );

            return returnInvoice.includes(query) || originalSale.includes(query) || itemMatches;
        });
    }, [returnsData, returnsSearchTerm]);

    // Navigation functions
    // const navigateToHome = () => { // unused
    //     router.push('/');
    // };

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

    const handleViewReturnReceiptModal = (returnTransaction: ReturnTransactionData) => {
        setSelectedReturnTransaction(returnTransaction);
        setViewReturnReceipt(true);
    };

    const getReturnItemKey = (saleId: string, productId: string) => `${saleId}-${productId}`;

    const getProductForSaleItem = (saleItem: SalesData['items'][number]) => {
        return productData.find(p => p.id?.toString() === saleItem.product_id?.toString());
    };

    const getSaleItemQuantity = (saleItem: SalesData['items'][number]): number => {
        const quantity = Number(saleItem.quantity ?? saleItem.qty ?? 0);
        return Number.isFinite(quantity) ? quantity : 0;
    };

    const getSaleItemLineTotal = (saleItem: SalesData['items'][number]): number => {
        const lineTotal = Number(saleItem.line_total ?? 0);
        return Number.isFinite(lineTotal) ? lineTotal : 0;
    };

    const getSaleItemPrice = (saleItem: SalesData['items'][number]): number => {
        const directPrice = Number(saleItem.price ?? 0);
        if (Number.isFinite(directPrice) && directPrice > 0) {
            return directPrice;
        }

        const quantity = getSaleItemQuantity(saleItem);
        const lineTotal = getSaleItemLineTotal(saleItem);
        if (quantity > 0 && Number.isFinite(lineTotal) && lineTotal > 0) {
            return lineTotal / quantity;
        }

        return 0;
    };

    const getSaleItemName = (saleItem: SalesData['items'][number]): string => {
        if (saleItem.name && saleItem.name.trim()) {
            return saleItem.name;
        }

        const product = getProductForSaleItem(saleItem);
        if (product?.name) {
            return product.name;
        }

        return `Product #${saleItem.product_id}`;
    };

    const getReturnItemName = (returnItem: ReturnItemData): string => {
        if (returnItem.product_name && returnItem.product_name.trim()) {
            return returnItem.product_name;
        }

        return `Product #${returnItem.product_id}`;
    };

    const getSaleItemUnit = (saleItem: SalesData['items'][number]): string => {
        if (saleItem.unit && saleItem.unit.trim()) {
            return saleItem.unit;
        }

        const product = getProductForSaleItem(saleItem);
        return product?.unit_config?.level_3_name || product?.unit_config?.level_1_name || 'Unit';
    };

    const getReturnItemUnit = (returnItem: ReturnItemData): string => {
        const product = productData.find((p) => p.id?.toString() === returnItem.product_id?.toString());
        return product?.unit_config?.level_3_name || product?.unit_config?.level_1_name || 'Unit';
    };

    const getUnitConfig = (product?: ProductData) => {
        const unitLevels = Math.min(3, Math.max(1, Number(product?.unit_config?.unit_levels ?? 3)));
        const conversion1To2 = Math.max(1, Number(product?.unit_config?.conversion_1_to_2 ?? 1));
        const conversion2To3 = Math.max(1, Number(product?.unit_config?.conversion_2_to_3 ?? 1));

        return {
            unitLevels,
            conversion1To2,
            conversion2To3,
            level1Name: product?.unit_config?.level_1_name || 'Box',
            level2Name: product?.unit_config?.level_2_name || 'Strip',
            level3Name: product?.unit_config?.level_3_name || 'Tablet'
        };
    };

    const formatBaseQty = (baseQty: number, saleItem: SalesData['items'][number]) => {
        const product = getProductForSaleItem(saleItem);
        const { conversion1To2, conversion2To3, level1Name, level2Name, level3Name } = getUnitConfig(product);
        const stripsPerBox = conversion1To2;
        const tabsPerStrip = conversion2To3;
        const tabsPerBox = stripsPerBox * tabsPerStrip;

        const boxes = Math.floor(baseQty / tabsPerBox);
        const remainingAfterBoxes = baseQty % tabsPerBox;
        const strips = Math.floor(remainingAfterBoxes / tabsPerStrip);
        const tablets = remainingAfterBoxes % tabsPerStrip;

        const parts: string[] = [];
        if (boxes > 0) parts.push(`${boxes} ${level1Name}`);
        if (strips > 0) parts.push(`${strips} ${level2Name}`);
        if (tablets > 0) parts.push(`${tablets} ${level3Name}`);
        return parts.length ? parts.join(', ') : `0 ${level3Name}`;
    };

    const openReturnModal = (sale: SalesData) => {
        const initialState: Record<string, ReturnQtyState> = {};
        sale.items.forEach((item) => {
            initialState[getReturnItemKey(sale.id, item.product_id)] = {
                boxQty: 0,
                stripQty: 0,
                tabletQty: 0
            };
        });

        setReturnQuantities(initialState);
        setReturnSaleData(sale);
        setIsReturnModalOpen(true);
    };

    const updateReturnQty = (
        saleItem: SalesData['items'][number],
        field: keyof ReturnQtyState,
        rawValue: number
    ) => {
        if (!returnSaleData) return;

        const key = getReturnItemKey(returnSaleData.id, saleItem.product_id);
        const prev = returnQuantities[key] || { boxQty: 0, stripQty: 0, tabletQty: 0 };
        const product = getProductForSaleItem(saleItem);
        const { conversion1To2, conversion2To3 } = getUnitConfig(product);
        const stripsPerBox = conversion1To2;
        const tabsPerStrip = conversion2To3;

        const next = { ...prev, [field]: Math.max(0, rawValue || 0) };

        const factors = {
            boxQty: stripsPerBox * tabsPerStrip,
            stripQty: tabsPerStrip,
            tabletQty: 1
        };

        const totalOther =
            (field === 'boxQty' ? 0 : next.boxQty * factors.boxQty) +
            (field === 'stripQty' ? 0 : next.stripQty * factors.stripQty) +
            (field === 'tabletQty' ? 0 : next.tabletQty * factors.tabletQty);

        const maxAllowedForField = Math.max(0, Math.floor((getSaleItemQuantity(saleItem) - totalOther) / factors[field]));
        next[field] = Math.min(next[field], maxAllowedForField);

        setReturnQuantities((prevState) => ({
            ...prevState,
            [key]: next
        }));
    };

    const getReturnQtyBase = (saleItem: SalesData['items'][number]) => {
        if (!returnSaleData) return 0;
        const key = getReturnItemKey(returnSaleData.id, saleItem.product_id);
        const values = returnQuantities[key] || { boxQty: 0, stripQty: 0, tabletQty: 0 };
        const product = getProductForSaleItem(saleItem);
        const { conversion1To2, conversion2To3 } = getUnitConfig(product);
        const stripsPerBox = conversion1To2;
        const tabsPerStrip = conversion2To3;

        return (
            values.boxQty * stripsPerBox * tabsPerStrip +
            values.stripQty * tabsPerStrip +
            values.tabletQty
        );
    };

    const getReturnRefundAmount = (saleItem: SalesData['items'][number]) => {
        const qtyBase = getReturnQtyBase(saleItem);
        return qtyBase * getSaleItemPrice(saleItem);
    };

    const getReturnItemQuantity = (returnItem: ReturnItemData): number => {
        const quantity = Number(returnItem.return_qty_base ?? 0);
        return Number.isFinite(quantity) ? quantity : 0;
    };

    const getReturnItemPrice = (returnItem: ReturnItemData): number => {
        const quantity = getReturnItemQuantity(returnItem);
        const refundAmount = Number(returnItem.refund_amount ?? 0);
        if (quantity > 0) {
            return refundAmount / quantity;
        }

        return 0;
    };

    const convertReturnItemsToCartItems = (returnTransaction: ReturnTransactionData): CartItem[] => {
        return returnTransaction.items.map((item) => ({
            id: item.product_id.toString(),
            name: getReturnItemName(item),
            qty: getReturnItemQuantity(item),
            price: getReturnItemPrice(item),
            unit: getReturnItemUnit(item),
            lineTotal: Number(item.refund_amount ?? 0),
            formattedQty: `${getReturnItemQuantity(item)} ${getReturnItemUnit(item)}`
        }));
    };

    const calculateReturnReceiptSubtotal = (returnTransaction: ReturnTransactionData): string => {
        return Number(returnTransaction.total_refunded ?? 0).toFixed(2);
    };

    const calculateReturnReceiptTotal = (returnTransaction: ReturnTransactionData): string => {
        return Number(returnTransaction.total_refunded ?? 0).toFixed(2);
    };

    const totalRefundAmount = useMemo(() => {
        if (!returnSaleData) return 0;
        return returnSaleData.items.reduce((sum, saleItem) => sum + getReturnRefundAmount(saleItem), 0);
    }, [returnSaleData, returnQuantities, productData]);

    // Convert sale items to the format expected by ReceiptModal
    const convertSaleItemsToCartItems = (saleItems: any[]): CartItem[] => {
        return saleItems.map(item => ({
            id: item.product_id || '',
            name: getSaleItemName(item),
            qty: getSaleItemQuantity(item),
            price: getSaleItemPrice(item),
            unit: getSaleItemUnit(item),
            lineTotal: getSaleItemLineTotal(item)
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

    const dummySaveReturnReceipt = async (): Promise<boolean> => {
        return true;
    };

    // Sale view and print functions
    // const handleViewSale = (sale: SalesData) => { // unused
    //     setSelectedSale(sale);
    //     setShowSaleDetails(true);
    // };

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
                                        <td>${getSaleItemName(item as any)}</td>
                                        <td>${getSaleItemQuantity(item as any)} ${getSaleItemUnit(item as any)}</td>
                                        <td>${storeSettings.currency} ${getSaleItemPrice(item as any).toFixed(2)}</td>
                                        <td>${storeSettings.currency} ${(getSaleItemLineTotal(item as any) || (getSaleItemQuantity(item as any) * getSaleItemPrice(item as any))).toFixed(2)}</td>
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

    const toProductModalProduct = (product: ProductData): ProductModalProduct => ({
        id: Number(product.id),
        name: product.name,
        description: product.description,
        category_name: product.category_name,
        price_per_box: product.price_per_box,
        price_per_strip: product.price_per_strip,
        price_per_tablet: product.price_per_tablet,
        base_stock: product.base_stock,
        stock: product.base_stock,
        unit_config: product.unit_config,
        expiry_date: product.expiry_date
    });

    const toStockModalProduct = (product: ProductData): StockModalProduct => ({
        id: String(product.id),
        name: product.name,
        description: product.description,
        category_name: product.category_name,
        price_per_box: product.price_per_box,
        price_per_strip: product.price_per_strip,
        price_per_tablet: product.price_per_tablet,
        base_stock: product.base_stock,
        stock: product.base_stock,
        unit_config: product.unit_config
    });

    // Add this function with your other handler functions
    const handleAddStock = (product: ProductData) => {
        setStockProduct(toStockModalProduct(product));
        setShowAddStockModal(true);
    };

    // Product handling functions for inventory tab
    const handleEditProduct = (product: ProductData) => {
        setEditingProduct(toProductModalProduct(product));
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

    const refreshCategoriesData = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/categories');
            if (!response.ok) throw new Error('Failed to fetch categories');
            const data = await response.json();
            setCategoriesData(data);
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const resetCategoryForm = () => {
        setCategoryForm({
            name: '',
            unit_levels: 1,
            level_1_name: '',
            level_2_name: '',
            level_3_name: '',
            conversion_1_to_2: '',
            conversion_2_to_3: ''
        });
    };

    const handleAddCategory = async () => {
        if (!categoryForm.name.trim()) {
            toastActions.error('Category name is required');
            return;
        }

        if (!categoryForm.level_1_name.trim()) {
            toastActions.error('Unit Name is required');
            return;
        }

        if (categoryForm.unit_levels >= 2 && (!categoryForm.level_2_name.trim() || !categoryForm.conversion_1_to_2.trim())) {
            toastActions.error('Please complete Main/Sub unit and conversion for 2-level setup');
            return;
        }

        if (categoryForm.unit_levels === 3 && (!categoryForm.level_3_name.trim() || !categoryForm.conversion_2_to_3.trim())) {
            toastActions.error('Please complete third unit and conversion for 3-level setup');
            return;
        }

        const payload = {
            name: categoryForm.name.trim(),
            unit_levels: categoryForm.unit_levels,
            level_1_name: categoryForm.level_1_name.trim(),
            level_2_name: categoryForm.unit_levels >= 2 ? categoryForm.level_2_name.trim() : null,
            level_3_name: categoryForm.unit_levels === 3 ? categoryForm.level_3_name.trim() : null,
            conversion_1_to_2: categoryForm.unit_levels >= 2 ? Number.parseInt(categoryForm.conversion_1_to_2, 10) : null,
            conversion_2_to_3: categoryForm.unit_levels === 3 ? Number.parseInt(categoryForm.conversion_2_to_3, 10) : null
        };

        try {
            setIsSubmittingCategory(true);
            const response = await fetch('http://localhost:5000/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errPayload = await response.json().catch(() => ({}));
                throw new Error(errPayload.error || 'Failed to add category');
            }

            await refreshCategoriesData();
            setShowAddCategoryModal(false);
            resetCategoryForm();
            toastActions.success('Category added successfully');
        } catch (error: any) {
            toastActions.error(error.message || 'Failed to add category');
        } finally {
            setIsSubmittingCategory(false);
        }
    };

    // Export sales to Excel
    const handleExportSales = async () => {
        try {
            const XLSX = await import('xlsx');
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
    const handleExportInventory = async () => {
        try {
            const XLSX = await import('xlsx');
            const worksheet = XLSX.utils.json_to_sheet(
                productData.map(product => ({
                    'ID': product.id,
                    'Product Name': product.name,
                    'Category': product.category_name || 'Uncategorized',
                    'Price (Rs.)': parseFloat((product.price_per_box || 0).toString()).toFixed(2),
                    'Base Stock': product.base_stock || 0
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

                const categoriesResponse = await fetch('http://localhost:5000/api/categories');
                if (!categoriesResponse.ok) throw new Error('Failed to fetch categories');
                const categories = await categoriesResponse.json();
                setCategoriesData(categories);

                const returnsResponse = await fetch('http://localhost:5000/api/returns');
                if (!returnsResponse.ok) throw new Error('Failed to fetch returns data');
                const returnsData = await returnsResponse.json() as ReturnTransactionData[];
                const filteredReturns = returnsData.filter((returnTransaction: ReturnTransactionData) => {
                    const returnDate = new Date(returnTransaction.date).toISOString().split('T')[0];
                    return returnDate >= dateRange.start && returnDate <= dateRange.end;
                });
                setReturnsData(filteredReturns);
                
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
                product.category_name === categoryFilter;
            
            return matchesSearch && matchesCategory;
        });
    }, [productData, searchFilter, categoryFilter]);
    
    // Get unique categories for filter dropdown
    const uniqueCategories = useMemo(() => {
        const categories = productData
            .map(product => product.category_name)
            .filter((category, index, self) => 
                category && self.indexOf(category) === index
            );
        
        return categories;
    }, [productData]);

    // Prepare chart data for sales
    const salesChartData = useMemo(() => {
        // Group sales by date and subtract refunds recorded for the same date range
        const salesByDate: Record<string, number> = {};
        
        salesData.forEach(sale => {
            const date = new Date(sale.date).toLocaleDateString();
            salesByDate[date] = (salesByDate[date] || 0) + parseFloat(sale.total.toString());
        });

        returnsData.forEach(returnTransaction => {
            const date = new Date(returnTransaction.date).toLocaleDateString();
            salesByDate[date] = (salesByDate[date] || 0) - Number(returnTransaction.total_refunded || 0);
        });
        
        // Convert to arrays for the chart
        const dates = Object.keys(salesByDate);
        const amounts = Object.values(salesByDate);
        
        return {
            options: {
                chart: {
                    id: 'sales-chart',
                    type: 'line' as const,
                    height: 170,
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
                    align: 'left' as const,
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
    }, [salesData, returnsData]);

    // Product category chart data
    const categoryChartData = useMemo(() => {
        const categoryCount: Record<string, number> = {};
        
        productData.forEach(product => {
            const category = product.category_name || 'Uncategorized';
            categoryCount[category] = (categoryCount[category] || 0) + 1;
        });
        
        const categories = Object.keys(categoryCount);
        const counts = Object.values(categoryCount);
        
        return {
            options: {
                chart: {
                    type: 'pie' as const,
                    height: 170
                },
                labels: categories,
                responsive: [{
                    breakpoint: 480,
                    options: {
                        chart: {
                            height: 140
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
        // Count product occurrences in sales and subtract returned quantities/revenue
        const productCounts: Record<string, { count: number, revenue: number }> = {};
        
        salesData.forEach(sale => {
            sale.items.forEach(item => {
                const productId = item.product_id?.toString();

                if (!productId) return;

                if (!productCounts[productId]) {
                    productCounts[productId] = { count: 0, revenue: 0 };
                }

                const quantity = getSaleItemQuantity(item);
                const price = getSaleItemPrice(item);

                productCounts[productId].count += Number.isFinite(quantity) ? quantity : 0;
                productCounts[productId].revenue += (Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(price) ? price : 0);
            });
        });

        returnsData.forEach((returnTransaction) => {
            returnTransaction.items.forEach((item) => {
                const productId = item.product_id?.toString();

                if (!productId) return;

                if (!productCounts[productId]) {
                    productCounts[productId] = { count: 0, revenue: 0 };
                }

                const quantity = Number(item.return_qty_base ?? 0);
                const refundAmount = Number(item.refund_amount ?? 0);

                productCounts[productId].count -= Number.isFinite(quantity) ? quantity : 0;
                productCounts[productId].revenue -= Number.isFinite(refundAmount) ? refundAmount : 0;
            });
        });
        
        // Convert to array and sort by count
        const sortedProducts = Object.entries(productCounts)
            .map(([productId, data]) => {
                // Look up the product in the productData array instead of salesData
                const product = productData.find(p => p.id?.toString() === productId);
                
                return {
                    id: productId,
                    name: product ? product.name : 'Unknown Product',
                    count: data.count ?? 0,
                    revenue: data.revenue ?? 0
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // Get top 5
        
        return sortedProducts;
    }, [salesData, returnsData, productData]); // Add productData as a dependency

    // Get low stock products
    const lowStockProducts = useMemo(() => {
        return productData
            .filter(product => (product.base_stock || 0) <= 5)
            .sort((a, b) => (a.base_stock || 0) - (b.base_stock || 0))
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

    const fetchReturnsData = async () => {
        try {
            const returnsResponse = await fetch('http://localhost:5000/api/returns');
            if (!returnsResponse.ok) throw new Error('Failed to fetch returns data');
            const returnsData = await returnsResponse.json() as ReturnTransactionData[];

            const filteredReturns = returnsData.filter((returnTransaction: ReturnTransactionData) => {
                const returnDate = new Date(returnTransaction.date).toISOString().split('T')[0];
                return returnDate >= dateRange.start && returnDate <= dateRange.end;
            });

            setReturnsData(filteredReturns);
        } catch (error) {
            console.error('Error fetching returns data:', error);
            setError('Failed to load return data');
        }
    };

    useEffect(() => {
        const grossRevenue = salesData.reduce((sum, sale) => sum + Number(sale.total ?? 0), 0);
        const refundedRevenue = returnsData.reduce((sum, returnTransaction) => sum + Number(returnTransaction.total_refunded ?? 0), 0);
        const netRevenue = grossRevenue - refundedRevenue;
        const averageOrderValue = salesData.length ? netRevenue / salesData.length : 0;

        setAnalytics((prev) => ({
            ...prev,
            totalSales: salesData.length,
            totalRevenue: netRevenue,
            averageOrderValue
        }));
    }, [salesData, returnsData]);

    const submitReturn = async () => {
        if (!returnSaleData) return;

        const payload = returnSaleData.items
            .map((saleItem) => {
                const returnQtyBase = getReturnQtyBase(saleItem);
                const refundAmount = getReturnRefundAmount(saleItem);

                return {
                    sale_id: Number(returnSaleData.id),
                    product_id: Number(saleItem.product_id),
                    return_qty_base: returnQtyBase,
                    refund_amount: refundAmount
                };
            })
            .filter((item) => item.return_qty_base > 0);

        if (payload.length === 0) {
            toastActions.info('Select at least one item quantity to return');
            return;
        }

        try {
            setIsSubmittingReturn(true);

            const response = await fetch('http://localhost:5000/api/sales/return', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: payload })
            });

            if (!response.ok) {
                throw new Error('Failed to process return');
            }

            const result = await response.json();
            toastActions.success(`Return processed. Refunded Rs. ${Number(result.total_refunded || 0).toFixed(2)}`);

            setIsReturnModalOpen(false);
            setReturnSaleData(null);
            setReturnQuantities({});

            await Promise.all([fetchReturnsData(), refreshProductData()]);
        } catch (error) {
            console.error('Error processing return:', error);
            toastActions.error('Failed to process return');
        } finally {
            setIsSubmittingReturn(false);
        }
    };

    useEffect(() => {
      const eventSource = new EventSource('http://localhost:5000/api/products/updates');
      
      eventSource.onmessage = (event) => {
        try {
                    const payload = JSON.parse(event.data);
                    const eventType = payload?.type;
                    const eventData = payload?.data ?? {};

                    if (eventType === 'product_update' && eventData.product) {
            // Existing product update logic...
                    } else if (eventType === 'data_reset') {
                        const resetType = typeof eventData.type === 'string' ? eventData.type : 'all';

                        if (resetType === 'all' || resetType === 'overview') {
                            refreshDashboard();
              toastActions.info("All data has been reset");
                        } else if (resetType === 'sales') {
                            fetchSalesData();
                            fetchReturnsData();
              toastActions.info("Sales data has been reset");
                        } else if (resetType === 'returns') {
                            fetchReturnsData();
              toastActions.info("Return data has been reset");
                        } else if (resetType === 'inventory' || resetType === 'stock' || resetType === 'alerts') {
                            refreshProductData();
              toastActions.info("Inventory data has been reset");
                        } else {
                            refreshDashboard();
                            toastActions.info("Dashboard data has been reset");
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
                    <div className="bg-white px-3 py-2 shadow-sm">
                        <div className="w-full max-w-full px-2 overflow-hidden">
                            <div className="flex flex-wrap items-center justify-between">
                                <h2 className="text-base font-semibold text-gray-700">Date Range</h2>
                                <div className="flex flex-wrap gap-3">
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                                        <input 
                                            type="date" 
                                            value={dateRange.start}
                                            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                                            className="border rounded px-2 py-1 text-gray-700 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1">End Date</label>
                                        <input 
                                            type="date" 
                                            value={dateRange.end}
                                            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                                            className="border rounded px-2 py-1 text-gray-700 text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable content area */}
                    <div className="flex-grow overflow-y-auto p-3 w-full max-w-full overflow-hidden">
                        <div className="w-full max-w-full px-2 overflow-hidden">
                            {error ? (
                                <div className="bg-red-50 border-l-4 border-red-500 p-3">
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
                                    <div className="space-y-4">
                                        {/* Add the button with space between it and the header */}
                                        <div className="flex justify-between items-center">
                                            <h1 className="text-xl font-semibold text-gray-800">Dashboard Overview</h1>
                                            <ClearDataButton 
                                                onSuccess={handleDataCleared} 
                                                activeTab={activeTab} // Pass the active tab
                                            />
                                        </div>
                                        
                                        {/* Overview tab content */}
                                        {/* Quick stats */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                            <div className="bg-white p-3 rounded-lg shadow-sm hover:text-white">
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

                                            <div className="bg-white p-3 rounded-lg shadow-sm">
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

                                            <div className="bg-white p-3 rounded-lg shadow-sm">
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

                                            <div className="bg-white p-3 rounded-lg shadow-sm">
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
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                                            {/* Sales Chart */}
                                            <div className="bg-white p-2.5 rounded-lg shadow-sm overflow-hidden">
                                                <h3 className="text-sm font-semibold text-gray-700 mb-1.5">Sales Trend</h3>
                                                {isClient && (
                                                    <Chart
                                                        options={salesChartData.options}
                                                        series={salesChartData.series}
                                                        type="line"
                                                        height={170}
                                                    />
                                                )}
                                            </div>

                                            {/* Category Distribution Chart */}
                                                <div className="bg-white p-2.5 rounded-lg shadow-sm overflow-hidden">
                                                    <h3 className="text-sm font-semibold text-gray-700 mb-1.5">Product Categories</h3>
                                                {isClient && (
                                                    <Chart
                                                        options={categoryChartData.options}
                                                        series={categoryChartData.series}
                                                        type="pie"
                                                        height={170}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        {/* Tables */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                            {/* Top Selling Products */}
                                            <div className="bg-white p-3 rounded-lg shadow-sm">
                                                <div className="flex justify-between items-center mb-3">
                                                    <h3 className="text-base font-semibold text-gray-700">Top Selling Products</h3>
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
                                            <div className="bg-white p-3 rounded-lg shadow-sm">
                                                <div className="flex justify-between items-center mb-3">
                                                    <h3 className="text-base font-semibold text-gray-700">Low Stock Alert</h3>
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
                                                                        <td className="py-2 px-3 text-right text-gray-600">{product.base_stock || 0} {product.unit_config?.level_1_name || 'Unit'}</td>
                                                                        <td className="py-2 px-3 text-center text-gray-600">
                                                                            {(product.base_stock || 0) === 0 ? (
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
                                    <div className="p-3">
                                        <div className="bg-white p-3 rounded-lg shadow-sm">
                                            <div className="flex justify-between items-center mb-3">
                                                <h2 className="text-xl font-semibold text-gray-800">Sales History</h2>
                                                <ClearDataButton 
                                                    onSuccess={handleDataCleared} 
                                                    activeTab={activeTab} // Pass the active tab
                                                />
                                            </div>
                                            
                                            {/* Add search bar for sales */}
                                            <div className="mb-3 relative">
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
                                                                        onClick={() => openReturnModal(sale)}
                                                                        className="bg-orange-600 hover:bg-orange-700 text-white p-2 rounded"
                                                                        title="Return / Refund"
                                                                    >
                                                                        <FaUndo size={16} />
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
                                ) : activeTab === 'returns' ? (
                                    <div className="p-3">
                                        <div className="bg-white p-3 rounded-lg shadow-sm">
                                            <div className="flex justify-between items-center mb-3">
                                                <h2 className="text-xl font-semibold text-gray-800">Returned / Refunded Sales</h2>
                                                <ClearDataButton 
                                                    onSuccess={handleDataCleared} 
                                                    activeTab={activeTab}
                                                />
                                            </div>

                                            <div className="mb-3 relative">
                                                <input
                                                    type="text"
                                                    placeholder="Search by return invoice or original sale..."
                                                    value={returnsSearchTerm}
                                                    onChange={(e) => setReturnsSearchTerm(e.target.value)}
                                                    className="w-full md:w-80 pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                                />
                                                <FaSearch className="absolute left-3 top-3 text-gray-500" />
                                            </div>

                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-gray-300 text-gray-800">
                                                        <tr>
                                                            <th className="px-6 py-3">Return Invoice</th>
                                                            <th className="px-6 py-3">Original Sale</th>
                                                            <th className="px-6 py-3">Date</th>
                                                            <th className="px-6 py-3">Items</th>
                                                            <th className="px-6 py-3">Refund</th>
                                                            <th className="px-6 py-3">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredReturnsData.map((returnTransaction) => (
                                                            <tr key={returnTransaction.id} className="border-b hover:bg-gray-50">
                                                                <td className="px-6 py-4 text-gray-700 font-medium">{returnTransaction.return_invoice_no}</td>
                                                                <td className="px-6 py-4 text-gray-700">Sale #{returnTransaction.original_sale_id}</td>
                                                                <td className="px-6 py-4 text-gray-700">{new Date(returnTransaction.date).toLocaleDateString()}</td>
                                                                <td className="px-6 py-4 text-gray-700">{returnTransaction.items.length}</td>
                                                                <td className="px-6 py-4 text-gray-700">Rs. {Number(returnTransaction.total_refunded || 0).toFixed(2)}</td>
                                                                <td className="px-6 py-4">
                                                                    <button
                                                                        onClick={() => handleViewReturnReceiptModal(returnTransaction)}
                                                                        className="bg-orange-600 hover:bg-orange-700 text-white p-2 rounded"
                                                                        title="View Return Receipt"
                                                                    >
                                                                        <FaUndo size={16} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>

                                                {filteredReturnsData.length === 0 && (
                                                    <div className="text-center py-8 text-gray-600">
                                                        {returnsSearchTerm ? 'No returned sales found matching your search.' : 'No refunded sales data available.'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : activeTab === 'inventory' ? (
                                    <div className="bg-white p-3 rounded-lg shadow-md">
                                        <div className="flex justify-between items-center mb-3">
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
                                                <button
                                                    onClick={() => {
                                                        resetCategoryForm();
                                                        setShowAddCategoryModal(true);
                                                    }}
                                                    className="px-4 py-2 bg-indigo-600 text-white rounded flex items-center hover:bg-indigo-700"
                                                >
                                                    <FaPlus className="mr-2" />
                                                    Add Category
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mb-4 flex gap-2">
                                            <button
                                                onClick={() => setInventorySubTab('products')}
                                                className={`px-3 py-1.5 rounded text-sm ${inventorySubTab === 'products' ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                            >
                                                Products
                                            </button>
                                            <button
                                                onClick={() => setInventorySubTab('categories')}
                                                className={`px-3 py-1.5 rounded text-sm ${inventorySubTab === 'categories' ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                            >
                                                Categories
                                            </button>
                                        </div>
                                        
                                        {inventorySubTab === 'products' ? (
                                        <>
                                        
                                        {/* Inventory filters */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-gray-600">
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
                                                            <td className="px-6 py-4 text-gray-700">{product.category_name || 'Uncategorized'}</td>
                                                            <td className="px-6 py-4 text-gray-700">Rs. {parseFloat((product.price_per_box || 0).toString()).toFixed(2)}</td>
                                                            <td className="px-6 py-4 text-gray-700">
                                                                <span className={`${(product.base_stock || 0) <= 5 ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                                                                    {product.base_stock || 0} {product.unit_config?.level_1_name || 'Unit'}
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
                                        </>
                                        ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-gray-300 text-gray-900">
                                                    <tr>
                                                        <th className="px-4 py-2">ID</th>
                                                        <th className="px-4 py-2">Category</th>
                                                        <th className="px-4 py-2">Unit Setup</th>
                                                        <th className="px-4 py-2">Created</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {categoriesData.map((category) => (
                                                        <tr key={category.id} className="border-b hover:bg-gray-50">
                                                            <td className="px-4 py-2 text-gray-700">{category.id}</td>
                                                            <td className="px-4 py-2 text-gray-700">{category.name}</td>
                                                            <td className="px-4 py-2 text-gray-700">
                                                                <span className="font-medium">{category.name}:</span>{' '}
                                                                {category.level_1_name}
                                                                {category.unit_levels >= 2 && category.level_2_name && (
                                                                    <span> &gt; {category.level_2_name}</span>
                                                                )}
                                                                {category.unit_levels >= 3 && category.level_3_name && (
                                                                    <span> &gt; {category.level_3_name}</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2 text-gray-700">
                                                                {category.created_at ? new Date(category.created_at).toLocaleDateString() : "&ndash;"}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>

                                            {categoriesData.length === 0 && (
                                                <div className="text-center py-4 text-gray-500">No categories found.</div>
                                            )}
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
                                                            <td className="px-6 py-4 text-gray-700">{product.category_name || 'Uncategorized'}</td>
                                                            <td className="px-6 py-4 text-gray-700">
                                                                <span className={`${product.base_stock <= 5 ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                                                                    {product.base_stock || 0}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-700">{product.unit_config?.level_1_name || 'Unit'}</td>
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
                {showAddCategoryModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-lg shadow-lg w-[95%] max-w-2xl max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-gray-800">Add Category</h3>
                                <button
                                    onClick={() => {
                                        setShowAddCategoryModal(false);
                                        resetCategoryForm();
                                    }}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    <FaTimes size={18} />
                                </button>
                            </div>

                            <div className="space-y-4 text-gray-700">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Category Name</label>
                                    <input
                                        type="text"
                                        value={categoryForm.name}
                                        onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
                                        className="w-full border rounded px-3 py-2"
                                        placeholder="e.g., Syrups, Tablets, General Items"
                                    />
                                </div>

                                <div className="border rounded-lg p-4 bg-gray-50">
                                    <h4 className="font-semibold text-gray-800 mb-3">Unit Setup</h4>
                                    <div className="mb-3">
                                        <label className="block text-sm font-medium mb-1">How many units does this product have?</label>
                                        <select
                                            value={categoryForm.unit_levels}
                                            onChange={(e) => setCategoryForm((prev) => ({ ...prev, unit_levels: Number(e.target.value) }))}
                                            className="w-full border rounded px-3 py-2"
                                        >
                                            <option value={1}>1</option>
                                            <option value={2}>2</option>
                                            <option value={3}>3</option>
                                        </select>
                                    </div>

                                    {categoryForm.unit_levels === 1 && (
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Level 1 Name (Unit Name)</label>
                                            <input
                                                type="text"
                                                value={categoryForm.level_1_name}
                                                onChange={(e) => setCategoryForm((prev) => ({ ...prev, level_1_name: e.target.value }))}
                                                className="w-full border rounded px-3 py-2"
                                                placeholder="e.g., Bottle"
                                            />
                                        </div>
                                    )}

                                    {categoryForm.unit_levels === 2 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Level 1 Name (Main Unit)</label>
                                                <input
                                                    type="text"
                                                    value={categoryForm.level_1_name}
                                                    onChange={(e) => setCategoryForm((prev) => ({ ...prev, level_1_name: e.target.value }))}
                                                    className="w-full border rounded px-3 py-2"
                                                    placeholder="e.g., Box"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Level 2 Name (Sub Unit)</label>
                                                <input
                                                    type="text"
                                                    value={categoryForm.level_2_name}
                                                    onChange={(e) => setCategoryForm((prev) => ({ ...prev, level_2_name: e.target.value }))}
                                                    className="w-full border rounded px-3 py-2"
                                                    placeholder="e.g., Vial"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium mb-1">Units in Level 1 (how many Level 2 units per Level 1)</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={categoryForm.conversion_1_to_2}
                                                    onChange={(e) => setCategoryForm((prev) => ({ ...prev, conversion_1_to_2: e.target.value }))}
                                                    className="w-full border rounded px-3 py-2"
                                                    placeholder="e.g., 10"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {categoryForm.unit_levels === 3 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Level 1 Name</label>
                                                <input
                                                    type="text"
                                                    value={categoryForm.level_1_name}
                                                    onChange={(e) => setCategoryForm((prev) => ({ ...prev, level_1_name: e.target.value }))}
                                                    className="w-full border rounded px-3 py-2"
                                                    placeholder="e.g., Box"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Level 2 Name</label>
                                                <input
                                                    type="text"
                                                    value={categoryForm.level_2_name}
                                                    onChange={(e) => setCategoryForm((prev) => ({ ...prev, level_2_name: e.target.value }))}
                                                    className="w-full border rounded px-3 py-2"
                                                    placeholder="e.g., Strip"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Level 3 Name</label>
                                                <input
                                                    type="text"
                                                    value={categoryForm.level_3_name}
                                                    onChange={(e) => setCategoryForm((prev) => ({ ...prev, level_3_name: e.target.value }))}
                                                    className="w-full border rounded px-3 py-2"
                                                    placeholder="e.g., Tablet"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Units in Level 1 (how many Level 2 units per Level 1)</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={categoryForm.conversion_1_to_2}
                                                    onChange={(e) => setCategoryForm((prev) => ({ ...prev, conversion_1_to_2: e.target.value }))}
                                                    className="w-full border rounded px-3 py-2"
                                                    placeholder="e.g., 10"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium mb-1">Units in Level 2 (how many Level 3 units per Level 2)</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={categoryForm.conversion_2_to_3}
                                                    onChange={(e) => setCategoryForm((prev) => ({ ...prev, conversion_2_to_3: e.target.value }))}
                                                    className="w-full border rounded px-3 py-2"
                                                    placeholder="e.g., 10"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 mt-5">
                                <button
                                    onClick={() => {
                                        setShowAddCategoryModal(false);
                                        resetCategoryForm();
                                    }}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddCategory}
                                    disabled={isSubmittingCategory}
                                    className={`px-4 py-2 text-white rounded ${isSubmittingCategory ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                >
                                    {isSubmittingCategory ? 'Saving...' : 'Save Category'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

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
                        productToEdit={editingProduct as any}
                        editModeOnly={!!editingProduct}
                    />
                )}

                {/* StockModals Component */}
                {(showStockModal || showAddStockModal) && (
                    <StockModals 
                        showStockModal={showStockModal}
                        showAddStockModal={showAddStockModal}
                        setShowStockModal={setShowStockModal}
                        setShowAddStockModal={setShowAddStockModal}
                        productToStock={stockProduct as any}
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

                {viewReturnReceipt && selectedReturnTransaction && (
                    <ReceiptModal
                        items={convertReturnItemsToCartItems(selectedReturnTransaction)}
                        discount={0}
                        calculateSubtotal={() => calculateReturnReceiptSubtotal(selectedReturnTransaction)}
                        calculateTotal={() => calculateReturnReceiptTotal(selectedReturnTransaction)}
                        handlePrint={handlePrint}
                        onClose={() => {
                            setViewReturnReceipt(false);
                            setSelectedReturnTransaction(null);
                        }}
                        saveSale={dummySaveReturnReceipt}
                        orderNumber={selectedReturnTransaction.return_invoice_no}
                        receiptTitle="Return Receipt"
                        orderLabel="Return Invoice #"
                        linkedSaleNumber={selectedReturnTransaction.original_sale_id.toString()}
                        primaryActionLabel="Print Return Receipt"
                    />
                )}

                {/* Return / Refund Modal */}
                {isReturnModalOpen && returnSaleData && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg w-[900px] max-h-[85vh] overflow-hidden shadow-lg">
                            <div className="bg-orange-600 text-white p-4 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-bold">Return / Refund</h3>
                                    <p className="text-sm opacity-95">Sale #{returnSaleData.id} | {new Date(returnSaleData.date).toLocaleString()}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setIsReturnModalOpen(false);
                                        setReturnSaleData(null);
                                        setReturnQuantities({});
                                    }}
                                    className="text-white hover:text-red-200"
                                >
                                    <FaTimes size={20} />
                                </button>
                            </div>

                            <div className="p-4 overflow-y-auto max-h-[60vh]">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 text-gray-700">
                                        <tr>
                                            <th className="px-4 py-2">Item</th>
                                            <th className="px-4 py-2">Sold Qty</th>
                                            <th className="px-4 py-2">Boxes</th>
                                            <th className="px-4 py-2">Strips</th>
                                            <th className="px-4 py-2">Tablets</th>
                                            <th className="px-4 py-2">Return Qty (Base)</th>
                                            <th className="px-4 py-2 text-right">Refund</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {returnSaleData.items.map((saleItem) => {
                                            const key = getReturnItemKey(returnSaleData.id, saleItem.product_id);
                                            const qty = returnQuantities[key] || { boxQty: 0, stripQty: 0, tabletQty: 0 };
                                            const returnQtyBase = getReturnQtyBase(saleItem);

                                            return (
                                                <tr key={key} className="border-b">
                                                    <td className="px-4 py-2 text-gray-700">{saleItem.name}</td>
                                                    <td className="px-4 py-2 text-gray-700">{formatBaseQty(getSaleItemQuantity(saleItem), saleItem)}</td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={qty.boxQty}
                                                            onChange={(e) => updateReturnQty(saleItem, 'boxQty', parseInt(e.target.value || '0'))}
                                                            className="w-20 border rounded px-2 py-1 text-gray-700"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={qty.stripQty}
                                                            onChange={(e) => updateReturnQty(saleItem, 'stripQty', parseInt(e.target.value || '0'))}
                                                            className="w-20 border rounded px-2 py-1 text-gray-700"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={qty.tabletQty}
                                                            onChange={(e) => updateReturnQty(saleItem, 'tabletQty', parseInt(e.target.value || '0'))}
                                                            className="w-20 border rounded px-2 py-1 text-gray-700"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2 text-gray-700">{returnQtyBase}</td>
                                                    <td className="px-4 py-2 text-right text-gray-700">Rs. {getReturnRefundAmount(saleItem).toFixed(2)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="border-t p-4 flex justify-between items-center bg-gray-50">
                                <p className="text-lg font-semibold text-gray-800">
                                    Total Refund Amount: <span className="text-orange-600">Rs. {totalRefundAmount.toFixed(2)}</span>
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setIsReturnModalOpen(false);
                                            setReturnSaleData(null);
                                            setReturnQuantities({});
                                        }}
                                        className="px-4 py-2 rounded bg-gray-300 text-gray-700 hover:bg-gray-400"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={submitReturn}
                                        disabled={isSubmittingReturn}
                                        className={`px-4 py-2 rounded text-white ${isSubmittingReturn ? 'bg-orange-300 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700'}`}
                                    >
                                        {isSubmittingReturn ? 'Processing...' : 'Submit Return'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
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