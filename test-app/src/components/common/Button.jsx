import React, { memo } from 'react';

const Button = memo(({ children, variant = 'primary', size = 'md', className = '', icon, onClick, disabled, type = 'button', ...props }) => {
    const baseStyles = 'inline-flex items-center justify-center border rounded-md shadow-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

    const variantStyles = {
        primary: 'border-transparent bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
        secondary: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-primary-500',
        danger: 'border-transparent bg-danger-600 text-white hover:bg-danger-700 focus:ring-danger-500',
        success: 'border-transparent bg-success-600 text-white hover:bg-success-700 focus:ring-success-500',
        outline: 'border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50 focus:ring-primary-500',
    };

    const sizeStyles = {
        sm: 'px-2 py-1 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base',
    };

    const styles = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

    return (
        <button
            className={styles}
            onClick={onClick}
            disabled={disabled}
            type={type}
            aria-disabled={disabled}
            {...props}
        >
            {icon && <span className="mr-2">{icon}</span>}
            {children}
        </button>
    );
});

export default Button;