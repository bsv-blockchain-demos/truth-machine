import type { ReactNode } from 'react'

// One 24x24 grid, 2px-ish rounded stroke, currentColor. Decorative by default:
// every icon in this app sits beside a worded label, so none of them carry meaning alone.
function Glyph({ size = 18, className, children }: { size?: number; className?: string; children: ReactNode }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
            {children}
        </svg>
    )
}

export function IconOk({ size }: { size?: number }) {
    return <Glyph size={size}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.6 2.6L16 9.5" /></Glyph>
}

export function IconPending({ size }: { size?: number }) {
    return <Glyph size={size}><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></Glyph>
}

export function IconFail({ size }: { size?: number }) {
    return <Glyph size={size}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.4v.2" /></Glyph>
}

export function IconLoading({ size }: { size?: number }) {
    return <Glyph size={size}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></Glyph>
}

export function IconNone({ size }: { size?: number }) {
    return <Glyph size={size}><circle cx="12" cy="12" r="9" /></Glyph>
}

export function IconCopy({ size }: { size?: number }) {
    return <Glyph size={size}><rect x="9" y="9" width="11" height="11" rx="1" /><path d="M15 5H5v10" /></Glyph>
}

export function IconExternal({ size }: { size?: number }) {
    return <Glyph size={size}><path d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5" /></Glyph>
}

export function IconUpload({ size }: { size?: number }) {
    return <Glyph size={size}><path d="M12 17V5M7.5 9.5L12 5l4.5 4.5" /><path d="M5 19h14" /></Glyph>
}

export function IconMinus({ size }: { size?: number }) {
    return <Glyph size={size}><path d="M6 12h12" /></Glyph>
}

export function IconPlus({ size }: { size?: number }) {
    return <Glyph size={size}><path d="M12 6v12M6 12h12" /></Glyph>
}

export function IconThemeLight({ size }: { size?: number }) {
    return <Glyph size={size}><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.5 1.5M18.3 18.3l1.5 1.5M2.5 12h2M19.5 12h2M4.2 19.8l1.5-1.5M18.3 5.7l1.5-1.5" /></Glyph>
}

export function IconThemeAuto({ size }: { size?: number }) {
    return <Glyph size={size}><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" /></Glyph>
}

export function IconThemeDark({ size }: { size?: number }) {
    return <Glyph size={size}><path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.6 6.6 0 0 0 9.7 9.7z" /></Glyph>
}

export function IconChevron({ size = 13, className }: { size?: number; className?: string }) {
    return <Glyph size={size} className={className}><path d="M9 6l6 6-6 6" /></Glyph>
}

export function IconLock({ size = 13 }: { size?: number }) {
    return <Glyph size={size}><rect x="4.5" y="10.5" width="15" height="9.5" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></Glyph>
}

export function IconFile({ size = 15 }: { size?: number }) {
    return <Glyph size={size}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></Glyph>
}

// Approximation of the BSV Association triangle mark. Replace with the official
// asset when one is available; nothing else depends on this shape.
export function IconBsvMark({ size = 13 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 4.2 21.4 19.8H2.6z" />
        </svg>
    )
}

export function IconGitHub({ size = 22 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
        </svg>
    )
}
