"use client";

import React, { useState, useEffect } from 'react';
import { FaCheckCircle, FaTimesCircle, FaExclamationCircle, FaTimes } from 'react-icons/fa';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <FaCheckCircle className="text-green-500 text-xl mr-2" />;
      case 'error':
        return <FaTimesCircle className="text-red-500 text-xl mr-2" />;
      case 'info':
        return <FaExclamationCircle className="text-blue-500 text-xl mr-2" />;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-100 border-green-500';
      case 'error':
        return 'bg-red-100 border-red-500';
      case 'info':
        return 'bg-blue-100 border-blue-500';
    }
  };

  return (
    <div className={`fixed top-4 right-4 flex items-center p-4 rounded-lg shadow-lg border-l-4 ${getBackgroundColor()} animate-fade-in z-50`}>
      {getIcon()}
      <p className="text-gray-700">{message}</p>
      <button onClick={onClose} className="ml-4 text-gray-500 hover:text-gray-700">
        <FaTimes />
      </button>
    </div>
  );
};

export default Toast;