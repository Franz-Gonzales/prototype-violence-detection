import React from 'react';

function Card({ children, className = '', ...props }) {
    return (
        <div className={`bg-white shadow rounded-lg p-6 ${className}`} {...props}>
            {children}
        </div>
    );
}

export default Card;