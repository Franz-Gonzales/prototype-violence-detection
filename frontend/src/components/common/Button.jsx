import React from 'react';

function Button({ children, variant = 'primary', className = '', icon, onClick, disabled, ...props }) {
    const baseStyles = 'inline-flex items-center justify-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

    const variantStyles = {
        primary: 'border-transparent bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
        secondary: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-primary-500',
        danger: 'border-transparent bg-danger-600 text-white hover:bg-danger-700 focus:ring-danger-500',
        success: 'border-transparent bg-success-600 text-white hover:bg-success-700 focus:ring-success-500',
    };

    const styles = `${baseStyles} ${variantStyles[variant]} ${className}`;

    return (
        <button
            className={styles}
            onClick={onClick}
            disabled={disabled}
            {...props}
        >
            {icon && <span className="mr-2">{icon}</span>}
            {children}
        </button>
    );
}

export default Button;