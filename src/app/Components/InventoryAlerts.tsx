"use client";

import React, { useState, useMemo } from 'react';
import { FaTrash, FaEdit, FaPlus, FaExclamationTriangle, FaCalendarTimes, FaPrint, FaFileExport, FaSearch } from 'react-icons/fa';
import * as XLSX from 'xlsx';

interface ProductData {
  id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
  defaultQty: number;
  photo: string;
  expiry_date?: string;
}

interface InventoryAlertsProps {
  productData: ProductData[];
  onAddStock: (product: ProductData) => void;
  onEditProduct: (product: ProductData) => void;
  onDeleteProduct: (productId: string) => void;
}

const InventoryAlerts: React.FC<InventoryAlertsProps> = ({
  productData,
  onAddStock,
  onEditProduct,
  onDeleteProduct
}) => {
  const [activeSection, setActiveSection] = useState<'outOfStock' | 'expired' | 'expiringSoon'>('outOfStock');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Prepare filtered product lists
  const outOfStockProducts = useMemo(() => {
    return productData.filter(product => product.stock <= 0)
      .filter(product => 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.id.toString().includes(searchTerm)
      );
  }, [productData, searchTerm]);

  const currentDate = new Date();
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(currentDate.getDate() + 30);

  const expiredProducts = useMemo(() => {
    return productData.filter(product => {
      if (!product.expiry_date) return false;
      const expiryDate = new Date(product.expiry_date);
      return expiryDate <= currentDate;
    }).filter(product => 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.id.toString().includes(searchTerm)
    );
  }, [productData, searchTerm, currentDate]);

  const expiringSoonProducts = useMemo(() => {
    return productData.filter(product => {
      if (!product.expiry_date) return false;
      const expiryDate = new Date(product.expiry_date);
      return expiryDate > currentDate && expiryDate <= thirtyDaysLater;
    }).filter(product => 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.id.toString().includes(searchTerm)
    );
  }, [productData, searchTerm, currentDate, thirtyDaysLater]);

  // Handle export to Excel
  const handleExport = () => {
    try {
      let dataToExport: any[] = [];
      let filename = '';

      if (activeSection === 'outOfStock') {
        dataToExport = outOfStockProducts.map(product => ({
          ID: product.id,
          Name: product.name,
          Category: product.category,
          Price: `Rs. ${product.price.toFixed(2)}`,
          Stock: product.stock,
          Unit: product.unit
        }));
        filename = 'out-of-stock-products.xlsx';
      } else if (activeSection === 'expired') {
        dataToExport = expiredProducts.map(product => ({
          ID: product.id,
          Name: product.name,
          Category: product.category,
          Price: `Rs. ${product.price.toFixed(2)}`,
          'Expiry Date': product.expiry_date ? new Date(product.expiry_date).toLocaleDateString() : 'N/A',
          Stock: product.stock,
          Unit: product.unit
        }));
        filename = 'expired-products.xlsx';
      } else {
        dataToExport = expiringSoonProducts.map(product => ({
          ID: product.id,
          Name: product.name,
          Category: product.category,
          Price: `Rs. ${product.price.toFixed(2)}`,
          'Expiry Date': product.expiry_date ? new Date(product.expiry_date).toLocaleDateString() : 'N/A',
          'Days Until Expiry': product.expiry_date ? 
            Math.ceil((new Date(product.expiry_date).getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)) : 
            'N/A',
          Stock: product.stock,
          Unit: product.unit
        }));
        filename = 'expiring-soon-products.xlsx';
      }

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data');
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Inventory Alerts</h2>
        <button 
          onClick={handleExport}
          className="px-4 py-2 bg-teal-600 text-white rounded flex items-center hover:bg-teal-700"
        >
          <FaFileExport className="mr-2" />
          Export List
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b mb-6">
        <button 
          className={`py-2 px-4 mr-1 ${activeSection === 'outOfStock' 
            ? 'bg-teal-600 text-white rounded-t-lg' 
            : 'text-gray-600 hover:text-teal-600'}`}
          onClick={() => setActiveSection('outOfStock')}
        >
          <div className="flex items-center">
            <FaExclamationTriangle className="mr-2" />
            Out of Stock ({outOfStockProducts.length})
          </div>
        </button>
        <button 
          className={`py-2 px-4 mr-1 ${activeSection === 'expired' 
            ? 'bg-red-600 text-white rounded-t-lg' 
            : 'text-gray-600 hover:text-red-600'}`}
          onClick={() => setActiveSection('expired')}
        >
          <div className="flex items-center">
            <FaCalendarTimes className="mr-2" />
            Expired Products ({expiredProducts.length})
          </div>
        </button>
        <button 
          className={`py-2 px-4 ${activeSection === 'expiringSoon' 
            ? 'bg-amber-500 text-white rounded-t-lg' 
            : 'text-gray-600 hover:text-amber-500'}`}
          onClick={() => setActiveSection('expiringSoon')}
        >
          <div className="flex items-center">
            <FaCalendarTimes className="mr-2" />
            Expiring Soon ({expiringSoonProducts.length})
          </div>
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6 relative text-gray-700">
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <FaSearch className="absolute left-3 top-3 text-black" />
      </div>

      {/* Product Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
              {(activeSection === 'expired' || activeSection === 'expiringSoon') && (
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry Date</th>
              )}
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {(activeSection === 'outOfStock' ? outOfStockProducts : 
              activeSection === 'expired' ? expiredProducts : expiringSoonProducts).map((product) => (
              <tr key={product.id} className={activeSection === 'expired' ? 'bg-red-50' : 
                activeSection === 'expiringSoon' ? 'bg-yellow-50' : ''}>
                <td className="px-4 py-2 whitespace-nowrap text-gray-700">{product.id}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center">
                    {product.photo && (
                      <img src={product.photo} alt={product.name} className="h-8 w-8 mr-2 object-cover rounded" />
                    )}
                    <div>
                      <div className="font-medium text-gray-900">{product.name}</div>
                      {product.description && (
                        <div className="text-sm text-gray-500">{product.description}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2 text-gray-700">{product.category || 'Uncategorized'}</td>
                <td className="px-4 py-2 text-gray-700">Rs. {product.price.toFixed(2)}</td>
                <td className="px-4 py-2 text-gray-700">
                  <span className={product.stock <= 0 ? 'text-red-600 font-bold' : ''}>
                    {product.stock} {product.unit}
                  </span>
                </td>
                {(activeSection === 'expired' || activeSection === 'expiringSoon') && (
                  <td className="px-4 py-2 text-gray-700">
                    {product.expiry_date ? new Date(product.expiry_date).toLocaleDateString() : 'N/A'}
                  </td>
                )}
                <td className="px-4 py-2 ">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onAddStock(product)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Add Stock"
                    >
                      <FaPlus className="inline" />
                    </button>
                    <button
                      onClick={() => onEditProduct(product)}
                      className="text-green-600 hover:text-green-900"
                      title="Edit Product"
                    >
                      <FaEdit className="inline" />
                    </button>
                    <button
                      onClick={() => onDeleteProduct(product.id.toString())}
                      className="text-red-600 hover:text-red-900"
                      title="Delete Product"
                    >
                      <FaTrash className="inline" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty State */}
        {((activeSection === 'outOfStock' && outOfStockProducts.length === 0) ||
          (activeSection === 'expired' && expiredProducts.length === 0) ||
          (activeSection === 'expiringSoon' && expiringSoonProducts.length === 0)) && (
          <div className="text-center py-10">
            <FaExclamationTriangle size={40} className="mx-auto text-red-600 mb-4" />
            <p className="text-gray-700 text-lg">
              {searchTerm ? 'No products found matching your search.' : 'No products in this category.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryAlerts;