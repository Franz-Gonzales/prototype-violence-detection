import React, { memo } from 'react';

const Card = memo(({ children, className = '', shadow = 'sm', padding = 'md', ...props }) => {
    const shadowStyles = {
        none: 'shadow-none',
        sm: 'shadow-sm',
        md: 'shadow',
        lg: 'shadow-lg',
    };

    const paddingStyles = {
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
    };

    return (
        <div
            className={`bg-white rounded-lg ${shadowStyles[shadow]} ${paddingStyles[padding]} ${className}`}
            role="region"
            {...props}
        >
            {children}
        </div>
    );
});

export default Card;