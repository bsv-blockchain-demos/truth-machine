import { IconOk, IconPending, IconFail, IconLoading } from './icons'

export type NoticeTone = 'success' | 'pending' | 'error' | 'loading'

export interface NoticeValue {
    tone: NoticeTone
    title: string
    message: string
    action?: { label: string; onClick: () => void }
}

// Outcome is never carried by colour alone: each tone pairs a distinct icon with a worded title.
const VARIANT: Record<NoticeTone, string> = { success: 'ok', pending: 'pending', error: 'fail', loading: 'loading' }
const ICON = { success: IconOk, pending: IconPending, error: IconFail, loading: IconLoading }

export default function Notice({ tone, title, message, action }: NoticeValue) {
    const Icon = ICON[tone]
    return (
        <div className={`tm-notice tm-notice--${VARIANT[tone]}`} role={tone === 'error' ? 'alert' : 'status'}
            aria-live={tone === 'error' ? 'assertive' : 'polite'}>
            <span className="tm-notice__i"><Icon /></span>
            <div>
                <p className="tm-notice__t">{title}</p>
                <p className="tm-notice__b">{message}</p>
                {action && <button type="button" className="tm-action" onClick={action.onClick}>{action.label}</button>}
            </div>
        </div>
    )
}
