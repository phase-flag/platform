import { useState, useRef } from 'react'

interface TooltipProps {
    text: string
    children: React.ReactNode
}

export default function Tooltip({ text, children }: TooltipProps) {
    const [visible, setVisible] = useState(false)
    const containerRef = useRef<HTMLSpanElement>(null)

    return (
        <span
            ref={containerRef}
            className="relative inline-flex items-center"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
            onFocus={() => setVisible(true)}
            onBlur={() => setVisible(false)}
        >
            {children}

            {visible && (
                <span
                    role="tooltip"
                    className="
                        absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                        z-[9999] w-max max-w-[220px]
                        bg-gray-900 text-white text-xs leading-snug
                        px-2.5 py-1.5 rounded-lg border border-gray-700 shadow-xl
                        pointer-events-none
                    "
                >
                    {text}
                    {/* Arrow */}
                    <span
                        className="
                            absolute top-full left-1/2 -translate-x-1/2
                            border-4 border-transparent border-t-gray-900
                        "
                    />
                </span>
            )}
        </span>
    )
}
